# Plan: Study RPG Hardening (PDF Phase 9)

**Prerequisites**: spec.md (US1–US6), data-model (below), contracts (below).

## Design Overview

Phase 9 hardens existing modules — Admin/Audit, Social, Notifications, Factions — plus ops assets.
New dependency: `web-push` (npm) for VAPID. New module: `WebPushService` inside NotificationsModule
(no new top-level module). New migration `027_study_hardening.sql` + `game_config` seeds.

### Architecture

```
┌─ AdminModule ───────────────────────────────────────────────────┐
│  AuditService (extended)                                        │
│   • exportCsv / exportJson (admin+teacher)                      │
│   • retention get/set (admin, audited)                          │
│   • purgeOlderThan(days) — advisory lock, audited run           │
│  AdminService (extended)                                        │
│   • status() — counts + queue stats + health                    │
│  AdminModule.onModuleInit — register 'audit-retention' worker   │
└─────────────────────────────────────────────────────────────────┘
┌─ SocialModule ──────────────────────────────────────────────────┐
│  dm-moderation.ts (pure): blockedWordHits, linkSpamScore,       │
│    moderationVerdict                                            │
│  SocialService.sendMessage — rate limit (game_config security.dm│
│    maxPerMinute) + moderation verdict; abuse audited            │
└─────────────────────────────────────────────────────────────────┘
┌─ NotificationsModule ───────────────────────────────────────────┐
│  web-push.service.ts — VAPID client, subscribe/unsubscribe,     │
│    send (silent no-op when unconfigured / no subscriptions)     │
│  NotificationsService.sendPushNotification → FCM + web push     │
└─────────────────────────────────────────────────────────────────┘
┌─ FactionsModule ────────────────────────────────────────────────┐
│  onModuleInit — repeatable BullMQ job 'faction-settlement'      │
│    (monthly) → FactionsService.settleIfDue() (idempotent)       │
└─────────────────────────────────────────────────────────────────┘
```

### Migration `027_study_hardening.sql`

- `web_push_subscriptions` — id UUID PK, user_id FK cascade, endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT, created_at.
- `game_config` seeds: `security.dm` (`{ maxPerMinute: 20 }`), `security.audit`
  (`{ retentionDays: 365 }`).

### Ops assets

- `scripts/backup.sh` — `pg_dump` of the main DB + tar of uploads dir (R2/S3 mirror note); prints
  target path + restore command.
- `scripts/restore.sh` — restore a dump into the target DB (guarded with `--if-exists`, requires
  `RESTORE_DUMP` env); documents Redis/Qdrant recreate-from-source.
- `scripts/load-test.mjs` — fetch-based: configurable URL, concurrency, duration; prints
  req/s, p50/p95, errors.
- `docs/runbooks/backup-restore.md`, `docs/runbooks/audit-retention.md`,
  `docs/runbooks/load-testing.md`, `docs/deployment/hosting.md`.

### API (contracts)

- `POST /admin/audit-logs/export` `{ format?: 'csv'|'json' }` → text/csv or json.
- `GET /admin/audit-logs/retention` → `{ retentionDays }` · `POST /admin/audit-logs/retention`
  `{ retentionDays, reason }` (admin, audited).
- `POST /admin/audit-logs/purge` (admin, manual) — runs the purge now.
- `GET /admin/status` (admin).
- `POST /notifications/web-push/subscribe` `{ endpoint, p256dh, auth, userAgent? }`;
  `POST /notifications/web-push/unsubscribe` `{ endpoint }`; `GET /notifications/web-push/public-key`
  → `{ publicKey: string | null }` (null when VAPID unconfigured).

### Frontend

- `services/admin.ts` — audit export, retention get/set/purge, status; `services/notifications.ts`
  (if absent) — web-push subscribe/unsubscribe/public-key.
- `types/index.ts` — `SystemStatus`, `AuditRetention`, web-push types.
- `AdminPage` — new **System** tab (status cards + health flags + queue stats) and audit **Export**
  button + retention control in the Audit tab.
- `NotificationSettingsPage` — "Enable browser notifications" (web push) block, hidden when
  public key is null; registers a `public/sw.js` service worker via `navigator.serviceWorker`.
- Locales extended in all 15 files (`admin.system.*`, `admin.audit.export*`, `notif.webPush.*`).

### Tests

Backend Jest: `dm-moderation.spec.ts` (pure), `audit-retention.spec.ts` (retention math + purge
safety with mocked db), `web-push.service.spec.ts` (subscribe/unsubscribe with mocked db, send
no-op when unconfigured), `social.service.spec.ts` additions (rate limit + moderation rejection,
audit on abuse). Definition of Done: backend build + full suite green, frontend `tsc -b --noEmit`
clean, `IMPLEMENTATION_STATUS.md` + `MASTER_PLAN.md` + `specs/README.md` + ops docs updated.
