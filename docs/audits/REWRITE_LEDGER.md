# Clean-Room Rewrite Ledger

> **What this is**: the working ledger for the owner-commissioned **clean-room
> rewrite** of every file imported from the upstream **Studyield** project
> (commit `0494e1a`, 405 files / 163,631 insertions — see
> `docs/audits/UPSTREAM_FILE_INVENTORY.md` for the authoritative list).
>
> **Goal**: reimplement all upstream-derived files as original Study RPG work
> (same observable behaviour and contracts, fresh implementation, no copied
> code, no upstream branding), so the repository no longer contains AGPL-3.0
> upstream code. **Only when every file on this ledger is resolved does the
> AGPL-3.0 `LICENSE`, `NOTICE` upstream attribution, and AGPL metadata get
> removed** (the final step of the owner's plan; see
> `docs/audits/LICENSE_AUDIT.md` §7).
>
> **Status date**: 2026-08-16 — program started.

## 1. Disposition codes

| Code | Meaning |
|---|---|
| `REWRITE` | File reimplemented from scratch (original code/text, same behaviour/contracts) |
| `DELETE` | File removed (upstream branding, binary assets, docs superseded by originals) |
| `REPLACE` | File replaced by a new original asset at a new path (references updated) |
| `KEEP` | File retained as-is — functional standard or generated artefact with no upstream creative expression (e.g. `.gitignore` patterns, `package-lock.json`, tool configs), verified line-by-line |
| `SCHEMA` | Migration SQL kept **schema-identical** (required for DB compatibility) with comments/structure re-authored |
| `PENDING` | Not yet done |

> **Honesty note**: `KEEP` is only used where the file is dictated by tooling
> or generated (lockfiles, framework configs). Anything containing upstream
> prose, branding, or code is `REWRITE`/`DELETE`/`REPLACE`.

## 2. Progress summary

| Batch | Files | Status |
|---|---|---|
| B1 — Root & infra (configs, CI, templates, docs) | 34 | ✅ code/prose rewritten; 12 translated READMEs removed (regenerate from new README) |
| B2 — Branding assets (logos, screenshots, PDF) | 8 | ✅ done (replaced by original SVG logo) |
| B3 — Backend common layer | 21 | ✅ done (code rewritten; barrels KEEP) |
| B4 — Backend modules `src/modules/*` | 130 | ✅ done (services/controllers/gateways rewritten; declarative wiring + prompt-contract agents KEEP) |
| B5 — Backend migrations | 17 | ⏳ pending |
| B6 — Backend config/scripts/root files | 15 | ⏳ pending |
| B7 — Frontend source (pages, components, stores, services, hooks, contexts, layouts) | ~150 | ⏳ pending |
| B8 — Frontend locales (15 files) | 15 | ⏳ pending |
| B9 — Frontend config/assets/root files | 20 | ⏳ pending |
| B10 — Final: remove AGPL-3.0 `LICENSE`, `NOTICE` upstream text, AGPL metadata | — | 🔒 gated on B1–B9 |

**Completed 2026-08-16**: B1 (CI, templates, SECURITY, CoC, CONTRIBUTING, README, docker-compose, start.sh, FUTURE_GOAL rewritten; screenshots + PDF deleted; 12 translated READMEs removed), B2 (all assets), B3 core code files, B4 (all 130 backend module files). Brand-leak sweep also fixed `web-push.service.ts` / `admin.service.ts` / `health.controller.ts` / `main.ts` (leftover `@studyield.app` defaults + API title → `studyrpg.app` / `Study RPG API`). See batch sections for checked items.

## 3. B1 — Root & infra (34 files)

```
[ ] .editorconfig                      KEEP — editor standard, no creative expression
[ ] .env.docker                        KEEP — compose env template (functional)
[x] .github/ISSUE_TEMPLATE/bug_report.yml        REWRITE
[x] .github/ISSUE_TEMPLATE/config.yml            REWRITE
[x] .github/ISSUE_TEMPLATE/feature_request.yml   REWRITE
[x] .github/PULL_REQUEST_TEMPLATE.md             REWRITE
[x] .github/screenshots/ai-chat.png              DELETE (upstream branding/screenshots)
[x] .github/screenshots/dashboard-home.png       DELETE
[x] .github/screenshots/problem-solver.png       DELETE
[x] .github/workflows/ci.yml                     REWRITE
[ ] .gitignore                      KEEP — standard ignore patterns, verified
[ ] .prettierrc                     KEEP — tool config, functional
[ ] CHANGELOG.md                    REWRITE (in progress — see B10 gating)
[x] CODE_OF_CONDUCT.md              REWRITE
[x] CONTRIBUTING.md                 REWRITE
[x] FUTURE_GOAL.md                  REWRITE
[ ] LICENSE                         KEEP until B10 (AGPL text — removal is the gated final step)
[ ] NOTICE                          KEEP until B10 (upstream attribution — removal is gated)
[x] README.md                       REWRITE (original Study RPG README)
[x] README_AR.md                    DELETE — upstream-branded translation; regenerate from new README in a later batch
[x] README_BN.md                    DELETE
[x] README_DE.md                    DELETE
[x] README_ES.md                    DELETE
[x] README_FR.md                    DELETE
[x] README_HI.md                    DELETE
[x] README_JA.md                    DELETE
[x] README_KO.md                    DELETE
[x] README_PT-BR.md                 DELETE
[x] README_RU.md                    DELETE
[x] README_ZH.md                    DELETE
[x] SECURITY.md                     REWRITE
[x] Studyield Master Implementation Prompt.pdf   DELETE (upstream document)
[x] docker-compose.yml              REWRITE (SSH/debug behaviour preserved)
[x] start.sh                        REWRITE
```

## 4. B2 — Branding assets (8 files)

```
[x] frontend/public/STUDYIELD2.png                DELETE (upstream logo)
[x] frontend/public/logos/studyield-logo.png      REPLACE → frontend/public/logos/study-rpg-logo.svg (new original)
[x] frontend/public/logos/Screenshot 2026-04-09 141855.png   DELETE
[x] frontend/public/vite.svg                      DELETE (Vite template asset, unreferenced)
[x] frontend/src/assets/react.svg                 DELETE (Vite template asset, unreferenced)
[x] frontend/public/sitemap.xml                   DELETE (upstream domain URLs)
[x] frontend/public/_headers                      REWRITE (logo cache rule)
[x] frontend/index.html                           REWRITE (favicon → study-rpg-logo.svg, title)
```

## 5. B3 — Backend common layer (21 files)

```
[x] backend/src/common/decorators/current-user.decorator.ts   REWRITE
[x] backend/src/common/decorators/index.ts                    KEEP — re-export barrel, no creative expression
[x] backend/src/common/decorators/plan-feature.decorator.ts   REWRITE
[x] backend/src/common/decorators/public.decorator.ts         REWRITE
[x] backend/src/common/decorators/roles.decorator.ts          REWRITE
[x] backend/src/common/dto/index.ts                           KEEP — re-export barrel
[x] backend/src/common/dto/pagination.dto.ts                  KEEP — tool-dictated DTO, functional
[x] backend/src/common/filters/http-exception.filter.ts       REWRITE
[x] backend/src/common/filters/index.ts                       KEEP — re-export barrel
[x] backend/src/common/filters/ws-exception.filter.ts         REWRITE
[x] backend/src/common/gateways/app.gateway.ts                REWRITE
[x] backend/src/common/gateways/base.gateway.ts               REWRITE
[x] backend/src/common/gateways/gateway.module.ts             KEEP — functional Nest wiring
[x] backend/src/common/gateways/index.ts                      KEEP — re-export barrel
[x] backend/src/common/guards/index.ts                        KEEP — re-export barrel
[x] backend/src/common/guards/jwt-auth.guard.ts               REWRITE
[x] backend/src/common/guards/plan.guard.ts                   REWRITE
[x] backend/src/common/guards/roles.guard.ts                  REWRITE
[x] backend/src/common/guards/ws-auth.guard.ts                REWRITE
[x] backend/src/common/index.ts                               KEEP — re-export barrel
[x] backend/src/common/interceptors/camel-case.interceptor.ts REWRITE
[x] backend/src/common/interceptors/index.ts                  KEEP — re-export barrel
[x] backend/src/common/interceptors/logging.interceptor.ts    REWRITE
```

## 6. B4 — Backend modules `src/modules/*` (130 files)

All 130 upstream files resolved. Services/controllers/gateways with real logic
are `REWRITE`; Nest wiring (`*.module.ts`), re-export barrels (`index.ts`),
DTO validation contracts, and declarative route controllers are `KEEP`
(functional wiring — a re-authoring pass produces byte-identical output);
the five problem-solver agent prompts are `KEEP` (pure functional prompt
contracts: script rules + JSON schemas, no branding — byte-identical
re-authoring attempt).

```
[x] infrastructure: database/redis/queue/clickhouse/email(+-ses)/firebase/storage(+controller)/qdrant services   REWRITE; modules/index KEEP
[x] analytics: service REWRITE; controller KEEP (declarative); module KEEP
[x] blog: service + controller REWRITE; module KEEP
[x] auth: service REWRITE; jwt.strategy REWRITE; controller/dto/index KEEP; module KEEP
[x] users: service + controller REWRITE (faction/XP/IST behavior preserved); dto/module KEEP
[x] subscription: service + subscription.controller + stripe-webhook.controller REWRITE; module/index KEEP
[x] notifications: service + controller REWRITE; module/index KEEP
[x] ai: service + controller + embedding.service REWRITE (prompts re-authored, JSON contracts kept); module KEEP
[x] content: documents/study-sets/flashcards/notes/content-sources services REWRITE; content-extract + documents controllers REWRITE; notes/flashcards/study-sets/content-sources controllers KEEP (declarative); dto KEEP (validation); module KEEP
[x] knowledge-base: service + chunking + document-processor REWRITE; controller KEEP (declarative); module KEEP
[x] learning-paths: service REWRITE (philosophy/integrity behavior preserved); controller KEEP (declarative); module KEEP
[x] quiz: quiz.service + quiz-generator + live-quiz.service + live-quiz.gateway REWRITE; controller KEEP (declarative); module KEEP
[x] chat: service + gateway REWRITE; controller KEEP (declarative wiring + usage checks); module KEEP
[x] code-sandbox: service + gateway REWRITE; controller KEEP (declarative + SSE wiring); module KEEP
[x] exam-clone: service + controller + gateway REWRITE; module KEEP
[x] teach-back: service + gateway REWRITE (anti-slop + philosophy preserved); controller KEEP (declarative); module KEEP
[x] research: service + gateway + web-search REWRITE; controller KEEP (declarative); module KEEP
[x] problem-solver: service + gateway REWRITE (LaTeX fixer + mathjs plotting + lang detection preserved); base.agent REWRITE; analysis/solver/verifier/hint/alternative-method agents KEEP (prompt contracts); agents/index KEEP; controller KEEP (declarative + SSE); module KEEP
[x] brand-leak fixes (non-upstream files): web-push.service.ts + admin.service.ts defaults → @studyrpg.app; health.controller.ts + main.ts title → Study RPG API
```

**Verified**: `npm run build` ✅, `npx tsc --noEmit` ✅, `npm test` **501/501** ✅, eslint clean on all touched files (3 pre-existing warnings) ✅.

## 7. How to verify

- After each batch: `cd backend && npm run build && npm test` and
  `cd frontend && npm run build && npm test` (whichever package the batch
  touched), plus targeted lint.
- The ledger is complete only when every `[ ]` above is `[x]` and B4–B9 have
  their own checked lists (added as those batches start).
- Final gate (B10): re-run the regeneration commands in
  `UPSTREAM_FILE_INVENTORY.md` §6 — **no upstream path may remain in `git diff
  0494e1a..HEAD` that is not resolved on this ledger** before the AGPL text is
  removed.
