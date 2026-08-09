/**
 * Unit tests for the anti-overstudy / health-first rules (spec 015).
 */
import {
  overStudyFactor,
  restRequired,
  minutesUntilRestAllowed,
  isNightHour,
  istHour,
  studyHealth,
  dailyBudgetRemaining,
} from './overstudy';

describe('overStudyFactor', () => {
  it('returns 1.0 up to the healthy optimum / decay start', () => {
    expect(overStudyFactor(0)).toBe(1);
    expect(overStudyFactor(60)).toBe(1);
    expect(overStudyFactor(120)).toBe(1);
  });

  it('decays linearly between decayStart and the hard cap', () => {
    // 180 of [120, 240] → t=0.5 → 1 - 0.5*0.9 = 0.55
    expect(overStudyFactor(180)).toBeCloseTo(0.55, 3);
  });

  it('floors at minFactor once the hard cap is reached', () => {
    expect(overStudyFactor(240)).toBe(0.1);
    expect(overStudyFactor(999)).toBe(0.1);
  });

  it('honours custom options', () => {
    expect(overStudyFactor(100, { decayStartMinutes: 50, hardDailyCapMinutes: 100, minFactor: 0.2 })).toBe(0.2);
    // 60 of [50, 100] → t=0.2 → 1 - 0.2*0.8 = 0.84
    expect(overStudyFactor(60, { decayStartMinutes: 50, hardDailyCapMinutes: 100, minFactor: 0.2 })).toBeCloseTo(0.84, 3);
  });

  it('never exceeds 1 or goes below the floor', () => {
    expect(overStudyFactor(-5)).toBe(1);
    expect(overStudyFactor(0, { minFactor: 0.5 })).toBe(1);
  });
});

describe('restRequired', () => {
  const now = new Date('2026-08-07T12:00:00Z');

  it('returns false with no previous completed session', () => {
    expect(restRequired(null, now)).toBe(false);
  });

  it('never forces rest after a short session', () => {
    expect(
      restRequired({ endedAt: new Date(now.getTime() - 2 * 60 * 1000), minutes: 25 }, now),
    ).toBe(false);
  });

  it('returns true when a long session ended inside the cooldown window', () => {
    expect(
      restRequired({ endedAt: new Date(now.getTime() - 5 * 60 * 1000), minutes: 75 }, now),
    ).toBe(true);
  });

  it('returns false once the cooldown window has passed', () => {
    expect(
      restRequired({ endedAt: new Date(now.getTime() - 30 * 60 * 1000), minutes: 75 }, now),
    ).toBe(false);
  });

  it('honours custom cooldown windows', () => {
    expect(
      restRequired(
        { endedAt: new Date(now.getTime() - 10 * 60 * 1000), minutes: 90 },
        now,
        { sessionCooldownMinutes: 15, cooldownAfterMinutes: 60 },
      ),
    ).toBe(true);
  });
});

describe('minutesUntilRestAllowed', () => {
  it('returns 0 when no cooldown applies', () => {
    expect(minutesUntilRestAllowed(null, new Date(), 20)).toBe(0);
  });

  it('reports the remaining rest minutes', () => {
    const now = new Date('2026-08-07T12:00:00Z');
    const ended = new Date(now.getTime() - 5 * 60 * 1000);
    expect(minutesUntilRestAllowed(ended, now, 20)).toBe(15);
  });

  it('clamps at 0 when the window already passed', () => {
    const now = new Date('2026-08-07T12:00:00Z');
    const ended = new Date(now.getTime() - 30 * 60 * 1000);
    expect(minutesUntilRestAllowed(ended, now, 20)).toBe(0);
  });
});

describe('isNightHour', () => {
  it('detects a night window that wraps past midnight (22 → 6)', () => {
    expect(isNightHour(22)).toBe(true);
    expect(isNightHour(23)).toBe(true);
    expect(isNightHour(0)).toBe(true);
    expect(isNightHour(5)).toBe(true);
    expect(isNightHour(6)).toBe(false);
    expect(isNightHour(14)).toBe(false);
  });

  it('handles non-wrapping windows', () => {
    expect(isNightHour(11, 10, 18)).toBe(true);
    expect(isNightHour(19, 10, 18)).toBe(false);
  });

  it('returns false when start equals end', () => {
    expect(isNightHour(12, 12, 12)).toBe(false);
  });
});

describe('istHour', () => {
  it('converts a UTC instant to the IST hour (UTC+5:30)', () => {
    expect(istHour(new Date('2026-01-01T00:00:00Z'))).toBe(5);
    expect(istHour(new Date('2026-08-07T17:00:00Z'))).toBe(22);
  });
});

describe('studyHealth', () => {
  it('maps minutes to the correct band', () => {
    expect(studyHealth(30)).toEqual({ percent: 25, band: 'fresh' });
    expect(studyHealth(90)).toEqual({ percent: 75, band: 'focused' });
    expect(studyHealth(150)).toEqual({ percent: 100, band: 'draining' });
    expect(studyHealth(240)).toEqual({ percent: 100, band: 'depleted' });
  });

  it('clamps the percent at 100', () => {
    expect(studyHealth(400).percent).toBe(100);
  });
});

describe('dailyBudgetRemaining', () => {
  it('returns the healthy minutes left before the hard cap', () => {
    expect(dailyBudgetRemaining(90, 240)).toBe(150);
    expect(dailyBudgetRemaining(240, 240)).toBe(0);
    expect(dailyBudgetRemaining(300, 240)).toBe(0);
  });
});
