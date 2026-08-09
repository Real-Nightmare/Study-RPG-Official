import { CampfireService } from './campfire.service';
import { istDayKey } from '../events/quest-rules';

// The service keys reflections by the IST day key of *today* — compute the
// expected key dynamically so these tests never go stale.
const DAY = istDayKey(new Date());

function makeDb(overrides: Record<string, unknown> = {}) {
  const store: Record<string, unknown[]> = {
    campfire: [],
  };
  return {
    store,
    queryOne: jest.fn(async (sql: string, params: unknown[]) => {
      const all = () => store.campfire as Array<Record<string, unknown>>;
      // Daily-cap count: [userId, dayKey]
      if (sql.includes('SELECT COUNT(*)::int AS count FROM campfire_reflections')) {
        const rows = all().filter(
          (r) => r.user_id === params[0] && r.day_key === params[1] && r.status !== 'skipped',
        );
        return { count: rows.length };
      }
      // submit()/skip() lookup: [reflectionId, userId]
      if (sql.includes('WHERE id = $1 AND user_id = $2')) {
        return all().find((r) => r.id === params[0] && r.user_id === params[1]) ?? null;
      }
      // Idempotent start(): [userId, dayKey, sourceKind, sourceId]
      if (sql.includes('source_id IS NOT DISTINCT FROM')) {
        const row = all().find(
          (r) =>
            r.user_id === params[0] &&
            r.day_key === params[1] &&
            r.source_kind === params[2] &&
            (params[3] === null || params[3] === undefined
              ? r.source_id === null || r.source_id === undefined
              : r.source_id === params[3]),
        );
        return row ?? null;
      }
      // latestMultiplier(): [userId, dayKey]
      if (sql.includes('ORDER BY answered_at DESC LIMIT 1')) {
        const answered = all()
          .filter(
            (r) => r.user_id === params[0] && r.day_key === params[1] && r.status === 'answered',
          )
          .sort(
            (a, b) =>
              new Date(b.answered_at as Date).getTime() - new Date(a.answered_at as Date).getTime(),
          );
        return answered[0] ?? null;
      }
      if (sql.includes('game_config')) return { value: null };
      return overrides.row ?? null;
    }),
    queryMany: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM campfire_reflections')) {
        return store.campfire
          .filter(
            (r) =>
              (r as { user_id: string }).user_id === params[0] &&
              (r as { day_key: string }).day_key === params[1],
          )
          .sort(
            (a, b) =>
              new Date((b as { created_at: Date }).created_at).getTime() -
              new Date((a as { created_at: Date }).created_at).getTime(),
          );
      }
      if (sql.includes('teach_back_sessions')) return [];
      if (sql.includes('quiz_attempts')) return [];
      if (sql.includes('exam_attempts')) return [];
      return [];
    }),
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('INSERT INTO campfire_reflections')) {
        store.campfire.push({
          id: params[0],
          user_id: params[1],
          question: params[2],
          source_kind: params[3],
          source_id: params[4],
          context: params[5],
          day_key: params[6],
          status: 'pending',
          created_at: params[7],
          answered_at: null,
          answer: null,
          depth_score: null,
          multiplier: 1,
        });
      } else if (sql.startsWith('UPDATE campfire_reflections')) {
        // submit(): ... WHERE id = $4 AND user_id = $5
        const row = store.campfire.find(
          (r) =>
            (r as { id: string }).id === params[3] &&
            (r as { user_id: string }).user_id === params[4],
        );
        if (row) {
          Object.assign(row, {
            answer: params[0],
            depth_score: params[1],
            multiplier: params[2],
            status: 'answered',
            answered_at: new Date(),
          });
        } else {
          // skip(): ... WHERE id = $1 AND user_id = $2
          const skipped = store.campfire.find(
            (r) =>
              (r as { id: string }).id === params[0] &&
              (r as { user_id: string }).user_id === params[1],
          );
          if (skipped) Object.assign(skipped, { status: 'skipped' });
        }
      }
      return {};
    }),
  };
}

const fakeAi = {
  isAvailable: () => true,
  completeJson: jest.fn(async () => ({ question: 'Why does X lead to Y? Give an example.' })),
};

describe('CampfireService', () => {
  it('starts a reflection with a deterministic fallback question when AI is unavailable', async () => {
    const db = makeDb();
    const svc = new CampfireService(db as never, undefined);
    const view = await svc.start('u1', { subject: 'Photosynthesis' });
    expect(view.question).toContain('Photosynthesis');
    expect(view.status).toBe('pending');
    expect(view.multiplier).toBe(1);
  });

  it('uses the AI tutor question when available', async () => {
    const db = makeDb();
    const svc = new CampfireService(db as never, fakeAi as never);
    const view = await svc.start('u1', { subject: 'Newton' });
    expect(fakeAi.completeJson).toHaveBeenCalled();
    expect(view.question).toBe('Why does X lead to Y? Give an example.');
  });

  it('grades depth via AI and maps to the 1.5x multiplier', async () => {
    const db = makeDb();
    const ai = {
      isAvailable: () => true,
      completeJson: jest
        .fn()
        .mockResolvedValueOnce({ question: 'Why?' })
        .mockResolvedValueOnce({ depthScore: 92, feedback: 'deep' }),
    };
    const svc = new CampfireService(db as never, ai as never);
    const view = await svc.start('u1', { subject: 'Biology' });
    const answered = await svc.submit(
      'u1',
      view.id,
      'A genuinely deep answer that explains mechanisms and connects ideas across many sentences.'.repeat(
        2,
      ),
    );
    expect(answered.depthScore).toBe(92);
    expect(answered.multiplier).toBe(1.5);
  });

  it('falls back to the lexical heuristic when AI grading fails', async () => {
    const db = makeDb();
    const ai = {
      isAvailable: () => true,
      completeJson: jest.fn().mockRejectedValueOnce(new Error('boom')),
    };
    const svc = new CampfireService(db as never, ai as never);
    const view = await svc.start('u1', { subject: 'Chemistry' });
    const answered = await svc.submit(
      'u1',
      view.id,
      'Because the electrons move, the reaction changes. Therefore the energy means something since it leads to bonds forming.'.repeat(
        2,
      ),
    );
    expect(answered.depthScore).toBeGreaterThanOrEqual(0);
    expect(answered.depthScore).toBeLessThanOrEqual(100);
    expect(answered.multiplier).toBeGreaterThanOrEqual(1);
    expect(answered.multiplier).toBeLessThanOrEqual(1.5);
  });

  it('enforces the daily cap', async () => {
    const db = makeDb();
    const svc = new CampfireService(db as never, undefined);
    // Pre-seed 3 reflections for today.
    for (let i = 0; i < 3; i++) {
      db.store.campfire.push({
        id: `r${i}`,
        user_id: 'u1',
        day_key: DAY,
        status: 'answered',
        source_kind: 'session',
        source_id: `s${i}`,
        created_at: new Date(),
      });
    }
    await expect(svc.start('u1', { subject: 'Math' })).rejects.toThrow('limit reached');
  });

  it('is idempotent per (user, day, source)', async () => {
    const db = makeDb();
    const svc = new CampfireService(db as never, undefined);
    const first = await svc.start('u1', { sourceKind: 'session', sourceId: 'abc' });
    const second = await svc.start('u1', { sourceKind: 'session', sourceId: 'abc' });
    expect(second.id).toBe(first.id);
  });

  it('returns the latest answered multiplier (default 1.0)', async () => {
    const db = makeDb();
    const svc = new CampfireService(db as never, undefined);
    expect(await svc.latestMultiplier('u1')).toBe(1.0);
    db.store.campfire.push({
      id: 'x1',
      user_id: 'u1',
      day_key: DAY,
      status: 'answered',
      multiplier: 1.5,
      answered_at: new Date(),
      source_kind: 'session',
      source_id: 's1',
      created_at: new Date(),
    });
    expect(await svc.latestMultiplier('u1')).toBe(1.5);
  });

  it('rejects brief reflections (anti-slop)', async () => {
    const db = makeDb();
    const svc = new CampfireService(db as never, undefined);
    const view = await svc.start('u1', { subject: 'History' });
    await expect(svc.submit('u1', view.id, 'ok')).rejects.toThrow('too brief');
  });
});
