import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { StudyEventsService } from '../events/events.service';
import { CreateTaskDto, UpdateTaskDto, CompleteTaskDto } from './dto/task.dto';

export interface StudyTask {
  id: string;
  userId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  subject: string | null;
  chapter: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  recurrence: string;
  completedAt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ListTasksOptions {
  status?: string;
  type?: string;
  parentId?: string;
  includeSubtasks?: boolean;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly events?: StudyEventsService,
  ) {}

  async create(userId: string, dto: CreateTaskDto): Promise<StudyTask> {
    // Validate parent belongs to the same user if provided
    if (dto.parentId) {
      await this.verifyOwnership(dto.parentId, userId);
    }

    const id = uuidv4();
    const result = await this.db.queryOne<StudyTask>(
      `INSERT INTO study_tasks (
        id, user_id, parent_id, title, description, task_type,
        subject, chapter, priority, due_date, estimated_minutes, recurrence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        id,
        userId,
        dto.parentId || null,
        dto.title,
        dto.description || null,
        dto.taskType || 'homework',
        dto.subject || null,
        dto.chapter || null,
        dto.priority || 'medium',
        dto.dueDate ? new Date(dto.dueDate) : null,
        dto.estimatedMinutes ?? null,
        dto.recurrence || 'none',
      ],
    );

    this.logger.log(`Task created: ${id} for user ${userId}`);
    return this.mapTask(result!);
  }

  async list(userId: string, options: ListTasksOptions = {}): Promise<StudyTask[]> {
    const conditions: string[] = ['user_id = $1'];
    const values: unknown[] = [userId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(options.status);
    }
    if (options.type) {
      conditions.push(`task_type = $${paramIndex++}`);
      values.push(options.type);
    }
    if (options.parentId === undefined) {
      // Top-level tasks only (exclude subtasks) unless explicitly requesting them
      conditions.push('parent_id IS NULL');
    } else if (options.parentId === null) {
      // explicit: all tasks including subtasks
    } else {
      conditions.push(`parent_id = $${paramIndex++}`);
      values.push(options.parentId);
    }

    const results = await this.db.queryMany<StudyTask>(
      `SELECT * FROM study_tasks
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         due_date ASC NULLS LAST,
         created_at ASC`,
      values,
    );

    return results.map((r) => this.mapTask(r));
  }

  async findByIdWithAccess(id: string, userId: string): Promise<StudyTask> {
    const task = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM study_tasks WHERE id = $1',
      [id],
    );
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return this.mapTask(task);
  }

  async update(id: string, userId: string, dto: UpdateTaskDto): Promise<StudyTask> {
    await this.verifyOwnership(id, userId);

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(dto.title);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.taskType !== undefined) {
      updates.push(`task_type = $${paramIndex++}`);
      values.push(dto.taskType);
    }
    if (dto.subject !== undefined) {
      updates.push(`subject = $${paramIndex++}`);
      values.push(dto.subject);
    }
    if (dto.chapter !== undefined) {
      updates.push(`chapter = $${paramIndex++}`);
      values.push(dto.chapter);
    }
    if (dto.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(dto.priority);
    }
    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
      updates.push(`completed_at = $${paramIndex++}`);
      values.push(dto.status === 'done' ? new Date() : null);
    }
    if (dto.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(dto.dueDate ? new Date(dto.dueDate) : null);
    }
    if (dto.estimatedMinutes !== undefined) {
      updates.push(`estimated_minutes = $${paramIndex++}`);
      values.push(dto.estimatedMinutes);
    }
    if (dto.actualMinutes !== undefined) {
      updates.push(`actual_minutes = $${paramIndex++}`);
      values.push(dto.actualMinutes);
    }
    if (dto.recurrence !== undefined) {
      updates.push(`recurrence = $${paramIndex++}`);
      values.push(dto.recurrence);
    }

    if (updates.length === 0) {
      return this.findByIdWithAccess(id, userId);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await this.db.queryOne<StudyTask>(
      `UPDATE study_tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    this.logger.log(`Task updated: ${id}`);
    return this.mapTask(result!);
  }

  async complete(id: string, userId: string, dto: CompleteTaskDto): Promise<StudyTask> {
    await this.verifyOwnership(id, userId);
    const result = await this.db.queryOne<StudyTask>(
      `UPDATE study_tasks
       SET status = 'done', completed_at = NOW(), updated_at = NOW(),
           actual_minutes = COALESCE($1, actual_minutes)
       WHERE id = $2 RETURNING *`,
      [dto.actualMinutes ?? null, id],
    );
    if (this.events) {
      await this.events
        .recordStudyActivity(userId, { type: 'task_completed' })
        .catch(() => undefined);
    }
    this.logger.log(`Task completed: ${id}`);
    return this.mapTask(result!);
  }

  async reopen(id: string, userId: string): Promise<StudyTask> {
    await this.verifyOwnership(id, userId);
    const result = await this.db.queryOne<StudyTask>(
      `UPDATE study_tasks
       SET status = 'todo', completed_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.mapTask(result!);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.verifyOwnership(id, userId);
    await this.db.query('DELETE FROM study_tasks WHERE id = $1', [id]);
    this.logger.log(`Task deleted: ${id}`);
  }

  async getTodaySummary(userId: string) {
    const result = await this.db.queryOne<{
      total: string;
      completed: string;
      due_today: string;
    }>(
      `SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'done')::text AS completed,
        COUNT(*) FILTER (WHERE due_date::date = CURRENT_DATE)::text AS due_today
       FROM study_tasks
       WHERE user_id = $1`,
      [userId],
    );
    return {
      total: parseInt(result?.total || '0', 10),
      completed: parseInt(result?.completed || '0', 10),
      dueToday: parseInt(result?.due_today || '0', 10),
    };
  }

  private async verifyOwnership(taskId: string, userId: string): Promise<void> {
    const result = await this.db.queryOne<{ user_id: string }>(
      'SELECT user_id FROM study_tasks WHERE id = $1',
      [taskId],
    );
    if (!result) {
      throw new NotFoundException('Task not found');
    }
    if (result.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private mapTask(row: unknown): StudyTask {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      parentId: (r.parent_id as string) || null,
      title: r.title as string,
      description: (r.description as string) || null,
      taskType: r.task_type as string,
      subject: (r.subject as string) || null,
      chapter: (r.chapter as string) || null,
      priority: r.priority as string,
      status: r.status as string,
      dueDate: r.due_date ? new Date(r.due_date as string).toISOString() : null,
      estimatedMinutes: r.estimated_minutes as number | null,
      actualMinutes: r.actual_minutes as number | null,
      recurrence: r.recurrence as string,
      completedAt: r.completed_at ? new Date(r.completed_at as string).toISOString() : null,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }
}
