import {
  applyPuzzleAttempt,
  dailyRankedLimitReached,
  pickNextRankedPuzzle,
  PuzzleStreakState,
} from './puzzle-streak';

const base: PuzzleStreakState = {
  streak: 0,
  personalBest: 0,
  dailyRankedCount: 0,
  lastRankedDay: null,
  lastRankedPuzzleId: null,
};

describe('applyPuzzleAttempt', () => {
  it('increases the streak on a correct ranked answer', () => {
    const result = applyPuzzleAttempt({
      state: { ...base, streak: 2, personalBest: 2 },
      correct: true,
      mode: 'ranked',
      shielded: false,
      today: '2026-08-05',
    });
    expect(result.streak).toBe(3);
    expect(result.personalBest).toBe(3);
    expect(result.reset).toBe(false);
  });

  it('resets the streak on an incorrect ranked answer without shield', () => {
    const result = applyPuzzleAttempt({
      state: { ...base, streak: 4, personalBest: 5 },
      correct: false,
      mode: 'ranked',
      shielded: false,
      today: '2026-08-05',
    });
    expect(result.streak).toBe(0);
    expect(result.reset).toBe(true);
    expect(result.personalBest).toBe(5); // best is preserved
  });

  it('preserves the streak with a valid shield on an incorrect answer', () => {
    const result = applyPuzzleAttempt({
      state: { ...base, streak: 3, personalBest: 3 },
      correct: false,
      mode: 'ranked',
      shielded: true,
      today: '2026-08-05',
    });
    expect(result.streak).toBe(3);
    expect(result.reset).toBe(false);
  });

  it('practice attempts never touch the ranked streak', () => {
    const result = applyPuzzleAttempt({
      state: { ...base, streak: 7, dailyRankedCount: 2, lastRankedDay: '2026-08-05' },
      correct: false,
      mode: 'practice',
      shielded: false,
      today: '2026-08-05',
    });
    expect(result.streak).toBe(7);
    expect(result.dailyRankedCount).toBe(2);
  });

  it('resets the daily ranked counter when the day changes', () => {
    const result = applyPuzzleAttempt({
      state: { ...base, streak: 1, dailyRankedCount: 9, lastRankedDay: '2026-08-04' },
      correct: true,
      mode: 'ranked',
      shielded: false,
      today: '2026-08-05',
    });
    expect(result.dailyRankedCount).toBe(1);
    expect(result.lastRankedDay).toBe('2026-08-05');
  });
});

describe('dailyRankedLimitReached', () => {
  it('is false on a fresh day', () => {
    expect(
      dailyRankedLimitReached(
        { ...base, lastRankedDay: '2026-08-04', dailyRankedCount: 10 },
        '2026-08-05',
      ),
    ).toBe(false);
  });

  it('is true when the limit is hit on the same day', () => {
    expect(
      dailyRankedLimitReached(
        { ...base, lastRankedDay: '2026-08-05', dailyRankedCount: 10 },
        '2026-08-05',
      ),
    ).toBe(true);
  });
});

describe('pickNextRankedPuzzle', () => {
  it('never picks the last ranked puzzle when alternatives exist', () => {
    const pick = pickNextRankedPuzzle([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'a');
    expect(pick).not.toBeNull();
    expect(pick!.id).not.toBe('a');
  });

  it('returns null when the only puzzle was just ranked', () => {
    expect(pickNextRankedPuzzle([{ id: 'a' }], 'a')).toBeNull();
  });

  it('picks when there is no previous ranked puzzle', () => {
    const pick = pickNextRankedPuzzle([{ id: 'a' }], null);
    expect(pick!.id).toBe('a');
  });
});
