import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { AiService } from '../ai/ai.service';
import { withPhilosophy } from '../ai/study-rpg-philosophy';
import { AuditService } from '../admin/audit.service';
import { needsReview, reviewHistoryAppend, ReviewEvent } from './review-queue';

export interface Programme {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  status: 'suggested' | 'building' | 'active' | 'rejected' | 'archived';
  suggestedBy: string | null;
  suggesterName: string | null;
  aiBuilt: boolean;
  content: Record<string, unknown>;
  rewardPolicy: Record<string, unknown>;
  review: Record<string, unknown>;
  reviewHistory: Record<string, unknown>[];
  hasFactions: boolean;
  factionSize: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuggestProgrammeDto {
  name: string;
  description?: string;
  kind?: string;
  hasFactions?: boolean;
  factionSize?: number;
}

export interface ReviewProgrammeDto {
  verdict: 'accepted' | 'rejected';
  reason: string;
  score?: number;
}

export interface ProgrammeTemplate {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  outline: Record<string, unknown>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
  kind?: string;
  outline?: Record<string, unknown>;
  active?: boolean;
  reason: string;
}

export interface BatchReviewItem {
  id: string;
  verdict: 'accepted' | 'rejected';
  reason: string;
  score?: number;
}

interface AiBuiltProgramme {
  name: string;
  description: string;
  objectives: string[];
  milestones: Array<{ title: string; weeks: number; activities: string[] }>;
  estimatedWeeklyHours: number;
  rewardPolicy: { kind: 'none' | 'stp' | 'xp' | 'badge'; amount: number; criteria: string };
}

@Injectable()
export class ProgrammesService {
  private readonly logger = new Logger(ProgrammesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Templates (Phase 8 §31 follow-up: admin-curated outlines)
  // -------------------------------------------------------------------------

  async listTemplates(): Promise<ProgrammeTemplate[]> {
    const rows = await this.db.queryMany<ProgrammeTemplate>(
      'SELECT * FROM programme_templates WHERE active = TRUE ORDER BY kind, name',
    );
    return rows.map((r) => this.mapTemplate(r));
  }

  async createTemplate(actorId: string, dto: CreateTemplateDto): Promise<ProgrammeTemplate> {
    const name = (dto.name || '').trim();
    if (!name) {
      throw new BadRequestException('Template name is required');
    }
    const reason = (dto.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const id = uuidv4();
    const result = await this.db.queryOne<ProgrammeTemplate>(
      `INSERT INTO programme_templates (id, name, description, kind, outline, active, created_by)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6)
       RETURNING *`,
      [
        id,
        name,
        dto.description || null,
        dto.kind || 'custom',
        JSON.stringify(dto.outline || {}),
        actorId,
      ],
    );
    await this.audit.log({
      actorId,
      action: 'programme_template.create',
      targetType: 'programme_template',
      targetId: id,
      reason,
      details: { name, kind: dto.kind || 'custom' },
    });
    return this.mapTemplate(result!);
  }

  async updateTemplate(
    actorId: string,
    templateId: string,
    dto: Partial<CreateTemplateDto> & { reason: string },
  ): Promise<ProgrammeTemplate> {
    const existing = await this.db.queryOne<ProgrammeTemplate>(
      'SELECT * FROM programme_templates WHERE id = $1',
      [templateId],
    );
    if (!existing) {
      throw new NotFoundException('Template not found');
    }
    const reason = (dto.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const result = await this.db.queryOne<ProgrammeTemplate>(
      `UPDATE programme_templates
       SET name = $1, description = $2, kind = $3, outline = $4, active = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        dto.name?.trim() || existing.name,
        dto.description !== undefined ? dto.description : existing.description,
        dto.kind || existing.kind,
        JSON.stringify(dto.outline || existing.outline),
        dto.active !== undefined ? dto.active : existing.active,
        templateId,
      ],
    );
    await this.audit.log({
      actorId,
      action: 'programme_template.update',
      targetType: 'programme_template',
      targetId: templateId,
      reason,
      details: { name: result!.name },
    });
    return this.mapTemplate(result!);
  }

  async deleteTemplate(actorId: string, templateId: string, reason: string): Promise<void> {
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const existing = await this.db.queryOne<ProgrammeTemplate>(
      'SELECT * FROM programme_templates WHERE id = $1',
      [templateId],
    );
    if (!existing) {
      throw new NotFoundException('Template not found');
    }
    await this.db.query('DELETE FROM programme_templates WHERE id = $1', [templateId]);
    await this.audit.log({
      actorId,
      action: 'programme_template.delete',
      targetType: 'programme_template',
      targetId: templateId,
      reason: cleanReason,
      details: { name: existing.name },
    });
  }

  /** User instantiates a template: AI builds the programme from its outline. */
  async suggestFromTemplate(
    userId: string,
    templateId: string,
    opts: { hasFactions?: boolean; factionSize?: number } = {},
  ): Promise<Programme> {
    const template = await this.db.queryOne<ProgrammeTemplate>(
      'SELECT * FROM programme_templates WHERE id = $1 AND active = TRUE',
      [templateId],
    );
    if (!template) {
      throw new NotFoundException('Active template not found');
    }
    return this.suggest(userId, {
      name: template.name,
      description: template.description || undefined,
      kind: template.kind,
      hasFactions: opts.hasFactions,
      factionSize: opts.factionSize,
      templateOutline: template.outline,
    });
  }

  // -------------------------------------------------------------------------
  // Review queue + batch review (Phase 8 §31 follow-up)
  // -------------------------------------------------------------------------

  /** Programmes that still need a human verdict (no AI review or low score). */
  async reviewQueue(): Promise<Programme[]> {
    const rows = await this.db.queryMany<Programme>(
      `SELECT p.*, u.name AS suggester_name
       FROM programmes p
       LEFT JOIN users u ON u.id = p.suggested_by
       WHERE p.status IN ('suggested', 'building', 'active')
       ORDER BY p.created_at DESC
       LIMIT 200`,
    );
    return rows.map((r) => this.mapProgramme(r)).filter((p) => needsReview(p.review as never));
  }

  /** Admin batch review — every item audited + appended to review history. */
  async batchReview(actorId: string, items: BatchReviewItem[]): Promise<{ reviewed: number }> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Batch review requires at least one programme');
    }
    let reviewed = 0;
    for (const item of items) {
      const programme = await this.findOne(item.id);
      if (programme.status === 'archived') {
        throw new BadRequestException(`Archived programme ${programme.name} cannot be re-reviewed`);
      }
      await this.applyReview(actorId, programme.id, {
        verdict: item.verdict,
        reason: item.reason,
        score: item.score,
      });
      reviewed += 1;
    }
    return { reviewed };
  }

  // -------------------------------------------------------------------------
  // Core (Phase 6)
  // -------------------------------------------------------------------------

  /** Phase 6: user suggests → AI builds immediately → live for everyone. */
  async suggest(
    userId: string,
    dto: SuggestProgrammeDto & { templateOutline?: Record<string, unknown> },
  ): Promise<Programme> {
    const name = (dto.name || '').trim();
    if (name.length < 3) {
      throw new BadRequestException('Programme name must be at least 3 characters');
    }

    const id = uuidv4();
    const now = new Date();
    const kind = dto.kind || 'custom';

    // Create as 'building' first so the UI shows progress.
    await this.db.query(
      `INSERT INTO programmes
         (id, name, description, kind, status, suggested_by, ai_built, content, reward_policy, review, has_factions, faction_size, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'building', $5, $6, '{}', '{}', '{}', $7, $8, $9, $9)`,
      [
        id,
        name,
        dto.description || null,
        kind,
        userId,
        false,
        dto.hasFactions ?? false,
        dto.factionSize ?? 7,
        now,
      ],
    );

    // AI builds the full programme content + reward policy.
    try {
      const built = await this.buildWithAi(dto, dto.templateOutline);
      await this.db.query(
        `UPDATE programmes
         SET name = $1, description = $2, content = $3, reward_policy = $4, ai_built = true,
             status = 'active', updated_at = $5
         WHERE id = $6`,
        [
          built.name,
          built.description,
          JSON.stringify({
            objectives: built.objectives,
            milestones: built.milestones,
            estimatedWeeklyHours: built.estimatedWeeklyHours,
          }),
          JSON.stringify(built.rewardPolicy),
          new Date(),
          id,
        ],
      );
    } catch (error) {
      this.logger.error(`AI build failed for programme ${id}`, error);
      await this.db.query(
        `UPDATE programmes SET status = 'active', updated_at = $1 WHERE id = $2`,
        [new Date(), id],
      );
    }

    // Fire the AI reviewer (best-effort; admin can override).
    this.reviewWithAi(id).catch((error) =>
      this.logger.warn(`AI review failed for ${id}: ${(error as Error).message}`),
    );

    this.audit
      .log({
        actorId: userId,
        action: 'programme.suggest',
        targetType: 'programme',
        targetId: id,
        reason: `Suggested programme "${name}"`,
        details: { kind },
      })
      .catch(() => undefined);

    return this.findOne(id, userId);
  }

  async list(options: { status?: string; kind?: string; userId?: string; mine?: boolean }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.status) {
      conditions.push(`p.status = $${paramIndex++}`);
      values.push(options.status);
    }
    if (options.kind) {
      conditions.push(`p.kind = $${paramIndex++}`);
      values.push(options.kind);
    }
    if (options.mine && options.userId) {
      conditions.push(`p.suggested_by = $${paramIndex++}`);
      values.push(options.userId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.queryMany<Programme>(
      `SELECT p.*, u.name AS suggester_name,
              EXISTS(SELECT 1 FROM programme_members pm WHERE pm.programme_id = p.id AND pm.user_id = $1) AS joined
       FROM programmes p
       LEFT JOIN users u ON u.id = p.suggested_by
       ${where}
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [options.userId || null, ...values],
    );
    return rows.map((r) => this.mapProgramme(r));
  }

  async findOne(id: string, userId?: string): Promise<Programme> {
    const row = await this.db.queryOne<Programme>(
      `SELECT p.*, u.name AS suggester_name,
              EXISTS(SELECT 1 FROM programme_members pm WHERE pm.programme_id = p.id AND pm.user_id = $2) AS joined
       FROM programmes p
       LEFT JOIN users u ON u.id = p.suggested_by
       WHERE p.id = $1`,
      [id, userId || null],
    );
    if (!row) {
      throw new NotFoundException('Programme not found');
    }
    return this.mapProgramme(row);
  }

  async join(userId: string, programmeId: string): Promise<Programme> {
    const programme = await this.findOne(programmeId, userId);
    if (programme.status !== 'active') {
      throw new BadRequestException('Only active programmes can be joined');
    }

    await this.db.query(
      `INSERT INTO programme_members (programme_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [programmeId, userId],
    );

    return this.findOne(programmeId, userId);
  }

  async leave(userId: string, programmeId: string): Promise<Programme> {
    await this.db.query('DELETE FROM programme_members WHERE programme_id = $1 AND user_id = $2', [
      programmeId,
      userId,
    ]);
    return this.findOne(programmeId, userId);
  }

  /** Admin override of the AI review — always audited with a reason. */
  async adminReview(
    actorId: string,
    programmeId: string,
    dto: ReviewProgrammeDto,
  ): Promise<Programme> {
    const reason = (dto.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const programme = await this.findOne(programmeId);
    if (programme.status === 'archived') {
      throw new BadRequestException('Archived programmes cannot be re-reviewed');
    }
    return this.applyReview(actorId, programmeId, dto);
  }

  /** Shared review application (admin override + batch) with history append. */
  private async applyReview(
    actorId: string,
    programmeId: string,
    dto: ReviewProgrammeDto,
  ): Promise<Programme> {
    const reason = (dto.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const current = await this.findOne(programmeId);
    const event: ReviewEvent = {
      verdict: dto.verdict,
      score: dto.score ?? null,
      reasons: [reason],
      reviewer: actorId,
      reviewedAt: new Date().toISOString(),
    };
    const history = reviewHistoryAppend(
      current.reviewHistory as unknown as ReviewEvent[] | null,
      event,
    );

    await this.db.query(
      `UPDATE programmes
       SET status = $1, review = $2, review_history = $3, updated_at = $4
       WHERE id = $5`,
      [
        dto.verdict === 'rejected' ? 'rejected' : 'active',
        JSON.stringify({
          verdict: dto.verdict,
          score: dto.score ?? null,
          reasons: [reason],
          reviewedBy: actorId,
          reviewedAt: event.reviewedAt,
        }),
        JSON.stringify(history),
        new Date(),
        programmeId,
      ],
    );

    await this.audit.log({
      actorId,
      action: `programme.review_${dto.verdict}`,
      targetType: 'programme',
      targetId: programmeId,
      reason,
      details: { score: dto.score ?? null },
    });

    return this.findOne(programmeId);
  }

  async archive(actorId: string, programmeId: string, reason: string): Promise<Programme> {
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    await this.db.query(
      "UPDATE programmes SET status = 'archived', updated_at = $1 WHERE id = $2",
      [new Date(), programmeId],
    );
    await this.audit.log({
      actorId,
      action: 'programme.archive',
      targetType: 'programme',
      targetId: programmeId,
      reason: cleanReason,
    });
    return this.findOne(programmeId);
  }

  // ---------------- AI ----------------

  private async buildWithAi(
    dto: SuggestProgrammeDto,
    templateOutline?: Record<string, unknown>,
  ): Promise<AiBuiltProgramme> {
    const outlineBlock = templateOutline
      ? `\nTemplate outline (follow it closely):\n${JSON.stringify(templateOutline).substring(0, 2000)}`
      : '';
    const prompt = `You are the programme architect for a study platform. Build a complete study programme.

Suggestion:
- Name: ${dto.name}
- Description: ${dto.description || '(none provided)'}
- Kind: ${dto.kind || 'custom'}
${outlineBlock}

Return STRICT JSON (no markdown) with this exact shape:
{
  "name": "a refined programme name",
  "description": "2-3 sentence description of what students achieve",
  "objectives": ["3-5 concrete learning objectives"],
  "milestones": [
    {"title": "milestone title", "weeks": 1-4, "activities": ["2-4 real activities per milestone"]}
  ],
  "estimatedWeeklyHours": 2-10,
  "rewardPolicy": {"kind": "none" | "stp" | "xp" | "badge", "amount": number, "criteria": "how a participant earns the reward"}
}

Rules:
- Real, actionable activities a student can do with flashcards, quizzes, tasks, notes or teach-back.
- Reward policy: choose "none" for purely intrinsic programmes, or a modest amount for programmes with clear milestones/competition.
- No fabricated external links. Everything must be doable inside the study platform.`;

    const response = await this.ai.complete(
      [
        {
          role: 'system',
          content: withPhilosophy(
            'You are the programme architect for a study platform. You output strict JSON only.',
          ),
        },
        { role: 'user', content: prompt },
      ],
      { responseFormat: { type: 'json_object' }, temperature: 0.4, maxTokens: 1500 },
    );

    const parsed = JSON.parse(response.content) as AiBuiltProgramme;
    if (!parsed.name || !Array.isArray(parsed.objectives)) {
      throw new BadRequestException('AI returned malformed programme');
    }
    return {
      name: parsed.name,
      description: parsed.description || '',
      objectives: parsed.objectives.slice(0, 5),
      milestones: (parsed.milestones || []).slice(0, 8),
      estimatedWeeklyHours: Math.max(1, Math.min(10, Number(parsed.estimatedWeeklyHours) || 3)),
      rewardPolicy: {
        kind: parsed.rewardPolicy?.kind || 'none',
        amount: Math.max(0, Number(parsed.rewardPolicy?.amount) || 0),
        criteria: parsed.rewardPolicy?.criteria || '',
      },
    };
  }

  /** AI reviewer: is this programme real and useful, or bad/unnecessary? */
  private async reviewWithAi(programmeId: string): Promise<void> {
    const programme = await this.findOne(programmeId);
    if (programme.status === 'rejected' || programme.status === 'archived') {
      return;
    }

    const content = programme.content;
    const prompt = `You are a strict curriculum reviewer. Judge whether this study programme is REAL and USEFUL (targets something concrete, doable activities) or BAD/UNNECESSARY (vague, unactionable, duplicative, or nonsense).

Programme: ${programme.name}
Description: ${programme.description}
Kind: ${programme.kind}
Content: ${JSON.stringify(content).substring(0, 2500)}

Return STRICT JSON: {"verdict": "accepted" | "rejected", "score": 0-100, "reasons": ["short reason"]}`;

    const response = await this.ai.complete(
      [
        {
          role: 'system',
          content: withPhilosophy(
            'You are a strict curriculum reviewer. You output strict JSON only.',
          ),
        },
        { role: 'user', content: prompt },
      ],
      { responseFormat: { type: 'json_object' }, temperature: 0.2, maxTokens: 400 },
    );

    const parsed = JSON.parse(response.content) as {
      verdict: 'accepted' | 'rejected';
      score: number;
      reasons: string[];
    };
    const verdict = parsed.verdict === 'rejected' ? 'rejected' : 'accepted';
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 50));
    const event: ReviewEvent = {
      verdict,
      score,
      reasons: parsed.reasons || [],
      reviewer: 'ai',
      reviewedAt: new Date().toISOString(),
    };
    const history = reviewHistoryAppend(
      programme.reviewHistory as unknown as ReviewEvent[] | null,
      event,
    );

    await this.db.query(
      `UPDATE programmes
       SET status = $1, review = $2, review_history = $3, updated_at = $4
       WHERE id = $5 AND status NOT IN ('rejected', 'archived')`,
      [
        verdict,
        JSON.stringify({
          verdict,
          score,
          reasons: parsed.reasons || [],
          reviewedBy: 'ai',
          reviewedAt: event.reviewedAt,
        }),
        JSON.stringify(history),
        new Date(),
        programmeId,
      ],
    );
  }

  private mapProgramme(row: unknown): Programme {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string | null) || null,
      kind: r.kind as string,
      status: r.status as Programme['status'],
      suggestedBy: (r.suggested_by as string | null) || null,
      suggesterName: (r.suggester_name as string | null) || null,
      aiBuilt: r.ai_built as boolean,
      content: this.parseJson(r.content, {}),
      rewardPolicy: this.parseJson(r.reward_policy, {}),
      review: this.parseJson(r.review, {}),
      reviewHistory: this.parseArray(r.review_history),
      hasFactions: r.has_factions as boolean,
      factionSize: r.faction_size as number,
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

  private parseArray(value: unknown): Record<string, unknown>[] {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  }

  private mapTemplate(row: unknown): ProgrammeTemplate {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string | null) || null,
      kind: r.kind as string,
      outline: this.parseJson(r.outline, {}),
      active: (r.active as boolean) ?? true,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }
}
