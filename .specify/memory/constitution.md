<!--
Sync Impact Report (initial ratification):
- Version change: n/a → 1.0.0 (template placeholder file first filled with project content)
- Ratified from AGENTS.md Golden Rules, repository conventions, and the owner's master brief.
-->

# Studyield / Study RPG Constitution

## Core Principles

### I. Study-First Success (NON-NEGOTIABLE)
Studying is the success metric. The RPG layer — cards, battles, factions, economy, leaderboards —
is a *celebration of study*, never the goal. Students MUST associate studying with success, not
study-to-get-something. Every reward MUST be gated on meaningful study activity with anti-farming
caps, and the student dashboard MUST keep its `hide-game-stats` toggle so the game layer can be
hidden entirely.

### II. Verified Truth Over Claims
Never claim a feature works because a route or page exists. No fake completion: only report
tests/builds actually run, with exact commands and outcomes. Read `docs/audits/` first, verify
against code, and never assume the README is accurate.

### III. Raw SQL, No ORM
The backend is NestJS 10 + TypeScript with raw SQL via `pg`. Features MUST follow the existing
module layout (`backend/src/modules/<feature>/` with module/controller/service + `dto/` + `index.ts`
barrel + registration in `app.module.ts`). DTOs MUST be enforced with class-validator
(`forbidNonWhitelisted`) and the camelCase response interceptor MUST be kept.

### IV. Complete i18n & UI Conventions
The frontend is React 19 + Vite + Tailwind + Radix (shadcn-style components under
`src/components/ui`). Every user-facing string MUST be added to ALL 15 locale files (nav + page
namespace). Reuse existing component patterns, Zustand stores, and API clients under `src/services`.

### V. Migration Discipline
New migrations MUST follow `NNN_name.sql` in `backend/migrations/`, with unique prefixes ordered
sequentially from the current max. Order-preserving letter suffixes (e.g. `002b`) are permitted only
when a numeric slot is already taken. Never renumber or reuse existing prefixes.

### VI. Licence & Original IP (AGPL-3.0)
The root `LICENSE` (AGPL-3.0) is the single source of truth; all metadata MUST stay aligned per
ADR-0001. All Study RPG characters, card names, lore, and artwork MUST be original — no copyrighted
characters/artwork from The Amazing Digital Circus or any other third party.

### VII. Security & Secrets
Never commit `.env*` files; use `.env.example` templates; never read or print existing secrets.
Every admin mutation MUST require a reason and write an `audit_logs` row. Admin surfaces MUST be
role-gated (admins mutate; teachers may read audit logs).

### VIII. Tests & Definition of Done
Backend: Jest unit tests (`npm test`). Frontend: Vitest + Testing Library beside source. Definition
of Done: typechecks and builds pass for touched packages, lint passes on touched files, tests pass,
new env vars are reflected in `.env.example`, `IMPLEMENTATION_STATUS.md` is updated, and
licence-affecting decisions are recorded in `docs/architecture/decisions/`.

## Specification Workflow (GitHub Spec Kit)

- All new features MUST be authored spec-first under `specs/<NNN>-<name>/` (spec.md → plan.md →
  data-model/contracts → tasks.md), created and updated via the `/speckit.*` skills
  (constitution, specify, plan, tasks, clarify, analyze, checklist, implement, converge).
- Tooling lives in `.specify/` (templates, scripts, workflows). Do not hand-edit generated files;
  templates resolve through `.specify/templates/` (project overrides → presets → extensions → core).
- Use the `specify` CLI (`uv tool install specify-cli`) for init, upgrade, extensions, and presets.
- The owner's master prompt (`Studyield Master Implementation Prompt.pdf`) and its translation in
  `docs/implementation/MASTER_PLAN.md` remain the source of truth for PDF phase mapping; specs
  SHOULD reference the PDF phase they belong to.
- Legacy OpenSpec artifacts are archived under `archive/openspec/` — do not create new openspec
  changes; new work goes through Spec Kit specs.

## Governance

- This constitution supersedes ad-hoc development practices. Amendments MUST be documented and
  versioned: MAJOR for principle removals/redefinitions, MINOR for new principles or materially
  expanded guidance, PATCH for clarifications and wording.
- Compliance is reviewed as part of every PR review: spec-first for new features, DoD checks
  enforced, complexity must be justified.
- `AGENTS.md` remains the runtime operating guide for agents; this constitution is the governing
  principles document both reference.

**Version**: 1.0.0 | **Ratified**: 2026-08-06 | **Last Amended**: 2026-08-06
