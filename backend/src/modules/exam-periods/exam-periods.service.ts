import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import {
  CreateExamPeriodDto,
  UpdateExamPeriodDto,
  AttachExamsDto,
  RecordExamResultDto,
} from './dto/exam-period.dto';

export interface ExamPeriod {
  id: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'live' | 'ended';
  notes: string | null;
  exams: Array<{ id: string; name: string; examDate: string | null; subject: string | null }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamResult {
  id: string;
  examId: string;
  marksObtained: number;
  marksTotal: number;
  mistakeAnalysis: string | null;
  revisionPlan: string | null;
  completedAt: Date;
}

function deriveStatus(startDate: string, endDate: string): ExamPeriod['status'] {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) {
    return 'upcoming';
  }
  if (today > endDate) {
    return 'ended';
  }
  return 'live';
}

@Injectable()
export class ExamPeriodsService {
  private readonly logger = new Logger(ExamPeriodsService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, dto: CreateExamPeriodDto): Promise<ExamPeriod> {
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('startDate must not be after endDate');
    }
    const id = uuidv4();
    const result = await this.db.queryOne<ExamPeriod>(
      `INSERT INTO exam_periods (id, user_id, name, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, userId, dto.name, dto.startDate, dto.endDate, dto.notes || null],
    );
    this.logger.log(`Exam period created: ${id}`);
    return this.mapPeriod(result!);
  }

  async list(userId: string): Promise<ExamPeriod[]> {
    const rows = await this.db.queryMany<ExamPeriod>(
      `SELECT ep.*,
              COALESCE(json_agg(
                json_build_object('id', e.id, 'name', e.name, 'examDate', e.exam_date, 'subject', s.name)
                ORDER BY e.exam_date NULLS LAST
              ) FILTER (WHERE e.id IS NOT NULL), '[]') AS exams
       FROM exam_periods ep
       LEFT JOIN exams e ON e.period_id = ep.id AND e.user_id = ep.user_id
       LEFT JOIN subjects s ON s.id = e.subject_id
       WHERE ep.user_id = $1
       GROUP BY ep.id
       ORDER BY ep.start_date ASC`,
      [userId],
    );
    return rows.map((r) => this.mapPeriod(r));
  }

  async findOne(userId: string, id: string): Promise<ExamPeriod> {
    const period = (await this.list(userId)).find((p) => p.id === id);
    if (!period) {
      throw new NotFoundException('Exam period not found');
    }
    return period;
  }

  async update(userId: string, id: string, dto: UpdateExamPeriodDto): Promise<ExamPeriod> {
    await this.findOne(userId, id);
    if (dto.startDate && dto.endDate && dto.startDate > dto.endDate) {
      throw new BadRequestException('startDate must not be after endDate');
    }
    const result = await this.db.queryOne<ExamPeriod>(
      `UPDATE exam_periods SET
        name = COALESCE($1, name),
        start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        notes = COALESCE($4, notes),
        updated_at = NOW()
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [dto.name ?? null, dto.startDate ?? null, dto.endDate ?? null, dto.notes ?? null, id, userId],
    );
    return this.mapPeriod(result!);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.db.query('DELETE FROM exam_periods WHERE id = $1 AND user_id = $2', [id, userId]);
  }

  async attachExams(userId: string, periodId: string, dto: AttachExamsDto): Promise<ExamPeriod> {
    await this.findOne(userId, periodId);
    // Validate exams are owned.
    const owned = await this.db.queryMany<{ id: string }>(
      'SELECT id FROM exams WHERE user_id = $1 AND id = ANY($2::uuid[])',
      [userId, dto.examIds],
    );
    if (owned.length !== dto.examIds.length) {
      throw new NotFoundException('One or more exams not found');
    }
    await this.db.query(
      'UPDATE exams SET period_id = $1 WHERE user_id = $2 AND id = ANY($3::uuid[])',
      [periodId, userId, dto.examIds],
    );
    return this.findOne(userId, periodId);
  }

  async recordResult(
    userId: string,
    examId: string,
    dto: RecordExamResultDto,
  ): Promise<ExamResult> {
    const exam = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM exams WHERE id = $1 AND user_id = $2',
      [examId, userId],
    );
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    const id = uuidv4();
    const result = await this.db.queryOne<ExamResult>(
      `INSERT INTO exam_results (id, user_id, exam_id, marks_obtained, marks_total, mistake_analysis, revision_plan)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        id,
        userId,
        examId,
        dto.marksObtained,
        dto.marksTotal,
        dto.mistakeAnalysis || null,
        dto.revisionPlan || null,
      ],
    );
    this.logger.log(`Exam result recorded: ${id} for exam ${examId}`);
    return this.mapResult(result!);
  }

  async results(userId: string, examId?: string): Promise<ExamResult[]> {
    const rows = examId
      ? await this.db.queryMany<ExamResult>(
          `SELECT er.* FROM exam_results er
           JOIN exams e ON e.id = er.exam_id AND e.user_id = $1
           WHERE er.exam_id = $2 ORDER BY er.completed_at DESC`,
          [userId, examId],
        )
      : await this.db.queryMany<ExamResult>(
          `SELECT er.* FROM exam_results er
           JOIN exams e ON e.id = er.exam_id AND e.user_id = $1
           ORDER BY er.completed_at DESC LIMIT 100`,
          [userId],
        );
    return rows.map((r) => this.mapResult(r));
  }

  /** Nearest upcoming exam across all exams (used by the dashboard recommendation). */
  async nearestUpcomingExam(
    userId: string,
    horizonDays = 30,
  ): Promise<{
    id: string;
    name: string;
    subject: string | null;
    examDate: string;
    daysUntil: number;
  } | null> {
    const row = await this.db.queryOne<{
      id: string;
      name: string;
      subject: string | null;
      exam_date: string;
    }>(
      `SELECT e.id, e.name, s.name AS subject, e.exam_date
       FROM exams e
       LEFT JOIN subjects s ON s.id = e.subject_id
       WHERE e.user_id = $1 AND e.exam_date IS NOT NULL
         AND e.exam_date >= CURRENT_DATE
         AND e.exam_date < CURRENT_DATE + ($2 || ' days')::interval
       ORDER BY e.exam_date ASC
       LIMIT 1`,
      [userId, horizonDays],
    );
    if (!row) {
      return null;
    }
    const examDate = new Date(row.exam_date).toISOString().slice(0, 10);
    const daysUntil = Math.max(
      0,
      Math.round((new Date(examDate).getTime() - Date.now()) / 86400000),
    );
    return { id: row.id, name: row.name, subject: row.subject ?? null, examDate, daysUntil };
  }

  private mapPeriod(row: unknown): ExamPeriod {
    const r = row as Record<string, unknown>;
    const startDate = new Date(r.start_date as string).toISOString().slice(0, 10);
    const endDate = new Date(r.end_date as string).toISOString().slice(0, 10);
    return {
      id: r.id as string,
      userId: r.user_id as string,
      name: r.name as string,
      startDate,
      endDate,
      status: deriveStatus(r.start_date as string, r.end_date as string),
      notes: (r.notes ?? null) as string | null,
      exams: Array.isArray(r.exams)
        ? (r.exams as Array<{
            id: string;
            name: string;
            examDate: string | null;
            subject: string | null;
          }>)
        : [],
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }

  private mapResult(row: unknown): ExamResult {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      examId: r.exam_id as string,
      marksObtained: Number(r.marks_obtained),
      marksTotal: Number(r.marks_total),
      mistakeAnalysis: (r.mistake_analysis ?? null) as string | null,
      revisionPlan: (r.revision_plan ?? null) as string | null,
      completedAt: new Date(r.completed_at as string),
    };
  }
}
