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

### T1 — Local LLM via Ollama (fixes G1)

- Add `ollama/ollama` service to compose; entrypoint pulls two models on first boot:
  - `qwen2.5:7b-instruct` (chat/quizzes/grading) — good quality/CPU-viable default
  - `nomic-embed-text` (embeddings, 768-dim)
- Backend already speaks OpenAI-compatible APIs (`RerankProvider` proves the pattern). Extend `AiService` config resolution:
  - `AI_PROVIDER=openai-compatible` (default in docker env) → base URL `http://ollama:11434/v1`, model `qwen2.5:7b-instruct`, no API key.
  - Keep `openrouter` as an optional upgrade path; admin panel selector already exists per PRD.
- Embeddings: implement `OllamaEmbeddingProvider implements EmbeddingProvider` alongside the existing abstraction; collection versioning already handles index rebuilds when the embedding model changes (`CollectionResolver`).
- Reranker: point `RERANKER_PROVIDER=ollama` by default; keep no-op fallback.
- Acceptance: fresh clone → `docker compose up` → chat answers from uploaded notes without any user-supplied key. Campfire grading falls back deterministically as today.

### T2 — Local Email via Mailpit (fixes G2)

- Add `axllent/mailpit` service (SMTP :1025, UI :8025).
- Refactor `email.module.ts`: add an SMTP transport (nodemailer) selected when `EMAIL_TRANSPORT=smtp`; SES stays available but only when `EMAIL_TRANSPORT=ses` AND credentials exist.
- Docker default: `EMAIL_TRANSPORT=smtp`, host `mailpit`, port `1025`. Password-reset and verification emails land in Mailpit's web UI during local play.
- Acceptance: register → reset password → read the email at `http://localhost:8025`. No AWS account anywhere in the default path.

### T3 — Local Object Storage via MinIO + multi-provider adapter (fixes G4)

This is the ONE area where external providers are permitted. Requirements: multiple providers, all free tier, none requiring a credit card, all behind one interface.

**Default (zero-config)**: MinIO in compose. Buckets auto-created by an init job (`mc mb studyrpg-uploads`).

**Adapter interface** (extend existing `StorageService`):

```
StorageProvider = 'minio' | 'supabase' | 'cloudinary' | 'appwrite'
STORAGE_PROVIDER=minio            # docker default
STORAGE_*_BUCKET / keys per provider
```

| Provider | Free tier | Credit card? | Notes |
|----------|-----------|--------------|-------|
| **MinIO** (self-hosted) | unlimited (your disk) | No | Default; S3 API |
| **Supabase Storage** | 1 GB | **No** | S3-ish REST + signed URLs |
| **Cloudinary** | ~25 credits/mo (~25 GB bandwidth) | **No** | Good for images/avatars/card art |
| **Appwrite Storage** | 2 GB | **No** | Simple REST file API |

Deliberately excluded: Cloudflare R2 and AWS S3 free tiers (both require a card on file).

- Implement four small adapters behind the existing service surface (upload/download/signed URL/delete), each ≤200 lines, each with unit tests using mocked HTTP.
- Acceptance: switching `STORAGE_PROVIDER` env var moves uploads with zero code change; avatar upload + document upload work end-to-end on MinIO out of the box.

### T4 — Local Web Search via SearXNG (fixes G5)

- Add `searxng/searxng` service (JSON format enabled in settings.yml).
- Rewrite `web-search.service.ts` provider selection:
  - `SEARCH_PROVIDER=searxng` (default) → `http://searxng:8080/search?q=…&format=json`
  - keep any existing commercial provider as opt-in.
- Acceptance: Deep Research produces cited reports offline.

### T5 — Local Code Execution Sandbox (fixes G6)

- Add a `code-runner` sidecar image: Node/Python runtime in a container started with `--network none`, read-only rootfs, tmpfs `/tmp`, memory + CPU caps, wall-clock kill.
- `code-sandbox.service.ts` posts code over an internal HTTP endpoint (`RUNNER_URL=http://code-runner:9000`); responses return stdout/stderr/exit-time exactly like today's contract.
- Acceptance: solving a Python problem in Problem Solver actually executes locally; malicious code cannot reach network or host FS.

### T6 — Push Notifications Without Firebase (fixes G3)

- Web push (VAPID) already works self-hosted — make it THE notification channel:
  - Generate VAPID keys automatically on first backend boot if unset (persist to `game_config`) so dev needs zero setup.
  - Frontend `sw.js` flow is already implemented; ensure NotificationSettings page hides nothing when VAPID exists (it will always exist now).
- Demote FCM: move `firebase/` module behind `FCM_ENABLED=true` flag, excluded from compose defaults; mark for removal in v1.1 unless someone needs Android-native push before v2.
- Acceptance: quest reminder arrives as browser push after clicking "enable notifications". No Google account involved.

### T7 — Ocean Protocol / C2D strictly optional (fixes G7)

- Master switch `MARKETPLACE_ENABLED=false` in docker defaults. When false:
  - Data-marketplace controllers registered but return 501 with a clear message; idle-capacity node never starts; benchmark pipeline still works (it's internal-only and valuable to schools).
  - No wallet, no RPC URL, no Ocean Node required anywhere in `.env.docker`.
- When an operator later enables it, existing on-chain publishing path stays intact (Polygon mainnet per owner decision).

### T8 — Payments stay infra-only (per owner)

- Stripe wiring remains but `BILLING_ENABLED=false` default: plan limits resolve to generous static values; no checkout route mounted; webhook controller returns 404 when disabled.
- Documented in README as "reserved for future infrastructure tiers".

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

## 6. README.md — Complete Run Guide (fixes G11)

Rewrite root `README.md` so a stranger can go clone → play in under 5 minutes:

```md sections required:
- What Study RPG is (3 sentences + screenshot of dashboard & battle)
- Quickstart: 
    git clone … && cd study-rpg
    docker compose up -d        # postgres redis qdrant clickhouse ollama searxng mailpit minio
    ./scripts/bootstrap.sh      # waits healthy, runs migrations, pulls ollama models, seeds CBSE preset + game_config + admin
    open http://localhost:8080  # frontend; login with seeded demo student or create account
- First-run contents: models pulled (~4.5 GB), buckets created, VAPID generated, event seeded
- Ports table (8080 frontend, 3000 api, 8025 mailpit UI, 9001 minio console, 11434 ollama)
- Optional upgrades: OpenRouter key, SES, Firebase, Stripe, Ocean (all off by default; exact env vars listed)
- Storage providers: how to switch to Supabase/Cloudinary/Appwrite (free, no card)
- Troubleshooting: model pull failures, port conflicts, Apple Silicon notes
- Architecture diagram + link to docs/
- Licence section reflecting rewrite status
```

Also ship `scripts/bootstrap.sh` implementing exactly those steps with idempotent checks and clear progress output — this script is part of "working code", tested on a clean clone.

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
