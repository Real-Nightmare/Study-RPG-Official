import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { recommendNextAction, RecommendationAction } from './recommendation';
import { ExamPeriodsService } from '../exam-periods/exam-periods.service';
import { istDayKey } from '../events/quest-rules';

export interface DashboardSummary {
  todayPlan: {
    tasksDueToday: number;
    tasksDueNow: number;
    nextTask: { id: string; title: string; dueDate: string | null } | null;
  };
  upcomingExams: Array<{
    id: string;
    name: string;
    subject: string | null;
    examDate: string;
    daysUntil: number;
  }>;
  currentExamPortions: number;
  focusMinutesToday: number;
  flashcardsDue: number;
  quizAccuracy30d: number | null;
  recentMistakes: Array<{
    id: string;
    questionText: string;
    subject: string | null;
    status: string;
  }>;
  weakTopics: Array<{ topic: string; accuracy: number }>;
  puzzleStreak: { best: number; subjects: Array<{ subject: string; streak: number }> };
  studyStreakDays: number;
  gameStats: {
    stpToday: number;
    playerXp: number;
    eventExp: number;
    dailyQuests: Array<{ id: string; title: string; done: boolean }>;
  };
  recommendedAction: RecommendationAction;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly examPeriods: ExamPeriodsService,
  ) {}

  async getPreferences(userId: string): Promise<{ hideGameStats: boolean }> {
    const row = await this.db.queryOne<{ hide_game_stats: boolean }>(
      'SELECT hide_game_stats FROM user_preferences WHERE user_id = $1',
      [userId],
    );
    return { hideGameStats: row?.hide_game_stats ?? false };
  }

  async setPreferences(
    userId: string,
    prefs: { hideGameStats?: boolean },
  ): Promise<{ hideGameStats: boolean }> {
    const hideGameStats = prefs.hideGameStats ?? false;
    await this.db.query(
      `INSERT INTO user_preferences (user_id, hide_game_stats, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET hide_game_stats = EXCLUDED.hide_game_stats, updated_at = NOW()`,
      [userId, hideGameStats],
    );
    return { hideGameStats };
  }

  async summary(userId: string): Promise<DashboardSummary> {
    const prefs = await this.getPreferences(userId);
    const hideGameStats = prefs.hideGameStats;

    const [
      tasksDue,
      tasksOverdue,
      flashcardsDue,
      focusToday,
      quizAccuracy,
      mistakes,
      weakTopics,
      streaks,
      studyStreak,
      gameStats,
    ] = await Promise.all([
      this.countTasksDue(userId),
      this.countTasksOverdue(userId),
      this.countFlashcardsDue(userId),
      this.focusMinutesToday(userId),
      this.quizAccuracy30d(userId),
      this.recentMistakes(userId),
      this.weakTopics(userId),
      this.puzzleStreaks(userId),
      this.studyStreakDays(userId),
      hideGameStats ? Promise.resolve(null) : this.gameStats(userId),
    ]);

    const nextTask = await this.nextTask(userId);
    const upcomingExams = await this.upcomingExams(userId);
    const currentPortions = await this.currentExamPortions(userId);
    const nearestExam =
      upcomingExams.length > 0
        ? {
            name: upcomingExams[0].name,
            examDate: upcomingExams[0].examDate,
            daysUntil: upcomingExams[0].daysUntil,
          }
        : null;

    const recommendedAction = recommendNextAction({
      nearestExam,
      flashcardsDue,
      overdueTasks: tasksOverdue,
      openMistakes: mistakes.items.length,
      puzzleStreakAvailable: streaks.subjects.some((s) => s.streak >= 0),
    });

    const summary: DashboardSummary = {
      todayPlan: {
        tasksDueToday: tasksDue,
        tasksDueNow: tasksOverdue,
        nextTask,
      },
      upcomingExams,
      currentExamPortions: currentPortions,
      focusMinutesToday: focusToday,
      flashcardsDue,
      quizAccuracy30d: quizAccuracy,
      recentMistakes: mistakes.items.slice(0, 5),
      weakTopics: weakTopics.slice(0, 5),
      puzzleStreak: streaks,
      studyStreakDays: studyStreak,
      gameStats: gameStats ?? { stpToday: 0, playerXp: 0, eventExp: 0, dailyQuests: [] },
      recommendedAction,
    };

    this.logger.log(`Dashboard summary built for user ${userId}`);
    return summary;
  }

  // ------------------------------------------------------------------
  // Section queries
  // ------------------------------------------------------------------

  private async countTasksDue(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM study_tasks
       WHERE user_id = $1 AND status <> 'done'
         AND due_date IS NOT NULL AND due_date::date <= CURRENT_DATE`,
      [userId],
    );
    return Number(row?.count ?? 0);
  }

  private async countTasksOverdue(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM study_tasks
       WHERE user_id = $1 AND status <> 'done'
         AND due_date IS NOT NULL AND due_date::date < CURRENT_DATE`,
      [userId],
    );
    return Number(row?.count ?? 0);
  }

  private async nextTask(
    userId: string,
  ): Promise<{ id: string; title: string; dueDate: string | null } | null> {
    const row = await this.db.queryOne<{ id: string; title: string; due_date: string | null }>(
      `SELECT id, title, due_date FROM study_tasks
       WHERE user_id = $1 AND status <> 'done'
       ORDER BY due_date ASC NULLS LAST LIMIT 1`,
      [userId],
    );
    return row ? { id: row.id, title: row.title, dueDate: row.due_date } : null;
  }

  private async countFlashcardsDue(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM flashcards f
       JOIN study_sets s ON s.id = f.study_set_id AND s.user_id = $1
       WHERE f.next_review_at IS NOT NULL AND f.next_review_at <= NOW()`,
      [userId],
    );
    return Number(row?.count ?? 0);
  }

  private async focusMinutesToday(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ minutes: string }>(
      `SELECT COALESCE(SUM(focus_minutes), 0)::int AS minutes FROM focus_sessions
       WHERE user_id = $1 AND status = 'completed' AND started_at >= CURRENT_DATE`,
      [userId],
    );
    return Number(row?.minutes ?? 0);
  }

  private async quizAccuracy30d(userId: string): Promise<number | null> {
    const row = await this.db.queryOne<{ accuracy: string }>(
      `SELECT COALESCE(AVG(score) / NULLIF(MAX(total_questions), 0) * 100, 0)::numeric(6,2) AS accuracy
       FROM quiz_attempts
       WHERE user_id = $1 AND completed_at >= NOW() - INTERVAL '30 days'
         AND total_questions > 0`,
      [userId],
    );
    return row && row.accuracy !== null ? Number(row.accuracy) : null;
  }

  private async recentMistakes(userId: string): Promise<{
    items: Array<{ id: string; questionText: string; subject: string | null; status: string }>;
  }> {
    const rows = await this.db.queryMany<{
      id: string;
      question_text: string;
      subject: string | null;
      status: string;
    }>(
      `SELECT id, question_text, subject, status FROM mistakes
       WHERE user_id = $1 AND status <> 'resolved'
       ORDER BY created_at DESC LIMIT 5`,
      [userId],
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        questionText: r.question_text,
        subject: r.subject,
        status: r.status,
      })),
    };
  }

  private async weakTopics(userId: string): Promise<Array<{ topic: string; accuracy: number }>> {
    const rows = await this.db.queryMany<{ topic: string; accuracy: string }>(
      `SELECT q.title AS topic, AVG(qa.score / NULLIF(qa.total_questions, 0) * 100)::numeric(6,2) AS accuracy
       FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id AND q.user_id = $1
       WHERE qa.completed_at >= NOW() - INTERVAL '30 days' AND qa.total_questions > 0
       GROUP BY q.title
       HAVING COUNT(*) >= 1
       ORDER BY accuracy ASC LIMIT 5`,
      [userId],
    );
    return rows.map((r) => ({ topic: r.topic, accuracy: Number(r.accuracy) }));
  }

  private async puzzleStreaks(
    userId: string,
  ): Promise<{ best: number; subjects: Array<{ subject: string; streak: number }> }> {
    const rows = await this.db.queryMany<{
      subject: string;
      streak: string;
      personal_best: string;
    }>(
      `SELECT subject, streak, personal_best FROM puzzle_streaks WHERE user_id = $1 ORDER BY streak DESC`,
      [userId],
    );
    const subjects = rows.map((r) => ({ subject: r.subject, streak: Number(r.streak) }));
    const best = Math.max(0, ...subjects.map((s) => s.streak));
    return { best, subjects };
  }

  private async studyStreakDays(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ days: string }>(
      `WITH days AS (
         SELECT DISTINCT completed_at::date AS day FROM quiz_attempts WHERE user_id = $1 AND completed_at IS NOT NULL
         UNION
         SELECT DISTINCT started_at::date FROM focus_sessions WHERE user_id = $1
       )
       SELECT COUNT(*)::int AS days FROM days WHERE day >= CURRENT_DATE - 30`,
      [userId],
    );
    return Number(row?.days ?? 0);
  }

  private async upcomingExams(
    userId: string,
  ): Promise<
    Array<{ id: string; name: string; subject: string | null; examDate: string; daysUntil: number }>
  > {
    const rows = await this.db.queryMany<{
      id: string;
      name: string;
      subject: string | null;
      exam_date: string;
    }>(
      `SELECT e.id, e.name, s.name AS subject, e.exam_date
       FROM exams e LEFT JOIN subjects s ON s.id = e.subject_id
       WHERE e.user_id = $1 AND e.exam_date IS NOT NULL AND e.exam_date >= CURRENT_DATE
       ORDER BY e.exam_date ASC LIMIT 5`,
      [userId],
    );
    return rows.map((r) => {
      const examDate = new Date(r.exam_date).toISOString().slice(0, 10);
      const daysUntil = Math.max(
        0,
        Math.round((new Date(examDate).getTime() - Date.now()) / 86400000),
      );
      return { id: r.id, name: r.name, subject: r.subject ?? null, examDate, daysUntil };
    });
  }

  private async currentExamPortions(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT ep.id)::int AS count
       FROM exam_portions ep JOIN exams e ON e.id = ep.exam_id
       WHERE e.user_id = $1 AND e.exam_date >= CURRENT_DATE`,
      [userId],
    );
    return Number(row?.count ?? 0);
  }

  private async gameStats(userId: string): Promise<DashboardSummary['gameStats']> {
    // Real data only: STP earned today from the immutable wallet ledger, XP
    // from the player profile, event EXP from active-event StudyPass state,
    // and daily quests from the data-driven quest tables (plus two honestly
    // computed study quests).
    const dayKey = istDayKey(new Date());
    const [walletRow, profileRow, eventExpRow, questRows] = await Promise.all([
      this.db.queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0)::int AS total
         FROM wallet_ledger
         WHERE user_id = $1 AND amount > 0 AND created_at >= CURRENT_DATE`,
        [userId],
      ),
      this.db.queryOne<{ xp: number }>(`SELECT xp FROM player_profiles WHERE user_id = $1`, [
        userId,
      ]),
      this.db.queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(s.event_exp), 0)::int AS total
         FROM user_event_state s
         JOIN events e ON e.id = s.event_id
         WHERE s.user_id = $1 AND e.status = 'active'
           AND NOW() >= e.starts_at AND NOW() < e.ends_at`,
        [userId],
      ),
      this.db.queryMany<{ id: string; title: string; done: boolean }>(
        `SELECT q.id, q.title,
                (uq.completed_at IS NOT NULL) AS done
         FROM quests q
         LEFT JOIN user_quests uq
           ON uq.quest_id = q.id AND uq.user_id = $1 AND uq.period_key = $2
         WHERE q.active = TRUE AND q.period = 'daily'
           AND (q.event_id IS NULL OR EXISTS (
                 SELECT 1 FROM events e
                 WHERE e.id = q.event_id AND e.status = 'active'
                   AND NOW() >= e.starts_at AND NOW() < e.ends_at))
         ORDER BY q.sort_order
         LIMIT 3`,
        [userId, dayKey],
      ),
    ]);

    const focusDone = (await this.focusMinutesToday(userId)) >= 30;
    const flashcardsClear = (await this.countFlashcardsDue(userId)) === 0;

    const dbQuests = questRows.map((q) => ({
      id: String(q.id),
      title: q.title,
      done: Boolean(q.done),
    }));
    const computedQuests = [
      { id: 'focus', title: 'Focus 30 minutes', done: focusDone },
      { id: 'flashcards', title: 'Review due flashcards', done: flashcardsClear },
    ];

    return {
      stpToday: Number(walletRow?.total ?? 0),
      playerXp: Number(profileRow?.xp ?? 0),
      eventExp: Number(eventExpRow?.total ?? 0),
      dailyQuests: [...dbQuests, ...computedQuests].slice(0, 5),
    };
  }
}
