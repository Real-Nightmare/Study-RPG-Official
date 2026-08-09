# Study RPG — Product Philosophy

> Captured from the product owner's handwritten vision notes (2026). This document is the
> canonical statement of what Study RPG is *for*. UI copy, rewards, and game systems should
> always be checked against it. Everything here is **already implemented** in the app — see the
> "Where it lives" notes under each item.

---

## Title

**Study RPG** — a tool meant to encourage *proper and deep learning*, not a simple studying tool.

## Overview

Study RPG is not a simple studying tool. It is a tool meant to encourage proper and deep learning:

- **Frees up time** by promoting **daily study using active recall tricks**.
- **Rewards study with playtime** — the brain learns to associate studying with dopamine, not dread.
- **Avoids procrastination** building up before exams.
- Uses **AI** to power **Quizzes**, **Revision Tests**, **Practice Exams**, **Teach Back (Feynman technique)** and **Collaborative Exams** — and more.

> Where it lives: AI chat → `/dashboard/chat`, quizzes → `/dashboard/live-quiz`, practice exams →
> `/dashboard/exam-clone` + `/dashboard/practice-exam`, teach-back → `/dashboard/teach-back`,
> collaborative exams → `/dashboard/collaborative-exam`, revision tests → Revision Centre programme below.

## The Five Features

### 1. Missions

Any task — homework, TP, assignment, etc. — is considered a **mission** with **low-level rewards**.
Missions promote the **rote memorisation** that memory skills require.

> Where it lives: `/dashboard/tasks` (nav: **Missions**). Completing a mission grants low-tier XP/rewards
> via the RPG reward pipeline (`backend/src/modules/rpg` + `backend/src/modules/integrity/reward-curve.ts`).

### 2. Revision Centre

A programme that promotes proper revision and prioritises **"Depth over Length"**. To get
**medium-level rewards** you must **prove** you've revised by doing a quiz where you are asked to
**use the idea you learned in a different scenario**. To participate, the student must **sign up**.

> Where it lives: seeded programme template `"Revision Centre"` in migration
> `backend/migrations/026_study_advanced.sql`, instantiated via `/dashboard/programmes`.
> Rewards are gated on demonstrated application (medium tier), not passive time.

### 3. Competency-Based Testing

A programme that tests students on **competency-based questions**, which:
- enhances **thinking skills**,
- prepares students for **board exams**,
- provides **insights into why marks were lost and how to improve**.

Students can **choose a subject** to be tested on.

> Where it lives: `/dashboard/exam-centre` (subject selection, mistake analysis, revision plans) and
> `/dashboard/exam-clone` (marks insights + review queue). The Exam Centre subtitle now describes this
> programme directly.

### 4. Programmes

A framework designed to help students **think about problems** — in class or about a topic — and
**make a system** designed to resolve that issue and improve studies. This targets **thinking skills**:
helping students think and create systems. **All programmes are optional** — *your choice matters most*.

> Where it lives: `/dashboard/programmes` (suggest a programme or start from a template; AI builds the
> full programme; optional to join; reward policy + objectives per programme).

### 5. Factions

Splits students into groups with **one team leader** who leads the Faction to improve studies and
increase its score for rewards. **Weaker Factions are required to receive help from stronger factions**
— creating a culture of studying by helping each other.

> Where it lives: `/dashboard/factions` — auto-balanced teams, elected leaders, **help pledges**
> (record help given to weaker factions), and monthly settlement scoring.

---

## The Goal

The goal of Study RPG is to **learn through mastery and understanding of topics, rather than simple
memorisation**. Jobs require mastery of study, which rote memorisation cannot beat — it requires the
**skill of true learning**.

Study RPG also **prioritises the health of the student** and ensures a **proper timetable**:
even if you miss some study time, it will **reschedule time for proper and efficient study** — while
still promoting **unity and more ideas through events**.

> Where it lives: focus sessions + timetable rescheduling (`/dashboard/focus`), study events
> (`/dashboard/events`), the F2W integrity layer
> (`backend/src/modules/integrity/` — reward curve, behavior guard, campfire reflection loop), and the
> **anti-overstudy wellbeing layer** (spec 015) — `backend/src/modules/integrity/overstudy.ts`
> (diminishing returns past the healthy daily optimum, rest-cooldown gate, IST night-rest guard,
> study-health bands) enforced in focus-session start/complete + event EXP, with a study-health
> meter on the focus page; every AI surface shares the canonical philosophy block in
> `backend/src/modules/ai/study-rpg-philosophy.ts` (incl. the health-first anti-overstudy guardian).

---

## Design Rules (how this reads in the UI)

1. **Depth over length.** Proven application beats hours logged. Rewards scale with demonstrated understanding.
2. **Mastery over memorisation.** Copy never celebrates passive grinding; it celebrates real cognitive progress.
3. **Free to Win (F2W).** No pay-to-win shortcuts. Every reward is earned through academic achievement.
4. **Study = playtime.** Game mechanics exist to make studying feel rewarding, never to replace it.
5. **Health first.** Timetables reschedule missed time; the system never punishes a student for resting.
6. **Unity through help.** Factions, events and collaborative exams exist so students lift each other up.
