# AGENTS.md — Operating Guide for AI Agents

> Phase 0 deliverable. This file tells AI coding agents how to work safely and effectively in this repository (Studyield — AI learning platform; evolving toward Study RPG).

## 1. Repo Shape (short version)

- **Two independent npm projects, no root package.json.**
  - `backend/` — NestJS 10 API, TypeScript, **raw SQL via `pg` (no ORM)**, custom migration runner (`scripts/migrate.js`, `npm run migrate`).
  - `frontend/` — React 19 + Vite 7 + Tailwind CSS + Radix UI; i18n with 15 locales; Zustand; TanStack Query; Socket.IO client.
- **Infra**: `docker-compose.yml` (PostgreSQL 15, Redis 7, Qdrant, ClickHouse, backend, frontend/nginx). `start.sh` bootstraps dev.
- **CI**: `.github/workflows/ci.yml` (lint + typecheck + build for both packages).

## 2. Golden Rules

1. **Read the audits first.** `docs/audits/INITIAL_REPOSITORY_AUDIT.md` and `docs/audits/LICENSE_AUDIT.md` contain the Phase 0 findings and open items. Do not contradict them without updating them.
2. **Do not assume the README is accurate.** The README overstates completeness (no tests exist, lint script is broken). Verify against code.
3. **Licence is AGPL-3.0 — single source of truth.** The root `LICENSE` is AGPL-3.0 and all metadata (package.json, NOTICE, READMEs, footer) is aligned to it per ADR-0001 (`docs/architecture/decisions/0001-licence-decision.md`). Do not replace with Apache/MIT or reintroduce Apache claims.
4. **Never claim a feature works because a route/page exists.** No automated tests exist. Runtime verification requires DB + AI credentials that may not be present.
5. **No fake completion.** Only report tests/builds you actually ran, with exact commands and outcomes.

## 3. Commands That Work Today

```bash
# Backend
cd backend && npm ci
cd backend && npm run build        # nest build — PASSES
cd backend && npm run lint         # PASSES (glob fixed in Phase 1)
cd backend && npm test             # PASSES (unit tests exist since Phase 1)
cd backend && npm run migrate      # needs a running Postgres (docker compose up postgres)

# Frontend
cd frontend && npm ci
cd frontend && npm run build       # tsc -b && vite build — PASSES (chunks split in Phase 1)
cd frontend && npm run lint        # 0 errors / 14 warnings (known)
cd frontend && npm test            # vitest run — PASSES (utils + component tests)
```

**Known**: frontend lint has 14 pre-existing warnings (0 errors); backend lint/tests pass since Phase 1; frontend tests pass since Phase 2 (Vitest).

## 4. Conventions to Follow

- **Backend**: follow existing NestJS module layout (`src/modules/<feature>/` with module/controller/service/entities). Raw SQL only — no ORM. Keep the camelCase response interceptor and validation pipe in mind (DTOs are enforced via class-validator with `forbidNonWhitelisted`). New core-tool modules follow the `planner/` pattern (dto/ + service + controller + module + `index.ts` barrel + registration in `app.module.ts`).
- **Frontend**: use existing component patterns (shadcn-style Radix components under `src/components/ui`), Zustand stores under `src/stores`, API clients under `src/services` (see `tasks.ts`), i18n via `src/locales/<locale>.json` (add keys to **all** locale files — nav + page namespace).
- **Frontend tests**: Vitest + jsdom + Testing Library (`vitest.config.ts`, `src/test/setup.ts`). Unit tests live beside source as `*.test.ts`; run `npm test` (vitest run).
- **Migrations**: new files follow `NNN_name.sql` in `backend/migrations/`. **Prefixes must be unique** (the Phase 0 collisions at 002/006/010 were fixed with `002b`/`006b`/`010b` suffixes in Phase 1). Number new migrations sequentially from the current max (015); if a letter-suffix slot is used, stay below it.
- **Secrets**: never commit `.env*` files; use `.env.example` templates. Do not read or print existing secrets.
- **Licence/IP**: no copyrighted characters/artwork from The Amazing Digital Circus or any third party — all Study RPG characters, names, lore, and art must be original.
- **Commits**: Conventional Commits; branch from `develop` when the workflow is active (currently single `main`).
- **Specs (GitHub Spec Kit)**: all new features are authored spec-first in `specs/<NNN>-<name>/` (`spec.md` → `plan.md` → `tasks.md`) via the `/speckit.*` skills (constitution, specify, plan, tasks, clarify, analyze, checklist, implement, converge); the project constitution lives at `.specify/memory/constitution.md`; tooling lives in `.specify/` (do not hand-edit generated files; templates resolve via `.specify/templates/`). The `specify` CLI is installed via `uv tool install specify-cli`. Legacy OpenSpec artifacts are archived under `archive/openspec/` — do not create new openspec changes.

## 5. Definition of Done

- Typechecks and builds pass for the touched package(s).
- Lint passes on touched files (backend: `npx eslint "src/**/*.ts"`; frontend: `npm run lint`).
- Tests pass for the touched package(s) (backend: `npm test`; frontend: `npm test`).
- New migrations have unique prefixes and are ordered correctly.
- No secrets introduced; `.env.example` updated for new env vars.
- `IMPLEMENTATION_STATUS.md` updated; licence-affecting decisions recorded in `docs/architecture/decisions/`.

## 6. Where Things Live

| Concern | Path |
|---------|------|
| Backend source | `backend/src/` (modules, common, types) |
| Migrations | `backend/migrations/` |
| Frontend source | `frontend/src/` (pages, components, services, stores, locales) |
| Frontend routes | `frontend/src/pages/` + router config |
| Infra | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` |
| CI | `.github/workflows/ci.yml` |
| Audits | `docs/audits/` |
| Architecture decisions | `docs/architecture/decisions/` (create as needed) |
| Status | `IMPLEMENTATION_STATUS.md` (root) |
| Specs (Spec Kit) | `specs/` (features) + `.specify/` (tooling, constitution at `.specify/memory/constitution.md`) |
| Archived OpenSpec | `archive/openspec/` |
