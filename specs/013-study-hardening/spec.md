# Feature Specification: Study RPG Hardening

**Feature Branch**: `013-study-hardening`

**Created**: 2026-08-06

**Status**: Draft

**Input**: Authorized from the owner's master prompt PDF Phase 9 (Hardening) and
`docs/implementation/MASTER_PLAN.md` §4: audit-log retention + export, DM moderation and rate
limits, standards-based Web Push (VAPID), scheduled faction settlement, an admin status dashboard,
and ops deliverables (backups with restore testing, load tests, deployment docs, runbooks).

## User Scenarios & Testing

### User Story 1 — Audit-log retention & export (Priority: P1)

Admins can **export** the audit log (CSV/JSON) and configure a **retention window**; a scheduled job
purges entries older than the window. Teachers keep read access to the retained log, so the
"teachers can verify admins are not cheating" guarantee survives housekeeping.

**Why this priority**: The audit log is the owner's anti-cheating proof; without retention it grows
forever, and without export there is no durable evidence trail.

**Independent Test**: Insert entries, export them, run the retention purge, and verify only stale
entries are removed.

**Acceptance Scenarios**:

1. **Given** audit entries, **When** an admin exports them, **Then** a CSV/JSON with the same fields
   as the list view is returned.
2. **Given** a configured retention window (days), **When** the purge job runs,
   **Then** entries older than the window are deleted and the run is itself audited.
3. **Given** a retention of 0 days or missing config, **When** the job runs, **Then** nothing is
   purged (safety default).

### User Story 2 — DM moderation & rate limits (Priority: P2)

Direct messages are rate-limited (a small per-user window per minute) and passed through a
**content moderation** filter (blocked words + link-spam heuristics). Violations are rejected with a
clear message; repeated abuse is logged to the audit trail so teachers/admins can see it.

**Why this priority**: The owner brief §32 explicitly forbids unrestricted private messaging; this is
the safety valve for the self-hosted chat.

**Independent Test**: Send messages over the limit and with blocked content, verify rejections and
audit entries.

**Acceptance Scenarios**:

1. **Given** a user sends more than the per-minute limit, **When** they send again,
   **Then** the message is rejected with a rate-limit message.
2. **Given** a message containing a blocked word or spammy link pattern, **When** it is sent,
   **Then** it is rejected with a moderation message and the attempt is audited.
3. **Given** normal messages, **When** sent, **Then** they pass through unchanged.

### User Story 3 — Standards-based Web Push (VAPID) (Priority: P2)

In addition to Firebase FCM, users can subscribe to **standards-based Web Push (VAPID)** from the
browser (no app needed). Subscriptions are stored per user; notifications are sent over both channels
when configured. The frontend registers a service worker and a subscribe button appears when VAPID is
configured.

**Why this priority**: It fulfills the "website notifications instead of email" brief fraction 3 with
a free, self-hosted, standards-based channel.

**Independent Test**: Subscribe with a push payload, store the subscription, and send a test
notification to it.

**Acceptance Scenarios**:

1. **Given** VAPID keys configured, **When** the user clicks "Enable browser notifications",
   **Then** the browser asks permission and the subscription is stored.
2. **Given** a stored subscription, **When** a notification is created,
   **Then** it is pushed via web-push (VAPID) in addition to FCM when configured.
3. **Given** no VAPID keys, **When** the page loads, **Then** the subscribe UI is hidden and sending
   is skipped gracefully.

### User Story 4 — Scheduled faction settlement (Priority: P2)

The monthly faction settlement (IST) runs on a **scheduled BullMQ job** (repeatable), not only on
lazy reads; leaders are notified when their faction's settlement completes.

**Why this priority**: Completes brief fraction 17 — recurring rewards without waiting for a user to
hit the factions page.

**Independent Test**: Enqueue the settlement job and verify it runs `settleIfDue` and notifies
leaders.

**Acceptance Scenarios**:

1. **Given** the repeatable job registered, **When** the job fires,
   **Then** `settleIfDue()` runs exactly once for the current IST period.
2. **Given** a completed settlement, **When** the job fires again in the same period,
   **Then** it is a no-op (idempotent).

### User Story 5 — Admin status dashboard (Priority: P3)

Admins get a **system status** endpoint + UI tab: counts (users by role, audit entries, active
events, live factions), queue stats (waiting/active/failed), and health checks (DB/Redis/Qdrant).

**Why this priority**: Gives the Nightmare admin a single pane of glass (brief fraction 1 follow-up).

**Independent Test**: Call the status endpoint and verify the counters and health flags.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they open the System tab, **Then** user/audit/event/faction counts,
   queue stats and health flags are shown.
2. **Given** a non-admin, **When** they call the status endpoint, **Then** it is forbidden.

### User Story 6 — Ops: backups, load test, deployment docs, runbooks (Priority: P3)

Repository gains: `scripts/backup.sh` + `scripts/restore.sh` (Postgres + volumes, with restore
testing notes), a `scripts/load-test.mjs` smoke load tester, deployment docs (Cloudflare Pages +
backend host), and runbooks (backup/restore, audit retention, load testing).

**Why this priority**: PDF §43 DoD requires verified backups/restore and deployment documentation.

**Independent Test**: The load-test script hits the health endpoint and reports p95; backup/restore
scripts are documented and shellcheck-clean.

**Acceptance Scenarios**:

1. **Given** a running API, **When** the load test runs, **Then** it reports requests/sec and p95
   latency.
2. **Given** the runbooks, **When** an operator follows them, **Then** backup, restore and retention
   are reproducible step-by-step.

## Edge Cases

- Web push with no stored subscription is a silent no-op (never throws).
- Rate limiting uses a configurable per-user per-minute window from `game_config`
  (`security.dm`), with code defaults.
- Moderation is a deny-list + heuristics; false positives are avoided by only blocking clear
  patterns (exact blocked words, ≥4 bare links).
- The retention job uses a Postgres advisory lock so concurrent runs never double-purge.
- Health checks return `ok:false` + error string instead of throwing when a service is down.

## Requirements

### Functional Requirements

- **FR-001**: `POST /admin/audit-logs/export` returns CSV (admin/teacher); `GET
  /admin/audit-logs/retention` + `POST /admin/audit-logs/retention` set the window (days,
  admin-only, audited); scheduled `audit-retention` BullMQ job purges older entries under an
  advisory lock and audits its own run.
- **FR-002**: `SocialService.sendMessage` enforces a configurable per-user per-minute DM rate limit
  and a pure `dm-moderation.ts` filter (blocked words + link-spam heuristic); violations reject with
  clear errors; abuse attempts are audited.
- **FR-003**: `web_push_subscriptions` table (user_id, endpoint, p256dh, auth, user_agent, created);
  `POST /notifications/web-push/subscribe|unsubscribe`; `sendWebPush` in NotificationsService when
  `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` are configured (web-push npm package);
  graceful no-op otherwise.
- **FR-004**: `FactionsModule` registers a repeatable BullMQ job (`faction-settlement`, monthly IST)
  calling `settleIfDue()`; idempotent per period.
- **FR-005**: `GET /admin/status` (admin) — users by role, audit count, active events, live
  factions, queue stats, DB/Redis/Qdrant health.
- **FR-006**: Ops assets — `scripts/backup.sh`, `scripts/restore.sh`, `scripts/load-test.mjs`,
  `docs/runbooks/` (backup-restore, audit-retention, load-testing), `docs/deployment/` (hosting
  guide).
- **FR-007**: All schema lands in migration `027_study_hardening.sql` (unique prefix after `026`)
  + `game_config` seeds (`security.dm`, `security.audit`).

### Key Entities

- **WebPushSubscription**: user_id, endpoint (unique), p256dh, auth, timestamps.
- **AuditRetention**: config in `game_config` (`security.audit.retentionDays`, default 365).
- **DmRateLimit**: config in `game_config` (`security.dm.maxPerMinute`, default 20).
- **Moderation**: pure `dm-moderation.ts` — `blockedWordHits(body)`, `linkSpamScore(body)`,
  `moderationVerdict(body)`.

## Success Criteria

- **SC-001**: Audit export + retention purge work; purge is audited and advisory-locked.
- **SC-002**: DM rate limit + moderation reject bad messages and audit abuse; normal chat is
  unaffected.
- **SC-003**: VAPID subscribe/send works when configured, hidden otherwise, never throws.
- **SC-004**: Faction settlement job is scheduled, idempotent, and notifies leaders.
- **SC-005**: `/admin/status` returns live counters + health for admins only.
- **SC-006**: Scripts + runbooks + deployment docs are present and shellcheck-clean.
- **SC-007**: Backend build + full suite green; frontend `tsc -b --noEmit` clean.

## Assumptions

- `web-push` npm package is added to `backend/package.json` (v3.6.x).
- Backup scripts cover Postgres (pg_dump) and note Redis/Qdrant as recreate-from-source; full
  restore testing requires a running Docker stack (documented, not executable in this workspace).
- FCM remains the primary push channel; VAPID is additive.
- The load test is a lightweight smoke tester (fetch-based), not a full k6 suite.
