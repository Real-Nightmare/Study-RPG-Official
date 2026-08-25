/**
 * c2d-runner server — hardened local compute-to-data + code sandbox runner.
 *
 * Zero-dependency HTTP sidecar. Two endpoints:
 *
 *   GET  /health    → { ok: true }
 *
 *   POST /execute   { language, code, stdin?, timeout? }        (code sandbox contract)
 *                   → { stdout, stderr, execution_time_ms, memory_used_bytes }
 *                     (matches backend/src/modules/code-sandbox expectations)
 *
 *   POST /c2d/run   { language, code, data, timeout }           (compute-to-data contract)
 *                   → { status, stdout, stderr, exitCode, executionTimeMs }
 *
 *     The sanitized dataset JSON arrives as `data`; the runner pipes it to the
 *     algorithm's stdin. Researcher algorithms therefore read stdin and write
 *     results to stdout — the same contract a buyer's compute job gets.
 *
 * Hardening model (enforced here + in docker-compose.yml):
 *   - container has NO outbound network route (compose `internal` network),
 *   - read-only root filesystem; each job gets a fresh tmpfs-style temp dir,
 *   - child processes: no shell, wall-clock kill, output caps, PID cap via
 *     compose pids_limit, non-root user, no capabilities.
 *
 * This process never evaluates code in its own context.
 */

'use strict';

const http = require('http');
const { spawn } = require('child_process');
const { mkdtemp, rm, writeFile } = require('fs/promises');
const { tmpdir } = require('os');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.RUNNER_PORT || 9000);
const MAX_OUTPUT_BYTES = Number(process.env.RUNNER_MAX_OUTPUT_BYTES || 1_000_000);
const DEFAULT_TIMEOUT_S = 20;
const MAX_TIMEOUT_S = 120;
const MAX_BODY_BYTES = 4_000_000;

// Language allowlist: command + file extension. No shell is ever involved.
const LANGUAGES = {
  python: { cmd: 'python3', ext: '.py' },
  javascript: { cmd: 'node', ext: '.js' },
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Execute one job inside an isolated temp directory. Resolves with the
 * result object; never throws for job-level failures.
 */
async function runJob({ language, code, stdin, timeout }) {
  const lang = LANGUAGES[String(language || '').toLowerCase()];
  const timeoutS = Math.max(1, Math.min(MAX_TIMEOUT_S, Number(timeout) || DEFAULT_TIMEOUT_S));
  if (!lang) {
    return {
      status: 'error',
      stdout: '',
      stderr: `Unsupported language "${language}". Allowed: ${Object.keys(LANGUAGES).join(', ')}.`,
      exitCode: null,
      executionTimeMs: null,
    };
  }
  if (typeof code !== 'string' || !code.trim()) {
    return {
      status: 'error',
      stdout: '',
      stderr: 'No code provided.',
      exitCode: null,
      executionTimeMs: null,
    };
  }

  const dir = await mkdtemp(path.join(tmpdir(), `job-${crypto.randomUUID().slice(0, 8)}-`));
  try {
    const file = path.join(dir, `main${lang.ext}`);
    // Write with mode 0o600 — only the unprivileged runner user can read it.
    await writeFile(file, code, { encoding: 'utf8', mode: 0o600 });

    const started = Date.now();
    return await new Promise((resolve) => {
      const child = spawn(lang.cmd, [file], {
        cwd: dir,
        env: {
          PATH: process.env.PATH,
          HOME: dir,
          LANG: 'C.UTF-8',
          PYTHONDONTWRITEBYTECODE: '1',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        // No shell, default signal handling; the compose policy supplies the
        // heavy isolation (no network, read-only fs, caps dropped).
      });

      let stdout = '';
      let stderr = '';
      let truncated = false;
      let settled = false;

      const killTimer = setTimeout(() => {
        // Wall-clock kill: SIGKILL directly — untrusted code gets no grace.
        child.kill('SIGKILL');
      }, timeoutS * 1000);

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(killTimer);
        resolve(result);
      };

      child.stdout.on('data', (d) => {
        if (stdout.length < MAX_OUTPUT_BYTES) stdout += d.toString('utf8');
        else if (!truncated) {
          truncated = true;
          stdout += '\n[output truncated]';
          child.stdout.destroy();
        }
      });
      child.stderr.on('data', (d) => {
        if (stderr.length < MAX_OUTPUT_BYTES) stderr += d.toString('utf8');
        else if (!truncated) {
          truncated = true;
          stderr += '\n[output truncated]';
          child.stderr.destroy();
        }
      });

      child.on('error', (err) => {
        finish({
          status: 'error',
          stdout,
          stderr: `${stderr}Failed to start runtime: ${err.message}`.slice(0, MAX_OUTPUT_BYTES),
          exitCode: null,
          executionTimeMs: Date.now() - started,
        });
      });

      child.on('close', (exitCode, signal) => {
        const timedOut = signal === 'SIGKILL';
        finish({
          status: timedOut ? 'timeout' : exitCode === 0 ? 'success' : 'error',
          stdout,
          stderr: timedOut ? `${stderr}\n[job killed after ${timeoutS}s wall clock]`.trim() : stderr,
          exitCode,
          executionTimeMs: Date.now() - started,
        });
      });

      // Feed stdin (dataset payload / user stdin), then close the pipe.
      child.stdin.on('error', () => {
        /* EPIPE if the program does not read stdin — harmless */
      });
      if (stdin != null && stdin !== '') child.stdin.write(String(stdin));
      child.stdin.end();
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'GET' && (url === '/health' || url === '/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method not allowed' }));
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(req, MAX_BODY_BYTES));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON body' }));
    return;
  }

  if (url === '/execute') {
    // Code-sandbox contract: {stdout, stderr, execution_time_ms}
    const r = await runJob({
      language: body.language || 'python',
      code: body.code,
      stdin: body.stdin ?? '',
      timeout: body.timeout ?? DEFAULT_TIMEOUT_S,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        stdout: r.stdout,
        stderr: r.stderr,
        execution_time_ms: r.executionTimeMs,
        memory_used_bytes: null,
      }),
    );
    return;
  }

  if (url === '/c2d/run') {
    // Compute-to-data contract: dataset JSON on stdin → result object.
    const r = await runJob({
      language: body.language || 'python',
      code: body.code,
      stdin: body.data ?? '',
      timeout: body.timeout ?? DEFAULT_TIMEOUT_S,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(r));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[c2d-runner] listening on :${PORT} (network-isolated compute environment)`);
});
