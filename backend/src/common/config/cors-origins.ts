/**
 * CORS origin allowlist for HTTP (main.ts) and every Socket.IO gateway.
 *
 * Centralised so the HTTP API and all WebSocket namespaces share the same
 * security posture: an explicit comma-separated allowlist (`CORS_ORIGINS`)
 * with a local-dev fallback. Never reflects arbitrary origins with
 * credentials (audit finding S1).
 */

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3010',
  'http://localhost:5189',
  'http://127.0.0.1:5189',
];

/** Parse a comma-separated `CORS_ORIGINS` value into a trimmed, non-empty allowlist. */
export function parseCorsOrigins(envOrigins?: string): string[] {
  const configured = (envOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_CORS_ORIGINS;
}
