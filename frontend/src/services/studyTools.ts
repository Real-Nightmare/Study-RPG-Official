import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  FocusSession,
  StartFocusSessionRequest,
  FocusTodaySummary,
  FocusWellbeing,
  Mistake,
  CreateMistakeRequest,
  MistakeList,
  Puzzle,
  PuzzleSubjectOverview,
  PuzzleAttempt,
  NextPuzzleResponse,
  SubmitPuzzleRequest,
  SubmitPuzzleResponse,
  ExamPeriod,
  CreateExamPeriodRequest,
  ExamResult,
  RecordExamResultRequest,
  DashboardSummary,
  DashboardPreferences,
} from '@/types';

export const studyToolsService = {
  // ---------------- Focus sessions ----------------
  async listFocusSessions(limit = 50): Promise<FocusSession[]> {
    const response = await api.get<FocusSession[]>(ENDPOINTS.focusSessions.list, { params: { limit } });
    return response.data;
  },

  async startFocusSession(data: StartFocusSessionRequest): Promise<FocusSession> {
    const response = await api.post<FocusSession>(ENDPOINTS.focusSessions.create, data);
    return response.data;
  },

  async focusToday(): Promise<FocusTodaySummary> {
    const response = await api.get<FocusTodaySummary>(ENDPOINTS.focusSessions.today);
    return response.data;
  },

  /** Anti-overstudy status (spec 015): budget, health meter, cooldown. */
  async focusWellbeing(): Promise<FocusWellbeing> {
    const response = await api.get<FocusWellbeing>(ENDPOINTS.focusSessions.wellbeing);
    return response.data;
  },

  async pauseFocusSession(id: string): Promise<FocusSession> {
    const response = await api.post<FocusSession>(ENDPOINTS.focusSessions.pause(id));
    return response.data;
  },

  async resumeFocusSession(id: string): Promise<FocusSession> {
    const response = await api.post<FocusSession>(ENDPOINTS.focusSessions.resume(id));
    return response.data;
  },

  async completeFocusSession(id: string): Promise<FocusSession> {
    const response = await api.post<FocusSession>(ENDPOINTS.focusSessions.complete(id));
    return response.data;
  },

  async deleteFocusSession(id: string): Promise<void> {
    await api.delete(ENDPOINTS.focusSessions.delete(id));
  },

  // ---------------- Mistakes ----------------
  async listMistakes(params?: {
    status?: string;
    subject?: string;
    category?: string;
  }): Promise<MistakeList> {
    const response = await api.get<MistakeList>(ENDPOINTS.mistakes.list, { params });
    return response.data;
  },

  async createMistake(data: CreateMistakeRequest): Promise<Mistake> {
    const response = await api.post<Mistake>(ENDPOINTS.mistakes.create, data);
    return response.data;
  },

  async resolveMistake(id: string, correctionNote?: string): Promise<Mistake> {
    const response = await api.post<Mistake>(ENDPOINTS.mistakes.resolve(id), { correctionNote });
    return response.data;
  },

  async reopenMistake(id: string): Promise<Mistake> {
    const response = await api.post<Mistake>(ENDPOINTS.mistakes.reopen(id));
    return response.data;
  },

  async deleteMistake(id: string): Promise<void> {
    await api.delete(ENDPOINTS.mistakes.delete(id));
  },

  // ---------------- Puzzles ----------------
  async puzzleSubjects(): Promise<PuzzleSubjectOverview[]> {
    const response = await api.get<PuzzleSubjectOverview[]>(ENDPOINTS.puzzles.subjects);
    return response.data;
  },

  async puzzleAttempts(subject?: string): Promise<PuzzleAttempt[]> {
    const response = await api.get<PuzzleAttempt[]>(ENDPOINTS.puzzles.attempts, { params: { subject } });
    return response.data;
  },

  async nextPuzzle(subject: string, mode: 'ranked' | 'practice'): Promise<NextPuzzleResponse> {
    const response = await api.get<NextPuzzleResponse>(ENDPOINTS.puzzles.next, {
      params: { subject, mode },
    });
    return response.data;
  },

  async submitPuzzle(id: string, data: SubmitPuzzleRequest): Promise<SubmitPuzzleResponse> {
    const response = await api.post<SubmitPuzzleResponse>(ENDPOINTS.puzzles.submit(id), data);
    return response.data;
  },

  async createPuzzle(data: {
    subject: string;
    question: string;
    choices: Array<{ key: string; text: string }>;
    answerKey: string;
    explanation?: string;
    difficulty?: string;
  }): Promise<Puzzle> {
    const response = await api.post<Puzzle>(ENDPOINTS.puzzles.create, data);
    return response.data;
  },

  async listPuzzles(subject?: string): Promise<Puzzle[]> {
    const response = await api.get<Puzzle[]>(ENDPOINTS.puzzles.list, { params: { subject } });
    return response.data;
  },

  async deletePuzzle(id: string): Promise<void> {
    await api.delete(ENDPOINTS.puzzles.delete(id));
  },

  // ---------------- Exam periods ----------------
  async listExamPeriods(): Promise<ExamPeriod[]> {
    const response = await api.get<ExamPeriod[]>(ENDPOINTS.examPeriods.list);
    return response.data;
  },

  async nearestExam(): Promise<{
    id: string;
    name: string;
    subject: string | null;
    examDate: string;
    daysUntil: number;
  } | null> {
    const response = await api.get<{ id: string; name: string; subject: string | null; examDate: string; daysUntil: number } | null>(
      ENDPOINTS.examPeriods.nearest,
    );
    return response.data;
  },

  async createExamPeriod(data: CreateExamPeriodRequest): Promise<ExamPeriod> {
    const response = await api.post<ExamPeriod>(ENDPOINTS.examPeriods.create, data);
    return response.data;
  },

  async deleteExamPeriod(id: string): Promise<void> {
    await api.delete(ENDPOINTS.examPeriods.delete(id));
  },

  async attachExams(periodId: string, examIds: string[]): Promise<ExamPeriod> {
    const response = await api.post<ExamPeriod>(ENDPOINTS.examPeriods.attach(periodId), { examIds });
    return response.data;
  },

  async listExamResults(): Promise<ExamResult[]> {
    const response = await api.get<ExamResult[]>(ENDPOINTS.examPeriods.results);
    return response.data;
  },

  async recordExamResult(examId: string, data: RecordExamResultRequest): Promise<ExamResult> {
    const response = await api.post<ExamResult>(ENDPOINTS.examPeriods.result(examId), data);
    return response.data;
  },

  // ---------------- Dashboard ----------------
  async dashboardSummary(): Promise<DashboardSummary> {
    const response = await api.get<DashboardSummary>(ENDPOINTS.dashboard.summary);
    return response.data;
  },

  async getPreferences(): Promise<DashboardPreferences> {
    const response = await api.get<DashboardPreferences>(ENDPOINTS.dashboard.preferences);
    return response.data;
  },

  async setPreferences(data: DashboardPreferences): Promise<DashboardPreferences> {
    const response = await api.put<DashboardPreferences>(ENDPOINTS.dashboard.preferences, data);
    return response.data;
  },
};
