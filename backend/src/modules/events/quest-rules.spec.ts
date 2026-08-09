import { capProgress, isoWeekKey, istDayKey, periodKeyFor, progressDelta } from './quest-rules';

describe('quest-rules (§30)', () => {
  it('computes IST calendar day keys (UTC+05:30)', () => {
    // 18:00 UTC = 23:30 IST same day
    expect(istDayKey(new Date('2026-08-06T18:00:00Z'))).toBe('2026-08-06');
    // 19:00 UTC = 00:30 IST next day
    expect(istDayKey(new Date('2026-08-06T19:00:00Z'))).toBe('2026-08-07');
  });

  it('computes ISO week keys with Monday starts', () => {
    // Monday 2026-08-03 and Sunday 2026-08-09 share a week; previous Sunday differs.
    const monday = isoWeekKey(new Date('2026-08-03T12:00:00Z'));
    const sunday = isoWeekKey(new Date('2026-08-09T12:00:00Z'));
    const prevSunday = isoWeekKey(new Date('2026-08-02T12:00:00Z'));
    expect(monday).toMatch(/^\d{4}-W\d{2}$/);
    expect(monday).toBe(sunday);
    expect(monday).not.toBe(prevSunday);
  });

  it('maps quest periods to period keys', () => {
    const now = new Date('2026-08-06T12:00:00Z');
    expect(periodKeyFor('daily', now)).toBe(istDayKey(now));
    expect(periodKeyFor('weekly', now)).toBe(isoWeekKey(now));
    expect(periodKeyFor('none', now)).toBe('');
  });

  it('only progresses matching study-activity objectives', () => {
    const objective = { type: 'study_activity', activityType: 'task_completed', target: 3 };
    expect(progressDelta(objective, 'task_completed', 1)).toBe(1);
    expect(progressDelta(objective, 'task_completed', 4)).toBe(4);
    expect(progressDelta(objective, 'quiz_attempt', 1)).toBe(0);
    expect(progressDelta({ type: 'burn_targets', target: 2 }, 'task_completed', 1)).toBe(0);
  });

  it('caps progress at the objective target', () => {
    expect(capProgress(5, 3)).toBe(3);
    expect(capProgress(1, 3)).toBe(1);
    expect(capProgress(-2, 3)).toBe(0);
  });
});
