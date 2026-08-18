# Contributing to Study RPG

Thanks for helping build Study RPG! This guide covers how to contribute
cleanly and consistently.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

### Reporting bugs

Open a [Bug Report](https://github.com/Real-Nightmare/Study-RPG-Official/issues/new?template=bug_report.yml) with:

- A clear description of the issue
- Steps to reproduce
- Expected vs actual behaviour
- Environment details (OS, Node version, browser, device)
- Logs or screenshots where useful

### Suggesting features

Open a [Feature Request](https://github.com/Real-Nightmare/Study-RPG-Official/issues/new?template=feature_request.yml) with:

- The problem you want to solve
- The use case and motivation
- A suggested approach (optional)

### Submitting pull requests

1. Fork the repository.
2. Create a branch from `main`: `git checkout -b feat/your-change`.
3. Make focused changes.
4. Run the checks below.
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
6. Push and open a PR against `main`.

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)
- Redis 7+ (or Docker)
- Qdrant and ClickHouse (optional, used by RAG and analytics)

### Quick start (Docker infra + local dev servers)

```bash
# Start infrastructure only
docker compose --env-file .env.docker up -d postgres redis qdrant clickhouse

# Backend
cd backend
cp .env.example .env        # then fill in credentials
npm install
npm run migrate
npm run start:dev

# Frontend (second terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

### One-command start

```bash
./start.sh
```

### Project layout

```
backend/                NestJS API (raw SQL via pg — no ORM)
  src/common/           Guards, interceptors, decorators, filters, gateways
  src/modules/          Feature modules (auth, content, rpg, economy, ...)
  migrations/           Versioned SQL migrations
frontend/               React 19 + Vite + Tailwind + Radix UI
  src/pages/            Route pages
  src/components/       Shared and feature components
  src/services/         API clients
  src/stores/           Zustand stores
  src/locales/          i18n (15 locales)
docs/                   Architecture, getting-started, runbooks, audits
specs/                  Feature specs (Spec Kit)
```

## Adding translations

Study RPG supports 15 languages; translation PRs are welcome.

1. Copy `frontend/src/locales/en.json` to a new file (`fr.json`).
2. Translate the values — **keep the keys unchanged** (code depends on them).
3. Register the locale in the i18n config and language switcher.
4. When adding keys, add them to **every** locale file to keep parity.

## Code style

- TypeScript across backend and frontend.
- Prettier for formatting, ESLint for linting.
- Backend: NestJS module layout, raw SQL, camelCase response interceptor in
  mind (DTOs enforced via class-validator with `forbidNonWhitelisted`).
- Frontend: shadcn-style Radix components, Zustand stores, TanStack Query,
  i18n via locale files.
- Follow the Study RPG philosophy: depth over length, mastery over
  memorisation, health-first (see `docs/STUDY_RPG_PHILOSOPHY.md`).

## Checking your work

```bash
# Backend
cd backend
npm run build
npm run lint
npm test

# Frontend
cd frontend
npm run build
npm run lint
npm test
```

New features are authored spec-first via the Spec Kit workflow in `specs/`
(spec → plan → tasks → implementation).

## PR guidelines

- One focused change per PR.
- Describe what and why.
- Reference related issues ("Fixes #123").
- Add tests for new behaviour.
- Keep all CI checks green.

## Questions?

Open a [Discussion](https://github.com/Real-Nightmare/Study-RPG-Official/discussions)
or check the docs in `docs/`.
