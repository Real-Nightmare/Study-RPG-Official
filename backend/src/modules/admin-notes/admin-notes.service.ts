import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import pdf = require('pdf-parse');
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../admin/audit.service';
import { normalizeSelectedPages } from './page-selection';

export interface AdminNote {
  id: string;
  title: string;
  subject: string | null;
  content: string;
  pageCount: number;
  selectedPages: number[];
  uploadedByName: string | null;
  isUniversal: boolean;
  createdAt: Date;
}

export interface Syllabus {
  id: string;
  board: string;
  grade: string;
  subject: string;
  chapters: Array<{ name: string; topics?: string[] }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminNoteDto {
  title: string;
  subject?: string;
  selectedPages?: number[];
}

@Injectable()
export class AdminNotesService {
  private readonly logger = new Logger(AdminNotesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Upload a universal admin note. For PDFs, text is extracted per page and
   * `selectedPages` filters which pages the AI may cite (1-based) — this
   * prevents the "NCERT email on page 3" style failures.
   */
  async create(
    actorId: string,
    dto: CreateAdminNoteDto,
    file?: Express.Multer.File,
  ): Promise<AdminNote> {
    const reason = 'Uploaded a universal admin note';
    const title = (dto.title || '').trim();
    if (!title) {
      throw new BadRequestException('Title is required');
    }

    let content = '';
    let pageCount = 0;
    let selectedPages: number[] = [];

    if (file) {
      if (file.mimetype === 'application/pdf') {
        const parsed = await pdf(file.buffer);
        content = parsed.text || '';
        pageCount = parsed.numpages || 0;
      } else if (file.mimetype.startsWith('text/') || file.mimetype === 'text/markdown') {
        content = file.buffer.toString('utf8');
      } else {
        throw new BadRequestException('Only PDF or text files are supported for admin notes');
      }
    }

    // Normalize selected pages (supports singles + ranges) via the pure module.
    selectedPages = normalizeSelectedPages(dto.selectedPages, pageCount);

    if (!content && !file) {
      throw new BadRequestException('Provide a file or content for the admin note');
    }

    const id = uuidv4();
    const result = await this.db.queryOne<AdminNote>(
      `INSERT INTO admin_notes (id, title, subject, content, page_count, selected_pages, uploaded_by, is_universal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING *`,
      [id, title, dto.subject || null, content, pageCount, JSON.stringify(selectedPages), actorId],
    );

    await this.audit.log({
      actorId,
      action: 'admin_notes.create',
      targetType: 'admin_note',
      targetId: id,
      reason,
      details: { title, subject: dto.subject || null, pageCount, selectedPages },
    });

    return this.mapNote(result!);
  }

  async list(options: { subject?: string; limit?: number; offset?: number }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    if (options.subject) {
      conditions.push(`subject ILIKE $${paramIndex++}`);
      values.push(`%${options.subject}%`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [rows, countResult] = await Promise.all([
      this.db.queryMany<AdminNote>(
        `SELECT n.*, u.name AS uploaded_by_name
         FROM admin_notes n
         LEFT JOIN users u ON u.id = n.uploaded_by
         ${where}
         ORDER BY n.created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, offset],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM admin_notes n ${where}`,
        values,
      ),
    ]);

    return {
      data: rows.map((r) => this.mapNote(r)),
      total: parseInt(countResult?.count || '0', 10),
    };
  }

  async get(id: string): Promise<AdminNote> {
    const row = await this.db.queryOne<AdminNote>(
      `SELECT n.*, u.name AS uploaded_by_name FROM admin_notes n
       LEFT JOIN users u ON u.id = n.uploaded_by
       WHERE n.id = $1`,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Admin note not found');
    }
    return this.mapNote(row);
  }

  async remove(actorId: string, id: string, reason: string): Promise<void> {
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const note = await this.get(id);
    await this.db.query('DELETE FROM admin_notes WHERE id = $1', [id]);
    await this.audit.log({
      actorId,
      action: 'admin_notes.delete',
      targetType: 'admin_note',
      targetId: id,
      reason: cleanReason,
      details: { title: note.title },
    });
  }

  /**
   * Universal search over admin notes for the AI chat context. Only pages in
   * `selected_pages` are searchable, so the AI never cites excluded pages.
   */
  async searchUniversal(query: string, limit = 5): Promise<AdminNote[]> {
    const rows = await this.db.queryMany<AdminNote>(
      `SELECT n.*, u.name AS uploaded_by_name
       FROM admin_notes n
       LEFT JOIN users u ON u.id = n.uploaded_by
       WHERE n.is_universal = TRUE
         AND (n.title ILIKE $1 OR n.subject ILIKE $1 OR n.content ILIKE $1)
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [`%${query}%`, limit],
    );
    return rows.map((r) => this.mapNote(r));
  }

  // ---------------- Syllabus (admin-only write, student read) ----------------

  async createSyllabus(
    actorId: string,
    dto: {
      board: string;
      grade: string;
      subject: string;
      chapters: Array<{ name: string; topics?: string[] }>;
    },
    reason: string,
  ): Promise<Syllabus> {
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const id = uuidv4();
    const result = await this.db.queryOne<Syllabus>(
      `INSERT INTO syllabus (id, board, grade, subject, chapters, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (board, grade, subject) DO UPDATE
       SET chapters = EXCLUDED.chapters, updated_at = NOW()
       RETURNING *`,
      [id, dto.board, dto.grade, dto.subject, JSON.stringify(dto.chapters || []), actorId],
    );

    await this.audit.log({
      actorId,
      action: 'syllabus.upsert',
      targetType: 'syllabus',
      targetId: id,
      reason: cleanReason,
      details: { board: dto.board, grade: dto.grade, subject: dto.subject },
    });

    return this.mapSyllabus(result!);
  }

  async listSyllabus(options: { board?: string; grade?: string; subject?: string }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    if (options.board) {
      conditions.push(`board = $${paramIndex++}`);
      values.push(options.board);
    }
    if (options.grade) {
      conditions.push(`grade = $${paramIndex++}`);
      values.push(options.grade);
    }
    if (options.subject) {
      conditions.push(`subject ILIKE $${paramIndex++}`);
      values.push(`%${options.subject}%`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.queryMany<Syllabus>(
      `SELECT * FROM syllabus ${where} ORDER BY board, grade, subject`,
      values,
    );
    return rows.map((r) => this.mapSyllabus(r));
  }

  async removeSyllabus(actorId: string, id: string, reason: string): Promise<void> {
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    await this.db.query('DELETE FROM syllabus WHERE id = $1', [id]);
    await this.audit.log({
      actorId,
      action: 'syllabus.delete',
      targetType: 'syllabus',
      targetId: id,
      reason: cleanReason,
    });
  }

  private mapNote(row: unknown): AdminNote {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      title: r.title as string,
      subject: (r.subject as string | null) || null,
      content: (r.content as string) || '',
      pageCount: Number(r.page_count ?? 0),
      selectedPages: parseNumberArray(r.selected_pages),
      uploadedByName: (r.uploaded_by_name as string | null) || null,
      isUniversal: (r.is_universal as boolean) ?? true,
      createdAt: new Date(r.created_at as string),
    };
  }

  private mapSyllabus(row: unknown): Syllabus {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      board: r.board as string,
      grade: r.grade as string,
      subject: r.subject as string,
      chapters: parseJsonArray(r.chapters),
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }
}

function parseNumberArray(value: unknown): number[] {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as number[]) : [];
}

function parseJsonArray(value: unknown): Array<{ name: string; topics?: string[] }> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as Array<{ name: string; topics?: string[] }>) : [];
}
