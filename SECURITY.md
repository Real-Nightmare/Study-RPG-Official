# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest  | ✅ |

Only the most recent release receives security fixes. Upgrade promptly.

## Reporting a Vulnerability

Security matters here — please report privately, not through public issues.

### How to report

Email **security@studyrpg.app** with:

- The kind of issue (SQL injection, XSS, auth bypass, SSRF, privilege escalation, ...)
- File paths of the affected source
- The commit/tag where the problem lives
- Any special configuration needed to reproduce it
- Step-by-step reproduction steps
- A proof-of-concept or exploit sketch, if you have one

### What happens next

- **Acknowledgment** within 48 hours.
- **Initial assessment** within 5 business days.
- **Critical fixes** targeted within 30 days of disclosure.
- We coordinate with you on public disclosure timing.

### Safe harbour

We will not pursue legal action against researchers who:

- Act in good faith and avoid harming users or destroying data,
- Only touch accounts they own or have explicit permission to test,
- Do not use an issue beyond verifying it, and
- Report promptly after discovery.

## Hardening checklist for self-hosters

1. **Secrets**: never commit `.env` files; copy `.env.example` and fill it in.
2. **JWT**: set strong unique `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (≥32 chars) in production.
3. **Data stores**: strong passwords; keep PostgreSQL, Redis, Qdrant and ClickHouse off the public network.
4. **TLS**: HTTPS everywhere in production.
5. **Updates**: keep the platform and its dependencies current.
6. **Uploads**: enforce size limits and validate file types.
7. **CORS**: scope `CORS_ORIGINS` to your own frontend domain.
8. **Ocean marketplace** (if enabled): never configure a funded wallet on an untrusted host.

## Dependencies

[Dependabot](https://github.com/dependabot) monitors our dependencies for known
vulnerabilities and opens automated PRs when a fix is published.
