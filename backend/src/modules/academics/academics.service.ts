import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import {
  UpdateAcademicProfileDto,
  CreateSubjectDto,
  UpdateSubjectDto,
  CreateChapterDto,
  UpdateChapterDto,
  CreateTopicDto,
  UpdateTopicDto,
  CreateExamDto,
  UpdateExamDto,
  AddPortionDto,
} from './dto/academics.dto';

interface AcademicProfileRow {
  user_id: string;
  country: string | null;
  board: string | null;
  school: string | null;
  grade: string | null;
  academic_year: string | null;
}

interface SubjectRow {
  id: string;
  user_id: string;
  name: string;
  programme: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
}

interface ChapterRow {
  id: string;
  subject_id: string;
  user_id: string;
  name: string;
  description: string | null;
  order_index: number;
}

interface TopicRow {
  id: string;
  chapter_id: string;
  user_id: string;
  name: string;
  learning_objective: string | null;
  order_index: number;
}

interface ExamRow {
  id: string;
  user_id: string;
  subject_id: string | null;
  name: string;
  exam_date: Date | null;
  notes: string | null;
}

interface PortionRow {
  id: string;
  exam_id: string;
  chapter_id: string;
  chapter_name: string;
  weight: number;
}

// Editable CBSE Grade 9 preset (master prompt §7.1). Seeded per-user so students
// can rename, extend or delete freely. These are factual curriculum headings.
const CBSE_GRADE_9_PRESET: Array<{
  name: string;
  programme: string | null;
  color: string;
  icon: string;
  chapters: Array<{ name: string; topics: Array<{ name: string; learningObjective: string }> }>;
}> = [
  {
    name: 'Mathematics',
    programme: null,
    color: 'indigo',
    icon: 'calculator',
    chapters: [
      {
        name: 'Number Systems',
        topics: [
          {
            name: 'Irrational numbers',
            learningObjective:
              'Represent real numbers on the number line and perform operations on irrationals.',
          },
        ],
      },
      {
        name: 'Polynomials',
        topics: [
          {
            name: 'Remainder and factor theorem',
            learningObjective: 'Apply the remainder theorem to factorise polynomials.',
          },
        ],
      },
      {
        name: 'Linear Equations in Two Variables',
        topics: [],
      },
      {
        name: 'Triangles',
        topics: [
          {
            name: 'Congruence criteria',
            learningObjective: 'Prove triangles congruent using SSS, SAS, ASA and RHS.',
          },
        ],
      },
    ],
  },
  {
    name: 'Science',
    programme: null,
    color: 'emerald',
    icon: 'flask',
    chapters: [
      {
        name: 'Matter in Our Surroundings',
        topics: [
          {
            name: 'States of matter',
            learningObjective: 'Explain the three states of matter using the kinetic theory.',
          },
        ],
      },
      {
        name: 'Atoms and Molecules',
        topics: [
          {
            name: 'Chemical formulae',
            learningObjective: 'Write and balance simple chemical formulae.',
          },
        ],
      },
      {
        name: 'Motion',
        topics: [
          {
            name: 'Uniform and non-uniform motion',
            learningObjective: 'Solve problems using v = u + at and related equations.',
          },
        ],
      },
      {
        name: 'Force and Laws of Motion',
        topics: [],
      },
    ],
  },
  {
    name: 'Social Science',
    programme: null,
    color: 'amber',
    icon: 'globe',
    chapters: [
      {
        name: 'The French Revolution',
        topics: [
          {
            name: 'Causes and outcomes',
            learningObjective: 'Sequence the key events and outcomes of the French Revolution.',
          },
        ],
      },
      {
        name: 'Physical Features of India',
        topics: [],
      },
      {
        name: 'What is Democracy? Why Democracy?',
        topics: [
          {
            name: 'Features of democracy',
            learningObjective: 'Identify the features and merits of a democratic government.',
          },
        ],
      },
      {
        name: 'The Story of Village Palampur',
        topics: [],
      },
    ],
  },
  {
    name: 'English',
    programme: null,
    color: 'sky',
    icon: 'book',
    chapters: [
      {
        name: 'Beehive',
        topics: [
          {
            name: 'The Fun They Had',
            learningObjective: 'Analyse themes of technology and education in the story.',
          },
        ],
      },
      {
        name: 'Moments',
        topics: [],
      },
    ],
  },
  {
    name: 'Hindi',
    programme: null,
    color: 'rose',
    icon: 'languages',
    chapters: [
      {
        name: 'क्षितिज',
        topics: [],
      },
      {
        name: 'कृतिका',
        topics: [],
      },
    ],
  },
  {
    name: 'Information Technology',
    programme: null,
    color: 'violet',
    icon: 'monitor',
    chapters: [
      {
        name: 'Digital Documentation',
        topics: [
          {
            name: 'Word processing basics',
            learningObjective: 'Create and format a document using word processing software.',
          },
        ],
      },
      {
        name: 'Electronic Spreadsheet',
        topics: [],
      },
    ],
  },
];

@Injectable()
export class AcademicsService {
  private readonly logger = new Logger(AcademicsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ---------- Academic profile ----------

  async getProfile(userId: string) {
    const row = await this.db.queryOne<AcademicProfileRow>(
      'SELECT * FROM academic_profiles WHERE user_id = $1',
      [userId],
    );
    return row ? this.mapProfile(row) : null;
  }

  async updateProfile(userId: string, dto: UpdateAcademicProfileDto) {
    const existing = await this.db.queryOne<{ user_id: string }>(
      'SELECT user_id FROM academic_profiles WHERE user_id = $1',
      [userId],
    );
    if (existing) {
      await this.db.query(
        `UPDATE academic_profiles
         SET country = COALESCE($2, country),
             board = COALESCE($3, board),
             school = COALESCE($4, school),
             grade = COALESCE($5, grade),
             academic_year = COALESCE($6, academic_year),
             updated_at = NOW()
         WHERE user_id = $1`,
        [
          userId,
          dto.country ?? null,
          dto.board ?? null,
          dto.school ?? null,
          dto.grade ?? null,
          dto.academicYear ?? null,
        ],
      );
    } else {
      await this.db.query(
        `INSERT INTO academic_profiles (user_id, country, board, school, grade, academic_year)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          dto.country ?? null,
          dto.board ?? null,
          dto.school ?? null,
          dto.grade ?? null,
          dto.academicYear ?? null,
        ],
      );
    }
    this.logger.log(`Academic profile updated for user ${userId}`);
    return this.getProfile(userId);
  }

  // ---------- Full structure ----------

  async getStructure(userId: string) {
    await this.ensurePreset(userId);

    const [profile, subjects, chapters, topics, exams, portions] = await Promise.all([
      this.getProfile(userId),
      this.db.queryMany<SubjectRow>(
        'SELECT * FROM subjects WHERE user_id = $1 ORDER BY sort_order ASC, name ASC',
        [userId],
      ),
      this.db.queryMany<ChapterRow>(
        'SELECT * FROM chapters WHERE user_id = $1 ORDER BY order_index ASC, name ASC',
        [userId],
      ),
      this.db.queryMany<TopicRow>(
        'SELECT * FROM topics WHERE user_id = $1 ORDER BY order_index ASC, name ASC',
        [userId],
      ),
      this.db.queryMany<ExamRow>(
        'SELECT * FROM exams WHERE user_id = $1 ORDER BY exam_date ASC NULLS LAST, name ASC',
        [userId],
      ),
      this.db.queryMany<PortionRow>(
        `SELECT ep.id, ep.exam_id, ep.chapter_id, ep.weight, c.name AS chapter_name
         FROM exam_portions ep
         JOIN chapters c ON c.id = ep.chapter_id
         WHERE ep.user_id = $1
         ORDER BY ep.created_at ASC`,
        [userId],
      ),
    ]);

    return {
      profile,
      subjects: subjects.map((s) => ({
        ...this.mapSubject(s),
        chapters: chapters
          .filter((c) => c.subject_id === s.id)
          .map((c) => ({
            ...this.mapChapter(c),
            topics: topics.filter((t) => t.chapter_id === c.id).map((t) => this.mapTopic(t)),
          })),
      })),
      exams: exams.map((e) => ({
        ...this.mapExam(e),
        portions: portions
          .filter((p) => p.exam_id === e.id)
          .map((p) => ({
            id: p.id,
            chapterId: p.chapter_id,
            chapterName: p.chapter_name,
            weight: p.weight,
          })),
      })),
    };
  }

  // ---------- Subjects ----------

  async createSubject(userId: string, dto: CreateSubjectDto) {
    const id = uuidv4();
    try {
      const result = await this.db.queryOne<SubjectRow>(
        `INSERT INTO subjects (id, user_id, name, programme, color, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          id,
          userId,
          dto.name,
          dto.programme ?? null,
          dto.color ?? null,
          dto.icon ?? null,
          dto.sortOrder ?? 0,
        ],
      );
      return this.mapSubject(result!);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A subject with this name already exists');
      }
      throw error;
    }
  }

  async updateSubject(userId: string, id: string, dto: UpdateSubjectDto) {
    await this.assertOwned('subjects', id, userId);
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.programme !== undefined) {
      updates.push(`programme = $${paramIndex++}`);
      values.push(dto.programme);
    }
    if (dto.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(dto.color);
    }
    if (dto.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(dto.icon);
    }
    if (dto.sortOrder !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(dto.sortOrder);
    }
    if (updates.length === 0) {
      return this.getSubject(id, userId);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    try {
      const result = await this.db.queryOne<SubjectRow>(
        `UPDATE subjects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values,
      );
      return this.mapSubject(result!);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A subject with this name already exists');
      }
      throw error;
    }
  }

  async deleteSubject(userId: string, id: string): Promise<void> {
    await this.assertOwned('subjects', id, userId);
    await this.db.query('DELETE FROM subjects WHERE id = $1', [id]);
    this.logger.log(`Subject deleted: ${id}`);
  }

  private async getSubject(id: string, userId: string) {
    const row = await this.db.queryOne<SubjectRow>(
      'SELECT * FROM subjects WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (!row) {
      throw new NotFoundException('Subject not found');
    }
    return this.mapSubject(row);
  }

  // ---------- Chapters ----------

  async createChapter(userId: string, subjectId: string, dto: CreateChapterDto) {
    await this.assertOwned('subjects', subjectId, userId);
    const id = uuidv4();
    const result = await this.db.queryOne<ChapterRow>(
      `INSERT INTO chapters (id, subject_id, user_id, name, description, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, subjectId, userId, dto.name, dto.description ?? null, dto.orderIndex ?? 0],
    );
    return this.mapChapter(result!);
  }

  async updateChapter(userId: string, id: string, dto: UpdateChapterDto) {
    await this.assertOwned('chapters', id, userId);
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.orderIndex !== undefined) {
      updates.push(`order_index = $${paramIndex++}`);
      values.push(dto.orderIndex);
    }
    if (updates.length === 0) {
      return this.getChapter(id, userId);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await this.db.queryOne<ChapterRow>(
      `UPDATE chapters SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return this.mapChapter(result!);
  }

  async deleteChapter(userId: string, id: string): Promise<void> {
    await this.assertOwned('chapters', id, userId);
    await this.db.query('DELETE FROM chapters WHERE id = $1', [id]);
    this.logger.log(`Chapter deleted: ${id}`);
  }

  private async getChapter(id: string, userId: string) {
    const row = await this.db.queryOne<ChapterRow>(
      'SELECT * FROM chapters WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (!row) {
      throw new NotFoundException('Chapter not found');
    }
    return this.mapChapter(row);
  }

  // ---------- Topics ----------

  async createTopic(userId: string, chapterId: string, dto: CreateTopicDto) {
    await this.assertOwned('chapters', chapterId, userId);
    const id = uuidv4();
    const result = await this.db.queryOne<TopicRow>(
      `INSERT INTO topics (id, chapter_id, user_id, name, learning_objective, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, chapterId, userId, dto.name, dto.learningObjective ?? null, dto.orderIndex ?? 0],
    );
    return this.mapTopic(result!);
  }

  async updateTopic(userId: string, id: string, dto: UpdateTopicDto) {
    await this.assertOwned('topics', id, userId);
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.learningObjective !== undefined) {
      updates.push(`learning_objective = $${paramIndex++}`);
      values.push(dto.learningObjective);
    }
    if (dto.orderIndex !== undefined) {
      updates.push(`order_index = $${paramIndex++}`);
      values.push(dto.orderIndex);
    }
    if (updates.length === 0) {
      return this.getTopic(id, userId);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await this.db.queryOne<TopicRow>(
      `UPDATE topics SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return this.mapTopic(result!);
  }

  async deleteTopic(userId: string, id: string): Promise<void> {
    await this.assertOwned('topics', id, userId);
    await this.db.query('DELETE FROM topics WHERE id = $1', [id]);
    this.logger.log(`Topic deleted: ${id}`);
  }

  private async getTopic(id: string, userId: string) {
    const row = await this.db.queryOne<TopicRow>(
      'SELECT * FROM topics WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (!row) {
      throw new NotFoundException('Topic not found');
    }
    return this.mapTopic(row);
  }

  // ---------- Exams ----------

  async listExams(userId: string) {
    const [exams, portions] = await Promise.all([
      this.db.queryMany<ExamRow>(
        'SELECT * FROM exams WHERE user_id = $1 ORDER BY exam_date ASC NULLS LAST, name ASC',
        [userId],
      ),
      this.db.queryMany<PortionRow>(
        `SELECT ep.id, ep.exam_id, ep.chapter_id, ep.weight, c.name AS chapter_name
         FROM exam_portions ep
         JOIN chapters c ON c.id = ep.chapter_id
         WHERE ep.user_id = $1
         ORDER BY ep.created_at ASC`,
        [userId],
      ),
    ]);
    return exams.map((e) => ({
      ...this.mapExam(e),
      portions: portions
        .filter((p) => p.exam_id === e.id)
        .map((p) => ({
          id: p.id,
          chapterId: p.chapter_id,
          chapterName: p.chapter_name,
          weight: p.weight,
        })),
    }));
  }

  async createExam(userId: string, dto: CreateExamDto) {
    if (dto.subjectId) {
      await this.assertOwned('subjects', dto.subjectId, userId);
    }
    const id = uuidv4();
    const result = await this.db.queryOne<ExamRow>(
      `INSERT INTO exams (id, user_id, subject_id, name, exam_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        userId,
        dto.subjectId ?? null,
        dto.name,
        dto.examDate ? new Date(dto.examDate) : null,
        dto.notes ?? null,
      ],
    );
    return this.mapExam(result!);
  }

  async updateExam(userId: string, id: string, dto: UpdateExamDto) {
    await this.assertOwned('exams', id, userId);
    if (dto.subjectId) {
      await this.assertOwned('subjects', dto.subjectId, userId);
    }
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.subjectId !== undefined) {
      updates.push(`subject_id = $${paramIndex++}`);
      values.push(dto.subjectId);
    }
    if (dto.examDate !== undefined) {
      updates.push(`exam_date = $${paramIndex++}`);
      values.push(dto.examDate ? new Date(dto.examDate) : null);
    }
    if (dto.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(dto.notes);
    }
    if (updates.length === 0) {
      return this.getExam(id, userId);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await this.db.queryOne<ExamRow>(
      `UPDATE exams SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return this.mapExam(result!);
  }

  async deleteExam(userId: string, id: string): Promise<void> {
    await this.assertOwned('exams', id, userId);
    await this.db.query('DELETE FROM exams WHERE id = $1', [id]);
    this.logger.log(`Exam deleted: ${id}`);
  }

  private async getExam(id: string, userId: string) {
    const row = await this.db.queryOne<ExamRow>(
      'SELECT * FROM exams WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (!row) {
      throw new NotFoundException('Exam not found');
    }
    return this.mapExam(row);
  }

  // ---------- Exam portions ----------

  async addPortion(userId: string, examId: string, dto: AddPortionDto) {
    await this.assertOwned('exams', examId, userId);
    await this.assertOwned('chapters', dto.chapterId, userId);
    const id = uuidv4();
    try {
      const result = await this.db.queryOne<PortionRow>(
        `INSERT INTO exam_portions (id, exam_id, user_id, chapter_id, weight)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, exam_id, chapter_id, weight,
           (SELECT name FROM chapters WHERE id = $4) AS chapter_name`,
        [id, examId, userId, dto.chapterId, dto.weight ?? 1],
      );
      return {
        id: result!.id,
        examId: result!.exam_id,
        chapterId: result!.chapter_id,
        chapterName: result!.chapter_name,
        weight: result!.weight,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('This chapter is already part of the exam portion');
      }
      throw error;
    }
  }

  async removePortion(userId: string, examId: string, portionId: string): Promise<void> {
    await this.assertOwned('exams', examId, userId);
    const result = await this.db.queryOne<{ id: string; exam_id: string }>(
      'SELECT id, exam_id FROM exam_portions WHERE id = $1',
      [portionId],
    );
    if (!result || result.exam_id !== examId) {
      throw new NotFoundException('Exam portion not found');
    }
    await this.db.query('DELETE FROM exam_portions WHERE id = $1', [portionId]);
    this.logger.log(`Exam portion removed: ${portionId}`);
  }

  // ---------- Preset seeding ----------

  private async ensurePreset(userId: string): Promise<void> {
    const existing = await this.db.queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM subjects WHERE user_id = $1',
      [userId],
    );
    if (existing && parseInt(existing.count, 10) > 0) {
      return;
    }

    await this.db.transaction(async (client) => {
      for (const [subjectIndex, subject] of CBSE_GRADE_9_PRESET.entries()) {
        const subjectId = uuidv4();
        await client.query(
          `INSERT INTO subjects (id, user_id, name, programme, color, icon, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            subjectId,
            userId,
            subject.name,
            subject.programme,
            subject.color,
            subject.icon,
            subjectIndex,
          ],
        );
        for (const [chapterIndex, chapter] of subject.chapters.entries()) {
          const chapterId = uuidv4();
          await client.query(
            `INSERT INTO chapters (id, subject_id, user_id, name, order_index)
             VALUES ($1, $2, $3, $4, $5)`,
            [chapterId, subjectId, userId, chapter.name, chapterIndex],
          );
          for (const [topicIndex, topic] of chapter.topics.entries()) {
            await client.query(
              `INSERT INTO topics (id, chapter_id, user_id, name, learning_objective, order_index)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [uuidv4(), chapterId, userId, topic.name, topic.learningObjective, topicIndex],
            );
          }
        }
      }
      this.logger.log(`Seeded CBSE Grade 9 preset for user ${userId}`);
    });
  }

  // ---------- Helpers ----------

  private async assertOwned(table: string, id: string, userId: string): Promise<void> {
    const result = await this.db.queryOne<{ user_id: string }>(
      `SELECT user_id FROM ${table} WHERE id = $1`,
      [id],
    );
    if (!result) {
      throw new NotFoundException(`${table.slice(0, -1)} not found`);
    }
    if (result.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    const err = error as { code?: string };
    return err?.code === '23505';
  }

  private mapProfile(row: AcademicProfileRow) {
    return {
      userId: row.user_id,
      country: row.country,
      board: row.board,
      school: row.school,
      grade: row.grade,
      academicYear: row.academic_year,
    };
  }

  private mapSubject(row: SubjectRow) {
    return {
      id: row.id,
      name: row.name,
      programme: row.programme,
      color: row.color,
      icon: row.icon,
      sortOrder: row.sort_order,
    };
  }

  private mapChapter(row: ChapterRow) {
    return {
      id: row.id,
      subjectId: row.subject_id,
      name: row.name,
      description: row.description,
      orderIndex: row.order_index,
    };
  }

  private mapTopic(row: TopicRow) {
    return {
      id: row.id,
      chapterId: row.chapter_id,
      name: row.name,
      learningObjective: row.learning_objective,
      orderIndex: row.order_index,
    };
  }

  private mapExam(row: ExamRow) {
    return {
      id: row.id,
      subjectId: row.subject_id,
      name: row.name,
      examDate: row.exam_date ? new Date(row.exam_date).toISOString() : null,
      notes: row.notes,
    };
  }
}
