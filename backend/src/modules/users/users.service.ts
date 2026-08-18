import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface User {
  id: string;
  email: string | null;
  username: string | null;
  password: string | null;
  name: string;
  avatarUrl: string | null;
  role: string;
  googleId: string | null;
  appleId: string | null;
  emailVerified: boolean;
  educationLevel: string | null;
  subjects: string[];
  profileCompleted: boolean;
  preferences: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface CreateUserDto {
  email?: string;
  username?: string;
  password?: string;
  name: string;
  role?: string;
  googleId?: string;
  appleId?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}

export interface UpdateUserDto {
  name?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  educationLevel?: string;
  subjects?: string[];
  profileCompleted?: boolean;
  preferences?: Record<string, unknown>;
}

const XP_LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];
const DEFAULT_DAILY_XP_GOAL = 100;
/** Event types that reflect genuine studying (score double faction points). */
const STUDY_XP_TYPES = ['task_completed', 'quiz_attempt', 'study_session', 'focus_session'];

/**
 * User accounts: CRUD, credential lookups, profile updates, streaks, and the
 * gamification ledger. XP events also feed faction scores (Phase 6) so that
 * studying — not battling — is what advances faction rewards.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateUserDto): Promise<User> {
    const id = uuidv4();
    const now = new Date();

    const result = await this.db.queryOne<User>(
      `INSERT INTO users (id, email, username, password, name, role, avatar_url, google_id, apple_id, email_verified, preferences, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        dto.email ? dto.email.toLowerCase() : null,
        dto.username || null,
        dto.password || null,
        dto.name,
        dto.role || 'user',
        dto.avatarUrl || null,
        dto.googleId || null,
        dto.appleId || null,
        dto.emailVerified || false,
        JSON.stringify({}),
        now,
        now,
      ],
    );

    this.logger.log(`User created: ${result!.id}`);
    return this.mapUser(result!);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.queryOne<User>('SELECT * FROM users WHERE id = $1', [id]);
    return result ? this.mapUser(result) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.queryOne<User>('SELECT * FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);
    return result ? this.mapUser(result) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db.queryOne<User>('SELECT * FROM users WHERE username = $1', [
      username.toLowerCase(),
    ]);
    return result ? this.mapUser(result) : null;
  }

  /** Login by email OR username. */
  async findByIdentifier(identifier: string): Promise<User | null> {
    const value = identifier.toLowerCase();
    const result = await this.db.queryOne<User>(
      'SELECT * FROM users WHERE email = $1 OR username = $1',
      [value],
    );
    return result ? this.mapUser(result) : null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const result = await this.db.queryOne<User>('SELECT * FROM users WHERE google_id = $1', [
      googleId,
    ]);
    return result ? this.mapUser(result) : null;
  }

  async findByAppleId(appleId: string): Promise<User | null> {
    const result = await this.db.queryOne<User>('SELECT * FROM users WHERE apple_id = $1', [
      appleId,
    ]);
    return result ? this.mapUser(result) : null;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const assignments: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldAssignments: Array<[keyof UpdateUserDto, string]> = [
      ['name', 'name'],
      ['username', 'username'],
      ['email', 'email'],
      ['avatarUrl', 'avatar_url'],
      ['educationLevel', 'education_level'],
      ['subjects', 'subjects'],
      ['profileCompleted', 'profile_completed'],
      ['preferences', 'preferences'],
    ];

    for (const [key, column] of fieldAssignments) {
      if (dto[key] !== undefined) {
        assignments.push(`${column} = $${paramIndex++}`);
        values.push(this.serializeField(key, dto[key]));
      }
    }

    assignments.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await this.db.queryOne<User>(
      `UPDATE users SET ${assignments.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return this.mapUser(result!);
  }

  private serializeField(key: keyof UpdateUserDto, value: unknown): unknown {
    switch (key) {
      case 'username':
        return (value as string).toLowerCase();
      case 'email':
        return (value as string).toLowerCase();
      case 'subjects':
        return JSON.stringify(value);
      case 'preferences':
        return JSON.stringify(value);
      default:
        return value;
    }
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.db.query('UPDATE users SET password = $1, updated_at = $2 WHERE id = $3', [
      hashedPassword,
      new Date(),
      id,
    ]);
    this.logger.log(`Password updated for user: ${id}`);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db.query('UPDATE users SET last_login_at = $1 WHERE id = $2', [new Date(), id]);
  }

  async verifyEmail(id: string): Promise<void> {
    await this.db.query('UPDATE users SET email_verified = true, updated_at = $1 WHERE id = $2', [
      new Date(),
      id,
    ]);
    this.logger.log(`Email verified for user: ${id}`);
  }

  async linkGoogleAccount(id: string, googleId: string): Promise<void> {
    await this.db.query('UPDATE users SET google_id = $1, updated_at = $2 WHERE id = $3', [
      googleId,
      new Date(),
      id,
    ]);
    this.logger.log(`Google account linked for user: ${id}`);
  }

  async linkAppleAccount(id: string, appleId: string): Promise<void> {
    await this.db.query('UPDATE users SET apple_id = $1, updated_at = $2 WHERE id = $3', [
      appleId,
      new Date(),
      id,
    ]);
    this.logger.log(`Apple account linked for user: ${id}`);
  }

  async delete(id: string): Promise<void> {
    const result = await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException('User not found');
    }
    this.logger.log(`User deleted: ${id}`);
  }

  async getStats(id: string): Promise<{
    studySetsCount: number;
    flashcardsCount: number;
    quizzesCompleted: number;
    streakDays: number;
  }> {
    const [studySets, flashcards, quizzes, streak] = await Promise.all([
      this.db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM study_sets WHERE user_id = $1',
        [id],
      ),
      this.db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM flashcards f JOIN study_sets s ON f.study_set_id = s.id WHERE s.user_id = $1',
        [id],
      ),
      this.db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = $1',
        [id],
      ),
      this.calculateStreak(id),
    ]);

    return {
      studySetsCount: parseInt(studySets?.count || '0', 10),
      flashcardsCount: parseInt(flashcards?.count || '0', 10),
      quizzesCompleted: parseInt(quizzes?.count || '0', 10),
      streakDays: streak,
    };
  }

  async getGamification(id: string): Promise<{
    totalXp: number;
    level: number;
    streakDays: number;
    dailyXp: number;
    dailyGoal: number;
    nextLevelXp: number;
    currentLevelXp: number;
  }> {
    const [xpResult, dailyXpResult, streak] = await Promise.all([
      this.db
        .queryOne<{
          total_xp: string;
        }>(`SELECT COALESCE(SUM(xp), 0) as total_xp FROM user_xp_events WHERE user_id = $1`, [id])
        .catch(() => ({ total_xp: '0' })),
      this.db
        .queryOne<{
          daily_xp: string;
        }>(
          `SELECT COALESCE(SUM(xp), 0) as daily_xp FROM user_xp_events WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
          [id],
        )
        .catch(() => ({ daily_xp: '0' })),
      this.calculateStreak(id),
    ]);

    const totalXp = parseInt((xpResult as { total_xp: string })?.total_xp || '0', 10);
    const dailyXp = parseInt((dailyXpResult as { daily_xp: string })?.daily_xp || '0', 10);

    const level = this.levelForXp(totalXp);
    const currentLevelXp = XP_LEVEL_THRESHOLDS[level] || 0;
    const nextLevelXp = XP_LEVEL_THRESHOLDS[level + 1] || XP_LEVEL_THRESHOLDS[level] + 2500;

    return {
      totalXp,
      level,
      streakDays: streak,
      dailyXp,
      dailyGoal: DEFAULT_DAILY_XP_GOAL,
      nextLevelXp,
      currentLevelXp,
    };
  }

  async addXp(id: string, type: string, xp: number): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO user_xp_events (id, user_id, type, xp, created_at) VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), id, type, xp, new Date()],
      );
      // Phase 6: every study-XP event also contributes to the user's faction
      // score — battles earn XP too, but study-driven events carry the bulk.
      await this.creditFactionScore(id, type, xp);
    } catch (error) {
      this.logger.warn(`Failed to record XP event: ${error}`);
    }
  }

  /**
   * Credits a user's faction with points for study activity (Phase 6).
   * Study events (tasks, quizzes, sessions) score double; battle/duel XP
   * counts half — so studying is what wins faction rewards.
   */
  private async creditFactionScore(userId: string, type: string, xp: number): Promise<void> {
    try {
      if (!xp || xp <= 0) return;

      const membership = await this.db.queryOne<{ faction_id: string }>(
        `SELECT faction_id FROM faction_members WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      if (!membership) return;

      const isStudyType = STUDY_XP_TYPES.some((t) => type.includes(t));
      const points = isStudyType ? xp * 2 : Math.ceil(xp / 2);

      await this.db.query(
        `INSERT INTO faction_score_events (id, faction_id, user_id, event_type, points, period_key)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), membership.faction_id, userId, type, points, currentIstPeriodKey()],
      );
    } catch (error) {
      this.logger.warn(`Failed to credit faction score: ${(error as Error).message}`);
    }
  }

  private levelForXp(totalXp: number): number {
    for (let i = XP_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXp >= XP_LEVEL_THRESHOLDS[i]) {
        return i;
      }
    }
    return 0;
  }

  private async calculateStreak(userId: string): Promise<number> {
    try {
      // Distinct study dates from flashcard reviews and quiz attempts.
      const rows = await this.db.queryMany<{ study_date: string }>(
        `SELECT DISTINCT DATE(last_reviewed_at) as study_date
         FROM flashcards f JOIN study_sets s ON f.study_set_id = s.id
         WHERE s.user_id = $1 AND f.last_reviewed_at IS NOT NULL
         UNION
         SELECT DISTINCT DATE(created_at) as study_date
         FROM quiz_attempts WHERE user_id = $1
         ORDER BY study_date DESC
         LIMIT 365`,
        [userId],
      );

      if (!rows || rows.length === 0) return 0;

      const studyDates = new Set(rows.map((row) => this.toDateKey(new Date(row.study_date))));

      const today = this.toDateKey(new Date());
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = this.toDateKey(yesterdayDate);

      // A live streak must include today or yesterday.
      if (!studyDates.has(today) && !studyDates.has(yesterday)) return 0;

      const anchor = studyDates.has(today) ? new Date() : yesterdayDate;

      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const cursor = new Date(anchor);
        cursor.setDate(cursor.getDate() - i);
        if (studyDates.has(this.toDateKey(cursor))) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      this.logger.warn(`Failed to calculate streak: ${error}`);
      return 0;
    }
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private mapUser(row: unknown): User {
    const r = row as Record<string, unknown>;
    let subjects: string[] = [];
    if (r.subjects) {
      if (typeof r.subjects === 'string') {
        try {
          subjects = JSON.parse(r.subjects);
        } catch {
          subjects = [];
        }
      } else if (Array.isArray(r.subjects)) {
        subjects = r.subjects as string[];
      }
    }

    return {
      id: r.id as string,
      email: (r.email as string | null) || null,
      username: (r.username as string | null) || null,
      password: r.password as string | null,
      name: r.name as string,
      avatarUrl: r.avatar_url as string | null,
      role: (r.role as string) || 'user',
      googleId: r.google_id as string | null,
      appleId: r.apple_id as string | null,
      emailVerified: r.email_verified as boolean,
      educationLevel: r.education_level as string | null,
      subjects: subjects,
      profileCompleted: (r.profile_completed as boolean) || false,
      preferences:
        typeof r.preferences === 'string'
          ? JSON.parse(r.preferences)
          : (r.preferences as Record<string, unknown>) || {},
      isActive: (r.is_active as boolean) ?? true,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
      lastLoginAt: r.last_login_at ? new Date(r.last_login_at as string) : null,
    };
  }
}

/** Current month as 'YYYY-MM' in IST (Asia/Kolkata) — faction period key. */
function currentIstPeriodKey(): string {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}`;
}
