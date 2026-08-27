/**
 * Character archetype tests (completion plan T9): modifier math, selection
 * rules, the level-10 respec grant, and the battle max-HP hook.
 */

import { CHARACTERS, applyXpModifiers, battleMaxHp, canSelectCharacter, findCharacter, RESPEC_TOKEN_LEVEL } from './characters';
import { PlayerService } from './player.service';
import { DEFAULT_LEVEL_CONFIG } from './rpg-config';

describe('character definitions', () => {
  it('ships six original archetypes with unique keys', () => {
    expect(CHARACTERS).toHaveLength(6);
    const keys = new Set(CHARACTERS.map((c) => c.key));
    expect(keys.size).toBe(6);
  });

  it('gives each archetype a distinct mechanical identity', () => {
    const byKey = Object.fromEntries(CHARACTERS.map((c) => [c.key, c.modifiers]));
    expect(byKey.lorekeeper.xpBonusPct).toBeGreaterThan(0);
    expect(byKey.focuser.battleMaxHpBonus).toBeGreaterThan(0);
    expect(Object.keys(byKey.solver.xpTypeBonus)).toContain('problem_solved');
    expect(byKey.duelist.pvpStartRatingBonus).toBeGreaterThan(0);
    expect(byKey.alchemist.burnValueBonusPct).toBeGreaterThan(0);
    expect(byKey.warden.streakShieldBonus).toBeGreaterThan(0);
  });
});

describe('applyXpModifiers', () => {
  const lorekeeper = findCharacter('lorekeeper')!;
  const solver = findCharacter('solver')!;

  it('returns the base amount without a character', () => {
    expect(applyXpModifiers(100, undefined, 'focus_session')).toBe(100);
  });

  it('applies the flat percentage bonus (floored)', () => {
    expect(applyXpModifiers(100, lorekeeper, 'study_set_created')).toBe(105);
    expect(applyXpModifiers(33, lorekeeper, 'study_set_created')).toBe(34); // 34.65 → 34
  });

  it('stacks type-specific bonuses on top of the flat bonus', () => {
    // Solver has no flat bonus but +10% for problem_solved.
    expect(applyXpModifiers(100, solver, 'problem_solved')).toBe(110);
    expect(applyXpModifiers(100, solver, 'quiz_completed')).toBe(105);
    // Unrelated award types get no bonus.
    expect(applyXpModifiers(100, solver, 'streak_kept')).toBe(100);
  });

  it('never changes non-positive amounts', () => {
    expect(applyXpModifiers(0, lorekeeper, 'anything')).toBe(0);
  });
});

describe('battleMaxHp', () => {
  it('adds the archetype bonus to the base HP', () => {
    const focuser = findCharacter('focuser')!;
    expect(battleMaxHp(100, focuser)).toBe(120);
    expect(battleMaxHp(100, undefined)).toBe(100);
    expect(battleMaxHp(100, findCharacter('warden'))).toBe(110);
  });
});

describe('canSelectCharacter', () => {
  it('allows the first pick for free', () => {
    expect(canSelectCharacter(null, 0)).toBe(true);
  });

  it('blocks re-picking without a token', () => {
    expect(canSelectCharacter('lorekeeper', 0)).toBe(false);
  });

  it('allows changing when a token is held', () => {
    expect(canSelectCharacter('lorekeeper', 2)).toBe(true);
  });
});

describe('PlayerService.selectCharacter', () => {
  function makeDb(initial: { characterKey?: string | null; respecTokens?: number; xp?: number }) {
    const row = {
      character_key: initial.characterKey ?? null,
      respec_tokens: initial.respecTokens ?? 0,
      xp: initial.xp ?? 0,
    };
    return {
      row,
      queries: [] as Array<{ sql: string; params: unknown[] }>,
      query: jest.fn(async (sql: string, params: unknown[]) => {
        void sql;
        void params;
        return {};
      }),
      queryOne: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('FROM player_profiles WHERE user_id = $1')) {
          if (sql.includes('FOR UPDATE')) return { ...row };
          return { user_id: params[0], ...row, xp: row.xp, level: 1 };
        }
        if (sql.includes('FROM game_config')) return null;
        return null;
      }),
      queryMany: jest.fn(async () => []),
      transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) =>
        fn({
          query: async (sql: string, params: unknown[]) => {
            // Track UPDATEs that mutate the profile row so assertions can
            // verify token consumption and key assignment.
            if (sql.startsWith('UPDATE player_profiles') && sql.includes('respec_tokens = respec_tokens - 1')) {
              row.respec_tokens -= 1;
            }
            if (sql.startsWith('UPDATE player_profiles') && sql.includes('SET character_key')) {
              row.character_key = params[0] as string;
            }
            return {};
          },
        }),
      ),
    };
  }

  function makeService(db: ReturnType<typeof makeDb>) {
    return new PlayerService(db as never);
  }

  it('lets a fresh player pick any archetype for free', async () => {
    const db = makeDb({});
    const svc = makeService(db);
    const profile = await svc.selectCharacter('u1', 'lorekeeper');
    expect(profile.characterKey).toBe('lorekeeper');
    expect(profile.respecTokens).toBe(0);
  });

  it('rejects an unknown archetype', async () => {
    const svc = makeService(makeDb({}));
    await expect(svc.selectCharacter('u1', 'time_wizard')).toThrow(/Unknown character/);
  });

  it('rejects re-selection without a respec token', async () => {
    const svc = makeService(makeDb({ characterKey: 'lorekeeper' }));
    await expect(svc.selectCharacter('u1', 'focuser')).toThrow(/Respec tokens are granted at level/);
  });

  it('consumes a respec token when switching archetypes', async () => {
    const db = makeDb({ characterKey: 'lorekeeper', respecTokens: 1 });
    const svc = makeService(db);
    const profile = await svc.selectCharacter('u1', 'warden');
    expect(profile.characterKey).toBe('warden');
    expect(db.row.respec_tokens).toBe(0);
  });

  it('refuses picking the same archetype twice even with a token', async () => {
    const svc = makeService(makeDb({ characterKey: 'duelist', respecTokens: 3 }));
    await expect(svc.selectCharacter('u1', 'duelist')).toThrow(/already your archetype/);
  });

  it('lists all archetypes with selection state', async () => {
    const svc = makeService(makeDb({ characterKey: 'solver' }));
    const list = await svc.listCharacters('u1');
    expect(list).toHaveLength(CHARACTERS.length);
    expect(list.find((c) => c.key === 'solver')?.selected).toBe(true);
    expect(list.every((c) => c.canSelect === false)).toBe(true); // no tokens yet
  });
});

describe('PlayerService.addXp — archetype bonuses + respec grant', () => {
  function makeTxDb(row: { characterKey: string | null; xp: number; respecTokens: number }) {
    const state = { ...row };
    return {
      state,
      query: jest.fn(),
      queryOne: jest.fn(async (sql: string) => {
        if (sql.includes('FROM player_profiles') && !sql.includes('FOR UPDATE')) {
          return { character_key: state.characterKey };
        }
        if (sql.includes('FROM game_config') && sql.includes('rpg.levels')) return null;
        return null;
      }),
      transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) =>
        fn({
          query: async (sql: string, params: unknown[]) => {
            if (sql.includes('SELECT xp, respec_tokens FROM player_profiles')) {
              return { rows: [{ xp: state.xp, respec_tokens: state.respecTokens }] };
            }
            if (sql.includes('UPDATE player_profiles SET xp')) {
              state.xp = Number(params[0]);
            }
            if (sql.includes('respec_tokens + 1')) {
              state.respecTokens += 1;
            }
            return {};
          },
        }),
      ),
    };
  }

  function thresholdsFor(level: number): number[] {
    // Build a threshold list reaching `level` with DEFAULT curve semantics:
    // levelFromXp expects cumulative thresholds; reuse the default config.
    void level;
    return DEFAULT_LEVEL_CONFIG.thresholds;
  }

  it('applies the Lorekeeper bonus inside addXp and records the boosted value', async () => {
    const db = makeTxDb({ characterKey: 'lorekeeper', xp: 0, respecTokens: 0 });
    const svc = new PlayerService(db as never);
    const gain = await svc.addXp('u1', 40, 'quiz_attempt');
    expect(gain.amount).toBe(42); // +5% floored
    expect(gain.totalXp).toBe(42);
  });

  it('grants exactly one respec token on first crossing the token level', async () => {
    // Choose XP just above the level-10 threshold on the default curve.
    const thresholds = thresholdsFor(10);
    const lvl10Threshold = thresholds[Math.min(RESPEC_TOKEN_LEVEL - 1, thresholds.length - 1)];
    const before = Number(lvl10Threshold) - 5;
    const after = Number(lvl10Threshold) + 500;

    const db = makeTxDb({ characterKey: null, xp: before, respecTokens: 0 });
    const svc = new PlayerService(db as never);
    const gain = await svc.addXp('u1', after - before, 'quest_reward');
    expect(gain.leveledUp).toBe(true);
    expect(gain.respecGranted).toBe(true);
    expect(db.state.respecTokens).toBe(1);

    // A second gain past the threshold must not grant another token.
    const second = await svc.addXp('u1', 10, 'quest_reward');
    expect(second.respecGranted ?? false).toBe(false);
    expect(db.state.respecTokens).toBe(1);
  });
});
