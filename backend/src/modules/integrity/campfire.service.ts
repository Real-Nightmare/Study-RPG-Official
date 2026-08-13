import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { AiService } from '../ai/ai.service';
import { withPhilosophy } from '../ai/study-rpg-philosophy';
import { istDayKey } from '../events/quest-rules';
import { CampfireConfig, getIntegrityConfig } from './integrity-config';
import { campfireMultiplier } from './reward-curve';

export type CampfireSourceKind = 'session' | 'battle' | 'quiz' | 'exam' | 'teach_back';

export interface CampfireView {
  id: string;
  question: string;
  answer: string | null;
  depthScore: number | null;
  multiplier: number;
  sourceKind: CampfireSourceKind;
  sourceId: string | null;
  status: 'pending' | 'answered' | 'skipped';
  createdAt: Date;
}

export interface StartCampfireInput {
  sourceKind?: CampfireSourceKind;
  sourceId?: string;
  subject?: string | null;
  title?: string | null;
}

export interface CampfireStatusView {
  usedToday: number;
  maxPerDay: number;
  pending: CampfireView | null;
  latestMultiplier: number;
  reflections: CampfireView[];
}

/**
 * Metacognitive "Campfire" loop (spec 014, US5/FR-009).
 *
 * Before a student cashes in session rewards or logs off, the AI tutor asks a
 * single, targeted synthesis question about the material just reviewed. The
 * answer is graded for semantic depth (0-100) and mapped to a 1.0x-1.5x
 * reward multiplier. The loop is cost-bounded (max 3/day) and never dead-ends:
 * when no AI client is available or the call fails, a deterministic lexical
 * depth heuristic is used.
 */
@Injectable()
export class CampfireService {
  private readonly logger = new Logger(CampfireService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ai?: AiService,
  ) {}

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async status(userId: string): Promise<CampfireStatusView> {
    const config = await getIntegrityConfig(this.db);
    const dayKey = istDayKey(new Date());
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT id, question, answer, depth_score, multiplier, source_kind, source_id,
              status, created_at, answered_at
       FROM campfire_reflections
       WHERE user_id = $1 AND day_key = $2
       ORDER BY created_at DESC`,
      [userId, dayKey],
    );
    const reflections = rows.map((r) => this.mapView(r));
    const answered = reflections.filter((r) => r.status === 'answered');
    const latest = answered[0] ?? null;
    return {
      usedToday: reflections.filter((r) => r.status !== 'skipped').length,
      maxPerDay: config.campfire.maxPerDay,
      pending: reflections.find((r) => r.status === 'pending') ?? null,
      latestMultiplier: latest ? latest.multiplier : config.campfire.baseMultiplier,
      reflections,
    };
  }

  /**
   * Multiplier for the most recently answered reflection today (1.0x when none).
   * Used by reward paths (battle claims, session cash-ins).
   */
  async latestMultiplier(userId: string): Promise<number> {
    const config = await getIntegrityConfig(this.db);
    const row = await this.db.queryOne<{ multiplier: number | string }>(
      `SELECT multiplier FROM campfire_reflections
       WHERE user_id = $1 AND status = 'answered' AND day_key = $2
       ORDER BY answered_at DESC LIMIT 1`,
      [userId, istDayKey(new Date())],
    );
    return row ? Number(row.multiplier) : config.campfire.baseMultiplier;
  }

  // -------------------------------------------------------------------------
  // Start: the tutor asks ONE targeted synthesis question
  // -------------------------------------------------------------------------

  async start(userId: string, input: StartCampfireInput = {}): Promise<CampfireView> {
    const config = await getIntegrityConfig(this.db);
    const dayKey = istDayKey(new Date());
    const sourceKind = input.sourceKind ?? 'session';
    const sourceId = input.sourceId ?? null;

    // Idempotent: one reflection per (user, day, source).
    const existing = await this.db.queryOne<Record<string, unknown>>(
      `SELECT id, question, answer, depth_score, multiplier, source_kind, source_id,
              status, created_at, answered_at
       FROM campfire_reflections
       WHERE user_id = $1 AND day_key = $2 AND source_kind = $3
         AND source_id IS NOT DISTINCT FROM $4`,
      [userId, dayKey, sourceKind, sourceId],
    );
    if (existing) return this.mapView(existing);

    // Daily cost cap.
    const used = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM campfire_reflections
       WHERE user_id = $1 AND day_key = $2 AND status <> 'skipped'`,
      [userId, dayKey],
    );
    if (Number(used?.count ?? 0) >= config.campfire.maxPerDay) {
      throw new BadRequestException(
        `Campfire reflection limit reached (${config.campfire.maxPerDay}/day). Reflect again tomorrow.`,
      );
    }

    const context = await this.buildContext(userId, input);
    const question = await this.askTutor(context);

    const id = uuidv4();
    const now = new Date();
    await this.db.query(
      `INSERT INTO campfire_reflections
         (id, user_id, question, source_kind, source_id, context, day_key, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $8)
       ON CONFLICT (user_id, day_key, source_kind, source_id) DO NOTHING`,
      [id, userId, question, sourceKind, sourceId, JSON.stringify(context), dayKey, now],
    );
    this.logger.log(`Campfire reflection started for ${userId} (${sourceKind})`);
    return this.mapView({
      id,
      question,
      answer: null,
      depth_score: null,
      multiplier: config.campfire.baseMultiplier,
      source_kind: sourceKind,
      source_id: sourceId,
      status: 'pending',
      created_at: now,
      answered_at: null,
    });
  }

  /** Grade the student's answer and persist the depth score + multiplier. */
  async submit(userId: string, reflectionId: string, answer: string): Promise<CampfireView> {
    const config = await getIntegrityConfig(this.db);
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM campfire_reflections WHERE id = $1 AND user_id = $2`,
      [reflectionId, userId],
    );
    if (!row) throw new NotFoundException('Campfire reflection not found');
    if (row.status === 'answered') {
      throw new BadRequestException('Reflection already answered');
    }
    const cleaned = (answer ?? '').trim();
    if (cleaned.length < config.campfire.minAnswerChars) {
      throw new BadRequestException(
        `Your reflection is too brief (min ${config.campfire.minAnswerChars} characters) — take a real moment to synthesise.`,
      );
    }

    const question = row.question as string;
    const context = this.parseJson(row.context);
    const depth = await this.gradeDepth(question, cleaned, context, config.campfire);

    const multiplier = Number(
      campfireMultiplier(depth, {
        depthForFullMultiplier: config.campfire.depthForFullMultiplier,
        maxMultiplier: config.campfire.maxMultiplier,
        baseMultiplier: config.campfire.baseMultiplier,
      }).toFixed(2),
    );

    await this.db.query(
      `UPDATE campfire_reflections
       SET answer = $1, depth_score = $2, multiplier = $3, status = 'answered',
           answered_at = NOW(), updated_at = NOW()
       WHERE id = $4 AND user_id = $5`,
      [cleaned, depth, multiplier, reflectionId, userId],
    );
    this.logger.log(
      `Campfire reflection answered: ${userId} depth=${depth} multiplier=${multiplier}`,
    );
    return this.mapView({
      ...row,
      answer: cleaned,
      depth_score: depth,
      multiplier,
      status: 'answered',
      answered_at: new Date(),
    });
  }

  /** Skip (defer) a pending reflection — multiplier stays at base. */
  async skip(userId: string, reflectionId: string): Promise<CampfireView> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM campfire_reflections WHERE id = $1 AND user_id = $2`,
      [reflectionId, userId],
    );
    if (!row) throw new NotFoundException('Campfire reflection not found');
    await this.db.query(
      `UPDATE campfire_reflections SET status = 'skipped', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
      [reflectionId, userId],
    );
    return this.mapView({ ...row, status: 'skipped' });
  }

  // -------------------------------------------------------------------------
  // AI tutor (with deterministic fallbacks)
  // -------------------------------------------------------------------------

  private async askTutor(context: {
    topics: string[];
    subject?: string | null;
    title?: string | null;
  }): Promise<string> {
    const subject = context.subject || context.topics[0] || null;
    const fallback = subject
      ? `In your own words: what is the single most important idea you studied in "${subject}" today, and how does it connect to something you already knew? Give one concrete example.`
      : `In your own words: what is the single most important idea you studied today, and how does it connect to something you already knew? Give one concrete example.`;

    if (!this.ai || !this.ai.isAvailable()) return fallback;
    try {
      const topics =
        context.topics.length > 0 ? context.topics.join(', ') : (subject ?? 'your study session');
      const res = await this.ai.completeJson<{ question: string }>(
        [
          {
            role: 'system',
            content: `${withPhilosophy(
              'You are a metacognitive tutor. Ask exactly ONE targeted synthesis question that verifies real understanding of what the student just studied. The question must require connecting ideas (why/how/compare), never a recall fact — depth over recall. If the student has clearly over-studied today, your question should gently steer them toward consolidating (connecting) rather than cramming more. Return JSON: { "question": "..." }.',
            )}`,
          },
          {
            role: 'user',
            content: `The student just studied: ${topics}. Ask one synthesis question.`,
          },
        ],
        { maxTokens: 256, temperature: 0.4 },
      );
      const q = res?.question?.trim();
      return q && q.length > 10 ? q : fallback;
    } catch (err) {
      this.logger.warn(`Campfire question AI failed, using fallback: ${(err as Error).message}`);
      return fallback;
    }
  }

  private async gradeDepth(
    question: string,
    answer: string,
    context: Record<string, unknown>,
    config: CampfireConfig,
  ): Promise<number> {
    if (this.ai && this.ai.isAvailable()) {
      try {
        const res = await this.ai.completeJson<{ depthScore: number; feedback: string }>(
          [
            {
              role: 'system',
              content: withPhilosophy(
                'You are a metacognitive depth grader. Score the student\'s reflection answer from 0 to 100 on SEMANTIC DEPTH ONLY: does it demonstrate real understanding (explains why/how, connects concepts, gives examples) rather than surface recall? Do not reward length alone, and never reward cramming language. Score below 40 for vague or memorised-sounding answers. Return JSON: { "depthScore": 0-100, "feedback": "one sentence" }.',
              ),
            },
            {
              role: 'user',
              content: `Question: ${question}\n\nStudent's answer:\n${answer}`,
            },
          ],
          { maxTokens: 128, temperature: 0.2 },
        );
        const score = Number(res?.depthScore);
        if (Number.isFinite(score)) {
          return Math.max(0, Math.min(100, Math.round(score)));
        }
      } catch (err) {
        this.logger.warn(`Campfire grading AI failed, using heuristic: ${(err as Error).message}`);
      }
    }
    return this.lexicalDepth(question, answer, context, config);
  }

  /**
   * Deterministic fallback depth heuristic (never dead-ends without AI):
   *  - base 45 when the answer meets the minimum length, else 15
   *  - +2 per significant topic term from the question/context that appears
   *    in the answer (max +30)
   *  - +10 for 3+ sentences
   *  - +15 for explicit reasoning connectors
   */
  lexicalDepth(
    question: string,
    answer: string,
    context: Record<string, unknown>,
    config: CampfireConfig,
  ): number {
    let depth = answer.trim().length >= config.minAnswerChars ? 45 : 15;

    const significant = (text: string): string[] => {
      const words = (text ?? '').toLowerCase().match(/[a-z0-9]{5,}/g) ?? [];
      const stop = new Set([
        'about',
        'their',
        'there',
        'which',
        'would',
        'could',
        'should',
        'thing',
        'things',
        'today',
        'being',
        'while',
        'still',
      ]);
      return [...new Set(words.filter((w) => !stop.has(w)))];
    };

    const answerWords = new Set(significant(answer));
    const terms = [...new Set([...significant(question), ...significant(JSON.stringify(context))])];
    let hits = 0;
    for (const t of terms) {
      if (answerWords.has(t)) hits += 1;
    }
    depth += Math.min(30, hits * 2);

    const sentenceCount = (answer.match(/[.!?]+/g) ?? []).length;
    if (sentenceCount >= 3) depth += 10;

    if (/\b(because|therefore|means|leads|so that|since|however|for example)\b/i.test(answer)) {
      depth += 15;
    }

    return Math.max(0, Math.min(100, depth));
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Recent study context (last 24h) so the tutor's question is grounded. */
  private async buildContext(
    userId: string,
    input: StartCampfireInput,
  ): Promise<{ topics: string[]; subject?: string | null; title?: string | null }> {
    const topics: string[] = [];
    if (input.subject) topics.push(input.subject);
    if (input.title) topics.push(input.title);

    const rows = await this.db.queryMany<{ topic: string }>(
      `(SELECT topic FROM teach_back_sessions
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours' AND status IN ('submitted','evaluated')
         ORDER BY created_at DESC LIMIT 5)
       UNION ALL
       (SELECT q.title AS topic FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.id
         WHERE qa.user_id = $1 AND qa.created_at > NOW() - INTERVAL '24 hours'
         ORDER BY qa.created_at DESC LIMIT 5)
       UNION ALL
       (SELECT ec.title AS topic FROM exam_attempts ea JOIN exam_clones ec ON ea.exam_clone_id = ec.id
         WHERE ea.user_id = $1 AND ea.created_at > NOW() - INTERVAL '24 hours'
         ORDER BY ea.created_at DESC LIMIT 5)`,
      [userId],
    );
    for (const row of rows) {
      if (row?.topic && !topics.includes(row.topic)) topics.push(row.topic);
    }
    return { topics, subject: input.subject ?? null, title: input.title ?? null };
  }

  private mapView(r: Record<string, unknown>): CampfireView {
    return {
      id: r.id as string,
      question: r.question as string,
      answer: (r.answer ?? null) as string | null,
      depthScore:
        r.depth_score === null || r.depth_score === undefined ? null : Number(r.depth_score),
      multiplier: Number(r.multiplier ?? 1),
      sourceKind: (r.source_kind ?? 'session') as CampfireSourceKind,
      sourceId: (r.source_id ?? null) as string | null,
      status: (r.status ?? 'pending') as CampfireView['status'],
      createdAt: new Date((r.created_at ?? r.createdAt ?? r.answered_at) as string),
    };
  }

  private parseJson(value: unknown): Record<string, unknown> {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return (value ?? {}) as Record<string, unknown>;
  }
}
