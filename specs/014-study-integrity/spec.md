# Feature Specification: Study RPG Integrity (F2W Meritocracy & Anti-Cheese)

**Feature Branch**: `014-study-integrity`

**Created**: 2026-08-07

**Status**: Implemented

**Input**: Owner brief — "Principal EdTech Architect / Gamification Expert" mandates:
(1) Core Mechanic Hardening, (2) Anti-Cheese & Anti-Slop Safeguards,
(3) 100% Free-to-Win (F2W) Integrity, (4) Psychological UI Re-framing,
(5) Metacognitive "Campfire" Loops.

**Audit summary (from code review 2026-08-07)**:

- STP/SLC is the only currency and is minted exclusively from study activity,
  battles (daily-capped), quests and StudyPass rewards. There is **no
  real-money → STP path**; the "Gold Pass" costs 1500 in-game SLC, not cash.
  F2W is structurally intact; the P2W-adjacent risk is *naming* and *framing*.
- Cheesing vectors found:
  1. `FocusSessionsService.complete` accepts a client-supplied `focusMinutes`
     override → passive/idle timers mint event EXP and quest progress.
  2. `recordStudyActivity` grants flat event EXP for `quiz_attempt`/`study_session`
     regardless of accuracy or engagement.
  3. Battle mana-quiz (`correctCount`) and damage-challenge (`allCorrect`) are
     graded from client-supplied booleans.
  4. Teach-back XP is written straight to `user_xp_events` (no level recompute)
     with flat tiers and no anti-slop guard.
- There is **no metacognitive reflection loop** anywhere in the product.

---

## User Scenarios & Testing

### User Story 1 — Study-first reward economy (Priority: P0)

Premium rewards (STP, loot, XP) scale with cognitive effort: accuracy, focus
consistency, and material difficulty. A perfect spaced-repetition session, a
passed AI-cloned practice exam, or a successful Teach-Back evaluation earns
strictly more than repetition of easy activity.

**Why this priority**: This is the core mechanic — every reward path must reward
real learning, or the game trains the wrong behaviour.

**Acceptance Scenarios**:

1. **Given** a quiz attempt at 100% accuracy vs one at 60%, **When** rewards are
   computed, **Then** the 100% attempt earns at least 3× the 60% attempt.
2. **Given** an exam-clone practice attempt ≥ 80% accuracy, **When** it is
   submitted, **Then** STP + XP are granted (daily-capped); below the threshold
   no premium reward is granted.
3. **Given** a Teach-Back evaluation ≥ 70, **When** it is evaluated, **Then** XP
   is granted through the level-aware path and STP is credited once per day.

### User Story 2 — Anti-cheese behavioural verification (Priority: P0)

Backend rate-limits and verification loops prevent passive-timer farming,
answer spam, and rapid-wrong-answer gold farming. Reward output is throttled or
zeroed when behaviour is non-credible.

**Acceptance Scenarios**:

1. **Given** a focus session completes, **When** no verified study engagement
   (quiz/exam/flashcard activity) occurred during the session window, **Then**
   the session is marked unverified and accrues at most a reduced fraction of
   event EXP, and the client-supplied minute override is ignored.
2. **Given** a user submits quiz attempts faster than the configured minimum
   time-per-question or beyond the per-hour attempt cap, **When** the attempt
   is processed, **Then** no XP/STP reward is granted for the attempt.
3. **Given** a battle victory is claimed, **When** the player's rolling 7-day
   academic accuracy is below the honesty floor, **Then** the battle reward is
   paid at the flat baseline without the premium multiplier.

### User Story 3 — 100% Free-to-Win integrity (Priority: P1)

No status symbol, cosmetic, or functional item can be bought with money or
obtained by skipping study requirements. The integrity policy is enforced in
code and documented in the spec.

**Acceptance Scenarios**:

1. **Given** any STP spend path, **When** audited, **Then** STP can only have
   been earned via study-gated sources (no purchase endpoint exists).
2. **Given** the Gold Study Pass, **When** inspected, **Then** its 1500 SLC cost
   is a merit-currency sink and its UI copy states that it is earned, never
   purchased.
3. **Given** a boss battle in the exam world, **When** a student with no recent
   verified mastery (perfect SRS run, exam ≥ 80%, or Teach-Back ≥ 70) attempts
   it, **Then** it is blocked with a study-first message.

### User Story 4 — Psychological re-framing (Priority: P1)

All gamification copy explicitly bridges game state to real-world cognitive
achievement. Level-ups, quests, and notifications describe capacity, mastery,
and retention — not detached game slang.

**Acceptance Scenarios**:

1. **Given** a level-up occurs, **When** the notification/modal is rendered,
   **Then** it states the real-world capacity gained and the skill/topic
   mastered.
2. **Given** a quiz completion notification, **When** it is created, **Then** the
   copy is mastery-oriented ("retention checkpoint passed") rather than
   cheerleading ("🎉 Perfect Score!").

### User Story 5 — Metacognitive Campfire loop (Priority: P0)

Before cashing in session rewards or ending a study session, the student is
intercepted by a mandatory reflection modal. The AI tutor asks a single,
targeted synthesis question about the material just reviewed. A depth score
(0–100) from the answer yields a 1.0×–1.5× loot/reward multiplier.

**Acceptance Scenarios**:

1. **Given** a study session ends, **When** the student attempts to finalise it,
   **Then** the campfire modal blocks finalisation until answered or explicitly
   deferred (deferral = 1.0× multiplier).
2. **Given** a deep, accurate synthesis answer (depth ≥ 80), **When** it is
   graded, **Then** a 1.5× multiplier is recorded and applied to the next reward
   claim.
3. **Given** no AI client is configured, **When** the reflection is graded,
   **Then** a deterministic lexical depth heuristic is used so the loop never
   dead-ends.

---

## Requirements

### Functional Requirements

- **FR-001** A `rpg.integrity` `game_config` entry MUST configure reward math,
  rate limits, focus caps, and campfire thresholds with code defaults.
- **FR-002** Reward computation MUST be a pure, unit-tested function combining
  accuracy, focus consistency, material difficulty, and campfire multiplier.
- **FR-003** Behaviour guards MUST be pure, unit-tested functions (sliding-window
  rate limits, answer-time sanity, timer verification).
- **FR-004** `FocusSessionsService.complete` MUST ignore any client-supplied
  minute override (server clock only) and MUST mark sessions unverified when no
  engagement signal exists in the session window.
- **FR-005** Quiz attempts MUST grant accuracy-scaled XP/STP with per-hour attempt
  caps and minimum time-per-question sanity checks.
- **FR-006** Exam-clone attempts MUST grant accuracy-scaled XP/STP with a
  per-day attempt cap and minimum time-per-question sanity checks.
- **FR-007** Teach-Back MUST grant XP through `PlayerService.addXp` (level-aware)
  and STP for passing evaluations, with a minimum explanation length.
- **FR-008** Battle rewards MUST be multiplied by the player's rolling academic
  integrity score, and exam-world bosses MUST be gated behind recent verified
  mastery.
- **FR-009** A `campfire_reflections` table MUST persist question, answer, depth
  score, multiplier, and session context; claims MUST be idempotent and capped
  per day.
- **FR-010** All user-facing gamification copy (backend notifications + frontend
  locale strings) MUST bridge game state to real-world learning outcomes.

### Non-Functional Requirements

- **NFR-001** All new pure logic MUST ship with unit tests (backend `npm test`).
- **NFR-002** AI calls in the campfire loop MUST degrade gracefully (deterministic
  fallback) and be cost-bounded (max 3 reflections/day/user).
- **NFR-003** No real-money to in-game currency conversion may be introduced.
- **NFR-004** Frontend additions MUST keep `tsc -b --noEmit` and `npm run lint`
  green and add locale keys to **all 15 locale files**.

---

## Edge Cases

- Focus session paused/resumed multiple times — elapsed is server-clock delta
  from `started_at`/`resumed_at`; verification window spans the whole session.
- AI timeout on campfire grading — fall back to lexical depth; multiplier 1.0×.
- Battle reward claim already idempotency-keyed — multiplier must not re-apply.
- Quiz attempt with zero questions or all-unanswered — no reward, no error.
- Daily cap reached — further attempts earn 0 premium rewards but still complete.
