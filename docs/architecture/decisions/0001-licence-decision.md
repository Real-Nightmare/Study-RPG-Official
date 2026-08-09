# ADR-0001: Licence Decision — AGPL-3.0 as the Single Project Licence

- **Status**: Accepted (owner sign-off, 2026-08-04)
- **Date**: 2026-08-04
- **Deciders**: Repository owner (Real-Nightmare), AI agent (Buffy)

## Context

The repository contained **conflicting licence declarations** (documented in `docs/audits/LICENSE_AUDIT.md`):

- Root `LICENSE` file: **GNU Affero General Public License v3.0** (full 661-line text)
- `NOTICE` file: "Licensed under the Apache License, Version 2.0"
- `backend/package.json`: `"license": "Apache-2.0"`
- `frontend/package.json`: **no licence field**
- `README.md` badge: Apache-2.0; README.md License section: AGPL-3.0
- All 12 translated READMEs: Apache-2.0
- `CHANGELOG.md` / `FUTURE_GOAL.md`: claim the project was relicensed to Apache-2.0 during open-source preparation

The master implementation prompt explicitly instructs: *"Preserve the root licence. Do not replace it with Apache, MIT or another licence."*

## Decision

**AGPL-3.0 is the single, authoritative licence for this project.**

The root `LICENSE` file is preserved as-is. All inconsistent metadata is aligned to AGPL-3.0:

- `backend/package.json` → `"license": "AGPL-3.0"` (+ `package-lock.json`)
- `frontend/package.json` → `"license": "AGPL-3.0"`
- `NOTICE` → declares AGPL-3.0
- `README.md` + all translated READMEs → badges, comparison tables, and License sections state AGPL-3.0
- `CHANGELOG.md` / `FUTURE_GOAL.md` → corrected with explicit notes (historical Apache claims marked as superseded)
- New files added: `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`
- In-app **Source Code and Licence** section added to the frontend footer

## Consequences

- **Positive**: single consistent licence; GitHub licence detection and package metadata agree; downstream users have unambiguous terms; the prompt's "preserve the root licence" rule is followed.
- **Negative / considerations**: AGPL-3.0 is copyleft with a network-use provision — any network service deployed from this codebase must offer its source. This is an accepted property of the project per the prompt.
- **Obligations**: retain `LICENSE` and `NOTICE`; offer source to users of any deployed network service; keep all Study RPG content original (see `UPSTREAM.md`).

## Alternatives Considered

1. **Apache-2.0 everywhere** — rejected: would require replacing the root licence, explicitly disallowed by the master prompt; also mismatched with the existing `LICENSE` file.
2. **Leave the contradiction unresolved** — rejected: ambiguous licensing harms contributors and adopters; the audit flagged it as a Phase 0 blocker.

## References

- `docs/audits/LICENSE_AUDIT.md`
- `docs/audits/INITIAL_REPOSITORY_AUDIT.md` (§5)
- `LICENSE`, `NOTICE`, `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`
