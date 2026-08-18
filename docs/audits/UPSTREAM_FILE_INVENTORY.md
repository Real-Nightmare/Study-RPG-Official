# Upstream File Inventory

> **What this is**: an exhaustive, git-verified inventory of every file in this
> repository that came from the **upstream Studyield** project (i.e. files
> "contributed by someone else"), plus which of those were later modified by the
> Study RPG work. Generated from git provenance on **2026-08-15**.
> Companion documents: `UPSTREAM.md`, `docs/audits/LICENSE_AUDIT.md`.

## 1. Why this exists

The owner asked: *"find all the files inside here [that were contributed by
someone else]"*. This document is the answer, derived from the repository's
actual git history rather than guesswork. It exists so the fork's provenance is
fully auditable: every upstream-derived file can be identified at a glance, and
any future decision about rewriting or relicensing those files has a precise,
complete list to work from.

## 2. Method

- The repository history has **7 commits**. The very first commit,
  `0494e1a` ("Add files via upload", 2026-08-04), is the upstream **Studyield**
  import: **405 files / 163,631 insertions**.
- Everything added or changed after that commit is Study RPG work (commits
  `8f1ea2e` → `7688d42`).
- `git ls-tree -r --name-only 0494e1a` → the 405 upstream files.
- `git diff --name-only 0494e1a..HEAD` → the 592 paths touched since the import
  (133 of them are upstream files **modified**; 459 are **new** files).

## 3. Summary numbers

| Metric | Count |
|---|---|
| Upstream Studyield files imported (commit `0494e1a`) | **405** |
| — of which **modified** by Study RPG work (marked `✎` below) | **133** |
| — of which left untouched | **272** |
| New files created since the import (original Study RPG work) | **459** |
| Total paths in `HEAD` | 864 |

Breakdown of the 405 imported files by area: `backend/` 186, `frontend/` 185,
`.github/` 8, root-level 26 (docs, licence, CI, `docker-compose.yml`, `start.sh`,
`Studyield Master Implementation Prompt.pdf`).

## 4. Licence obligations (summary)

All 405 upstream files are AGPL-3.0 code authored by the Studyield contributors.
Under AGPL §5 the copyright and licence notices for that upstream code must be
**retained** — they are, in `NOTICE`, `UPSTREAM.md`, and this inventory.
Removing attribution to make the codebase private would be a licence violation.
The only lawful path to a fully private codebase is a **clean-room rewrite**
(reimplementation from the specification, not from the code) of the 133 modified
files and the 272 untouched upstream files above. All Study RPG work added after
the import is original to this fork and remains under the same project licence.
See `docs/audits/LICENSE_AUDIT.md` §7 for the full resolution log.

## 5. Full inventory of upstream files (405)

Legend: `✎` = upstream file **modified** by Study RPG work (133 total).

### 5.1 Root & infra (34 files, 17 modified)

```
.editorconfig
.env.docker
.github/ISSUE_TEMPLATE/bug_report.yml
.github/ISSUE_TEMPLATE/config.yml
.github/ISSUE_TEMPLATE/feature_request.yml
.github/PULL_REQUEST_TEMPLATE.md
.github/screenshots/ai-chat.png
.github/screenshots/dashboard-home.png
.github/screenshots/problem-solver.png
.github/workflows/ci.yml ✎
.gitignore
.prettierrc
CHANGELOG.md ✎
CODE_OF_CONDUCT.md
CONTRIBUTING.md
FUTURE_GOAL.md ✎
LICENSE
NOTICE ✎
README.md ✎
README_AR.md ✎
README_BN.md ✎
README_DE.md ✎
README_ES.md ✎
README_FR.md ✎
README_HI.md ✎
README_JA.md ✎
README_KO.md ✎
README_PT-BR.md ✎
README_RU.md ✎
README_ZH.md ✎
SECURITY.md
Studyield Master Implementation Prompt.pdf
docker-compose.yml ✎
start.sh
```

### 5.2 Backend (186 files, 40 modified)

```
backend/.dockerignore
backend/.env.example
backend/.eslintrc.js
backend/.gitignore
backend/.prettierrc
backend/Dockerfile ✎
backend/migrations/000_initial.sql
backend/migrations/001_add_exam_and_type_columns.sql
backend/migrations/002_exam_clone_tables.sql
backend/migrations/002_live_quiz_history.sql
backend/migrations/003_notes.sql
backend/migrations/004_exam_clone_features.sql
backend/migrations/005_exam_gamification.sql
backend/migrations/006_mind_maps.sql
backend/migrations/006_problem_chat_messages.sql
backend/migrations/007_problem_solver_enhancements.sql
backend/migrations/008_research_enhancements.sql
backend/migrations/009_user_profile_fields.sql
backend/migrations/010_blog.sql
backend/migrations/010_create_user_fcm_tokens_table.sql
backend/migrations/011_blog_update_authors_images.sql
backend/migrations/012_blog_ratings_comments.sql
backend/migrations/013_blog_ratings_review.sql
backend/migrations/014_teach_back_missing_columns.sql
backend/nest-cli.json
backend/package-lock.json ✎
backend/package.json ✎
backend/scripts/migrate.js
backend/src/app.module.ts ✎
backend/src/common/decorators/current-user.decorator.ts
backend/src/common/decorators/index.ts
backend/src/common/decorators/plan-feature.decorator.ts
backend/src/common/decorators/public.decorator.ts
backend/src/common/decorators/roles.decorator.ts ✎
backend/src/common/dto/index.ts
backend/src/common/dto/pagination.dto.ts
backend/src/common/filters/http-exception.filter.ts
backend/src/common/filters/index.ts
backend/src/common/filters/ws-exception.filter.ts
backend/src/common/gateways/app.gateway.ts ✎
backend/src/common/gateways/base.gateway.ts ✎
backend/src/common/gateways/gateway.module.ts
backend/src/common/gateways/index.ts
backend/src/common/guards/index.ts
backend/src/common/guards/jwt-auth.guard.ts
backend/src/common/guards/plan.guard.ts
backend/src/common/guards/roles.guard.ts
backend/src/common/guards/ws-auth.guard.ts
backend/src/common/index.ts
backend/src/common/interceptors/camel-case.interceptor.ts
backend/src/common/interceptors/index.ts
backend/src/common/interceptors/logging.interceptor.ts
backend/src/health.controller.ts ✎
backend/src/main.ts ✎
backend/src/modules/ai/ai.controller.ts
backend/src/modules/ai/ai.module.ts ✎
backend/src/modules/ai/ai.service.ts
backend/src/modules/ai/embedding.service.ts ✎
backend/src/modules/ai/index.ts
backend/src/modules/analytics/analytics.controller.ts
backend/src/modules/analytics/analytics.module.ts
backend/src/modules/analytics/analytics.service.ts
backend/src/modules/analytics/index.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.module.ts
backend/src/modules/auth/auth.service.ts ✎
backend/src/modules/auth/dto/index.ts ✎
backend/src/modules/auth/index.ts
backend/src/modules/auth/strategies/jwt.strategy.ts
backend/src/modules/blog/blog.controller.ts
backend/src/modules/blog/blog.module.ts
backend/src/modules/blog/blog.service.ts
backend/src/modules/blog/index.ts
backend/src/modules/chat/chat.controller.ts
backend/src/modules/chat/chat.gateway.ts ✎
backend/src/modules/chat/chat.module.ts ✎
backend/src/modules/chat/chat.service.ts ✎
backend/src/modules/chat/index.ts
backend/src/modules/clickhouse/clickhouse.module.ts
backend/src/modules/clickhouse/clickhouse.service.ts
backend/src/modules/clickhouse/index.ts
backend/src/modules/code-sandbox/code-sandbox.controller.ts
backend/src/modules/code-sandbox/code-sandbox.gateway.ts
backend/src/modules/code-sandbox/code-sandbox.module.ts
backend/src/modules/code-sandbox/code-sandbox.service.ts
backend/src/modules/code-sandbox/index.ts
backend/src/modules/content/content-extract.controller.ts
backend/src/modules/content/content-sources.controller.ts
backend/src/modules/content/content-sources.service.ts
backend/src/modules/content/content.module.ts
backend/src/modules/content/documents.controller.ts
backend/src/modules/content/documents.service.ts
backend/src/modules/content/dto/extract.dto.ts
backend/src/modules/content/dto/flashcard.dto.ts
backend/src/modules/content/dto/note.dto.ts
backend/src/modules/content/flashcards.controller.ts
backend/src/modules/content/flashcards.service.ts
backend/src/modules/content/index.ts
backend/src/modules/content/notes.controller.ts
backend/src/modules/content/notes.service.ts
backend/src/modules/content/study-sets.controller.ts
backend/src/modules/content/study-sets.service.ts
backend/src/modules/database/database.module.ts
backend/src/modules/database/database.service.ts
backend/src/modules/database/index.ts
backend/src/modules/email/email.module.ts
backend/src/modules/email/email.service.ts
backend/src/modules/email/index.ts
backend/src/modules/email/ses.service.ts
backend/src/modules/exam-clone/exam-clone.controller.ts
backend/src/modules/exam-clone/exam-clone.gateway.ts ✎
backend/src/modules/exam-clone/exam-clone.module.ts ✎
backend/src/modules/exam-clone/exam-clone.service.ts ✎
backend/src/modules/exam-clone/index.ts
backend/src/modules/firebase/firebase.module.ts
backend/src/modules/firebase/firebase.service.ts
backend/src/modules/firebase/index.ts
backend/src/modules/knowledge-base/chunking.service.ts
backend/src/modules/knowledge-base/document-processor.service.ts
backend/src/modules/knowledge-base/index.ts ✎
backend/src/modules/knowledge-base/knowledge-base.controller.ts ✎
backend/src/modules/knowledge-base/knowledge-base.module.ts ✎
backend/src/modules/knowledge-base/knowledge-base.service.ts ✎
backend/src/modules/learning-paths/index.ts
backend/src/modules/learning-paths/learning-paths.controller.ts ✎
backend/src/modules/learning-paths/learning-paths.module.ts ✎
backend/src/modules/learning-paths/learning-paths.service.ts ✎
backend/src/modules/notifications/index.ts
backend/src/modules/notifications/notifications.controller.ts ✎
backend/src/modules/notifications/notifications.module.ts ✎
backend/src/modules/notifications/notifications.service.ts ✎
backend/src/modules/problem-solver/agents/alternative-method.agent.ts
backend/src/modules/problem-solver/agents/analysis.agent.ts
backend/src/modules/problem-solver/agents/base.agent.ts
backend/src/modules/problem-solver/agents/hint.agent.ts
backend/src/modules/problem-solver/agents/index.ts
backend/src/modules/problem-solver/agents/solver.agent.ts
backend/src/modules/problem-solver/agents/verifier.agent.ts
backend/src/modules/problem-solver/index.ts
backend/src/modules/problem-solver/problem-solver.controller.ts
backend/src/modules/problem-solver/problem-solver.gateway.ts ✎
backend/src/modules/problem-solver/problem-solver.module.ts
backend/src/modules/problem-solver/problem-solver.service.ts
backend/src/modules/qdrant/index.ts ✎
backend/src/modules/qdrant/qdrant.module.ts ✎
backend/src/modules/qdrant/qdrant.service.ts ✎
backend/src/modules/queue/index.ts
backend/src/modules/queue/queue.module.ts
backend/src/modules/queue/queue.service.ts
backend/src/modules/quiz/index.ts
backend/src/modules/quiz/live-quiz.gateway.ts ✎
backend/src/modules/quiz/live-quiz.service.ts
backend/src/modules/quiz/quiz-generator.service.ts
backend/src/modules/quiz/quiz.controller.ts
backend/src/modules/quiz/quiz.module.ts ✎
backend/src/modules/quiz/quiz.service.ts ✎
backend/src/modules/redis/index.ts
backend/src/modules/redis/redis.module.ts
backend/src/modules/redis/redis.service.ts
backend/src/modules/research/index.ts
backend/src/modules/research/research.controller.ts
backend/src/modules/research/research.gateway.ts
backend/src/modules/research/research.module.ts
backend/src/modules/research/research.service.ts
backend/src/modules/research/web-search.service.ts
backend/src/modules/storage/index.ts
backend/src/modules/storage/storage.controller.ts
backend/src/modules/storage/storage.module.ts
backend/src/modules/storage/storage.service.ts
backend/src/modules/subscription/index.ts
backend/src/modules/subscription/stripe-webhook.controller.ts
backend/src/modules/subscription/subscription.controller.ts
backend/src/modules/subscription/subscription.module.ts
backend/src/modules/subscription/subscription.service.ts
backend/src/modules/teach-back/index.ts
backend/src/modules/teach-back/teach-back.controller.ts
backend/src/modules/teach-back/teach-back.gateway.ts
backend/src/modules/teach-back/teach-back.module.ts ✎
backend/src/modules/teach-back/teach-back.service.ts ✎
backend/src/modules/users/dto/index.ts
backend/src/modules/users/index.ts
backend/src/modules/users/users.controller.ts ✎
backend/src/modules/users/users.module.ts
backend/src/modules/users/users.service.ts ✎
backend/src/types/pdf-parse.d.ts
backend/tsconfig.json
```

### 5.3 Frontend (185 files, 76 modified)

```
frontend/.dockerignore
frontend/.env.example
frontend/.gitignore ✎
frontend/Dockerfile ✎
frontend/README.md ✎
frontend/eslint.config.js ✎
frontend/index.html ✎
frontend/nginx.conf
frontend/package-lock.json ✎
frontend/package.json ✎
frontend/postcss.config.js
frontend/public/STUDYIELD2.png
frontend/public/logos/Screenshot 2026-04-09 141855.png
frontend/public/logos/studyield-logo.png
frontend/public/sitemap.xml
frontend/public/vite.svg
frontend/src/App.tsx ✎
frontend/src/assets/react.svg
frontend/src/components/ClozeEditor.tsx
frontend/src/components/ClozeRenderer.tsx
frontend/src/components/DeleteConfirmModal.tsx
frontend/src/components/ErrorBoundary.tsx
frontend/src/components/ImageOcclusionEditor.tsx ✎
frontend/src/components/ImageOcclusionViewer.tsx ✎
frontend/src/components/LanguageSwitcher.tsx
frontend/src/components/NotificationBell.tsx
frontend/src/components/StreakCalendar.tsx
frontend/src/components/StudyHeatmap.tsx
frontend/src/components/XPProgressBar.tsx
frontend/src/components/documents/DocumentsTab.tsx
frontend/src/components/exam/PomodoroTimer.tsx ✎
frontend/src/components/landing/CTASection.tsx
frontend/src/components/landing/FAQSection.tsx
frontend/src/components/landing/FeaturesSection.tsx ✎
frontend/src/components/landing/Footer.tsx ✎
frontend/src/components/landing/Header.tsx ✎
frontend/src/components/landing/HeroSection.tsx ✎
frontend/src/components/landing/HowItWorksSection.tsx
frontend/src/components/landing/TestimonialsSection.tsx
frontend/src/components/landing/TrustedBySection.tsx
frontend/src/components/landing/index.ts ✎
frontend/src/components/notes/MindMapView.tsx ✎
frontend/src/components/notes/PresentationView.tsx ✎
frontend/src/components/problem-solver/InteractiveGraph.tsx
frontend/src/components/sources/SourcesTab.tsx ✎
frontend/src/components/ui/alert-dialog.tsx
frontend/src/components/ui/alert.tsx ✎
frontend/src/components/ui/badge.tsx
frontend/src/components/ui/button.tsx
frontend/src/components/ui/card.tsx ✎
frontend/src/components/ui/checkbox.tsx
frontend/src/components/ui/input.tsx
frontend/src/components/ui/label.tsx
frontend/src/components/ui/separator.tsx
frontend/src/components/ui/spinner.tsx
frontend/src/config/api.ts ✎
frontend/src/contexts/AuthContext.tsx
frontend/src/hooks/useMediaQuery.ts
frontend/src/hooks/usePlanGate.ts
frontend/src/index.css
frontend/src/layouts/DashboardLayout.tsx ✎
frontend/src/layouts/PublicLayout.tsx
frontend/src/lib/i18n.ts
frontend/src/lib/utils.ts
frontend/src/locales/ar.json ✎
frontend/src/locales/bn.json ✎
frontend/src/locales/de.json ✎
frontend/src/locales/en.json ✎
frontend/src/locales/es.json ✎
frontend/src/locales/fr.json ✎
frontend/src/locales/hi.json ✎
frontend/src/locales/it.json ✎
frontend/src/locales/ja.json ✎
frontend/src/locales/ko.json ✎
frontend/src/locales/nl.json ✎
frontend/src/locales/pt-BR.json ✎
frontend/src/locales/ru.json ✎
frontend/src/locales/uk.json ✎
frontend/src/locales/zh.json ✎
frontend/src/main.tsx
frontend/src/pages/AboutPage.tsx
frontend/src/pages/BlogPage.tsx ✎
frontend/src/pages/BlogPostPage.tsx ✎
frontend/src/pages/ContactPage.tsx
frontend/src/pages/CookiesPage.tsx
frontend/src/pages/DataDeletionPage.tsx
frontend/src/pages/FAQPage.tsx
frontend/src/pages/FeaturesPage.tsx
frontend/src/pages/ForgotPasswordPage.tsx ✎
frontend/src/pages/HomePage.tsx ✎
frontend/src/pages/LoginPage.tsx ✎
frontend/src/pages/OnboardingPage.tsx ✎
frontend/src/pages/PrivacyPage.tsx
frontend/src/pages/RegisterPage.tsx ✎
frontend/src/pages/ResetPasswordPage.tsx ✎
frontend/src/pages/SitemapPage.tsx
frontend/src/pages/SupportPage.tsx
frontend/src/pages/TermsPage.tsx
frontend/src/pages/TutorialPage.tsx ✎
frontend/src/pages/dashboard/AccountSettingsPage.tsx ✎
frontend/src/pages/dashboard/AddFlashcardPage.tsx
frontend/src/pages/dashboard/AnalyticsPage.tsx
frontend/src/pages/dashboard/AppearanceSettingsPage.tsx
frontend/src/pages/dashboard/BadgesPage.tsx
frontend/src/pages/dashboard/BatchSolverPage.tsx ✎
frontend/src/pages/dashboard/BookmarksPage.tsx ✎
frontend/src/pages/dashboard/CameraScanPage.tsx
frontend/src/pages/dashboard/ChatHistoryPage.tsx
frontend/src/pages/dashboard/ChatPage.tsx
frontend/src/pages/dashboard/CollaborativeExamPage.tsx ✎
frontend/src/pages/dashboard/ConceptMapPage.tsx
frontend/src/pages/dashboard/CreateNotePage.tsx
frontend/src/pages/dashboard/CreateStudySetPage.tsx ✎
frontend/src/pages/dashboard/DashboardHomePage.tsx ✎
frontend/src/pages/dashboard/DeepResearchPage.tsx
frontend/src/pages/dashboard/EditFlashcardPage.tsx
frontend/src/pages/dashboard/EditNotePage.tsx
frontend/src/pages/dashboard/EditStudySetPage.tsx
frontend/src/pages/dashboard/ExamClonePage.tsx ✎
frontend/src/pages/dashboard/ExamDetailPage.tsx ✎
frontend/src/pages/dashboard/FlashcardEditor.tsx
frontend/src/pages/dashboard/FormulaCardsPage.tsx
frontend/src/pages/dashboard/GenerateNotePage.tsx ✎
frontend/src/pages/dashboard/HintModePage.tsx
frontend/src/pages/dashboard/ImportSection.tsx ✎
frontend/src/pages/dashboard/LeaderboardPage.tsx
frontend/src/pages/dashboard/LearningPathDetailPage.tsx ✎
frontend/src/pages/dashboard/LearningPathsPage.tsx
frontend/src/pages/dashboard/LiveQuizPage.tsx ✎
frontend/src/pages/dashboard/MatchGamePage.tsx
frontend/src/pages/dashboard/NoteDetailPage.tsx
frontend/src/pages/dashboard/NotificationSettingsPage.tsx ✎
frontend/src/pages/dashboard/NotificationsPage.tsx
frontend/src/pages/dashboard/PracticeExamPage.tsx ✎
frontend/src/pages/dashboard/PracticeQuizPage.tsx
frontend/src/pages/dashboard/ProblemHistoryPage.tsx ✎
frontend/src/pages/dashboard/ProblemInputPage.tsx ✎
frontend/src/pages/dashboard/ProfileEditPage.tsx
frontend/src/pages/dashboard/QuizPage.tsx ✎
frontend/src/pages/dashboard/ResearchHistoryPage.tsx
frontend/src/pages/dashboard/ResearchProgressPage.tsx
frontend/src/pages/dashboard/ResearchReportPage.tsx
frontend/src/pages/dashboard/ReviewQueuePage.tsx
frontend/src/pages/dashboard/SettingsPage.tsx ✎
frontend/src/pages/dashboard/SimilarProblemsPage.tsx
frontend/src/pages/dashboard/SolutionPage.tsx ✎
frontend/src/pages/dashboard/SolverBookmarksPage.tsx
frontend/src/pages/dashboard/SolvingProgressPage.tsx
frontend/src/pages/dashboard/StudyBuddyChatPage.tsx
frontend/src/pages/dashboard/StudySessionPage.tsx ✎
frontend/src/pages/dashboard/StudySetDetailPage.tsx ✎
frontend/src/pages/dashboard/StudySetsPage.tsx ✎
frontend/src/pages/dashboard/TeachBackPage.tsx ✎
frontend/src/pages/dashboard/TeachBackSessionPage.tsx
frontend/src/pages/dashboard/index.ts ✎
frontend/src/pages/index.ts
frontend/src/providers/QueryProvider.tsx
frontend/src/services/api.ts
frontend/src/services/auth.ts
frontend/src/services/blog.ts
frontend/src/services/chat.ts
frontend/src/services/flashcards.ts
frontend/src/services/learningPaths.ts ✎
frontend/src/services/notes.ts
frontend/src/services/problemSolver.ts
frontend/src/services/quiz.ts
frontend/src/services/research.ts
frontend/src/services/studySets.ts
frontend/src/services/teachBack.ts
frontend/src/stores/index.ts
frontend/src/stores/useFlashcardsStore.ts
frontend/src/stores/useGamificationStore.ts
frontend/src/stores/useLiveQuizStore.ts ✎
frontend/src/stores/useNotesStore.ts
frontend/src/stores/useNotificationsStore.ts
frontend/src/stores/useProblemSolverStore.ts
frontend/src/stores/useStudySetsStore.ts
frontend/src/types/index.ts ✎
frontend/src/types/react-katex.d.ts
frontend/src/utils/exportPdf.ts ✎
frontend/tailwind.config.js
frontend/tsconfig.app.json
frontend/tsconfig.json
frontend/tsconfig.node.json
frontend/vite.config.ts ✎
```

## 6. How to regenerate

```bash
# All upstream files (405):
git ls-tree -r --name-only 0494e1a | sort

# Upstream files modified by Study RPG work (133):
comm -12 \
  <(git ls-tree -r --name-only 0494e1a | sort) \
  <(git diff --name-only 0494e1a..HEAD | sort)

# New (original) files since the import (459):
comm -23 \
  <(git diff --name-only 0494e1a..HEAD | sort) \
  <(git ls-tree -r --name-only 0494e1a | sort)
```

Numbers should match §3 after any future work; update this document when they
drift (e.g. after the next phase).
