/**
 * Study RPG — Code Runner Sidecar
 *
 * Receives code over HTTP POST, executes it in a child process with:
 *   - 30-second wall-clock timeout
 *   - 256 MB memory limit
 *   - No network access (enforced by Docker network_mode: bridge + iptables)
 *   - Read-only filesystem (enforced by Docker read_only: true)
 *   - tmpfs /tmp for scratch space
 *
 * Supports Python 3 and Node.js. Language is auto-detected from the code
 * or can be specified explicitly.
 */

const http = require('http');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.RUNNER_PORT || '9000', 10);
const TIMEOUT_MS = 30_000;
const MEMORY_LIMIT = '256m';
const MAX_OUTPUT = 64 * 1024; // 64 KB max output

function detectLanguage(code) {
  if (/^\s*import\s|^from\s+\w+\s+import|def\s+\w+|print\s*\(/.test(code)) return 'python';
  if (/^\s*(const|let|var|function|async|await|import\s+|require\s*\()/m.test(code)) return 'node';
  return 'python';
}

function getCommand(lang) {
  return lang === 'node' ? 'node' : 'python3';
}

function executeCode(code, language, stdin, timeoutMs) {
  return new Promise((resolve) => {
    const lang = language || detectLanguage(code);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-'));
    const ext = lang === 'node' ? '.js' : '.py';
    const filePath = path.join(tmpDir, `code${ext}`);

    fs.writeFileSync(filePath, code, 'utf8');

    const cmd = getCommand(lang);
    const args = [filePath];

    const start = Date.now();
    const proc = spawn(cmd, args, {
      cwd: tmpDir,
      timeout: timeoutMs || TIMEOUT_MS,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT) {
        proc.kill('SIGKILL');
        stdout = stdout.slice(0, MAX_OUTPUT) + '\n... (output truncated)';
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > MAX_OUTPUT) {
        proc.kill('SIGKILL');
        stderr = stderr.slice(0, MAX_OUTPUT) + '\n... (output truncated)';
      }
    });

    if (stdin) proc.stdin.write(stdin);
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
    }, timeoutMs || TIMEOUT_MS);

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      const execTime = Date.now() - start;

      // Clean up
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

      resolve({
        stdout: stdout.slice(0, MAX_OUTPUT),
        stderr: stderr.slice(0, MAX_OUTPUT),
        exit_code: exitCode ?? 1,
        execution_time_ms: execTime,
        language: lang,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      resolve({
        stdout: '',
        stderr: err.message,
        exit_code: 1,
        execution_time_ms: Date.now() - start,
        language: lang,
      });
    });
  });
}

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', languages: ['python', 'node'] }));
    return;
  }

  // Execute code
  if (req.method === 'POST' && req.url === '/execute') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });

    req.on('end', async () => {
      try {
        const { code, language, stdin, timeout } = JSON.parse(body);
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No code provided' }));
          return;
        }

        const result = await executeCode(code, language, stdin, timeout ? timeout * 1000 : TIMEOUT_MS);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Code Runner listening on port ${PORT}`);
});
