# Feature Specification: Study RPG — Anti-Overstudy & Health-First Wellbeing

**Feature Branch**: `015-study-wellbeing`

**Created**: 2026-08-09

**Status**: Implemented

**Input**: Owner follow-up brief — "the AI must use the philosophy too. Also add
anti-OverStudy mechanisms to heavily dampen OverStudy and promote smarter
studying!" Building on spec 014 (F2W integrity) and the canonical product
philosophy in `docs/STUDY_RPG_PHILOSOPHY.md`.

## Problem

Two gaps after spec 014:

1. **The AI did not speak the philosophy.** Every AI surface (chat assistant,
   Feynman teach-back evaluator, campfire tutor, programme architect, learning
   path coach) had its own generic system prompt. None of them refused to
   encourage cramming, none steered a tired or late-night student toward rest,
   and none consistently judged depth over length.
2. **Over-study was not dampened.** The reward economy rewarded *time* with no
   diminishing returns. A student who ground 8-hour days earned the same rate
   as a student studying the healthy optimum — actively training the wrong
   behaviour and rewarding grind over spaced, rested, deep learning.

## User Scenarios & Testing

### User Story 1 — Every AI agent uses the philosophy (Priority: P0)

All AI system prompts share one canonical philosophy block: depth over length,
mastery over memorisation, health first (anti-overstudy guardian), Free to Win,
game-to-reality framing, honest evidence-based tone, Socratic style. Each AI
agent follows it on top of its feature instructions.

**Acceptance Scenarios**:

1. **Given** a student tells the chat assistant they have been studying for
   hours, are exhausted, or it is very late, **When** the assistant replies,
   **Then** it gently but firmly recommends rest/sleep and explains that rest
   makes prior study consolidate — it never suggests "one more hour".
2. **Given** a Feynman teach-back evaluation, **When** the evaluator scores an
   answer, **Then** it judges understanding (accuracy/clarity/completeness),
   not effort or length, and never flatters without a specific reason.
3. **Given** a campfire tutor question or a depth grade, **When** it is
   generated, **Then** it follows the philosophy block (synthesis over recall,
   depth over length).

### User Story 2 — Diminishing returns on excess study (Priority: P0)

Rewards for study activity decay once the day's completed focus minutes pass
the healthy optimum, and floor out at a heavily dampened factor at the hard
daily cap. Night-window (IST) activity is additionally dampened.

**Acceptance Scenarios**:

1. **Given** a user with 60 focus minutes today completing another session,
   **When** rewards are computed, **Then** the full factor (1.0) applies.
2. **Given** a user with 180 focus minutes today (past the 120-minute optimum),
   **When** rewards are computed, **Then** the reward factor is ~0.55.
3. **Given** a user at/over the 240-minute hard cap, **When** rewards are
   computed, **Then** the reward factor is 0.1 (minFactor) — over-study is
   tolerated but heavily dampened.

### User Story 3 — Mandatory rest cooldown between long blocks (Priority: P0)

Starting a new focus session is blocked (with a health-first message) when a
long completed block ended within the cooldown window, and blocked entirely
once the hard daily cap is reached.

**Acceptance Scenarios**:

1. **Given** a completed session of ≥ 60 minutes that ended < 20 minutes ago,
   **When** the user tries to start another session, **Then** it is rejected
   with a message telling them to take a real break.
2. **Given** a completed short session (e.g. 25 minutes), **When** the user
   starts another session immediately, **Then** it is allowed (quick recall
   checks are never blocked).
3. **Given** today's completed focus minutes ≥ the hard daily cap, **When** the
   user tries to start a session, **Then** it is rejected with a rest/sleep
   message.

### User Story 4 — Study-health UI (Priority: P1)

The Focus Sessions page shows a study-health meter (fresh → focused → draining
→ depleted), the healthy optimum vs the hard cap, the remaining daily budget,
the active reward factor, the cooldown state with a countdown, and a night-study
nudge — all in health-first copy that bridges game state to real cognitive
wellbeing.

**Acceptance Scenarios**:

1. **Given** the Focus Sessions page loads, **When** wellbeing data is
   available, **Then** the meter, budget, and band are rendered with the
   correct colours.
2. **Given** a cooldown is active, **When** the page renders, **Then** the
   Start button is disabled and the cooldown banner shows the minutes left.
3. **Given** the night window (22:00–06:00 IST), **When** the page renders,
   **Then** a "it's late" nudge is shown.

## Requirements

### Functional Requirements

- **FR-001**: A single shared philosophy prompt block MUST exist and be
  prepended to the system prompt of: chat assistant, teach-back evaluator +
  challenge agents, campfire tutor + depth grader, programme architect +
  reviewer, learning-path generator + reviewer.
- **FR-002**: Reward dampening MUST be a pure, config-driven function:
  factor = 1.0 up to `decayStartMinutes`, linear decay to `minFactor` at
  `hardDailyCapMinutes`, floored at `minFactor` beyond.
- **FR-003**: Focus-session completion MUST apply the dampening factor to the
  event-EXP amount (study_session), and the events study-activity feed MUST
  apply it to all other activity types (never double-applying to
  study_session). Night-window IST activity MUST be multiplied by
  `nightFactor`.
- **FR-004**: Focus-session start MUST be rejected when the hard daily cap is
  reached or when a rest cooldown is active after a long block.
- **FR-005**: `GET /focus-sessions/wellbeing` MUST return today's minutes, the
  optimum/cap, remaining budget, health percent + band, reward factor,
  cooldown state + minutes left, night flag, and `canStart`.
- **FR-006**: All values MUST have code defaults (`integrity-config.ts`
  `overStudy` block) and a `game_config` `rpg.integrity.overStudy` seed.

### Key Entities

- **OverStudyConfig** — optimal/decay/cap minutes, minFactor, cooldown
  windows, night window + factor (inside `rpg.integrity` config).
- **overstudy.ts** (pure) — `overStudyFactor`, `restRequired`,
  `minutesUntilRestAllowed`, `isNightHour`, `istHour`, `studyHealth`,
  `dailyBudgetRemaining`.
- **WellbeingView** — the `GET /focus-sessions/wellbeing` payload.
- **STUDY_RPG_PHILOSOPHY / withPhilosophy()** — the shared AI prompt block.

## Success Criteria

- Backend suite green incl. new `overstudy.spec.ts`; frontend `tsc -b --noEmit`
  clean.
- The wellbeing namespace exists in ALL 15 locale files; Focus Sessions page
  renders the meter and gates.
- `IMPLEMENTATION_STATUS.md`, `CHANGELOG.md`, `specs/README.md`, and the
  philosophy doc updated.

## Assumptions

- IST (UTC+5:30) is the platform's canonical day/timezone (as in spec 014).
- Dampening applies to reward *rates* (event EXP / StudyPass progress), not to
  the ability to study itself beyond the daily cap — health gates are
  explicit and copy-framed, never silent.
