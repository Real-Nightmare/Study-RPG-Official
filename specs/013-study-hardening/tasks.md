# Tasks: Study RPG Hardening (PDF Phase 9)

**Input**: spec.md (US1–US6), plan.md.

**Prerequisites**: spec.md, plan.md. Phase 8 (Advanced Learning) green (build + tests).

## Phase 1: Schema & deps (Foundational)

- [x] T001 Write migration `backend/migrations/027_study_hardening.sql` —
      `web_push_subscriptions` table + `game_config` seeds (`security.dm`,
      `security.audit`). Unique prefix 027, ordered after 026.
- [x] T002 Add `web-push` dependency to `backend/package.json` (+ `@types/web-push`
      dev) and `npm install`.

## Phase 2: Pure modules (unit-testable)

- [x] T003 `backend/src/modules/social/dm-moderation.ts` — `blockedWordHits(body)`,
      `linkSpamScore(body)`, `moderationVerdict(body)` (deny-list + ≥4 bare links).
- [x] T004 `backend/src/modules/admin/audit-retention.ts` — `retentionWindow(days)`
      boundary math + `purgeQuery(days)` helper (0/undefined → no-op).
- [x] T005 Unit tests: `dm-moderation.spec.ts`, `audit-retention.spec.ts`.

## Phase 3: Audit retention + export (US1)

- [x] T006 [US1] `AuditService.exportCsv` / `exportJson` (same filters as list).
- [x] T007 [US1] `AuditService.getRetention` / `setRetention(actorId, days, reason)`
      (audited) via `game_config security.audit.retentionDays`.
- [x] T008 [US1] `AuditService.purgeOlderThan(days)` — advisory lock, deletes stale,
      audits its own run; `AdminController` endpoints (export, retention get/set,
      purge).
- [x] T009 [US1] `AdminModule` registers the `audit-retention` BullMQ worker +
      repeatable job (daily) via `QueueService`/`OnModuleInit` (safe when Redis
      unavailable).
- [x] T010 [US1] `audit-retention.spec.ts` service-level tests (mock db).

## Phase 4: DM moderation + rate limits (US2)

- [x] T011 [US2] `SocialService.sendMessage` — rate-limit check (per-user per-minute
      from `game_config security.dm.maxPerMinute`), moderation verdict, audit abuse
      attempts; clear reject messages.
- [x] T012 [US2] `social.service.spec.ts` additions — rate limit, blocked word,
      link spam, normal pass-through.

## Phase 5: Web Push VAPID (US3)

- [x] T013 [US3] `web-push.service.ts` in NotificationsModule — VAPID client when
      configured; `subscribe`, `unsubscribe`, `sendToUser` (silent no-op).
- [x] T014 [US3] Controller endpoints (subscribe/unsubscribe/public-key) in
      `notifications.controller.ts`; `NotificationsService.sendPushNotification`
      also sends web push.
- [x] T015 [US3] `web-push.service.spec.ts` (mock db + unconfigured no-op).

## Phase 6: Scheduled settlement + status (US4, US5)

- [x] T016 [US4] `FactionsModule` registers repeatable `faction-settlement` job
      (monthly) → `settleIfDue()`; idempotent.
- [x] T017 [US5] `AdminService.status()` — users by role, audit count, active events,
      live factions, queue stats (QueueService), DB/Redis/Qdrant health; `GET
      /admin/status` in controller (admin).

## Phase 7: Frontend (US1, US3, US5)

- [x] T018 `services/admin.ts` — export, retention get/set/purge, status;
      `services/notifications.ts` — web-push subscribe/unsubscribe/public-key.
- [x] T019 `types/index.ts` — `SystemStatus`, `AuditRetention`, web-push payloads.
- [x] T020 `AdminPage` — System tab (status cards, health flags, queue stats) +
      audit Export + retention control.
- [x] T021 `NotificationSettingsPage` — web-push enable block (hidden when no public
      key); `public/sw.js` service worker + registration.
- [x] T022 Locales — `admin.system.*`, `admin.audit.export*`, `notif.webPush.*` in
      ALL 15 locale files.

## Phase 8: Ops assets (US6)

- [x] T023 `scripts/backup.sh` + `scripts/restore.sh` (pg_dump/restore, guarded,
      shellcheck-clean).
- [x] T024 `scripts/load-test.mjs` — fetch smoke load tester (url/concurrency/
      duration, req/s + p50/p95).
- [x] T025 `docs/runbooks/backup-restore.md`, `docs/runbooks/audit-retention.md`,
      `docs/runbooks/load-testing.md`, `docs/deployment/hosting.md`.

## Phase 9: Verification & docs

- [x] T026 Backend: `npm run build` + `npm test` green.
- [x] T027 Frontend: `npx tsc -b --noEmit` clean; `npm run lint` no new errors.
- [x] T028 Update `IMPLEMENTATION_STATUS.md` (Phase 9 section), `MASTER_PLAN.md`
      §2/§4, `specs/README.md`, `CHANGELOG.md`.
