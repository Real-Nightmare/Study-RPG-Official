#!/usr/bin/env node
/**
 * Studyield smoke load tester (PDF Phase 9 ops deliverable).
 *
 * Lightweight fetch-based tester — not a full k6 suite. Hits one URL with a
 * fixed concurrency for a fixed duration and reports requests/sec + p50/p95.
 *
 * Usage:
 *   node scripts/load-test.mjs --url http://localhost:3000/api/health
 *   node scripts/load-test.mjs --url http://localhost:3000/api/health \
 *       --concurrency 20 --duration 15
 *
 * Env fallbacks: LOAD_TEST_URL, LOAD_TEST_CONCURRENCY, LOAD_TEST_DURATION.
 * Requires Node.js >= 18 (global fetch).
 */

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const url = arg('url', process.env.LOAD_TEST_URL || 'http://localhost:3000/api/health');
const concurrency = Math.max(1, Number(arg('concurrency', process.env.LOAD_TEST_CONCURRENCY || '10')) || 10);
const durationSec = Math.max(1, Number(arg('duration', process.env.LOAD_TEST_DURATION || '15')) || 15);

const start = Date.now();
const endAt = start + durationSec * 1000;
const latencies = [];
let completed = 0;
let failed = 0;
let inFlight = 0;

async function worker() {
  while (Date.now() < endAt) {
    const t0 = Date.now();
    inFlight += 1;
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
      latencies.push(Date.now() - t0);
      completed += 1;
      if (!res.ok) {
        failed += 1;
      }
    } catch {
      latencies.push(Date.now() - t0);
      failed += 1;
    } finally {
      inFlight -= 1;
    }
  }
}

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

console.log(`Target: ${url}`);
console.log(`Concurrency: ${concurrency}  Duration: ${durationSec}s`);
console.log('Running…');

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const elapsed = (Date.now() - start) / 1000;
const sorted = [...latencies].sort((a, b) => a - b);
const rps = elapsed > 0 ? completed / elapsed : 0;

console.log('\n--- Results ---');
console.log(`Requests completed : ${completed}`);
console.log(`Requests failed    : ${failed}`);
console.log(`Requests/sec       : ${rps.toFixed(1)}`);
console.log(`p50 latency        : ${pct(sorted, 50)} ms`);
console.log(`p95 latency        : ${pct(sorted, 95)} ms`);
console.log(`Max latency        : ${sorted[sorted.length - 1] ?? 0} ms`);

process.exit(failed > 0 ? 2 : 0);
