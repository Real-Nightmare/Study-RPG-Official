import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { CreateMistakeDto, UpdateMistakeDto, ResolveMistakeDto } from './dto/mistake.dto';

export interface Mistake {
  id: string;
  userId: string;
  subject: string | null;
  chapter: string | null;
  questionText: string;
  correctAnswer: string | null;
  wrongAnswer: string | null;
  category: string | null;
  cause: string | null;
  correctionNote: string | null;
  status: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

@Injectable()
export class MistakesService {
  private readonly logger = new Logger(MistakesService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, dto: CreateMistakeDto): Promise<Mistake> {
    const id = uuidv4();
    const result = await this.db.queryOne<Mistake>(
      `INSERT INTO mistakes (
        id, user_id, subject, chapter, question_text, correct_answer, wrong_answer,
        category, cause, correction_note, status, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', $11)
      RETURNING *`,
      [
        id,
        userId,
        dto.subject || null,
        dto.chapter || null,
        dto.questionText,
        dto.correctAnswer || null,
        dto.wrongAnswer || null,
        dto.category || null,
        dto.cause || null,
        dto.correctionNote || null,
        dto.source || 'manual',
      ],
    );
    this.logger.log(`Mistake recorded: ${id}`);
    return this.mapMistake(result!);
  }

  async list(
    userId: string,
    options: { status?: string; subject?: string; category?: string } = {},
  ): Promise<{ items: Mistake[]; counts: Record<string, number> }> {
    const conditions: string[] = ['user_id = $1'];
    const values: unknown[] = [userId];
    let paramIndex = 2;
    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(options.status);
    }
    if (options.subject) {
      conditions.push(`subject = $${paramIndex++}`);
      values.push(options.subject);
    }
    if (options.category) {
      conditions.push(`category = $${paramIndex++}`);
      values.push(options.category);
    }

    const items = await this.db.queryMany<Mistake>(
      `SELECT * FROM mistakes WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT 200`,
      values,
    );

    const counts = await this.db.queryOne<{ open: string; resolved: string; reopened: string }>(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'reopened')::int AS reopened
       FROM mistakes WHERE user_id = $1`,
      [userId],
    );

    return {
      items: items.map((r) => this.mapMistake(r)),
      counts: {
        open: Number(counts?.open ?? 0),
        resolved: Number(counts?.resolved ?? 0),
        reopened: Number(counts?.reopened ?? 0),
      },
    };
  }

  async resolve(userId: string, id: string, dto: ResolveMistakeDto): Promise<Mistake> {
    const mistake = await this.findOwned(userId, id);
    const note = dto.correctionNote ?? mistake.correctionNote;
    const result = await this.db.queryOne<Mistake>(
      `UPDATE mistakes
       SET status = 'resolved', correction_note = $1, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [note, id, userId],
    );
    this.logger.log(`Mistake resolved: ${id}`);
    return this.mapMistake(result!);
  }

  async reopen(userId: string, id: string): Promise<Mistake> {
    await this.findOwned(userId, id);
    const result = await this.db.queryOne<Mistake>(
      `UPDATE mistakes SET status = 'reopened', resolved_at = NULL, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId],
    );
    this.logger.log(`Mistake reopened: ${id}`);
    return this.mapMistake(result!);
  }

  async update(userId: string, id: string, dto: UpdateMistakeDto): Promise<Mistake> {
    await this.findOwned(userId, id);
    const result = await this.db.queryOne<Mistake>(
      `UPDATE mistakes SET
        subject = COALESCE($1, subject),
        chapter = COALESCE($2, chapter),
        correct_answer = COALESCE($3, correct_answer),
        category = COALESCE($4, category),
        cause = COALESCE($5, cause),
        correction_note = COALESCE($6, correction_note),
        updated_at = NOW()
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [
        dto.subject ?? null,
        dto.chapter ?? null,
        dto.correctAnswer ?? null,
        dto.category ?? null,
        dto.cause ?? null,
        dto.correctionNote ?? null,
        id,
        userId,
      ],
    );
    return this.mapMistake(result!);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.db.query('DELETE FROM mistakes WHERE id = $1 AND user_id = $2', [id, userId]);
  }

  private async findOwned(userId: string, id: string): Promise<Mistake> {
    const row = await this.db.queryOne<Mistake>(
      'SELECT * FROM mistakes WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (!row) {
      throw new NotFoundException('Mistake not found');
    }
    return this.mapMistake(row);
  }

  private mapMistake(row: unknown): Mistake {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      subject: (r.subject ?? null) as string | null,
      chapter: (r.chapter ?? null) as string | null,
      questionText: r.question_text as string,
      correctAnswer: (r.correct_answer ?? null) as string | null,
      wrongAnswer: (r.wrong_answer ?? null) as string | null,
      category: (r.category ?? null) as string | null,
      cause: (r.cause ?? null) as string | null,
      correctionNote: (r.correction_note ?? null) as string | null,
      status: r.status as string,
      source: r.source as string,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
      resolvedAt: r.resolved_at ? new Date(r.resolved_at as string) : null,
    };
  }
}
