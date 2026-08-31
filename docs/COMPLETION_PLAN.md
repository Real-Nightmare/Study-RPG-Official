# Study RPG — Completion Status

> What's been built, what's working, and what's left.

## What's Working (Zero-Config Local)

Everything runs from `docker compose up -d && sh scripts/bootstrap.sh` with no API keys or cloud accounts.

| Capability | How It Works |
|-----------|-------------|
| **AI Chat** | Ollama (qwen2.5:7b) runs locally — upload a PDF, chat with citations |
| **Quizzes** | AI-generated per topic; accuracy tracked; mistakes logged |
| **Teach-Back** | Explain a concept; AI scores explanation depth |
| **Campfire Reflection** | Mandatory metacognitive check before rewards |
| **Focus Sessions** | Timer-based study with wellbeing guards |
| **RPG Progression** | XP, STP, cards, decks, battles — earned through study only |
| **PvP Duels** | Async deck-snapshot battles with Elo ranking |
| **Party Battles** | Up to 4 players vs exam bosses |
| **Marketplace** | Card trading with supply ledger |
| **Events** | StudyPass, daily/weekly quests, Abstracted, Great Extinction |
| **Factions** | Auto-balanced teams, elected leaders, help-the-weaker mechanic |
| **Chat** | Realtime Socket.IO messaging |
| **File Uploads** | MinIO (S3-compatible) — PDFs, notes, images |
| **Email** | Mailpit captures all SMTP locally |
| **Web Search** | SearXNG for Deep Research |
| **Code Execution** | Sandboxed Python/Node in Docker |
| **Web Push** | Auto-generated VAPID keys |
| **Admin Panel** | Nightmare super-admin with audit logs |
| **6 Characters** | Lorekeeper, Focuser, Solver, Duelist, Alchemist, Warden |
| **15 Locales** | Full i18n across all pages |

## What's Optional (Add Keys to Upgrade)

| Feature | Default | Upgrade |
|---------|---------|---------|
| **AI Quality** | Ollama (local) | OpenRouter, Groq, Together, Fireworks, OpenAI |
| **Search** | SearXNG (local) | Any search API |
| **Storage** | MinIO (local) | Supabase (1GB), Cloudinary (25GB), Appwrite (2GB) |
| **Email** | Mailpit (dev) | SMTP server or AWS SES |
| **Code Execution** | Local (sandboxed) | E2B (cloud) |
| **Payments** | Disabled | Stripe (infra tiers only) |
| **Data Marketplace** | Disabled | Ocean Protocol (Polygon mainnet) |

## What's Left

### Clean-Room Rewrite (B10 Final Gate)

The upstream Studyield codebase is being rewritten to remove all AGPL-attribution dependencies. Current status:

| Batch | Status | Notes |
|-------|--------|-------|
| B1-B4 | ✅ Done | Backend, frontend, schema, root docs |
| B5-B9 | ✅ Done | Migrations, configs, source, locales |
| B10 | 🔄 In Progress | Final verification, AGPL removal |

3 intentional "Studyield" mentions remain in historical docs (architecture overview, quick-start "formerly" note, spec directory name).

### Content Polish

- Card/monster SVG art for all 9 cards and 12 monsters/bosses (6 characters done)
- Complete lore text for all game content
- Final locale key parity audit

### Verification

Run the full verification checklist:

```bash
# 1. Clean start
docker compose down -v && docker compose up -d && sh scripts/bootstrap.sh

# 2. User flows
# - Register → login → dashboard
# - Upload PDF → chat with citations
# - Focus session → campfire → rewards
# - Quiz → mistakes notebook
# - Teach-back scoring
# - Battle → rewards in ledger
# - PvP duel → Elo update
# - Marketplace listing → purchase
# - Password reset → email in Mailpit

# 3. Build verification
cd backend && npm run build && npm test
cd frontend && npm run build && npm test

# 4. CI checks
sh scripts/check-no-placeholders.sh
```

## Related Docs

- [Quick Start](./getting-started/quick-start.md) — run the app
- [Configuration](./getting-started/configuration.md) — all env vars
- [Architecture](./architecture/overview.md) — how it works
- [Master Plan](./implementation/MASTER_PLAN.md) — phase history
