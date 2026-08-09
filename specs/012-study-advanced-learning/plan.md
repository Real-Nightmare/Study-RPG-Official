# Plan: Study RPG Advanced Learning (PDF Phase 8)

**Prerequisites**: spec.md (US1–US4), data-model (below), contracts (below).

## Design Overview

Phase 8 extends two existing modules — `ProgrammesModule` and `LearningPathsModule` — and adds one
migration. No new top-level module is required; the existing raw-SQL service conventions apply
(dto/service/controller/module + barrel, registration already present in `app.module.ts`).

### Architecture

```
┌─ ProgrammesModule ──────────────────────────────────────────────┐
│  providers:                                                     │
│   • ProgrammesService (extended)                                │
│      - template CRUD (admin, audited) + list (public)           │
│      - suggestFromTemplate (AI build from template outline)     │
│      - reviewQueue (no AI verdict | low score)                  │
│      - batchReview (audited per item)                           │
│      - review history: every review appends to review_history   │
│  imports: AiModule, AdminModule (AuditService)                  │
└─────────────────────────────────────────────────────────────────┘
┌─ LearningPathsModule ───────────────────────────────────────────┐
│  providers:                                                     │
│   • LearningPathsService (extended)                             │
│      - generateFromProgramme(userId, programmeId)               │
│        (AI: objectives+milestones → ordered steps + review)     │
│  imports: ProgrammesModule (to read programme + audit), AiModule│
└─────────────────────────────────────────────────────────────────┘
```

`LearningPathsModule` importing `ProgrammesModule` is safe (no cycle: ProgrammesModule does not
import LearningPathsModule).

### Migration `026_study_advanced.sql`

- `ALTER TABLE learning_paths ADD COLUMN programme_id UUID REFERENCES programmes(id) ON DELETE SET
  NULL;` + index.
- `CREATE TABLE programme_templates (id UUID PK, name VARCHAR(120), description TEXT, kind
  VARCHAR(40) DEFAULT 'custom', outline JSONB DEFAULT '{}', active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ, updated_at
  TIMESTAMPTZ);`
- `ALTER TABLE programmes ADD COLUMN review_history JSONB NOT NULL DEFAULT '[]';`
- Seed 3 templates: **Revision Centre** (kind revision_centre), **Competency Based Testing** (kind
  competency_testing), **Exam Sprint** (kind exam_sprint) — each with a concrete outline JSON
  (objectives + milestone shape + reward guidance).

### API (contracts)

- `GET /programmes/templates` — active templates for everyone.
- `POST /programmes/templates` (admin) `{ name, description?, kind?, outline?, reason }`.
- `PUT /programmes/templates/:id` (admin) `{ ...patch, reason }` · `DELETE /programmes/templates/:id`
  (admin) `{ reason }`.
- `POST /programmes/suggest-from-template` `{ templateId, hasFactions?, factionSize? }` → Programme.
- `GET /programmes/review-queue` (admin) — programmes lacking `review.verdict` or score < 50.
- `POST /programmes/batch-review` (admin) `{ items: [{ id, verdict, reason, score? }] }`.
- `POST /programmes/:id/learning-path` (member) → LearningPath (linked, reviewed).
- `GET /learning-paths` / `GET /learning-paths/:id` now include `programmeId` + `programmeName`.

### Frontend

- `config/api.ts`: template + review-queue + batch-review + from-programme endpoints.
- `services/programmes.ts`: templates list/create/update/delete, suggestFromTemplate, reviewQueue,
  batchReview; `services/learningPaths.ts`: `fromProgramme(id)`.
- `types/index.ts`: `ProgrammeTemplate`, `ProgrammeReviewEvent`, `ReviewQueueItem`, extended
  `LearningPath` (programmeId/programmeName/review/needsRegeneration).
- `ProgrammesPage`: templates strip (browse + instantiate), admin template manager, admin review
  queue tab with batch review, review history in the detail view, "Start learning path" button on
  active programmes.
- `LearningPathsPage`: shows programme badge on linked paths; regenerate action when
  `needsRegeneration`.
- Locale namespace `programmes` + `learningPaths` extended in all 15 locale files.

### Tests

Backend Jest unit tests: `programmes.service.spec.ts` additions (template CRUD + audited,
suggest-from-template fallback, review-queue filter, batch-review audit), `learning-paths` additions
(from-programme builds steps + review, non-active programme rejected). Pure helpers: a
`review-queue.ts` predicate module (unit-testable) and `path-review.ts` clamp helpers.
Definition of Done: backend build + full suite green, frontend `tsc -b --noEmit` clean,
`IMPLEMENTATION_STATUS.md` + `MASTER_PLAN.md` + `specs/README.md` updated.
