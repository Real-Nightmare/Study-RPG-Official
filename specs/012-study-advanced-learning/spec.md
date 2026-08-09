# Feature Specification: Study RPG Advanced Learning

**Feature Branch**: `012-study-advanced-learning`

**Created**: 2026-08-06

**Status**: Draft

**Input**: Authorized from the owner's master prompt PDF Phase 8 (Advanced Learning) and
`docs/implementation/MASTER_PLAN.md` §4: wire AI-built programmes and the AI reviewer into
learning paths, programme templates, and a batch review workflow with review history. Exam clone,
problem solver and teach-back evaluation are already shipped (verified present) — this spec
completes the advanced-learning loop by connecting the programme layer (owner brief fractions 5 & 6)
to personal learning paths.

## User Scenarios & Testing

### User Story 1 — Programme → Learning Path (Priority: P1)

A student joins an active AI-built programme (e.g. Revision Centre) and one-click turns it into a
**personal learning path**: the AI converts the programme's objectives and milestones into ordered
study steps (study / quiz / practice / review) the student can complete and track. The learning path
remembers which programme it came from, and the programme card shows a "Start learning path" action.

**Why this priority**: This is the phase's core promise — AI-built programmes stop being passive
content and become actionable study plans, the same study-first loop the owner demanded.

**Independent Test**: Generate a learning path from a programme and verify the steps, the
programme link, and completion tracking.

**Acceptance Scenarios**:

1. **Given** an active programme with objectives/milestones, **When** a member requests a learning
   path from it, **Then** an AI-built path with ordered steps of types study/quiz/practice/review is
   created and linked to the programme (`programme_id` set).
2. **Given** a generated path, **When** a step is completed, **Then** progress updates and the path
   can be completed like any other learning path.
3. **Given** a non-existent or non-active programme, **When** a user requests a path from it,
   **Then** the request is rejected.

### User Story 2 — Programme templates (Priority: P1)

Admins publish **programme templates** (Revision Centre, Competency Based Testing, Exam Sprint,
custom) that describe the shape of a good programme. Any user can **suggest from a template**: the
AI builds the full programme from the template outline instead of from a blank idea — higher-quality
suggestions with less noise.

**Why this priority**: Templates raise the floor of every AI-built programme and give admins a
curation lever; they also make the Revision Centre / Competency Based Testing programmes the owner
asked for first-class.

**Independent Test**: List templates, create one as admin, suggest a programme from a template, and
verify the AI build uses the template.

**Acceptance Scenarios**:

1. **Given** published templates, **When** a user lists them, **Then** only active templates are
   returned (no admin drafts).
2. **Given** an admin creates/updates/deletes a template, **When** the action completes,
   **Then** it is written to `programme_templates` and audited with a reason.
3. **Given** a user suggests from a template, **When** the AI builds the programme,
   **Then** the result is live immediately, exactly like a normal suggestion.

### User Story 3 — Batch review + review history (Priority: P2)

Admins see a **review queue** (suggested/building/active programmes with no AI verdict yet, or
flagged as low-score), and can **batch review**: accept/reject many at once with one reason each.
Every review — AI or admin — appends to the programme's **review history**, visible in the UI, so
teachers can verify the admin is not cheating and no programme is judged invisibly.

**Why this priority**: It completes the owner's "AI reviewer + admin override, visible to teachers"
story (brief fraction 6) with the transparency the audit requirement demands.

**Independent Test**: Seed programmes without reviews, batch-review them, and verify the queue drains
and history records both AI and admin reviews.

**Acceptance Scenarios**:

1. **Given** programmes without an AI review verdict, **When** the admin opens the review queue,
   **Then** they are listed with their AI score (if any).
2. **Given** selected programmes in the queue, **When** the admin batch-reviews them,
   **Then** each gets a verdict + reason, is audited, and appends to its review history.
3. **Given** a programme's review history, **When** the detail view is opened,
   **Then** every review event (verdict, score, reasons, reviewer, time) is shown.

### User Story 4 — AI review of generated paths (Priority: P3)

After a programme generates a learning path, the AI **reviews the path** (quality score + reasons)
before it is saved; low-quality generations are still saved (students can always study) but flagged
so the user can regenerate.

**Why this priority**: Keeps the study-first constitution — a bad path must never block studying,
but a visibly-flagged weak path invites regeneration.

**Independent Test**: Generate a path, verify it carries a review verdict + score, and that weak
paths are saved with a flag.

**Acceptance Scenarios**:

1. **Given** a generated path, **When** generation completes, **Then** the path carries a
   `review { verdict, score, reasons }` from the AI.
2. **Given** a weak generated path (low score), **When** it is saved, **Then** it is saved with a
   low-score flag and the UI offers regeneration.

## Edge Cases

- Template suggestions fall back to the normal build prompt if the AI fails (programme still goes
  live with a safe default outline).
- Batch review with an empty selection is a no-op (400).
- Review history is capped at the 50 most recent events per programme.
- A programme can only generate a learning path when `status = 'active'`.
- Path generation records study-activity hooks (step completion drives learning-path progress only).

## Requirements

### Functional Requirements

- **FR-001**: `POST /programmes/:id/learning-path` generates a personal AI learning path linked to
  the programme (`learning_paths.programme_id`); only active programmes; steps of type
  study/quiz/practice/review with estimated minutes.
- **FR-002**: `programme_templates` table + admin CRUD (audited, reason required) + public list;
  templates have kind, name, description, and a JSON outline the AI build prompt consumes.
- **FR-003**: `POST /programmes/suggest-from-template` builds a programme from a template outline
  via the AI, same lifecycle as a normal suggestion (building → active), audited.
- **FR-004**: `GET /programmes/review-queue` (admin) lists programmes lacking an AI verdict or with
  a low score; `POST /programmes/batch-review` accepts/rejects a list with reasons, audited per item.
- **FR-005**: Every review (AI or admin) appends to `programmes.review_history` (JSONB array, capped
  at 50); the detail view returns the full history.
- **FR-006**: AI-generated learning paths carry a `review` JSONB (verdict, score, reasons);
  low-score paths are saved with a `needsRegeneration` flag.
- **FR-007**: All new tables/columns land in one migration `026_study_advanced.sql` with a unique
  prefix after `025`.

### Key Entities

- **ProgrammeTemplate**: id, name, description, kind (custom / revision_centre /
  competency_testing / exam_sprint), outline JSONB, active, created_by, timestamps.
- **LearningPath.programmeId**: nullable FK back to the source programme (with programme name).
- **Programme.reviewHistory**: JSONB array of review events (verdict, score, reasons, reviewer,
  reviewedAt).
- **LearningPath.review**: JSONB with verdict/score/reasons + `needsRegeneration` flag.

## Success Criteria

- **SC-001**: Programme → learning path generation works for any active programme and links back.
- **SC-002**: Templates can be created/listed/instantiated; template suggestions go live.
- **SC-003**: The review queue and batch review work and every action is audited with a reason.
- **SC-004**: Review history is visible per programme, capped, and includes AI + admin events.
- **SC-005**: Backend build + full test suite green; frontend `tsc -b --noEmit` clean.

## Assumptions

- Exam clone, problem solver and teach-back are already complete (verified in earlier phases); this
  spec only adds the programme ↔ learning-path loop.
- Templates are authored by admins (teachers can view); students only instantiate.
- AI review of generated paths is best-effort: if the AI call fails, the path saves without a review
  (flag = false) and the UI never blocks studying.
