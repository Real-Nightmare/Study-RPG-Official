# Licence Audit

> **Phase 0 deliverable** — `docs/audits/LICENSE_AUDIT.md`
> **Date**: 2026-08-04
> **Status**: Contradiction **confirmed** in Phase 0; **resolved in Phase 1 (2026-08-04) per Option A — AGPL-3.0 is the single project licence** (see ADR-0001). This document records the original evidence; the resolution log is at the end. No legal conclusions provided — consult counsel for distribution decisions.

---

## 1. Executive Summary

The repository **does not declare a single, consistent licence**. The authoritative root licence file (`LICENSE`) is the **GNU Affero General Public License v3.0**, while the package metadata, the `NOTICE` file, and the majority of the documentation claim **Apache License 2.0**. The frontend package manifest declares **no licence at all**.

This is exactly the situation the master implementation prompt anticipated:

> *"The repository currently appears to contain conflicting licence declarations. The root licence file and package or README metadata may not agree. Perform a licence audit before branding or redistribution changes."*
>
> *"Preserve the root licence. Do not replace it with Apache, MIT or another licence."*

---

## 2. Evidence — Every Licence Declaration Found

| # | Location | Declaration | Evidence |
|---|----------|-------------|----------|
| 1 | `LICENSE` (repo root) | **GNU AGPL v3.0** | Full 661-line AGPL-3.0 text ("GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007") |
| 2 | `NOTICE` (repo root) | **Apache 2.0** | "Licensed under the Apache License, Version 2.0." — also lists third-party components |
| 3 | `backend/package.json` | **Apache-2.0** | `"license": "Apache-2.0"` |
| 4 | `frontend/package.json` | **None** | No `license` field present |
| 5 | `README.md` badge (L16) | Apache-2.0 badge | `img.shields.io/badge/license-Apache--2.0-blue.svg` |
| 6 | `README.md` "License" section (L528–530) | **AGPL-3.0** | "This project is licensed under the GNU Affero General Public License v3.0" |
| 7 | `README_AR.md` L321 | Apache 2.0 | "مرخص بموجب Apache License 2.0" |
| 8 | `README_BN.md` L312 | Apache 2.0 | |
| 9 | `README_DE.md` L532 | Apache 2.0 | |
| 10 | `README_ES.md` L532 | Apache 2.0 | |
| 11 | `README_KO.md` L533 | Apache 2.0 | |
| 12 | `README_ZH.md` L129 (comparison table) | Apache 2.0 | "**开源** ✅ Apache 2.0" |
| 13 | `CHANGELOG.md` L11, L29, L39 | Apache 2.0 | "Open-source release under Apache License 2.0"; "Replaced proprietary license with Apache License 2.0"; "Removed proprietary INFO INLET license" |
| 14 | `FUTURE_GOAL.md` (Developer Briefing) | Apache 2.0 | "Replaced proprietary INFO INLET license with **Apache License 2.0**"; "Updated `backend/package.json` license: `UNLICENSED` → `Apache-2.0`" |
| 15 | `SECURITY.md` | — (no claim) | No licence statement |

**Note on #14**: `FUTURE_GOAL.md` states the open-source preparation swapped the (proprietary "INFO INLET") licence to Apache-2.0 and updated `backend/package.json` — but the **root `LICENSE` file was never swapped**: it still contains the full AGPL-3.0 text. This strongly suggests the Apache-2.0 metadata changes were made while the root `LICENSE` retained (or was later re-created with) AGPL-3.0 text, leaving the tree internally inconsistent.

---

## 3. Third-Party Assets & Attribution Checklist

Per the prompt, the audit must also identify third-party copied assets, fonts, icons, illustrations, AI models, datasets, question banks, and translations.

| Category | Found | Licence/Origin | Notes |
|----------|-------|----------------|-------|
| Fonts | KaTeX font files (bundled via `katex`) | MIT (KaTeX) | Built into frontend bundle (`.ttf`/`.woff2` listed in build output) |
| Icons | `lucide-react`, `react-icons` | ISC / MIT | Listed in NOTICE |
| UI primitives | Radix UI (~24 packages) | MIT | Listed in NOTICE |
| Math rendering | `katex` / `react-katex` | MIT | Listed in NOTICE |
| Markdown/PDF | `react-markdown`, `remark-gfm`, `jspdf`, `jspdf-autotable` | MIT | In `frontend/package.json` |
| Charts | `recharts`, `function-plot` | MIT | In `frontend/package.json` |
| Animation | `framer-motion`, `lottie-react` | MIT | In `frontend/package.json` |
| Backend libs | NestJS, TypeScript, pg, Socket.IO, Passport, BullMQ, ioredis, LangChain, Stripe, Firebase Admin | MIT / Apache-2.0 | Listed in NOTICE |
| AI models | OpenAI / OpenRouter models (used at runtime, not shipped) | — | Runtime dependency only; no model weights in repo |
| Datasets / question banks | **None found** | — | No bundled datasets or question banks in repo |
| Translations | 15 locale JSON files (`frontend/src/locales/`) | Project-created | Verify translator provenance/contributor agreements if any were machine-translated |
| Screenshots | `.github/screenshots/*.png` | Project-created | UI screenshots of the platform |
| Logo assets | `frontend/public/logos/studyield-logo.png` | Project-created | |
| `vite.svg` favicon | Vite default branding | MIT (Vite) | Default template asset; replace or attribute |

**IP-risk note from the prompt**: The prompt requires that all Study RPG characters, card names, lore, and artwork be original and that no copyrighted characters or artwork from The Amazing Digital Circus be used. ("Abstraction" may remain a general conceptual inspiration only.) This audit found **no evidence of third-party character artwork or copyrighted fiction assets in the repository**, but the upcoming Study RPG direction must maintain that rule; anything copied from any source must be recorded here.

---

## 4. Why This Matters (impact summary)

- **AGPL-3.0 vs Apache-2.0 are incompatible in spirit for distribution**: AGPL is copyleft with a network-use provision; Apache is permissive. Distributing this repo under one declared licence while the other text is present creates genuine legal ambiguity for downstream users.
- **`frontend/package.json` with no licence** is an omission that makes the frontend's terms unclear for any consumer.
- **12 README translations + badges** currently advertise Apache-2.0 while the root licence is AGPL-3.0 → all must be corrected to match whatever the owner decides.
- npm/GitHub both surface the `package.json` licence and the root `LICENSE` file; mismatches are surfaced by GitHub's licence detector and by packaging tooling.

---

## 5. Recommended Resolution (pending owner decision)

The master prompt instructs: **preserve the root licence and do not replace it with Apache/MIT**. The options below are ranked accordingly. **No change is made in Phase 0** — this is presented for sign-off.

### Option A (recommended, matches prompt) — Keep AGPL-3.0 as the single source of truth
1. Keep root `LICENSE` (AGPL-3.0) as-is.
2. `backend/package.json`: `"license": "Apache-2.0"` → `"AGPL-3.0"`.
3. `frontend/package.json`: add `"license": "AGPL-3.0"`.
4. `NOTICE`: change header claim to AGPL-3.0 (keep the third-party attribution list).
5. Fix all 12 translated READMEs + badges + CHANGELOG to say AGPL-3.0.
6. Add `UPSTREAM.md` and `THIRD_PARTY_NOTICES.md`; add a visible **Source Code and Licence** section in the app footer/about (prompt requirement).
7. Add standard AGPL header notice (one-line copyright + licence pointer) to source files where practical.

### Option B — Owner explicitly overrides to Apache-2.0
Only if the owner consciously overrides the prompt. Would require replacing the root `LICENSE` with the Apache-2.0 text — explicitly disallowed by the prompt ("Do not replace it with Apache, MIT or another licence") — and would need to be a deliberate, documented decision.

### Option C — Interim (before sign-off)
Keep everything as-is but mark the contradiction as **known/open** (this document + `IMPLEMENTATION_STATUS.md`), and do not ship branding/distribution material until resolved.

---

## 6. Open Questions for the Owner

1. ~~Which licence is authoritative?~~ **RESOLVED 2026-08-04**: AGPL-3.0 (root file, per prompt) — owner approved Option A.
2. Was the root `LICENSE` file deliberately AGPL-3.0, or was the AGPL text committed accidentally while metadata was updated to Apache-2.0? *(still interesting for history, but no longer blocking)*
3. For the Study RPG direction: does the project need to re-license or dual-license to protect original characters/lore (e.g. add a content licence notice separate from the code licence)? *(open, not blocking)*
4. Are any translations/screenshots/logo assets third-party owned? (None found, but confirm provenance.) *(open, not blocking)*
5. ~~Should third-party notices be consolidated into `THIRD_PARTY_NOTICES.md`?~~ **DONE in Phase 1** — created.

## 7. Resolution Log (Phase 1, 2026-08-04)

Owner approved **Option A — AGPL-3.0 as the single project licence** (per ADR-0001, `docs/architecture/decisions/0001-licence-decision.md`). Completed changes:

1. `backend/package.json` + `backend/package-lock.json`: `license` → `AGPL-3.0`.
2. `frontend/package.json`: added `license: AGPL-3.0` (previously absent).
3. `NOTICE`: header now declares AGPL-3.0; third-party list retained.
4. `README.md` + all 12 translated READMEs: badges, comparison tables, and License sections corrected to AGPL-3.0.
5. `CHANGELOG.md`: Apache references corrected; `FUTURE_GOAL.md`: correction notice added + history annotated.
6. Created `UPSTREAM.md` and `THIRD_PARTY_NOTICES.md`; added **Source Code & Licence** links to the frontend footer (15 locales).

Remaining (non-blocking): confirm no third-party-owned assets (Q4); decide content-licence handling for Study RPG (Q3).

**2026-08-14 — "remove the Studyield licence/attribution to make the repo private" request — declined as-is.** The owner asked whether Studyield-derived files could be recoded out and their licence/attribution stripped so the codebase could go private. That is not lawful while upstream-derived code remains: the upstream Studyield code is distributed under AGPL-3.0, and AGPL §5 (in conjunction with the copyright notices preserved in `NOTICE` and `UPSTREAM.md`) requires retaining the upstream copyright and licence notices — deleting them to hide provenance would be a licence violation, not a cleanup. The only lawful path to a private codebase is a **clean-room rewrite of the upstream-derived files** (reimplementation from the specification, not from the code). All new Study RPG work (Study RPG characters/lore/art, RPG engine, integrity/economy/wellbeing systems, and the Ocean data marketplace) is original code authored for this fork and remains under the same AGPL-3.0 project licence.

**2026-08-16 — clean-room rewrite program commissioned (owner decision) — in progress.** The owner now explicitly commissions that rewrite: *"rewrite all the files not by us and after rewriting everything we remove the license."* This is the lawful path the audit itself identified. The working ledger is `docs/audits/REWRITE_LEDGER.md`; every one of the 405 upstream files is tracked there with a disposition (`REWRITE`/`DELETE`/`REPLACE`/`KEEP`/`SCHEMA`). Rules of the program: (1) rewritten files keep the same observable behaviour and contracts but are original implementations — no copied code, no upstream branding, no upstream prose; (2) `KEEP` is used only for functional/generated/tool-dictated files with no upstream creative expression; (3) **the AGPL-3.0 `LICENSE`, the upstream attribution in `NOTICE`, and AGPL metadata are removed only as the final, gated step once the ledger shows zero unresolved upstream files** — removal before then would be premature and unlawful; (4) the inventory in `UPSTREAM_FILE_INVENTORY.md` and `UPSTREAM.md` remain the provenance record until that final step. Nothing in this update removes or obscures upstream attribution today; the AGPL terms continue to apply to the upstream-derived files until each is rewritten.

---

*Evidence gathered 2026-08-04. No legal conclusions intended; consult qualified counsel for distribution decisions.*
