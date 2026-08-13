# Connector / Core-Tool Guide

Adding a new AI-powered "core tool" (a connector to an external model, search engine, code
runner, etc.)? Follow the `planner` module pattern — every new core-tool module should look
like it, so the codebase stays uniform.

## 1. Module skeleton

Create `backend/src/modules/<tool>/` with this shape:

```
<tool>/
  dto/
    <tool>.dto.ts        # request DTOs (class-validator)
  <tool>.module.ts       # @Module({ controllers: [...], providers: [...], exports: [...] })
  <tool>.controller.ts   # HTTP surface (@Controller('<tool>'))
  <tool>.service.ts      # business logic (raw SQL + external calls)
  index.ts               # barrel re-exporting the module
  <tool>.spec.ts         # unit tests beside the source
```

Register the barrel in `backend/src/app.module.ts` imports.

## 2. Conventions that must hold

- **Raw SQL only** — no ORM. Use the shared `database` module's pool.
- **DTOs enforced** — the global validation pipe runs `forbidNonWhitelisted`, so declare
  every accepted field with class-validator decorators and reject the rest.
- **camelCase responses** — the shared interceptor handles it; keep internal SQL aliases
  consistent with it.
- **Realtime?** — add a gateway (see `common/gateways/`) and reuse the shared CORS helper.
- **Secrets** — read env via `ConfigService` (or the validated Joi schema in `app.module.ts`),
  never hardcode keys; add new vars to `backend/.env.example`.
- **Migrations** — new tables go in `backend/migrations/NNN_<name>.sql`; prefixes must be
  unique and ordered after the current max.
- **AI keys** — pass provider keys through the `ai` module's client; don't roll your own
  HTTP to LLM endpoints unless you need a distinct provider shape.

## 3. Frontend consumption

- API client: add methods to a service in `frontend/src/services/` (see `tasks.ts`).
- State: server data via TanStack Query; ephemeral/optimistic state in a Zustand store under
  `frontend/src/stores/`.
- i18n: add user-facing strings to **all** locale files (nav + page namespace).
- Accessibility: buttons over clickable divs; if a div must be clickable, add
  `role="button"` + `tabIndex` + an Enter/Space `onKeyDown` (helper: `src/lib/a11y.ts`).

## 4. Spec-first

New features are authored spec-first in `specs/<NNN>-<name>/` (`spec.md` → `plan.md` →
`tasks.md`) via the Spec Kit skills. Ship the spec, then the implementation, then update
`IMPLEMENTATION_STATUS.md` and the `CHANGELOG`.
