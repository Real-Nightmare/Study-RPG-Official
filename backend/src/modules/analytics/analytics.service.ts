import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ClickhouseService } from '../clickhouse/clickhouse.service';

export interface UserAnalytics {
  totalStudyTime: number;
  studySetsCreated: number;
  flashcardsReviewed: number;
  quizzesTaken: number;
  averageQuizScore: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Date | null;
}

export interface StudyActivity {
  date: string;
  studyTime: number;
  flashcardsReviewed: number;
  quizzesTaken: number;
}

export interface PerformanceMetrics {
  flashcardAccuracy: number;
  quizAccuracy: number;
  improvementRate: number;
  strongTopics: string[];
  weakTopics: string[];
}

/**
 * Aggregates learning statistics for a user. Postgres holds the durable
 * counters (study sets, quiz attempts); ClickHouse provides the daily
 * activity stream used for streaks and study time. ClickHouse is treated as
 * optional — every read falls back gracefully when it is unavailable.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  /** Rough conversion: each recorded activity row ≈ 5 minutes of study. */
  private readonly minutesPerActivity = 5;

  constructor(
    private readonly db: DatabaseService,
    private readonly clickhouse: ClickhouseService,
  ) {}

  async trackEvent(
    userId: string,
    eventType: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.clickhouse.trackEvent({ eventType, userId, metadata });
  }

  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    try {
      const [studySets, flashcards, quizzes, quizScores] = await Promise.all([
        this.db.queryOne<{ count: string }>(
          'SELECT COUNT(*) as count FROM study_sets WHERE user_id = $1',
          [userId],
        ),
        this.db.queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM flashcards f
           JOIN study_sets s ON f.study_set_id = s.id
           WHERE s.user_id = $1 AND f.last_reviewed_at IS NOT NULL`,
          [userId],
        ),
        this.db.queryOne<{ count: string }>(
          'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = $1',
          [userId],
        ),
        this.db.queryOne<{ avg: string }>(
          'SELECT AVG(score) as avg FROM quiz_attempts WHERE user_id = $1',
          [userId],
        ),
      ]);

      let activity: Array<{ date: string; count: number }> = [];
      try {
        activity = await this.clickhouse.getUserActivity(userId, 30);
      } catch (error) {
        this.logger.warn(`ClickHouse unavailable: ${(error as Error).message}`);
      }
      const streak = this.calculateStreak(activity);

      return {
        totalStudyTime: activity.reduce((sum, day) => sum + day.count, 0) * this.minutesPerActivity,
        studySetsCreated: parseInt(studySets?.count || '0', 10),
        flashcardsReviewed: parseInt(flashcards?.count || '0', 10),
        quizzesTaken: parseInt(quizzes?.count || '0', 10),
        averageQuizScore: parseFloat(quizScores?.avg || '0'),
        currentStreak: streak.current,
        longestStreak: streak.longest,
        lastStudyDate: activity.length > 0 ? new Date(activity[activity.length - 1].date) : null,
      };
    } catch (error) {
      this.logger.error(`Failed to get user analytics: ${(error as Error).message}`);
      return {
        totalStudyTime: 0,
        studySetsCreated: 0,
        flashcardsReviewed: 0,
        quizzesTaken: 0,
        averageQuizScore: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastStudyDate: null,
      };
    }
  }

  async getStudyActivity(userId: string, days = 30): Promise<StudyActivity[]> {
    let activity: Array<{ date: string; count: number }> = [];
    try {
      activity = await this.clickhouse.getUserActivity(userId, days);
    } catch (error) {
      this.logger.warn(`ClickHouse unavailable for study activity: ${(error as Error).message}`);
    }

    return activity.map((day) => ({
      date: day.date,
      studyTime: day.count * this.minutesPerActivity,
      flashcardsReviewed: 0,
      quizzesTaken: 0,
    }));
  }

  async getPerformanceMetrics(userId: string): Promise<PerformanceMetrics> {
    const answerStats = await this.db.queryOne<{ total: string; correct: string }>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_correct) as correct
       FROM quiz_attempt_answers qa
       JOIN quiz_attempts a ON qa.attempt_id = a.id
       WHERE a.user_id = $1`,
      [userId],
    );

    const total = parseInt(answerStats?.total || '0', 10);
    const correct = parseInt(answerStats?.correct || '0', 10);

    return {
      flashcardAccuracy: total > 0 ? (correct / total) * 100 : 0,
      quizAccuracy: total > 0 ? (correct / total) * 100 : 0,
      improvementRate: 0,
      strongTopics: [],
      weakTopics: [],
    };
  }

  async getGlobalStats(): Promise<{
    totalUsers: number;
    totalStudySets: number;
    totalFlashcards: number;
    totalQuizzes: number;
  }> {
    const [users, studySets, flashcards, quizzes] = await Promise.all([
      this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM users'),
      this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM study_sets'),
      this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM flashcards'),
      this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM quizzes'),
    ]);

    return {
      totalUsers: parseInt(users?.count || '0', 10),
      totalStudySets: parseInt(studySets?.count || '0', 10),
      totalFlashcards: parseInt(flashcards?.count || '0', 10),
      totalQuizzes: parseInt(quizzes?.count || '0', 10),
    };
  }

  /**
   * Computes current and longest day-streaks from a per-day activity series.
   * Only days with activity count; a missing day resets the run.
   */
  private calculateStreak(activity: Array<{ date: string; count: number }>): {
    current: number;
    longest: number;
  } {
    if (activity.length === 0) return { current: 0, longest: 0 };

    const activeDays = [...activity]
      .filter((day) => day.count > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (activeDays.length === 0) return { current: 0, longest: 0 };

    let longest = 0;
    let running = 0;
    let previous: Date | null = null;

    for (const day of activeDays) {
      const date = this.normalizeDate(day.date);
      if (previous) {
        const gapDays = this.diffInDays(previous, date);
        running = gapDays === 1 ? running + 1 : 1;
      } else {
        running = 1;
      }
      longest = Math.max(longest, running);
      previous = date;
    }

    const today = this.normalizeDate(new Date());
    const lastGap = previous ? this.diffInDays(previous, today) : Number.MAX_SAFE_INTEGER;
    const current = lastGap <= 1 ? running : 0;

    return { current, longest };
  }

  private normalizeDate(value: string | Date): Date {
    const date = value instanceof Date ? value : new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private diffInDays(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }
}
