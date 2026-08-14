// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: 'free' | 'pro' | 'team';
  billingCycle?: 'monthly' | 'yearly' | null;
  educationLevel?: string;
  subjects?: string[];
  profileCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Study Set types
export interface StudySet {
  id: string;
  userId: string;
  title: string;
  description?: string;
  isPublic: boolean;
  tags: string[];
  coverImageUrl?: string;
  examDate?: string;
  examSubject?: string;
  flashcardsCount: number;
  documentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudySetRequest {
  title: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  coverImageUrl?: string;
  examDate?: string;
  examSubject?: string;
}

export interface UpdateStudySetRequest {
  title?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  coverImageUrl?: string;
  examDate?: string;
  examSubject?: string;
}

// Document types
export interface Document {
  id: string;
  studySetId: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  createdAt: string;
}

// Flashcard types
export type FlashcardType = 'standard' | 'cloze' | 'image_occlusion';

export interface Flashcard {
  id: string;
  studySetId: string;
  front: string;
  back: string;
  notes?: string;
  tags: string[];
  type?: FlashcardType;
  difficulty: number;
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReviewAt?: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Cloze deletion utilities
export const CLOZE_REGEX = /\{\{(.+?)\}\}/g;

export function hasClozeMarkers(text: string): boolean {
  return CLOZE_REGEX.test(text);
}

export function extractClozeBlanks(text: string): string[] {
  const matches = text.match(CLOZE_REGEX);
  return matches ? matches.map((m) => m.slice(2, -2)) : [];
}

export function renderClozeWithBlanks(text: string, revealedIndices: Set<number>): { segments: Array<{ text: string; isBlank: boolean; index: number; answer: string }> } {
  const segments: Array<{ text: string; isBlank: boolean; index: number; answer: string }> = [];
  let lastIndex = 0;
  let blankIndex = 0;
  const regex = /\{\{(.+?)\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isBlank: false, index: -1, answer: '' });
    }
    const revealed = revealedIndices.has(blankIndex);
    segments.push({ text: revealed ? match[1] : '______', isBlank: true, index: blankIndex, answer: match[1] });
    blankIndex++;
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isBlank: false, index: -1, answer: '' });
  }
  return { segments };
}

// Image Occlusion types
export interface OcclusionRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface CreateFlashcardRequest {
  studySetId: string;
  front: string;
  back: string;
  notes?: string;
  tags?: string[];
  type?: 'standard' | 'cloze' | 'image_occlusion';
}

export interface UpdateFlashcardRequest {
  front?: string;
  back?: string;
  notes?: string;
  tags?: string[];
  type?: 'standard' | 'cloze' | 'image_occlusion';
}

export interface ReviewFlashcardRequest {
  quality: 1 | 2 | 3 | 4 | 5;
}

// Flashcard status helpers
export const getFlashcardStatus = (flashcard: Flashcard): string => {
  if (flashcard.repetitions === 0) return 'New';
  if (flashcard.interval < 7) return 'Learning';
  if (flashcard.interval < 30) return 'Review';
  return 'Mastered';
};

export const isFlashcardDue = (flashcard: Flashcard): boolean => {
  if (!flashcard.nextReviewAt) return true;
  return new Date(flashcard.nextReviewAt) <= new Date();
};

// Knowledge Base types
export interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description?: string;
  documentCount: number;
  chunkCount: number;
  status: 'active' | 'processing' | 'error';
  createdAt: string;
  updatedAt: string;
}

// Chat types
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  knowledgeBaseId?: string;
  studySetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  createdAt: string;
}

export interface Citation {
  chunkId: string;
  content: string;
  score: number;
  documentId?: string;
}

// Quiz types
export interface Quiz {
  id: string;
  studySetId: string;
  title: string;
  questionCount: number;
  timeLimit?: number;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface QuizAttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  timeSpent: number;
  completedAt?: string;
  createdAt: string;
}

export interface QuizAttemptDetail {
  attempt: QuizAttempt;
  answers: QuizAttemptAnswer[];
}

// Subscription types
export interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'pro' | 'team';
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodEnd: string;
  createdAt: string;
}

// Common API types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

// Gamification types
export interface GamificationStats {
  totalXp: number;
  level: number;
  streakDays: number;
  dailyXp: number;
  dailyGoal: number;
  nextLevelXp: number;
  currentLevelXp: number;
}

export type XPEventType = 'card_review' | 'quiz_complete' | 'perfect_quiz' | 'daily_streak' | 'daily_goal';

export interface XPEvent {
  type: XPEventType;
  xp: number;
  timestamp: string;
}

export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];

export const LEVEL_NAMES = [
  { name: 'Beginner',    gradient: 'from-gray-400 to-gray-500',       shadow: 'shadow-gray-400/20',     text: 'text-gray-500' },
  { name: 'Bronze',      gradient: 'from-amber-600 to-amber-700',     shadow: 'shadow-amber-600/20',    text: 'text-amber-600' },
  { name: 'Silver',      gradient: 'from-slate-400 to-slate-500',     shadow: 'shadow-slate-400/20',    text: 'text-slate-500' },
  { name: 'Gold',        gradient: 'from-yellow-400 to-yellow-500',   shadow: 'shadow-yellow-400/20',   text: 'text-yellow-500' },
  { name: 'Platinum',    gradient: 'from-cyan-400 to-cyan-500',       shadow: 'shadow-cyan-400/20',     text: 'text-cyan-500' },
  { name: 'Diamond',     gradient: 'from-blue-400 to-blue-500',       shadow: 'shadow-blue-400/20',     text: 'text-blue-500' },
  { name: 'Master',      gradient: 'from-purple-500 to-purple-600',   shadow: 'shadow-purple-500/20',   text: 'text-purple-500' },
  { name: 'Grandmaster', gradient: 'from-red-500 to-rose-600',        shadow: 'shadow-red-500/20',      text: 'text-red-500' },
  { name: 'Champion',    gradient: 'from-orange-500 to-red-500',      shadow: 'shadow-orange-500/20',   text: 'text-orange-500' },
  { name: 'Legend',      gradient: 'from-indigo-500 to-violet-600',   shadow: 'shadow-indigo-500/20',   text: 'text-indigo-500' },
  { name: 'Mythic',      gradient: 'from-fuchsia-500 to-pink-600',    shadow: 'shadow-fuchsia-500/20',  text: 'text-fuchsia-500' },
  { name: 'Immortal',    gradient: 'from-amber-400 via-red-500 to-purple-600', shadow: 'shadow-amber-400/20', text: 'text-amber-500' },
] as const;

export function getLevelInfo(level: number) {
  return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length - 1)];
}

export function getLevelFromXP(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number } {
  let level = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i;
      break;
    }
  }
  const currentLevelXp = LEVEL_THRESHOLDS[level] || 0;
  const nextLevelXp = LEVEL_THRESHOLDS[level + 1] || LEVEL_THRESHOLDS[level] + 2500;
  return { level, currentLevelXp, nextLevelXp };
}

// Study Schedule types
export interface StudySchedule {
  daysUntilExam: number;
  dailyCardTarget: number;
  recommendedMinutes: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  todayPlan: {
    newCards: number;
    reviewCards: number;
    estimatedMinutes: number;
  };
}

// Notification types
export type NotificationType = 'info' | 'success' | 'warning' | 'reminder';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  studyReminders: boolean;
  weeklyDigest: boolean;
  achievementAlerts: boolean;
}

export interface NotificationsResponse {
  data: Notification[];
  total: number;
  unreadCount: number;
}

// Note types
export type NoteSourceType = 'manual' | 'ai_generated' | 'pdf' | 'youtube' | 'audio' | 'website' | 'handwriting';

export interface Note {
  id: string;
  studySetId: string;
  title: string;
  content: string;
  contentJson?: Record<string, unknown>;
  summary?: string;
  sourceType: NoteSourceType;
  sourceUrl?: string;
  sourceMetadata?: Record<string, unknown>;
  tags: string[];
  isPinned: boolean;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  studySetId: string;
  title: string;
  content: string;
  contentJson?: Record<string, unknown>;
  summary?: string;
  sourceType?: NoteSourceType;
  sourceUrl?: string;
  sourceMetadata?: Record<string, unknown>;
  tags?: string[];
  isPinned?: boolean;
  color?: string;
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  contentJson?: Record<string, unknown>;
  summary?: string;
  tags?: string[];
  isPinned?: boolean;
  color?: string;
}

// Study Task (Planner) types
export type TaskType =
  | 'homework'
  | 'revision'
  | 'exam_prep'
  | 'project'
  | 'reading'
  | 'practice';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface StudyTask {
  id: string;
  userId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  taskType: TaskType;
  subject: string | null;
  chapter: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  recurrence: TaskRecurrence;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  parentId?: string;
  taskType?: TaskType;
  subject?: string;
  chapter?: string;
  priority?: TaskPriority;
  dueDate?: string;
  estimatedMinutes?: number;
  recurrence?: TaskRecurrence;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  parentId?: string;
  taskType?: TaskType;
  subject?: string;
  chapter?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  recurrence?: TaskRecurrence;
}

export interface TodayTaskSummary {
  total: number;
  completed: number;
  dueToday: number;
}

// Academic structure (Phase 2 Study RPG Core) types
export interface AcademicProfile {
  userId: string;
  country: string | null;
  board: string | null;
  school: string | null;
  grade: string | null;
  academicYear: string | null;
}

export interface UpdateAcademicProfileRequest {
  country?: string;
  board?: string;
  school?: string;
  grade?: string;
  academicYear?: string;
}

export interface Topic {
  id: string;
  chapterId: string;
  name: string;
  learningObjective: string | null;
  orderIndex: number;
}

export interface Chapter {
  id: string;
  subjectId: string;
  name: string;
  description: string | null;
  orderIndex: number;
  topics: Topic[];
}

export interface Subject {
  id: string;
  name: string;
  programme: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  chapters: Chapter[];
}

export interface ExamPortion {
  id: string;
  chapterId: string;
  chapterName: string;
  weight: number;
}

export interface Exam {
  id: string;
  subjectId: string | null;
  name: string;
  examDate: string | null;
  notes: string | null;
  portions: ExamPortion[];
}

export interface AcademicStructure {
  profile: AcademicProfile | null;
  subjects: Subject[];
  exams: Exam[];
}

export interface CreateSubjectRequest {
  name: string;
  programme?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateSubjectRequest {
  name?: string;
  programme?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface CreateChapterRequest {
  name: string;
  description?: string;
  orderIndex?: number;
}

export interface CreateTopicRequest {
  name: string;
  learningObjective?: string;
  orderIndex?: number;
}

export interface CreateExamRequest {
  name: string;
  subjectId?: string;
  examDate?: string;
  notes?: string;
}

export interface AddPortionRequest {
  chapterId: string;
  weight?: number;
}

// -------------------- Study Tools (Phase 2 gap-fill) --------------------

export interface FocusSession {
  id: string;
  taskId: string | null;
  subject: string | null;
  startedAt: string;
  endedAt: string | null;
  focusMinutes: number;
  status: 'running' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface StartFocusSessionRequest {
  taskId?: string;
  subject?: string;
}

export interface FocusTodaySummary {
  totalMinutes: number;
  bySubject: Array<{ subject: string; minutes: number }>;
}

export type StudyHealthBand = 'fresh' | 'focused' | 'draining' | 'depleted';

/** Anti-overstudy status (spec 015) served by GET /focus-sessions/wellbeing. */
export interface FocusWellbeing {
  todayMinutes: number;
  optimalDailyMinutes: number;
  hardDailyCapMinutes: number;
  budgetRemaining: number;
  healthPercent: number;
  band: StudyHealthBand;
  rewardFactor: number;
  cooldownActive: boolean;
  cooldownMinutesLeft: number;
  nightStudy: boolean;
  nightFactor: number;
  canStart: boolean;
}

export interface Mistake {
  id: string;
  subject: string | null;
  chapter: string | null;
  questionText: string;
  correctAnswer: string | null;
  wrongAnswer: string | null;
  category: string | null;
  cause: string | null;
  correctionNote: string | null;
  status: 'open' | 'resolved' | 'reopened';
  source: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface CreateMistakeRequest {
  questionText: string;
  subject?: string;
  chapter?: string;
  correctAnswer?: string;
  wrongAnswer?: string;
  category?: string;
  cause?: string;
  correctionNote?: string;
  source?: string;
}

export interface MistakeList {
  items: Mistake[];
  counts: Record<string, number>;
}

export interface PuzzleChoice {
  key: string;
  text: string;
}

export interface Puzzle {
  id: string;
  subject: string;
  question: string;
  choices: PuzzleChoice[];
  answerKey: string;
  explanation: string | null;
  difficulty: string;
  source: string;
  createdAt: string;
}

export interface PuzzleSubjectOverview {
  subject: string;
  total: number;
  rankedToday: number;
  streak: number;
  personalBest: number;
}

export interface PuzzleAttempt {
  id: string;
  puzzleId: string;
  subject: string;
  mode: string;
  selectedKey: string | null;
  isCorrect: boolean;
  shielded: boolean;
  streakAfter: number;
  personalBest: number;
  createdAt: string;
}

export interface NextPuzzleResponse {
  puzzle: Omit<Puzzle, 'answerKey'> | null;
  streak: {
    streak: number;
    personalBest: number;
    dailyRankedCount: number;
    lastRankedDay: string | null;
    lastRankedPuzzleId: string | null;
  };
  dailyLimitReached: boolean;
}

export interface SubmitPuzzleRequest {
  selectedKey: string;
  mode?: string;
  shielded?: boolean;
}

export interface SubmitPuzzleResponse {
  correct: boolean;
  answerKey: string;
  explanation: string | null;
  streak: {
    streak: number;
    personalBest: number;
    dailyRankedCount: number;
    lastRankedDay: string | null;
    lastRankedPuzzleId: string | null;
  };
  attempt: PuzzleAttempt;
}

export interface ExamPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'live' | 'ended';
  notes: string | null;
  exams: Array<{ id: string; name: string; examDate: string | null; subject: string | null }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamPeriodRequest {
  name: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface ExamResult {
  id: string;
  examId: string;
  marksObtained: number;
  marksTotal: number;
  mistakeAnalysis: string | null;
  revisionPlan: string | null;
  completedAt: string;
}

export interface RecordExamResultRequest {
  marksObtained: number;
  marksTotal: number;
  mistakeAnalysis?: string;
  revisionPlan?: string;
}

export interface DashboardSummary {
  todayPlan: {
    tasksDueToday: number;
    tasksDueNow: number;
    nextTask: { id: string; title: string; dueDate: string | null } | null;
  };
  upcomingExams: Array<{ id: string; name: string; subject: string | null; examDate: string; daysUntil: number }>;
  currentExamPortions: number;
  focusMinutesToday: number;
  flashcardsDue: number;
  quizAccuracy30d: number | null;
  recentMistakes: Array<{ id: string; questionText: string; subject: string | null; status: string }>;
  weakTopics: Array<{ topic: string; accuracy: number }>;
  puzzleStreak: { best: number; subjects: Array<{ subject: string; streak: number }> };
  studyStreakDays: number;
  gameStats: {
    stpToday: number;
    playerXp: number;
    eventExp: number;
    dailyQuests: Array<{ id: string; title: string; done: boolean }>;
  };
  recommendedAction:
    | { kind: 'exam'; label: string; examName: string; daysUntil: number }
    | { kind: 'flashcards'; label: string; count: number }
    | { kind: 'tasks'; label: string; count: number }
    | { kind: 'mistakes'; label: string; count: number }
    | { kind: 'puzzle'; label: string }
    | { kind: 'relax'; label: string };
}

export interface DashboardPreferences {
  hideGameStats: boolean;
}

// ---------------- Study RPG (Phase 4) ----------------

export interface RpgLevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  totalXp: number;
}

export interface RpgProfile {
  userId: string;
  xp: number;
  level: number;
  eventExp: number;
  stp: number;
  battleRating: number;
  studyStreak: number;
  bestPuzzleStreak: number;
  currentWorld: string;
  levelInfo: RpgLevelInfo;
  createdAt: string;
  updatedAt: string;
}

export interface RpgWalletEntry {
  id: string;
  userId: string;
  currency: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionType: string;
  reason: string | null;
  relatedEntityId: string | null;
  idempotencyKey: string;
  actor: string;
  createdAt: string;
}

export interface RpgAbility {
  key: string;
  name: string;
  category: string;
  description: string;
  manaCost: number;
  damage?: number;
  healing?: number;
  duration?: number;
  cooldown?: number;
  target: string;
  stackPolicy: string;
  statusEffect?: {
    type: string;
    duration: number;
    damagePerTurn?: number;
    shieldValue?: number;
  };
  restrictions?: string[];
  balanceVersion: string;
}

export interface RpgCardDefinition {
  key: string;
  name: string;
  rarity: 'common' | 'rare' | 'legendary';
  category: string;
  ability: RpgAbility;
  lore: string;
  balanceVersion: string;
}

export interface RpgCardInstance {
  id: string;
  cardKey: string;
  name: string;
  rarity: string;
  category: string;
  ability: RpgAbility;
  lore: string;
  source: string;
  createdAt: string;
}

export interface RpgDeckCard {
  slot: number;
  instanceId: string;
  cardKey: string;
  name: string;
  rarity: string;
  category: string;
  ability: RpgAbility;
}

export interface RpgDeckValidation {
  valid: boolean;
  size: number;
  errors: string[];
  restrictedCounts: Record<string, number>;
}

export interface RpgDeck {
  id: string;
  name: string;
  isActive: boolean;
  validated: boolean;
  invalidReason: string | null;
  validation: RpgDeckValidation;
  cards: RpgDeckCard[];
  createdAt: string;
  updatedAt: string;
}

export interface RpgStatus {
  type: string;
  remaining: number;
  damagePerTurn?: number;
  shieldValue?: number;
  source: string;
}

export interface RpgBattleLogEntry {
  turn: number;
  sequence: number;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface RpgBattleState {
  seed: number;
  turn: number;
  playerHp: number;
  playerMana: number;
  maxHp: number;
  maxMana: number;
  monster: { key: string; name: string; hp: number; maxHp: number; attack: number };
  shieldRemaining: number;
  statuses: RpgStatus[];
  phase: 'active' | 'player_won' | 'monster_won' | 'forfeited';
  hand: Array<{
    instanceId: string;
    cardKey: string;
    ability: RpgAbility;
  }>;
  cooldowns: Record<string, number>;
  challengeBonusThisTurn: number;
  log: RpgBattleLogEntry[];
  lastAction: string | null;
}

export interface RpgBattleReward {
  xp: number;
  stp: number;
  limited: boolean;
}

export interface RpgBattle {
  id: string;
  seed: number;
  subject: string | null;
  world: string;
  monster: { key: string; name: string; hp: number; maxHp: number; attack: number };
  state: RpgBattleState;
  phase: string;
  rewardClaimed: boolean;
  reward: RpgBattleReward | null;
  createdAt: string;
  updatedAt: string;
}

export interface RpgBattleHistoryItem {
  id: string;
  phase: string;
  monsterKey: string;
  world: string;
  rewardClaimed: boolean;
  createdAt: string;
}

export interface CreateRpgDeckRequest {
  name: string;
  cardInstanceIds: string[];
}

export interface UpdateRpgDeckRequest {
  name?: string;
  cardInstanceIds?: string[];
}

export interface CreateRpgBattleRequest {
  monsterKey?: string;
  subject?: string;
  deckId?: string;
}

export interface RpgBattleActionRequest {
  cardInstanceId: string;
}

export interface RpgManaQuizRequest {
  correctCount: number;
}

export interface RpgDamageChallengeRequest {
  allCorrect: boolean;
}

// ---------------- PvP duels (Phase 5) ----------------

export type RpgPvpDuelStatus = 'challenged' | 'in_progress' | 'settled' | 'expired';
export type RpgDuelSide = 'challenger' | 'defender';

export interface RpgPvpRewards {
  xp: number;
  stp: number;
  limited: boolean;
}

export interface RpgPvpMargins {
  challengerHpPct: number;
  defenderHpPct: number;
  challengerTurns: number;
  defenderTurns: number;
}

export interface RpgPvpPlayer {
  id: string;
  name: string;
  rating: number;
}

export interface RpgPvpDuel {
  id: string;
  status: RpgPvpDuelStatus;
  challenger: RpgPvpPlayer;
  defender: RpgPvpPlayer;
  mySide: RpgDuelSide | null;
  myBattleId: string | null;
  myBattle: RpgBattle | null;
  opponentBattleId: string | null;
  opponentPlayed: boolean;
  winner: RpgDuelSide | 'draw' | null;
  margins: RpgPvpMargins | null;
  ratingChange: { challenger: number; defender: number } | null;
  rewards: RpgPvpRewards | null;
  expiresAt: string;
  settledAt: string | null;
  createdAt: string;
}

export interface RpgPvpLeaderboardEntry {
  userId: string;
  name: string;
  rating: number;
  level: number;
}

export interface CreateRpgPvpDuelRequest {
  opponentEmail?: string;
  deckId?: string;
}


// ================= Phase 6 — Study Community =================

// ---- Admin & audit ----
export interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AdminNote {
  id: string;
  title: string;
  subject: string | null;
  content: string;
  pageCount: number;
  selectedPages: number[];
  uploadedByName: string | null;
  isUniversal: boolean;
  createdAt: string;
}

export interface SyllabusEntry {
  id: string;
  board: string;
  grade: string;
  subject: string;
  chapters: Array<{ name: string; topics?: string[] }>;
  createdAt: string;
  updatedAt: string;
}

// ---- Programmes ----
export type ProgrammeStatus = 'suggested' | 'building' | 'active' | 'rejected' | 'archived';

export interface Programme {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  status: ProgrammeStatus;
  suggestedBy: string | null;
  suggesterName: string | null;
  aiBuilt: boolean;
  content: Record<string, unknown>;
  rewardPolicy: Record<string, unknown>;
  review: Record<string, unknown>;
  reviewHistory: ProgrammeReviewEvent[];
  hasFactions: boolean;
  factionSize: number;
  joined?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestProgrammeRequest {
  name: string;
  description?: string;
  kind?: string;
  hasFactions?: boolean;
  factionSize?: number;
}

// ---- Factions ----
export interface Faction {
  id: string;
  programmeId: string | null;
  programmeName: string | null;
  name: string;
  color: string;
  targetSize: number;
  status: string;
  memberCount: number;
  myRole: string | null;
  score: number;
  createdAt: string;
}

export interface FactionMember {
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
}

export interface ElectionResult {
  userId: string;
  name: string;
  votes: number;
}

export interface HelpPledge {
  id: string;
  helperFactionId: string;
  helperName: string;
  helpedFactionId: string;
  helpedName: string;
  periodKey: string;
  status: string;
  activityCount: number;
}

// ---- Social ----
export interface FriendUser {
  userId: string;
  name: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  status: 'accepted' | 'pending' | 'blocked';
  direction: 'outgoing' | 'incoming';
}

export interface SearchUserResult {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

// ---- RPG parties ----
export interface RpgParty {
  id: string;
  leaderId: string;
  leaderName: string;
  name: string;
  maxMembers: number;
  memberCount: number;
  members: Array<{ userId: string; name: string }>;
  createdAt: string;
}

export interface RpgExamBoss {
  key: string;
  name: string;
  subject: string;
  lore: string;
}

export interface RpgPartyBattle {
  id: string;
  partyId: string;
  boss: { key: string; name: string; hp: number; maxHp: number; attack: number };
  examId: string | null;
  state: {
    seed: number;
    round: number;
    phase: string;
    boss: { key: string; name: string; hp: number; maxHp: number; attack: number };
    heroes: Array<{
      userId: string;
      name: string;
      isDown: boolean;
      actedThisRound: boolean;
      state: {
        playerHp: number;
        playerMana: number;
        maxHp: number;
        maxMana: number;
        hand: Array<{
          instanceId: string;
          cardKey: string;
          ability?: {
            key: string;
            name: string;
            manaCost: number;
          };
        }>;
      };
    }>;
    log: Array<{ round: number; eventType: string; payload: Record<string, unknown> }>;
  };
  phase: string;
  rewardClaimed: boolean;
  reward: { xp: number; stp: number } | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Economy (PDF Phase 6 — §16.3, §18, §20–§24)
// ---------------------------------------------------------------------------

export interface EconomyListing {
  id: string;
  cardKey: string;
  cardName: string;
  rarity: string;
  category: string;
  ability: unknown;
  lore: string | null;
  officialValue: number;
  price: number;
  status: string;
  sellerId: string;
  sellerName: string;
  sellerUsername: string | null;
  createdAt: string;
  expiresAt: string;
  hasMyOffer: boolean;
}

export interface EconomyOffer {
  id: string;
  listingId: string;
  buyerId: string;
  amount: number;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  cardName: string;
  cardKey: string;
  listingPrice: number;
  otherName: string;
}

export interface EconomyCollectionCard {
  id: string;
  cardKey: string;
  name: string;
  rarity: string;
  category: string;
  ability: unknown;
  lore: string;
  officialValue: number;
  location: 'inventory' | 'vault';
  source: string;
  inDeck: boolean;
  listed: boolean;
  createdAt: string;
}

export interface EconomySupplyRow {
  key: string;
  name: string;
  rarity: string;
  originalSupply: number;
  activeSupply: number;
  burnedCount: number;
  scrapedCount: number;
  listedCount: number;
  officialValue: number;
  extinct: boolean;
  active: boolean;
  replacementOf: string | null;
  retiredAt: string | null;
}

export interface EconomyPricePoint {
  value: number;
  reason: string;
  created_at: string;
}

export interface EconomyScrapeResult {
  removed: boolean;
  cardKey: string;
  name: string;
  payout: number;
  extinct: boolean;
  replacementKey: string | null;
}

export interface EconomyBurnResult {
  burned: boolean;
  burnId: string;
  cardKey: string;
  name: string;
  total: number;
  instalments: number;
  firstPayment: number;
  paid: number;
  remaining: number;
  nextInstalmentAt: string | null;
  extinct: boolean;
  replacementKey: string | null;
}

export interface EconomyBurnStatus {
  burnId: string;
  cardKey: string;
  total: number;
  instalments: number;
  schedule: number[];
  paidAmount: number;
  paidCount: number;
  status: string;
  nextInstalmentAt: string | null;
}

export interface EconomySettlement {
  listingId: string;
  cardName: string;
  price: number;
  buyerId: string;
  sellerId: string;
}

export interface EconomyReconcileResult {
  cardsChecked: number;
  valueChanges: number;
  extinct: string[];
}

export interface EconomyInstalmentRun {
  processed: number;
  completed: number;
  failures: string[];
}

// ---------------------------------------------------------------------------
// Study Events (PDF Phase 7 — §25–§30)
// ---------------------------------------------------------------------------

export type EventStatus = 'scheduled' | 'active' | 'ended';

export interface StudyEvent {
  id: string;
  slug: string;
  name: string;
  story: string | null;
  kind: string;
  startsAt: string;
  endsAt: string;
  graceHours: number;
  claimDeadline: string;
  config: Record<string, unknown>;
  status: EventStatus;
}

export interface StudyPassTrackView {
  track: 'free' | 'gold' | null;
  trackLocked: boolean;
  goldPaidAt: string | null;
  level: number;
  exp: number;
  currentThreshold: number;
  nextThreshold: number | null;
  levelProgressPct: number;
  maxed: boolean;
  claimedLevels: number[];
  claimableLevels: number[];
}

export interface EventQuest {
  id: string;
  slug: string;
  category: string;
  title: string;
  story: string | null;
  objective: Record<string, unknown>;
  rewards: Record<string, unknown>;
  period: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export interface EventItem {
  slug: string;
  name: string;
  description: string | null;
  tradable: boolean;
  quantity: number;
}

export interface LootBoxOdds {
  label: string;
  weights: Record<string, number>;
}

export interface CurrentEventView {
  event: StudyEvent;
  studyPass: StudyPassTrackView;
  quests: EventQuest[];
  items: EventItem[];
  lootBoxOdds: Record<string, LootBoxOdds>;
  goldCost: number;
}

export interface AbstractedCard {
  instanceId: string;
  cardKey: string;
  name: string;
  rarity: string;
  ability: unknown;
}

export interface UnabstractRequest {
  instanceId: string;
  confirm: boolean;
  reason?: string;
}

export interface UnabstractResult {
  unabstracted: boolean;
  cardKey: string;
  name: string;
  resultCardKey: string;
  stpAwarded: number;
  abstractedErrors: number;
}

export interface LimboResult {
  redeemed: boolean;
  consumedErrors: number;
  rewardCardKey: string;
}

export interface ExtinctionTargetView {
  cardKey: string;
  name: string;
  rarity: string;
  officialValue: number;
  reason: string;
}

export interface MilestoneView {
  id: string;
  slug: string;
  title: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export interface CreateEventRequest {
  slug: string;
  name: string;
  story?: string;
  startsAt: string;
  endsAt: string;
  graceHours?: number;
  reason: string;
}

export interface ClaimLevelResult {
  level: number;
  granted: string[];
  studyPass: StudyPassTrackView;
}

// ---------------------------------------------------------------------------
// Advanced Learning (PDF Phase 8 — §31 follow-ups)
// ---------------------------------------------------------------------------

export interface ProgrammeTemplate {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  outline: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProgrammeReviewEvent {
  verdict: 'accepted' | 'rejected';
  score: number | null;
  reasons: string[];
  reviewer: string | null;
  reviewedAt: string;
}

export interface CreateProgrammeTemplateRequest {
  name: string;
  description?: string;
  kind?: string;
  outline?: Record<string, unknown>;
  reason: string;
}

export interface BatchReviewItem {
  id: string;
  verdict: 'accepted' | 'rejected';
  reason: string;
  score?: number;
}

export interface LearningPathReview {
  verdict: string;
  score: number | null;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Hardening (PDF Phase 9 — §32–§36)
// ---------------------------------------------------------------------------

export interface SystemStatus {
  users: Record<string, number>;
  auditCount: number;
  activeEvents: number;
  activeFactions: number;
  health: {
    database: boolean;
    redis: boolean;
    qdrant: boolean;
    queue: boolean;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export interface AuditRetention {
  retentionDays: number;
}

export interface WebPushPublicKey {
  publicKey: string | null;
}

// ---------------------------------------------------------------------------
// Integrity (spec 014 — F2W meritocracy, anti-cheese, campfire loop)
// ---------------------------------------------------------------------------

export type CampfireSourceKind = 'session' | 'battle' | 'quiz' | 'exam' | 'teach_back';

export interface CampfireReflection {
  id: string;
  question: string;
  answer: string | null;
  depthScore: number | null;
  multiplier: number;
  sourceKind: CampfireSourceKind;
  sourceId: string | null;
  status: 'pending' | 'answered' | 'skipped';
  createdAt: string;
}

export interface CampfireStatus {
  usedToday: number;
  maxPerDay: number;
  pending: CampfireReflection | null;
  latestMultiplier: number;
  reflections: CampfireReflection[];
}

// ---------------------------------------------------------------------------
// Data marketplace + AI benchmarking (owner brief: Ocean Protocol, admin
// effectiveness benchmarking — aggregates only, never raw student data)
// ---------------------------------------------------------------------------

export interface DataConsentView {
  consented: boolean;
  consentedAt: string | null;
  withdrawnAt: string | null;
}

export interface DataMarketplaceStatus {
  publishMode: 'disabled' | 'metadata-first' | 'on-chain-ready';
  aquariusConfigured: boolean;
  walletConfigured: boolean;
  network: 'mainnet' | 'testnet';
  chainId: number;
  oceanNode: {
    enabled: boolean;
    nodeRunning: boolean;
    idleSince: string | null;
    stoppedAt: string | null;
    lastAction: string | null;
    lastError: string | null;
    startsInLast24h: number;
    activeConnections: number;
    dockerUnavailable: boolean;
  };
}

export type MarketplaceDatasetType = 'study_engagement' | 'academic_outcomes' | 'rpg_effectiveness';

export interface MarketplaceDataset {
  id: string;
  name: string;
  description: string;
  datasetType: MarketplaceDatasetType;
  cohortFilters: Record<string, string>;
  priceCurrency: string;
  priceAmount: number;
  status: 'draft' | 'published' | 'revoked';
  did: string | null;
  privacyReport: {
    cohortSize?: number;
    totalCohortSize?: number;
    consentCoverage?: number;
    minGroupSize?: number;
    consentThreshold?: number;
    fields?: string[];
    payload?: Record<string, unknown>;
    ocean?: { published: boolean; reason: string | null };
    [key: string]: unknown;
  } | null;
  checksum: string | null;
  createdAt: string;
  publishedAt: string | null;
  revokedAt: string | null;
}

export interface BenchmarkWindowMetrics {
  activeUsers: number;
  focusMinutes: number;
  quizAccuracyPct: number;
  examScorePct: number;
  teachBackDepth: number;
  campfireDepth: number;
  stpEarned: number;
  avgStudyStreak: number;
}

export interface BenchmarkMetricDelta {
  key: keyof BenchmarkWindowMetrics;
  label: string;
  before: number;
  after: number;
  delta: number;
  improved: boolean;
}

export interface BenchmarkRun {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  config: {
    windowDays?: number;
    cohortFilters?: Record<string, string>;
    note?: string | null;
    [key: string]: unknown;
  };
  metrics: {
    before: BenchmarkWindowMetrics;
    after: BenchmarkWindowMetrics;
    deltas: BenchmarkMetricDelta[];
    score: number;
    band: 'transformative' | 'strong' | 'moderate' | 'neutral' | 'negative';
  } | null;
  report: {
    summary?: string;
    strengths?: string[];
    risks?: string[];
    recommendation?: string;
    generatedBy?: string;
    [key: string]: unknown;
  } | null;
  summary: {
    windowDays?: number;
    cohortFilters?: Record<string, string>;
    from?: string;
    mid?: string;
    to?: string;
    activeUsersAfter?: number;
    [key: string]: unknown;
  } | null;
  error: string | null;
  startedBy: string | null;
  createdAt: string;
  completedAt: string | null;
}
