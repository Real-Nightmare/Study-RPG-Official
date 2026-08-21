# Study RPG — Product Requirements Document (PRD) v1.0

> **Version**: 1.0 GA
> **Date**: 2026-08-21
> **Author**: Study RPG Team
> **Status**: Draft — pending stakeholder review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Philosophy](#2-product-vision--philosophy)
3. [Target Market & Users](#3-target-market--users)
4. [Business Model & Monetization](#4-business-model--monetization)
5. [Scope & Versioning](#5-scope--versioning)
6. [Core User Journeys](#6-core-user-journeys)
7. [Feature Specifications](#7-feature-specifications)
8. [Technical Architecture](#8-technical-architecture)
9. [Data Privacy & Compliance](#9-data-privacy--compliance)
10. [AI Model Requirements](#10-ai-model-requirements)
11. [Platform & Device Strategy](#11-platform--device-strategy)
12. [Success Metrics & Targets](#12-success-metrics--targets)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Timeline & Milestones](#15-timeline--milestones)
16. [Appendix](#16-appendix)

---

## 1. Executive Summary

**Study RPG** is a gamified AI learning platform that wraps academic study tools in an RPG layer where all progression is earned through real study depth — never purchased. The platform combines spaced repetition, AI-powered tutoring, and gamification (cards, battles, factions, events) to make studying engaging while promoting healthy study habits.

**Key Differentiators**:
- **Health-first anti-overstudy**: The platform actively discourages unhealthy study patterns
- **Campfire Reflections**: Mandatory metacognitive questions before reward cash-out
- **Free-to-Win Meritocracy**: Zero pay-to-win paths; subscriptions only gate infrastructure
- **Exponential Reward Curve**: Accuracy-based with difficulty multipliers
- **Privacy-first Data Marketplace**: Aggregate educational data sold via Ocean Protocol

**v1.0 GA Target**: CBSE Grade 9 students in India, responsive web (mobile + desktop), freemium model.

---

## 2. Product Vision & Philosophy

### 2.1 Vision Statement

*"Make studying feel like playing your favorite RPG — where every concept mastered, every focus session completed, and every mistake learned from makes your character stronger in ways that map directly to real-world cognitive improvement."*

### 2.2 Core Philosophy (from `docs/STUDY_RPG_PHILOSOPHY.md`)

1. **Depth over length** — Quality study matters more than hours logged
2. **Health-first anti-overstudy** — The platform actively discourages cramming
3. **Free-to-Win** — Zero pay-to-win paths; subscriptions only gate infrastructure
4. **Game-to-reality framing** — RPG rewards map to real cognitive improvement
5. **Mastery over memorisation** — Understanding is tested, not just recall

### 2.3 Brand Promise

Study RPG promises:
- Studying this way actually improves your grades (measurable via quizzes, teach-back)
- Your character grows because YOU learned something real (anti-cheese guards enforce this)
- You'll never be encouraged to study past healthy limits (wellbeing guards)
- Your data is private and you control whether it's used (consent-gated marketplace)

---

## 3. Target Market & Users

### 3.1 Primary Users

| User Type | Description | Age | Location |
|-----------|-------------|-----|----------|
| **Students** | CBSE Grade 9 students preparing for board exams and school tests | 13-15 | India |
| **Parents** | Parents of students who want to monitor and support study habits | 35-50 | India |
| **Teachers** | School teachers who want to assign and track study activities | 25-55 | India |

### 3.2 Secondary Users

| User Type | Description | When |
|-----------|-------------|------|
| **School Administrators** | Schools wanting to adopt the platform for their students | v2.0 (B2B2C) |
| **EdTech Researchers** | Researchers wanting aggregate educational data | v2.0 (Data Marketplace) |

### 3.3 User Personas

**Persona 1: Aarav (Student)**
- 14 years old, Class 9, Delhi
- Struggles with maintaining study consistency
- Likes games (BGMI, Free Fire)
- Parents worry about screen time vs. study time
- **Goal**: Study effectively while feeling like he's "playing"
- **Pain Point**: Traditional study apps feel boring, no feedback on what he actually learned

**Persona 2: Priya (Parent)**
- 38 years old, working professional
- Wants Aarav to study more but healthily
- Doesn't understand gaming terminology
- **Goal**: See that Aarav is studying effectively, not just grinding
- **Pain Point**: Can't tell if study time is productive or wasted

**Persona 3: Mr. Sharma (Teacher)**
- 42 years old, teaches Science at a Delhi school
- 35 students in class, hard to track individual progress
- **Goal**: See which students are struggling, assign targeted practice
- **Pain Point**: No way to see real-time study patterns outside class

---

## 4. Business Model & Monetization

### 4.1 Revenue Model: Freemium B2C

| Tier | Price | What's Included |
|------|-------|-----------------|
| **Free** | ₹0 | All study tools (focus sessions, flashcards, notes, quizzes), 1 battle/day, 1 programme, basic RPG progression, Campfire reflections |
| **Pro** | ₹99/month or ₹799/year | Unlimited battles, unlimited programmes, advanced analytics, priority AI response, more storage, custom themes |
| **School** (v2.0) | ₹499/student/year | Admin dashboard, syllabus management, teacher tools, cohort analytics, bulk student import |

### 4.2 Secondary Revenue Streams

1. **Data Marketplace** (v2.0): Aggregate anonymized educational data sold to EdTech researchers via Ocean Protocol
   - **Privacy guarantee**: Aggregate-only (min 50 students per group), no PII, consent-gated
   - **Expected contribution**: 5-10% of total revenue
   - **Opt-in required**: Users explicitly consent to data participation

2. **Premium Cosmetics** (v2.0, optional): Custom card backs, avatar accessories, battle animations
   - **Non-gameplay**: Does not affect stats, STP, or progression
   - **Cosmetic-only**: Pure aesthetic customization

### 4.3 Anti-Pay-to-Win Enforcement

The `integrity` module enforces:
- **Zero code paths** purchase STP/XP with real money
- **Every status symbol** is gated behind academic achievement thresholds
- **Stripe subscription** is infra-level only (limits, priority, storage)
- **Verified by**: `integrity-config.ts` contains the enforcement rules

### 4.4 Unit Economics (Estimated)

| Metric | Target |
|--------|--------|
| Customer Acquisition Cost (CAC) | ₹50-100 (organic + referrals) |
| Lifetime Value (LTV) | ₹500-1000 (12-month retention) |
| LTV:CAC Ratio | 5-10x |
| Free → Pro Conversion | 5-10% |
| Monthly Churn (Pro) | <5% |
| AI Cost per Active User/Month | $0.50-2.00 |

---

## 5. Scope & Versioning

### 5.1 v1.0 GA (Current Release)

**In Scope**:
- ✅ Study tools: Focus sessions, tasks, flashcards, notes, quizzes
- ✅ AI learning: Programme builder, teach-back evaluation, learning paths
- ✅ RPG progression: Stats, cards, decks, PvE battles
- ✅ Integrity: Campfire reflections, anti-cheese guards, exponential rewards
- ✅ Wellbeing: Rest cooldowns, night-rest nudges, overstudy dampening
- ✅ Admin: Super-admin role, audit logs
- ✅ Platform: CBSE Grade 9 preset, responsive web

**Out of Scope (v1.0)**:
- ❌ Economy/marketplace (buying/selling cards)
- ❌ Events (StudyPass, quests, Abstracted, Great Extinction)
- ❌ Social (friends, chat, factions)
- ❌ PvP duels
- ❌ Data marketplace (Ocean Protocol)
- ❌ B2B2C school licensing
- ❌ Native mobile apps
- ❌ Multi-curriculum (CBSE Grades 10-12, ICSE, etc.)

### 5.2 v1.1 (3 Months Post-Launch)

**Add**:
- Economy/marketplace (buy/sell cards, offers, burn mechanics)
- Events (StudyPass, daily/weekly quests, event EXP)
- Social (friends list, DMs, basic chat)
- PvP duels (async ghost battles)
- CBSE Grades 10-12

**Platform**: PWA with offline support for flashcards and notes

### 5.3 v2.0 (6 Months Post-Launch)

**Add**:
- Data marketplace (Ocean Protocol integration)
- Faction wars (monthly settlement, faction quests)
- Competitive exam prep (JEE, NEET patterns)
- B2B2C school licensing
- Native mobile apps (iOS/Android)

**Expand**: ICSE, state boards, international curricula (GCSE, IB)

---

## 6. Core User Journeys

### 6.1 Journey 1: Study Session → Reward Loop (PRIMARY)

```
Student opens app → Sees today's plan on dashboard
    → Starts a focus session (25 min timer)
    → Studies a subject (reads notes, practices flashcards)
    → Timer completes → Session logged
    → Campfire reflection appears (ONE targeted question)
    → Student answers → AI grades depth (0-100)
    → Reward multiplier applied (1.0-1.5×)
    → STP + XP granted → Character levels up
    → Student sees mastery message: "Your real-world cognitive capacity increased!"
```

**Why this journey matters**: This is the core loop that drives daily engagement. If this feels rewarding and meaningful, students will come back.

**Success criteria**:
- Campfire reflection completion rate > 70%
- Average focus session duration: 25-45 minutes (healthy range)
- Student reports feeling "rewarded for real learning" in surveys

### 6.2 Journey 2: AI-Powered Learning Path

```
Student wants to prepare for Science exam
    → Creates a new programme ("Science Chapter 5 Prep")
    → AI builds objectives, milestones, activities, reward policy
    → Programme activates immediately
    → Student follows the learning path (ordered steps)
    → Completes teach-back: explains a concept in own words
    → AI evaluates depth and accuracy
    → Student earns mastery rating for that concept
    → Programme progresses → Next step unlocked
    → Student completes programme → Final assessment
```

**Why this journey matters**: This is the "magic" that differentiates Study RPG from flashcard apps. The AI understands what the student needs and builds a personalised path.

**Success criteria**:
- Programme completion rate > 40%
- Teach-back depth score increases +20% after 30 days
- Student reports "I understand better" in surveys

### 6.3 Journey 3: Battle Progression

```
Student has earned enough STP from studying
    → Visits RPG page → Sees character stats, cards, decks
    → Assembles a deck (5 cards with restricted abilities)
    → Enters battle against a PvE monster
    → Battle plays out: quiz questions determine mana, card abilities deal damage
    → Student wins → Earns STP + XP + chance for new card
    → Levels up → Unlocks new battle worlds
    → Challenges a friend to PvP duel
    → Friend accepts → Ghost battle (deterministic, fair)
    → Winner earns rating points → Leaderboard updates
```

**Why this journey matters**: Battles are the "hook" that makes studying feel like gaming. The RPG progression gives students a reason to study consistently.

**Success criteria**:
- Battle participation rate: 40% of active users
- PvP duel acceptance rate > 60%
- Battle rating correlates with quiz accuracy (r > 0.5)

---

## 7. Feature Specifications

### 7.1 Study Tools (v1.0)

#### Focus Sessions
- **Timer**: Pomodoro-style (25 min default, configurable)
- **Rest-cooldown gates**: After long sessions, forced rest period
- **Night-rest nudges**: Discourages studying past 11 PM IST
- **Server-verified engagement**: Client time claims rejected; server counts real study
- **Study health meter**: Visual indicator of daily study budget remaining

#### Study Tasks
- **Priority-based**: High/Medium/Low with due dates
- **Recurrence**: Daily, weekly, custom schedules
- **Subject links**: Tasks tied to specific subjects/chapters
- **Today's plan**: Dashboard widget showing what to study today

#### Flashcards
- **Spaced repetition**: SM-2 algorithm with ease factors
- **Review scheduling**: Cards due for review shown automatically
- **Deck management**: Create, edit, delete study sets
- **Import/export**: Support for Anki-style imports

#### Notes
- **Rich text**: Markdown support with LaTeX math rendering
- **Mind map view**: Visual concept mapping
- **Presentation view**: Slide-style review mode
- **Subject/chapter linking**: Notes tied to academic structure

#### Quizzes
- **AI-generated**: Based on uploaded content or syllabus
- **Live multiplayer**: Real-time quiz battles with classmates
- **Difficulty levels**: Easy/Medium/Hard with adaptive difficulty
- **Accuracy tracking**: Per-subject, per-chapter accuracy trends

#### Exam Clone
- **AI simulation**: Generates past exam-style papers
- **Hints system**: Progressive hints when stuck
- **Time tracking**: Exam conditions (timed, no hints after X attempts)
- **Result analysis**: Weak areas identified for improvement

#### Puzzles
- **Per-subject**: Different puzzle types per subject (math problems, science riddles)
- **Streaks**: Consecutive correct answers build streak
- **Ranked mode**: Daily leaderboard for puzzle performance
- **Personal best tracking**: See improvement over time

#### Mistake Notebook
- **Categorisation**: Concept, careless, time pressure, guessing, other
- **Cause tracking**: Why was the mistake made?
- **Resolve/reopen lifecycle**: Track mastery of mistakes
- **Status counts**: How many mistakes pending vs. resolved

### 7.2 AI Features (v1.0)

#### Chat Assistant
- **RAG-powered**: Answers questions based on uploaded content
- **Philosophy-injected**: AI speaks the Study RPG philosophy (depth over length)
- **Context-aware**: Remembers conversation history
- **Source citations**: References specific documents/notes

#### Teach-Back (Feynman Technique)
- **Student explains**: Types or speaks an explanation of a concept
- **AI evaluates**: Grades depth, accuracy, and clarity (0-100)
- **Mastery framing**: "Your real-world cognitive capacity increased!"
- **STP rewards**: Only for high-quality explanations (≥70% depth)

#### Campfire Reflection
- **Mandatory before cash-out**: One targeted question before session rewards
- **AI grades**: Semantic depth (0-100) with deterministic fallback
- **Multiplier**: 1.0-1.5× based on depth score
- **Daily cap**: 3 reflections per day
- **Skip option**: Keeps 1.0× multiplier (no penalty)

#### Problem Solver
- **Multi-agent system**: Analysis → Solver → Verifier → Hints → Alternatives
- **LaTeX support**: Renders math problems properly
- **Step-by-step**: Shows working, not just answers
- **Similar problems**: Suggests practice problems for weak areas

#### Programme Builder
- **AI creates**: Objectives, milestones, activities, reward policy
- **Instant activation**: Programme starts immediately after creation
- **Review queue**: Admin/AI can review and approve programmes
- **Templates**: Pre-built programme templates for common needs

#### Learning Paths
- **AI-mapped**: Converts programme objectives into ordered steps
- **Self-review**: AI scores its own path (never blocks, just flags)
- **Regeneration**: If score < 60%, path can be regenerated
- **Progress tracking**: Visual progress through the path

#### Deep Research
- **Web search + RAG**: Comprehensive research reports
- **Cited sources**: All claims backed by sources
- **Export**: PDF/Markdown export of research reports

### 7.3 RPG System (v1.0)

#### Player Stats
- **XP**: Experience points for leveling up
- **Level**: 1-100 (configurable thresholds)
- **STP (Study Tokens)**: In-game currency earned through study
- **Battle Rating**: Elo-style rating for matchmaking
- **Study Streak**: Consecutive days of studying
- **Puzzle Streak**: Consecutive puzzle completions

#### STP Ledger
- **Immutable**: Every mutation logged with full audit trail
- **Idempotent**: Duplicate requests don't double-count
- **Transparent**: Students can see every STP earned/spent

#### Cards
- **9 original cards**: Each with unique ability and lore
- **Rarities**: Common, Rare, Epic, Legendary
- **Abilities**: Poison, Decay, Shield, Silence, Damage, Heal, etc.
- **Restricted decks**: Exactly 5 cards, one of each ability type

#### Battle Engine
- **Deterministic**: Same seed → same outcome (replayable)
- **Server-authoritative**: Client cannot cheat
- **Quiz-based mana**: Correct answers = mana to play cards
- **Status effects**: Poison, Decay, Shield, Silence with turn-based mechanics
- **6 PvE monsters + exam bosses**: Across different worlds

#### PvP Duels (v1.1)
- **Async ghost battles**: Fight a snapshot of opponent's deck
- **Fair**: Both sides fight deterministic ghosts
- **Elo rating**: Matchmaking by skill level
- **Rewards**: STP + XP for winners

### 7.4 Integrity System (v1.0)

#### Anti-Cheese Guards
- **Rate limiting**: Quiz attempts capped at 12/hour
- **Answer time sanity**: Minimum 4 seconds per question
- **Focus verification**: Server-clock only, idle detection
- **Daily caps**: 240 minutes focus, 10 battle wins, 200 STP/day

#### Exponential Reward Curve
- **Accuracy-based**: 0× at <60%, 3.5× at 100%
- **Difficulty multiplier**: Easy 1.0×, Medium 1.5×, Hard 2.0×
- **Campfire multiplier**: 1.0-1.5× from reflection depth
- **Never purchasable**: All rewards earned through study

#### Wellbeing Guards
- **Rest cooldown**: Forced rest after long study blocks
- **Night-rest nudge**: Discourages studying past 11 PM IST
- **Overstudy dampening**: Diminishing returns beyond healthy daily limit
- **Study health meter**: Visual feedback on daily budget

### 7.5 Platform Features (v1.0)

#### Dashboard
- **Widget grid**: Today's plan, tasks, exams, stats, quests
- **Hide game stats**: Toggle to show/hide RPG elements
- **Quick actions**: Start session, create task, open flashcards

#### Admin
- **Super-admin**: Full user management, audit logs
- **Audit trail**: Every admin action logged with reason
- **System status**: Health checks, queue stats, user counts

#### Notifications
- **Web push**: VAPID-based push notifications
- **In-app**: Notification bell with unread count
- **Email**: Transactional emails (account, password reset)

---

## 8. Technical Architecture

### 8.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React SPA)                   │
│  React 19 + Vite 7 + Tailwind + Radix UI + Zustand      │
│  TanStack Query + Socket.IO Client + i18n (15 locales)   │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP + WebSocket
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend (NestJS API)                   │
│  NestJS 10 + TypeScript + Raw SQL (no ORM)               │
│  43 modules + Custom migration runner                     │
└───────┬─────────────┬─────────────┬─────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│PostgreSQL│  │  Redis   │  │ Qdrant   │
│   15     │  │    7     │  │(vectors) │
└──────────┘  └──────────┘  └──────────┘
        │
        ▼
┌──────────┐
│ClickHouse│
│(analytics)│
└──────────┘
```

### 8.2 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 19, Vite 7, Tailwind CSS | UI framework |
| UI Components | Radix UI (shadcn-style) | Accessible components |
| State Management | Zustand (client), TanStack Query (server) | State |
| Backend | NestJS 10, TypeScript | API framework |
| Database | PostgreSQL 15 | Primary data store |
| Cache/Queue | Redis 7 + BullMQ | Caching, background jobs |
| Vector Search | Qdrant | RAG retrieval |
| Analytics | ClickHouse | Usage analytics |
| Realtime | Socket.IO | Chat, battles, live quiz |
| AI | OpenRouter (Claude 3 Sonnet) | LLM inference |
| Payments | Stripe | Subscription billing |
| Push | Web Push (VAPID) | Browser notifications |
| Data Marketplace | Ocean Protocol | Aggregate data sales |

### 8.3 Database Schema

**60+ tables** across:
- Core academic (users, subjects, chapters, topics)
- Study tools (focus sessions, flashcards, notes, documents)
- RPG system (player profiles, cards, decks, battles)
- Economy (marketplace, listings, supply ledger)
- Events (StudyPass, quests, milestones)
- Social (friends, DMs, factions, parties)
- Integrity (campfire reflections, audit logs)
- Programme system (programmes, learning paths)
- Data marketplace (consent, datasets, benchmarks)
- Infrastructure (game config, web push subscriptions)

### 8.4 API Design

- **REST**: Standard CRUD operations
- **WebSocket**: Realtime features (chat, battles, quiz)
- **Authentication**: JWT (email-optional, username-based)
- **Validation**: class-validator with `forbidNonWhitelisted`
- **Response format**: camelCase via interceptor

### 8.5 Deployment

- **Docker Compose**: Full stack orchestration
- **Services**: PostgreSQL, Redis, Qdrant, ClickHouse, Backend, Frontend (Nginx)
- **CI/CD**: GitHub Actions (lint, typecheck, build)
- **Migrations**: Custom runner (`scripts/migrate.js`)

---

## 9. Data Privacy & Compliance

### 9.1 Regulatory Requirements

| Regulation | Applicability | Requirements |
|------------|---------------|--------------|
| **India DPDP Act 2023** | Primary (India) | Parental consent for <18, data fiduciary obligations, right to erasure |
| **GDPR-K** | If EU students | Parental consent for <16, data minimization, right to be forgotten |
| **COPPA** | If US students | Parental consent for <13, no behavioral advertising |

### 9.2 Current Implementation

**What exists**:
- `users.email` (nullable) + `users.username` — PII stored
- `data_consent` table — opt-in consent for data marketplace
- `marketplace_datasets` — aggregated student performance data
- `privacy-guard.ts` — Enforces aggregate-only, PII blocklist, minimum group size

**What's missing for v1.0**:
- ❌ Age gate on registration
- ❌ Parental consent flow
- ❌ Complete data deletion API
- ❌ Privacy policy implementation beyond static page

### 9.3 v1.0 Compliance Requirements

1. **Age verification**: Collect birthdate on registration, reject <13, require parental consent for <18
2. **Parental consent flow**: Email verification + consent form for minors
3. **Data minimization**: Only collect what's necessary (email optional, school name optional)
4. **Right to erasure**: Complete account deletion API (partially exists)
5. **Privacy policy**: Must explicitly state data practices, including marketplace participation
6. **Consent management**: Users can withdraw consent at any time

### 9.4 Data Marketplace Privacy (v2.0)

**Hard rules** (enforced in `privacy-guard.ts`):
- **Aggregate-only**: Minimum 50 students per group, no individual data
- **PII blocklist**: Names, emails, usernames, specific timestamps blocked
- **Consent-gated**: Only students who explicitly opt-in participate
- **Checksummed DDO**: Data integrity verification via Ocean Protocol
- **Revocable**: Users can withdraw consent and remove their data

---

## 10. AI Model Requirements

### 10.1 Current Setup

| Aspect | Current | Target |
|--------|---------|--------|
| **Provider** | OpenRouter | OpenRouter |
| **Model** | Claude 3 Sonnet (configurable) | Claude 3 Sonnet |
| **Use cases** | Chat, teach-back, campfire, programmes, learning paths | Same |
| **Fallback** | Deterministic lexical scoring (campfire) | Same |

### 10.2 Accuracy Requirements

| Use Case | Accuracy Requirement | Measurement |
|----------|---------------------|-------------|
| **Quiz grading** | 100% for objective questions | Unit tests |
| **Teach-back evaluation** | Within 15% of human expert rating | Pilot testing |
| **Campfire reflection** | Consistent scoring (deterministic fallback) | Unit tests |
| **Programme building** | Relevant objectives/milestones | Admin review queue |
| **Learning path generation** | Logical ordering, appropriate difficulty | Self-review scoring |

### 10.3 Cost Management

**Estimated cost per active user per month**: $0.50-2.00

**Rate limits** (enforced in `integrity-config.ts`):
- Quiz: 12 attempts/hour
- Campfire: 3 reflections/day
- Chat: No explicit limit (but conversation history bounded)
- Programme building: 1 per day (AI review required)

**Cost optimization strategies**:
- Deterministic fallback for campfire (avoids AI call on skip)
- Conversation history pruning (bounded context window)
- Batch processing for non-realtime features (programme building)
- Model selection: Use cheaper models for low-stakes tasks (flashcard generation)

### 10.4 Quality Assurance

**Before launch**:
- Human expert evaluation of 100 teach-back responses
- Calibration of campfire depth scoring against human ratings
- A/B testing of AI-generated programmes vs. teacher-created ones
- Monitoring of AI failure rates and fallback triggers

---

## 11. Platform & Device Strategy

### 11.1 v1.0: Responsive Web

**Target devices**:
- Mobile browsers (Chrome, Safari, Samsung Internet)
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Tablet browsers (iPad, Android tablets)

**Responsive breakpoints**:
- Mobile: <768px (single column, bottom nav)
- Tablet: 768-1024px (two columns, side nav)
- Desktop: >1024px (full layout, side nav)

**Realtime performance targets**:
- Battle actions: <500ms latency
- Chat messages: <1s latency
- AI responses: <2s for chat, <5s for programme building
- Page load: <2s on 3G, <1s on 4G/WiFi

### 11.2 v1.1: PWA

**Additions**:
- Service worker for offline flashcard review
- Push notifications for study reminders
- App-like experience (installable, splash screen)
- Background sync for study session data

### 11.3 v2.0: Native Mobile Apps

**If justified by traction** (>100k MAU):
- iOS (Swift/SwiftUI)
- Android (Kotlin/Compose)
- Shared backend API
- Native push notifications
- Offline study mode

---

## 12. Success Metrics & Targets

### 12.1 Engagement Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| DAU/WAU ratio | >0.3 | Analytics |
| Average focus session duration | 25-45 minutes | Focus sessions table |
| Campfire reflection completion rate | >70% | Campfire reflections table |
| Programme completion rate | >40% | Programmes table |
| Battle participation rate | 40% of active users | Battles table |

### 12.2 Learning Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Quiz accuracy improvement | +15% after 30 days | Quiz attempts table |
| Teach-back depth score increase | +20% after 30 days | Teach-back evaluations |
| Mistake notebook resolution rate | >60% | Mistakes table |
| Study streak (consecutive days) | >7 days median | Player profiles table |

### 12.3 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Free → Pro conversion | 5-10% | Stripe subscriptions |
| Monthly churn (Pro) | <5% | Stripe subscriptions |
| Data marketplace opt-in | 30% of users | Data consent table |
| NPS score | >50 | User surveys |
| App store rating | >4.5 stars | App stores (v2.0) |

### 12.4 Health Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Average daily study time | 60-120 minutes | Focus sessions table |
| Overstudy detection rate | <10% of sessions | Wellbeing guards |
| Night study rate | <5% of sessions | Night-rest nudge |
| Rest compliance | >80% of nudges | Focus sessions table |

### 12.5 Pilot Phase

**Recommended before GA**:
- **Duration**: 4 weeks
- **Location**: 2-3 schools in Delhi NCR
- **Participants**: 100-200 students (CBSE Grade 9)
- **Success criteria**:
  - 70% daily active rate during pilot
  - 40% programme completion rate
  - 4.0+ star rating from students
  - No major privacy/compliance issues

---

## 13. Non-Functional Requirements

### 13.1 Performance

| Requirement | Target |
|-------------|--------|
| API response time (p95) | <200ms |
| WebSocket latency (p95) | <500ms |
| AI response time (chat) | <2s |
| AI response time (programme) | <5s |
| Page load time (3G) | <2s |
| Database query time (p95) | <100ms |

### 13.2 Scalability

| Metric | Target |
|--------|--------|
| Concurrent users | 10,000 |
| Daily active users | 100,000 |
| Database size | 100GB |
| Storage per user | 100MB (free), 1GB (Pro) |

### 13.3 Availability

| Metric | Target |
|--------|--------|
| Uptime | 99.9% (8.76 hours downtime/year) |
| Recovery time objective (RTO) | 1 hour |
| Recovery point objective (RPO) | 1 hour |
| Backup frequency | Daily |

### 13.4 Security

| Requirement | Implementation |
|-------------|----------------|
| Authentication | JWT with refresh tokens |
| Authorization | Role-based (student, teacher, admin) |
| Data encryption | TLS in transit, AES-256 at rest |
| Input validation | class-validator with forbidNonWhitelisted |
| SQL injection | Parameterized queries (raw SQL) |
| XSS protection | React's built-in escaping + CSP headers |
| Rate limiting | Per-endpoint rate limits |

### 13.5 Accessibility

| Requirement | Target |
|-------------|--------|
| WCAG compliance | Level AA |
| Screen reader support | Full keyboard navigation |
| Color contrast | 4.5:1 minimum |
| Touch targets | 44x44px minimum |

---

## 14. Risks & Mitigations

### 14.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI model cost overrun | High | Medium | Rate limits, cost monitoring, fallback to deterministic scoring |
| Database performance at scale | High | Medium | Query optimization, connection pooling, read replicas |
| WebSocket scalability | Medium | Medium | Redis adapter for Socket.IO, horizontal scaling |
| Migration failures | High | Low | Backup before migration, rollback scripts, staged rollout |

### 14.2 Product Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Low user retention | High | Medium | Daily streaks, push notifications, social features |
| AI grading inaccuracy | High | Low | Human expert calibration, fallback scoring, admin review |
| Privacy compliance issues | High | Medium | Legal review, age verification, consent management |
| Competition from Duolingo/Anki | Medium | High | Focus on RPG uniqueness, community features, school adoption |

### 14.3 Business Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Low free → Pro conversion | High | Medium | Value demonstration, trial period, referral program |
| Data marketplace rejection | Medium | Medium | Aggregate-only guarantee, transparency, opt-in only |
| School adoption resistance | High | Medium | Teacher dashboard, curriculum alignment, pilot program |

---

## 15. Timeline & Milestones

### 15.1 v1.0 GA (Current)

| Milestone | Status | Date |
|-----------|--------|------|
| Phase 0: Audit | ✅ Complete | 2026-08-04 |
| Phase 1: Architecture Stabilisation | ✅ Complete | 2026-08-04 |
| Phase 2: Studyield Core | ✅ Complete | 2026-08-05 |
| Phase 3: Production RAG | ✅ Complete | 2026-08-05 |
| Phase 4: Study RPG Core | ✅ Complete | 2026-08-05 |
| Phase 5: PvP Duels | ✅ Complete | 2026-08-06 |
| Phase 6: Study Community | ✅ Complete | 2026-08-06 |
| Phase 7: Study Events | ✅ Complete | 2026-08-06 |
| Phase 8: Advanced Learning | ✅ Complete | 2026-08-07 |
| Phase 9: Hardening | ✅ Complete | 2026-08-07 |
| Owner Brief: Integrity/F2W | ✅ Complete | 2026-08-07 |
| Owner Brief: Wellbeing | ✅ Complete | 2026-08-09 |
| Owner Brief: Data Marketplace | ✅ Complete | 2026-08-14 |
| Clean-Room Rewrite (B1-B4) | ✅ Complete | 2026-08-16 |
| Clean-Room Rewrite (B5-B10) | ⏳ Pending | — |
| Privacy Compliance (Age Gate, Consent) | ⏳ Pending | — |
| Pilot Program (Delhi NCR) | ⏳ Pending | — |
| **v1.0 GA Launch** | ⏳ **Target: 2026-09-15** | — |

### 15.2 v1.1 (3 Months Post-Launch)

| Milestone | Target Date |
|-----------|-------------|
| Economy/Marketplace | 2026-10-15 |
| Events (StudyPass, Quests) | 2026-10-30 |
| Social (Friends, Chat) | 2026-11-15 |
| PvP Duels | 2026-11-30 |
| CBSE Grades 10-12 | 2026-12-15 |
| PWA with Offline Support | 2026-12-30 |

### 15.3 v2.0 (6 Months Post-Launch)

| Milestone | Target Date |
|-----------|-------------|
| Data Marketplace (Ocean Protocol) | 2027-03-15 |
| Faction Wars | 2027-03-30 |
| Competitive Exam Prep (JEE/NEET) | 2027-04-15 |
| B2B2C School Licensing | 2027-04-30 |
| Native Mobile Apps | 2027-05-15 |
| ICSE/State Boards | 2027-05-30 |

---

## 16. Appendix

### 16.1 Glossary

| Term | Definition |
|------|------------|
| **STP** | Study Tokens — in-game currency earned through real study |
| **Campfire** | Metacognitive reflection before cashing out session rewards |
| **Teach-back** | Feynman technique — student explains concept, AI evaluates depth |
| **Programme** | AI-generated learning plan with objectives, milestones, activities |
| **Exam Boss** | Party battle against curriculum-themed monster |
| **Abstracted** | Event where students "unabstract" cards to restore them |
| **Great Extinction** | Event where card supply is burned for Extinction Sigils |
| **Free-to-Win** | Zero pay-to-win paths; all progression earned through study |

### 16.2 Related Documents

- `STUDY_RPG_MASTER_PROMPT.md` — Technical snapshot for AI agents
- `IMPLEMENTATION_STATUS.md` — Living implementation tracker
- `docs/STUDY_RPG_PHILOSOPHY.md` — Product philosophy
- `docs/architecture/overview.md` — Technical architecture
- `docs/audits/REWRITE_LEDGER.md` — Clean-room rewrite progress
- `AGENTS.md` — AI agent operating guide

### 16.3 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-21 | Study RPG Team | Initial PRD |

---

**End of Document**
