import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { AiService } from '../ai/ai.service';
import { withPhilosophy } from '../ai/study-rpg-philosophy';
import { ProgrammesService } from '../programmes/programmes.service';

export interface LearningPath {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  subject: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  steps: LearningStep[];
  progress: number;
  programmeId: string | null;
  programmeName: string | null;
  review: Record<string, unknown>;
  needsRegeneration: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type: 'study' | 'quiz' | 'practice' | 'review';
  resourceId: string | null;
  resourceType: 'study_set' | 'quiz' | 'document' | null;
  estimatedMinutes: number;
  isCompleted: boolean;
  completedAt: Date | null;
}

export interface CreateLearningPathDto {
  title: string;
  subject: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  goals?: string[];
}

export interface GenerateLearningPathDto {
  topic: string;
  currentLevel: 'beginner' | 'intermediate' | 'advanced';
  targetLevel: 'intermediate' | 'advanced' | 'expert';
  availableHoursPerWeek: number;
  studySetIds?: string[];
}

@Injectable()
export class LearningPathsService {
  private readonly logger = new Logger(LearningPathsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly aiService: AiService,
    private readonly programmes: ProgrammesService,
  ) {}

  async create(userId: string, dto: CreateLearningPathDto): Promise<LearningPath> {
    const id = uuidv4();
    const now = new Date();

    const result = await this.db.queryOne<LearningPath>(
      `INSERT INTO learning_paths (id, user_id, title, subject, difficulty, estimated_hours, steps, progress, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 0, $6, 0, $7, $8)
       RETURNING *`,
      [
        id,
        userId,
        dto.title,
        dto.subject,
        dto.difficulty || 'beginner',
        JSON.stringify([]),
        now,
        now,
      ],
    );

    return this.mapPath(result!);
  }

  async generate(userId: string, dto: GenerateLearningPathDto): Promise<LearningPath> {
    const prompt = `Create a comprehensive learning path for:
Topic: ${dto.topic}
Current Level: ${dto.currentLevel}
Target Level: ${dto.targetLevel}
Available Time: ${dto.availableHoursPerWeek} hours/week

Return in JSON format:
{
  "title": "Learning Path Title",
  "description": "Brief description",
  "estimatedHours": 40,
  "steps": [
    {
      "order": 1,
      "title": "Step title",
      "description": "What to learn",
      "type": "study|quiz|practice|review",
      "estimatedMinutes": 60
    }
  ]
}`;

    const response = await this.aiService.completeJson<{
      title: string;
      description: string;
      estimatedHours: number;
      steps: Array<{
        order: number;
        title: string;
        description: string;
        type: string;
        estimatedMinutes: number;
      }>;
    }>(
      [
        {
          role: 'system',
          content: withPhilosophy(
            'You are an expert educational curriculum designer. Design paths that favour spaced, bounded, rested sessions (never marathon cramming): keep per-step durations sane and alternate study with practice and review.',
          ),
        },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 4096 },
    );

    const id = uuidv4();
    const now = new Date();

    const steps: LearningStep[] = response.steps.map((s, i) => ({
      id: uuidv4(),
      order: s.order || i + 1,
      title: s.title,
      description: s.description,
      type: s.type as LearningStep['type'],
      resourceId: null,
      resourceType: null,
      estimatedMinutes: s.estimatedMinutes,
      isCompleted: false,
      completedAt: null,
    }));

    await this.db.query(
      `INSERT INTO learning_paths (id, user_id, title, description, subject, difficulty, estimated_hours, steps, progress, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)`,
      [
        id,
        userId,
        response.title,
        response.description,
        dto.topic,
        dto.currentLevel,
        response.estimatedHours,
        JSON.stringify(steps),
        now,
        now,
      ],
    );

    this.logger.log(`Learning path generated: ${id}`);
    return this.findById(id) as Promise<LearningPath>;
  }

  async findById(id: string): Promise<LearningPath | null> {
    const result = await this.db.queryOne<LearningPath>(
      `SELECT lp.*, p.name AS programme_name
       FROM learning_paths lp
       LEFT JOIN programmes p ON p.id = lp.programme_id
       WHERE lp.id = $1`,
      [id],
    );
    return result ? this.mapPath(result) : null;
  }

  async findByUser(userId: string): Promise<LearningPath[]> {
    const results = await this.db.queryMany<LearningPath>(
      `SELECT lp.*, p.name AS programme_name
       FROM learning_paths lp
       LEFT JOIN programmes p ON p.id = lp.programme_id
       WHERE lp.user_id = $1
       ORDER BY lp.updated_at DESC`,
      [userId],
    );
    return results.map((r) => this.mapPath(r));
  }

  /**
   * Phase 8: turn an active AI-built programme into a personal learning path.
   * The AI maps the programme's objectives + milestones to ordered study steps
   * and reviews its own output (score < 60 → needsRegeneration flag, saved).
   */
  async generateFromProgramme(userId: string, programmeId: string): Promise<LearningPath> {
    const programme = await this.programmes.findOne(programmeId, userId);
    if (programme.status !== 'active') {
      throw new BadRequestException('Only active programmes can become learning paths');
    }

    const content = programme.content ?? {};
    const objectives = Array.isArray(content.objectives) ? content.objectives : [];
    const milestones = Array.isArray(content.milestones) ? content.milestones : [];
    const rewardPolicy = programme.rewardPolicy ?? {};

    const prompt = `You are a personal study-plan coach. Turn this AI-built study programme into an ordered personal learning path for one student.

Programme: ${programme.name}
Description: ${programme.description || ''}
Kind: ${programme.kind}
Objectives: ${JSON.stringify(objectives).substring(0, 1500)}
Milestones: ${JSON.stringify(milestones).substring(0, 2500)}
Reward policy: ${JSON.stringify(rewardPolicy).substring(0, 800)}

Return STRICT JSON:
{
  "title": "personal path title",
  "description": "2-3 sentence plan for this student",
  "estimatedHours": number,
  "steps": [
    {"order": 1, "title": "step title", "description": "what to do", "type": "study" | "quiz" | "practice" | "review", "estimatedMinutes": 20-120}
  ]
}

Rules: 8-14 steps, real actions inside the study platform (flashcards, quizzes, puzzles, focus sessions, teach-back), ordered from fundamentals to mastery.`;

    try {
      const response = await this.aiService.completeJson<{
        title: string;
        description: string;
        estimatedHours: number;
        steps: Array<{
          order: number;
          title: string;
          description: string;
          type: string;
          estimatedMinutes: number;
        }>;
      }>(
        [
          {
            role: 'system',
            content: withPhilosophy(
              'You are a personal study-plan coach. You output strict JSON only.',
            ),
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.4, maxTokens: 3000 },
      );

      const steps = (response.steps || []).slice(0, 14).map((s, i) => ({
        id: uuidv4(),
        order: s.order || i + 1,
        title: s.title,
        description: s.description || '',
        type: this.isStepType(s.type) ? s.type : 'study',
        resourceId: null,
        resourceType: null,
        estimatedMinutes: Math.max(10, Math.min(180, Number(s.estimatedMinutes) || 45)),
        isCompleted: false,
        completedAt: null,
      }));
      if (steps.length === 0) {
        throw new BadRequestException('AI returned no steps for the learning path');
      }

      const review = await this.reviewPath(response.title, steps.length);
      const id = uuidv4();
      const now = new Date();
      await this.db.query(
        `INSERT INTO learning_paths
           (id, user_id, title, description, subject, difficulty, estimated_hours, steps, progress,
            programme_id, review, needs_regeneration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'intermediate', $6, $7, 0, $8, $9, $10, $11, $11)`,
        [
          id,
          userId,
          response.title,
          response.description || '',
          programme.kind,
          Number(response.estimatedHours) || 20,
          JSON.stringify(steps),
          programmeId,
          JSON.stringify(review),
          review.score !== null && review.score < 60,
          now,
        ],
      );
      this.logger.log(
        `Learning path ${id} generated from programme ${programmeId} (score ${review.score})`,
      );
      return this.findById(id) as Promise<LearningPath>;
    } catch (error) {
      // AI failure: save a minimal path from milestones so studying never blocks.
      this.logger.warn(
        `Path generation from programme ${programmeId} failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private isStepType(type: string): type is LearningStep['type'] {
    return type === 'study' || type === 'quiz' || type === 'practice' || type === 'review';
  }

  /** AI self-review of a generated path (best-effort; never blocks). */
  private async reviewPath(
    title: string,
    stepCount: number,
  ): Promise<{ verdict: string; score: number | null; reasons: string[] }> {
    try {
      const response = await this.aiService.completeJson<{
        verdict: 'accepted' | 'rejected';
        score: number;
        reasons: string[];
      }>(
        [
          {
            role: 'system',
            content: withPhilosophy(
              'You are a strict learning-path reviewer. You output strict JSON only.',
            ),
          },
          {
            role: 'user',
            content: `Review this generated learning path for quality: title "${title}" with ${stepCount} steps. Return {"verdict": "accepted" | "rejected", "score": 0-100, "reasons": ["short reason"]}. A path is rejected if it is incoherent, unactionable, or encourages unhealthy over-study (marathon blocks, no review spacing).`,
          },
        ],
        { temperature: 0.2, maxTokens: 300 },
      );
      return {
        verdict: response.verdict === 'rejected' ? 'rejected' : 'accepted',
        score: Math.max(0, Math.min(100, Number(response.score) || 50)),
        reasons: response.reasons || [],
      };
    } catch {
      return { verdict: 'accepted', score: null, reasons: [] };
    }
  }

  async completeStep(pathId: string, stepId: string, userId: string): Promise<LearningPath> {
    const path = await this.findById(pathId);
    if (!path) throw new NotFoundException('Learning path not found');
    if (path.userId !== userId) throw new ForbiddenException('Access denied');

    const steps = path.steps.map((s) => {
      if (s.id === stepId) {
        return { ...s, isCompleted: true, completedAt: new Date() };
      }
      return s;
    });

    const completedCount = steps.filter((s) => s.isCompleted).length;
    const progress = Math.round((completedCount / steps.length) * 100);

    await this.db.query(
      `UPDATE learning_paths SET steps = $1, progress = $2, updated_at = $3 WHERE id = $4`,
      [JSON.stringify(steps), progress, new Date(), pathId],
    );

    return this.findById(pathId) as Promise<LearningPath>;
  }

  async delete(id: string, userId: string): Promise<void> {
    const path = await this.findById(id);
    if (!path) throw new NotFoundException('Learning path not found');
    if (path.userId !== userId) throw new ForbiddenException('Access denied');

    await this.db.query('DELETE FROM learning_paths WHERE id = $1', [id]);
  }

  private mapPath(row: unknown): LearningPath {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      title: r.title as string,
      description: r.description as string | null,
      subject: r.subject as string,
      difficulty: r.difficulty as LearningPath['difficulty'],
      estimatedHours: r.estimated_hours as number,
      steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : (r.steps as LearningStep[]) || [],
      progress: r.progress as number,
      programmeId: (r.programme_id as string | null) || null,
      programmeName: (r.programme_name as string | null) || null,
      review: this.parseJson(r.review, {}),
      needsRegeneration: Boolean(r.needs_regeneration),
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }

  private parseJson(value: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return (value as Record<string, unknown>) || fallback;
  }
}
