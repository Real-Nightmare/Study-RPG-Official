import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { StudyEventsService } from '../events/events.service';
import { CreatePuzzleDto, UpdatePuzzleDto, SubmitPuzzleDto } from './dto/puzzle.dto';
import {
  applyPuzzleAttempt,
  dailyRankedLimitReached,
  pickNextRankedPuzzle,
  PuzzleStreakState,
} from './puzzle-streak';

export interface Puzzle {
  id: string;
  userId: string;
  subject: string;
  question: string;
  choices: Array<{ key: string; text: string }>;
  answerKey: string;
  explanation: string | null;
  difficulty: string;
  source: string;
  createdAt: Date;
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
  createdAt: Date;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class PuzzlesService {
  private readonly logger = new Logger(PuzzlesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly events?: StudyEventsService,
  ) {}

  async create(userId: string, dto: CreatePuzzleDto): Promise<Puzzle> {
    const id = uuidv4();
    const result = await this.db.queryOne<Puzzle>(
      `INSERT INTO puzzles (id, user_id, subject, question, choices, answer_key, explanation, difficulty, source)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, 'manual')
       RETURNING *`,
      [
        id,
        userId,
        dto.subject,
        dto.question,
        JSON.stringify(dto.choices),
        dto.answerKey,
        dto.explanation || null,
        dto.difficulty || 'medium',
      ],
    );
    this.logger.log(`Puzzle created: ${id} (${dto.subject})`);
    return this.mapPuzzle(result!);
  }

  async listSubjects(userId: string): Promise<
    Array<{
      subject: string;
      total: number;
      rankedToday: number;
      streak: number;
      personalBest: number;
    }>
  > {
    const rows = await this.db.queryMany<{
      subject: string;
      total: string;
      ranked_today: string;
      streak: string;
      personal_best: string;
    }>(
      `SELECT
         s.subject,
         COUNT(p.id)::int AS total,
         COALESCE(ps.daily_ranked_count, 0)::int AS ranked_today,
         COALESCE(ps.streak, 0)::int AS streak,
         COALESCE(ps.personal_best, 0)::int AS personal_best
       FROM (SELECT DISTINCT subject FROM puzzles WHERE user_id = $1) s
       LEFT JOIN puzzles p ON p.user_id = $1 AND p.subject = s.subject
       LEFT JOIN puzzle_streaks ps ON ps.user_id = $1 AND ps.subject = s.subject
       GROUP BY s.subject, ps.daily_ranked_count, ps.streak, ps.personal_best
       ORDER BY s.subject`,
      [userId],
    );
    return rows.map((r) => ({
      subject: r.subject,
      total: Number(r.total),
      rankedToday: Number(r.ranked_today),
      streak: Number(r.streak),
      personalBest: Number(r.personal_best),
    }));
  }

  async getStreak(userId: string, subject: string): Promise<PuzzleStreakState> {
    const row = await this.db.queryOne<PuzzleStreakState>(
      'SELECT * FROM puzzle_streaks WHERE user_id = $1 AND subject = $2',
      [userId, subject],
    );
    return (
      row ?? {
        streak: 0,
        personalBest: 0,
        dailyRankedCount: 0,
        lastRankedDay: null,
        lastRankedPuzzleId: null,
      }
    );
  }

  async nextPuzzle(
    userId: string,
    subject: string,
    mode: 'ranked' | 'practice',
  ): Promise<{
    puzzle: Omit<Puzzle, 'answerKey'> | null;
    streak: PuzzleStreakState;
    dailyLimitReached: boolean;
  }> {
    const streak = await this.getStreak(userId, subject);

    if (mode === 'ranked') {
      if (dailyRankedLimitReached(streak, todayKey())) {
        return { puzzle: null, streak, dailyLimitReached: true };
      }
      const rows = await this.db.queryMany<{ id: string }>(
        `SELECT id FROM puzzles
         WHERE user_id = $1 AND subject = $2
         ORDER BY created_at ASC`,
        [userId, subject],
      );
      const pick = pickNextRankedPuzzle(rows, streak.lastRankedPuzzleId);
      if (!pick) {
        return { puzzle: null, streak, dailyLimitReached: false };
      }
      const puzzle = await this.getOwned(userId, pick.id);
      return { puzzle: this.withoutAnswer(puzzle), streak, dailyLimitReached: false };
    }

    // Practice mode: any puzzle.
    const row = await this.db.queryOne<Puzzle>(
      `SELECT * FROM puzzles WHERE user_id = $1 AND subject = $2
       ORDER BY RANDOM() LIMIT 1`,
      [userId, subject],
    );
    if (!row) {
      return { puzzle: null, streak, dailyLimitReached: false };
    }
    return { puzzle: this.withoutAnswer(this.mapPuzzle(row)), streak, dailyLimitReached: false };
  }

  async submit(
    userId: string,
    puzzleId: string,
    dto: SubmitPuzzleDto,
  ): Promise<{
    correct: boolean;
    answerKey: string;
    explanation: string | null;
    streak: PuzzleStreakState;
    attempt: PuzzleAttempt;
  }> {
    const puzzle = await this.getOwned(userId, puzzleId);
    const mode = dto.mode === 'ranked' ? 'ranked' : 'practice';
    const correct = dto.selectedKey === puzzle.answerKey;

    const streakState = await this.getStreak(userId, puzzle.subject);
    const applied = applyPuzzleAttempt({
      state: streakState,
      correct,
      mode,
      shielded: dto.shielded ?? false,
      today: todayKey(),
    });

    // Persist streak state for ranked attempts.
    if (mode === 'ranked') {
      await this.db.query(
        `INSERT INTO puzzle_streaks (user_id, subject, streak, personal_best, daily_ranked_count, last_ranked_day, last_ranked_puzzle_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id, subject) DO UPDATE SET
           streak = EXCLUDED.streak,
           personal_best = EXCLUDED.personal_best,
           daily_ranked_count = EXCLUDED.daily_ranked_count,
           last_ranked_day = EXCLUDED.last_ranked_day,
           last_ranked_puzzle_id = EXCLUDED.last_ranked_puzzle_id,
           updated_at = NOW()`,
        [
          userId,
          puzzle.subject,
          applied.streak,
          applied.personalBest,
          applied.dailyRankedCount,
          applied.lastRankedDay,
          puzzleId,
        ],
      );
    }

    const attemptId = uuidv4();
    const attempt = await this.db.queryOne<PuzzleAttempt>(
      `INSERT INTO puzzle_attempts (
         id, user_id, puzzle_id, subject, mode, selected_key, is_correct, shielded,
         streak_after, personal_best
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        attemptId,
        userId,
        puzzleId,
        puzzle.subject,
        mode,
        dto.selectedKey,
        correct,
        dto.shielded ?? false,
        applied.streak,
        applied.personalBest,
      ],
    );

    if (this.events && correct) {
      await this.events
        .recordStudyActivity(userId, { type: 'puzzle_solved' })
        .catch(() => undefined);
    }
    this.logger.log(
      `Puzzle ${puzzleId} answered ${correct ? 'correct' : 'wrong'} (${mode}); streak → ${applied.streak}`,
    );

    return {
      correct,
      answerKey: puzzle.answerKey,
      explanation: puzzle.explanation,
      streak: {
        streak: applied.streak,
        personalBest: applied.personalBest,
        dailyRankedCount: applied.dailyRankedCount,
        lastRankedDay: applied.lastRankedDay,
        lastRankedPuzzleId: mode === 'ranked' ? puzzleId : streakState.lastRankedPuzzleId,
      },
      attempt: this.mapAttempt(attempt!),
    };
  }

  async attempts(userId: string, subject?: string, limit = 100): Promise<PuzzleAttempt[]> {
    const rows = subject
      ? await this.db.queryMany<PuzzleAttempt>(
          `SELECT * FROM puzzle_attempts WHERE user_id = $1 AND subject = $2
           ORDER BY created_at DESC LIMIT $3`,
          [userId, subject, limit],
        )
      : await this.db.queryMany<PuzzleAttempt>(
          `SELECT * FROM puzzle_attempts WHERE user_id = $1
           ORDER BY created_at DESC LIMIT $2`,
          [userId, limit],
        );
    return rows.map((r) => this.mapAttempt(r));
  }

  async list(userId: string, subject?: string): Promise<Puzzle[]> {
    const rows = subject
      ? await this.db.queryMany<Puzzle>(
          'SELECT * FROM puzzles WHERE user_id = $1 AND subject = $2 ORDER BY created_at ASC',
          [userId, subject],
        )
      : await this.db.queryMany<Puzzle>(
          'SELECT * FROM puzzles WHERE user_id = $1 ORDER BY subject ASC, created_at ASC',
          [userId],
        );
    return rows.map((r) => this.mapPuzzle(r));
  }

  async update(userId: string, id: string, dto: UpdatePuzzleDto): Promise<Puzzle> {
    await this.getOwned(userId, id);
    const result = await this.db.queryOne<Puzzle>(
      `UPDATE puzzles SET
        question = COALESCE($1, question),
        choices = COALESCE($2::jsonb, choices),
        answer_key = COALESCE($3, answer_key),
        explanation = COALESCE($4, explanation),
        difficulty = COALESCE($5, difficulty)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [
        dto.question ?? null,
        dto.choices ? JSON.stringify(dto.choices) : null,
        dto.answerKey ?? null,
        dto.explanation ?? null,
        dto.difficulty ?? null,
        id,
        userId,
      ],
    );
    return this.mapPuzzle(result!);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.db.query('DELETE FROM puzzles WHERE id = $1 AND user_id = $2', [id, userId]);
  }

  private async getOwned(userId: string, id: string): Promise<Puzzle> {
    const row = await this.db.queryOne<Puzzle>(
      'SELECT * FROM puzzles WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (!row) {
      throw new NotFoundException('Puzzle not found');
    }
    return this.mapPuzzle(row);
  }

  private withoutAnswer(puzzle: Puzzle): Omit<Puzzle, 'answerKey'> {
    const rest: Record<string, unknown> = { ...puzzle };
    delete rest.answerKey;
    return rest as Omit<Puzzle, 'answerKey'>;
  }

  private mapPuzzle(row: unknown): Puzzle {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      subject: r.subject as string,
      question: r.question as string,
      choices: Array.isArray(r.choices) ? (r.choices as Array<{ key: string; text: string }>) : [],
      answerKey: r.answer_key as string,
      explanation: (r.explanation ?? null) as string | null,
      difficulty: r.difficulty as string,
      source: r.source as string,
      createdAt: new Date(r.created_at as string),
    };
  }

  private mapAttempt(row: unknown): PuzzleAttempt {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      puzzleId: r.puzzle_id as string,
      subject: r.subject as string,
      mode: r.mode as string,
      selectedKey: (r.selected_key ?? null) as string | null,
      isCorrect: r.is_correct as boolean,
      shielded: r.shielded as boolean,
      streakAfter: Number(r.streak_after),
      personalBest: Number(r.personal_best),
      createdAt: new Date(r.created_at as string),
    };
  }
}
