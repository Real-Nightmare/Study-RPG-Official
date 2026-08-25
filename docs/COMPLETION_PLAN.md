# Study RPG — Full Completion Plan (Zero Placeholders, Fully Local)

> **Goal**: Make Study RPG **fully playable end-to-end** with **zero placeholder code**, running entirely from `docker compose up` with **no required external services** and **no credit-card-gated accounts** — except optional cloud storage providers (multiple free, no-CC options supported).
>
> **Rules for every task below**
> 1. Working code only — if a feature ships, it ships complete (UI + API + DB + tests). No stubs, no "coming soon", no mock data left behind.
> 2. Everything that has a Docker image with equivalent functionality runs locally in `docker-compose.yml`.
> 3. External SaaS is allowed ONLY for storage providers — and there must be several free, no-credit-card options wired through one adapter.
> 4. Payments stay infrastructure-level only (limits/priority), disabled by default. Monetization design is deferred.
> 5. The game layer (characters, cards, battles, worlds) is complete: real art assets, real lore, no missing content.

---

## 0. Wave Status (updated as waves complete)

**Wave 1 + 2 core shipped (this pass):**

- ✅ T7 marketplace: `MARKETPLACE_ENABLED` off by default, **compute-to-data
  ONLY** (no download/access path, metadata-first fallback removed), PII
  value-scan, network access permanently disabled for compute jobs,
  network-isolated `c2d-runner` container + admin researcher test harness.
- ✅ T8 billing gate (`BILLING_ENABLED=false`, 404 surfaces).
- ✅ T1 Ollama chat + embeddings (OpenAI-compatible provider selection).
- ✅ T2 Mailpit SMTP transport (nodemailer).
- ✅ T3 MinIO default storage provider (+ R2 kept) behind one interface.
  *Open:* Supabase/Cloudinary/Appwrite adapters.
- ✅ T4 SearXNG default search provider.
- ✅ T5 local code execution via the hardened c2d-runner sidecar.
- ✅ T6 VAPID auto-provisioning; FCM demoted behind `FCM_ENABLED`.
- ✅ G11 README quickstart + `scripts/bootstrap.sh`.

**Still open:** game content wave (T9–T10 art/characters), rebrand sweep
(T11), zero-placeholder CI sweep (§4), rewrite batches B5–B10 (§5),
storage extra adapters, full clean-clone verification checklist (§7).

---

## 1. Current Gaps (audit summary)

| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| G1 | AI requires an OpenRouter API key to do anything useful (chat, quizzes, teach-back, campfire, programmes) | `ai.service.ts`, `.env.example` | 🔴 Blocker |
| G2 | Email requires AWS SES credentials | `email/ses.service.ts` | 🔴 Blocker |
| G3 | Push notifications reference Firebase/FCM credentials | `firebase/` module, SECURITY.md §6 | 🟠 Major |
| G4 | File storage has a single implementation; uploads need object storage | `storage/storage.service.ts` | 🔴 Blocker |
| G5 | Web search in Deep Research calls an external search API | `research/web-search.service.ts` | 🟠 Major |
| G6 | Code sandbox executes externally or not at all | `code-sandbox/` module | 🟠 Major |
| G7 | Ocean Protocol / C2D requires a funded Polygon wallet and external Ocean Node | `data-marketplace/marketplace-config.ts`, migration 030/031 | 🟡 Must be off by default |
| G8 | Placeholder contact email in `SECURITY.md` ("placeholder — replace with the real address") | SECURITY.md:17 | 🟡 Polish |
| G9 | Game characters/worlds/bosses lack built-in art assets and complete lore; rebranding sweep incomplete (B2 partially done, B7-B9 pending) | `frontend/public/logos/`, rpg module monsters, REWRITE_LEDGER B7–B9 | 🔵 Content |
| G10 | Clean-room rewrite batches B5–B10 still open (migrations, backend configs/scripts, frontend source, locales, frontend configs, final AGPL removal) | `docs/audits/REWRITE_LEDGER.md` | 🔵 Compliance |
| G11 | README does not describe a working zero-config local run | `README.md`, `start.sh` | 🟠 Major |

---

## 2. Fully-Local Service Architecture

Every capability gets a Docker-first default. Nothing below requires an account, key, or credit card.

```
docker-compose.yml additions
├── postgres        (exists)
├── redis           (exists)
├── qdrant          (exists)
├── clickhouse      (exists)
├── backend         (exists)
├── frontend/nginx  (exists)
├── ollama          NEW  — local LLM + embeddings (OpenAI-compatible API on :11434/v1)
├── searxng         NEW  — local meta web-search for Deep Research
├── mailpit         NEW  — local SMTP sink + web UI (replaces SES in dev/self-host)
├── minio           NEW  — S3-compatible local object storage (default storage provider)
└── code-runner     NEW  — hardened local code-execution sidecar (network-off container)
```

### T1 — Local LLM via Ollama (fixes G1) — **DONE**

- Added `ollama/ollama` service to compose (+ `ollama-init` that pulls the two
  models on first boot):
  - `qwen2.5:7b-instruct` (chat/quizzes/grading) — CPU-viable default
  - `nomic-embed-text` (embeddings, 768-dim)
- Backend speaks the OpenAI-compatible API: `AI_PROVIDER=openai-compatible`
  (default in docker env) → base URL `http://ollama:11434/v1`, model
  `qwen2.5:7b-instruct`, no API key. `openrouter` remains an optional upgrade
  path.
- Embeddings: `EMBEDDING_PROVIDER=ollama-compatible` selects the local
  endpoint with dimension 768; collection versioning handles index rebuilds
  when the embedding model changes (`CollectionResolver`).
- Reranker: `RERANKER_PROVIDER=ollama` available; default stays no-op.

### T2 — Local Email via Mailpit (fixes G2) — **DONE**

- Added `axllent/mailpit` service (SMTP :1025, UI :8025).
- New `SmtpService` (nodemailer) selected when `EMAIL_TRANSPORT=smtp` (the
  default); SES only when `EMAIL_TRANSPORT=ses` AND credentials exist.
- Docker default points at Mailpit — password-reset and verification emails
  land in Mailpit's web UI during local play.

### T3 — Local Object Storage via MinIO + multi-provider adapter (fixes G4)

This is the ONE area where external providers are permitted. Requirements: multiple providers, all free tier, none requiring a credit card, all behind one interface.

**Default (zero-config)**: MinIO in compose. Bucket auto-created by the
idempotent `minio-init` job (`mc mb studyrpg-uploads`).

**Implemented now**: provider switch `STORAGE_PROVIDER=minio | r2` behind the
existing `StorageService` surface (both are S3-compatible, so one client
serves them; MinIO uses path-style addressing). Switching provider is purely
an environment change. **Open item**: Supabase / Cloudinary / Appwrite
REST adapters (free-tier, no-card options) are still to be added as small
adapters behind the same interface — deliberately not stubbed in this wave.

### T4 — Local Web Search via SearXNG (fixes G5) — **DONE**

- Added `searxng/searxng` service (JSON format enabled in settings.yml).
- `web-search.service.ts` provider selection:
  `SEARCH_PROVIDER=searxng` (default) → `http://searxng:8080/search?q=…&format=json`;
  Tavily/Serper remain opt-in for hosted installs.

### T5 — Local Code Execution Sandbox (fixes G6) — **DONE**

- The `code-runner` role is filled by the same hardened `c2d-runner` sidecar:
  network-off container, read-only rootfs, tmpfs `/tmp`, memory + CPU + PIDs
  caps, wall-clock SIGKILL, non-root, no shell.
- `code-sandbox.service.ts` posts code to `RUNNER_URL=http://c2d-runner:9000`
  (`/execute`; responses keep the exact stdout/stderr/execution_time_ms
  contract).

### T6 — Push Notifications Without Firebase (fixes G3) — **DONE**

- VAPID keys auto-generate on first backend boot and persist to `game_config`
  (`notifications.vapid`) so dev needs zero setup; env vars still take
  precedence.
- FCM demoted behind `FCM_ENABLED=true` (false by default, excluded from
  compose defaults).

### T7 — Ocean Protocol / C2D strictly optional (fixes G7) — **DONE, tightened per owner policy**

> **Owner policy update (this wave):** the marketplace must be *very strict*
> about never selling PII. It now allows **Compute-to-Data ONLY** — no
> download/access path exists at all — and researcher algorithms run in a
> separate, network-isolated Docker container so they can safely test our
> system.

Implemented:

- Master switch `MARKETPLACE_ENABLED=false` in docker defaults. When false:
  every `/data-marketplace` endpoint answers 501 with a clear message; the
  idle-capacity node can never start (double-gated); no wallet, RPC URL or
  Ocean Node is required anywhere. The benchmark pipeline still works.
- **C2D-only publishing**: `publishDataset` succeeds ONLY when a full on-chain
  compute asset was created (ERC721 + datatoken + fixed-rate exchange +
  `compute` service). The metadata-first fallback was removed — on any failure
  the dataset stays a draft with `c2d_error` explaining why.
- **PII defence in depth** (`privacy-guard.ts`): beyond field-name checks, a
  value-level scan (`scanPayloadForPii`) rejects non-numeric values, emails,
  IPs, phone-like runs, long digit IDs, arrays and objects before anything
  leaves the module.
- **Network access permanently off**: `allowNetworkAccess` is typed `false`,
  forced by `normalizeC2dPolicy`, rejected outright if requested via API,
  asserted again inside `publishComputeAsset`.
- **Isolated compute environment** (`docker/c2d-runner/`, compose service
  `c2d-runner`): internal Docker network (`internal: true` — no egress),
  read-only rootfs, tmpfs `/tmp`, non-root user, dropped capabilities,
  `no-new-privileges`, 512 MB / 1 CPU / 128 PIDs caps. Researchers test our
  system locally via the admin endpoint
  `POST /data-marketplace/datasets/:id/test-compute`, which executes their
  algorithm against the stored sanitized aggregate (JSON on stdin) inside
  that container and audits every run.
- When an operator later enables it, the existing on-chain publishing path
  stays intact (Polygon mainnet per owner decision).

### T8 — Payments stay infra-only (per owner) — **DONE**

- `BILLING_ENABLED=false` default: checkout/portal/cancel/verify routes and
  the Stripe webhook answer 404; plan limits resolve to generous static
  values; nothing crashes. Documented in README as reserved for future
  infrastructure tiers.

---

## 3. Game Completeness — Playable, Original, Zero Missing Content (fixes G9)

### T9 — Characters & avatars (built in, original)

- Define 6 playable character archetypes (original, no third-party IP): e.g., **Lorekeeper** (memory/flashcards bonus), **Focuser** (session stamina), **Solver** (problem-solving XP), **Duelist** (PvP rating start), **Alchemist** (burn/scrape value bonus), **Warden** (streak shield).
  - Each: name, 2-line lore, stat modifiers stored in `game_config.rpg.characters`, selection locked at profile creation (one respec token granted at level 10).
  - DB: `player_profiles.character_key` column + migration `032_characters.sql`; starter deck flavour shifts slightly per archetype.
- Art: one SVG portrait per archetype in `frontend/public/art/characters/*.svg` — hand-authored original vector art committed to the repo (no CDN, no generation at runtime).
- Character select screen in RpgPage (first-visit wizard if unset), locale keys in all 15 files.

### T10 — Card art & battle presentation

- Every `card_definitions` row gets a committed SVG illustration keyed by `card_key` (`frontend/public/art/cards/<key>.svg`), plus a shared frame per rarity.
- Battle screen uses monster art per `monster_id` (`frontend/public/art/monsters/*.svg`) — 6 PvE monsters + 6 exam bosses + PvP ghost avatar.
- World themes: background gradients/patterns per world as CSS tokens + SVG texture, no stock images.
- Acceptance: zero "grey box" visuals anywhere in Character/Decks/Battle/Economy tabs.

### T11 — Rebranding & content sweep completion (overlaps B2/B7 leftovers)

- Global grep gates in CI: repo must not contain `studyield`, `Studyield`, `@studyield.app`, old logo filenames, or third-party character names (TADC etc.). Exceptions: `archive/`, licence docs until B10.
- Replace SECURITY.md placeholder email with `security@studyrpg.app` and remove the "(placeholder …)" note (G8).
- Verify every locale file's app-name strings say Study RPG; footer links point at the new README/docs.

---

## 4. Zero-Placeholder Sweep (fixes G8 + hidden stubs)

- CI job greps source (excluding lockfiles/archive) for: `TODO`, `FIXME`, `placeholder`, `not implemented`, `coming soon`, `lorem ipsum`, hardcoded `localhost` outside config, and `YOUR_API_KEY`. Any hit fails the build unless explicitly allowlisted in a checked-in file with justification.
- Fix every current hit found by the sweep (SECURITY.md email is the known one; run the sweep to enumerate the rest).
- Definition: **a feature is done only when its happy path AND failure paths are handled with real behaviour** (e.g., AI down → deterministic fallback + honest UI message, never a fake answer).

---

## 5. Finish the Clean-Room Rewrite (fixes G10)

Continue `docs/audits/REWRITE_LEDGER.md` to completion:

1. **B5 — Migrations (17 files)**: schema-identical SQL, comments/headers re-authored (000 partially done this session — finish 002b→014 series).
2. **B6 — Backend configs/scripts/root**: `nest-cli.json`, `tsconfig.json`, `.env.example`, `scripts/migrate.js`, Dockerfiles re-authored where they carry upstream expression; functional files verified line-by-line as KEEP.
3. **B7 — Frontend source (~150 files)**: pages/components/stores/services rewritten or verified KEEP (declarative wiring). Largest batch — split into PR-sized passes per directory (`pages/dashboard/*` first, components second).
4. **B8 — Locales (15 files)**: regenerate translations from the rewritten English source keys (original phrasing; machine-assisted translation acceptable since it's our own strings).
5. **B9 — Frontend configs/assets/root**: vite/tailwind/eslint configs, remaining public assets.
6. **B10 — Final gate**: rerun inventory regeneration commands; when zero unresolved upstream paths remain, remove AGPL LICENSE/NOTICE per the ledger's gating rule and record ADR.
- Each batch ends with: backend build+tests green, frontend typecheck+tests+lint green, ledger updated.

---

## 6. README.md — Complete Run Guide (fixes G11) — **DONE (adapted to real ports)**

README rewritten so a stranger can go clone → play in under 5 minutes:
quickstart (`docker compose --env-file .env.docker up -d` +
`sh scripts/bootstrap.sh`), first-run contents, ports table
(5189 frontend, 3010 API, 8025 mailpit, 9001 minio console, 11434 ollama,
8888 searxng), optional upgrades, storage providers, architecture links.
`scripts/bootstrap.sh` implements the steps with idempotent checks and clear
progress output.

---

## 7. Verification Checklist (Definition of "Playable")

Run on a clean clone, empty Docker cache:

- [ ] `docker compose up -d && sh scripts/bootstrap.sh` completes without manual edits
- [ ] Register (username-only, no email needed) → login → dashboard renders live widgets
- [ ] Upload PDF → ingestion reaches `ready` → chat answers WITH citations from that PDF (local embeddings + Ollama)
- [ ] Focus session 1 min (dev override) → campfire question → reward lands in wallet ledger
- [ ] Quiz generate → attempt → accuracy recorded; mistakes notebook updates
- [ ] Teach-back explanation scored ≥ threshold grants STP
- [ ] Programme suggest → learning path generated → steps completable
- [ ] Battle vs PvE monster end-to-end incl. art, mana quiz, win rewards; party battle with 2 test users
- [ ] PvP duel between two accounts settles with Elo update
- [ ] Events: StudyPass claims, daily quest claim, Abstracted unabstract flow
- [ ] Economy: list card → second account buys → seller credited atomically
- [ ] Password reset email visible in Mailpit UI
- [ ] Browser push received after enabling notifications
- [ ] Avatar upload persists across restart (MinIO volume)
- [ ] `MARKETPLACE_ENABLED=false` → marketplace endpoints respond 501, nothing crashes
- [ ] Billing disabled → no checkout routes; plan limits use defaults
- [ ] Zero-placeholder CI grep passes
- [ ] backend `npm run build && npm test` green (430+ tests)
- [ ] frontend `npm run build && npm test && npm run lint` green
- [ ] Rebranding grep gate passes

---

## 8. Suggested Execution Order

| Wave | Tasks | Why first |
|------|-------|-----------|
| 1 | T1 Ollama, T3 MinIO+adapters, bootstrap.sh + README skeleton | Unblocks every AI + upload flow; makes the stack bootable |
| 2 | T2 Mailpit, T6 push, T4 SearXNG, T5 sandbox | Removes remaining external deps |
| 3 | T9 characters, T10 art/content, T11 rebrand sweep | Makes the GAME feel finished |
| 4 | B5→B6 rewrite batches + placeholder sweep CI | Compliance + hygiene while content is fresh |
| 5 | B7→B9 frontend rewrite, then B10 gate | Biggest mechanical batch last |
| 6 | Full verification checklist pass | Ship |

---

*Owner additions welcome — this document is the single source of truth for "what's left to be fully playable". Update the checklist boxes as waves complete.*
