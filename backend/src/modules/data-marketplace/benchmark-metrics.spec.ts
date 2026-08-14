import {
  buildEffectivenessReport,
  computeDeltas,
  effectivenessBand,
  effectivenessScore,
  mean,
  metricDelta,
  pct,
} from './benchmark-metrics';

describe('benchmark-metrics', () => {
  describe('metricDelta', () => {
    it('computes relative change', () => {
      expect(metricDelta(100, 150)).toBeCloseTo(0.5);
      expect(metricDelta(100, 90)).toBeCloseTo(-0.1);
    });

    it('clamps to [-1, 3]', () => {
      expect(metricDelta(10, -40)).toBe(-1);
      expect(metricDelta(10, 100)).toBe(3);
    });

    it('handles zero baselines without NaN', () => {
      expect(metricDelta(0, 0)).toBe(0);
      expect(metricDelta(0, 50)).toBe(0.5);
    });
  });

  describe('computeDeltas', () => {
    it('marks improvements and regressions', () => {
      const before = {
        activeUsers: 10,
        focusMinutes: 100,
        quizAccuracyPct: 50,
        examScorePct: 60,
        teachBackDepth: 40,
        campfireDepth: 30,
        stpEarned: 100,
        avgStudyStreak: 2,
      };
      const after = {
        activeUsers: 20,
        focusMinutes: 200,
        quizAccuracyPct: 65,
        examScorePct: 58,
        teachBackDepth: 55,
        campfireDepth: 45,
        stpEarned: 150,
        avgStudyStreak: 3,
      };
      const deltas = computeDeltas(before, after);
      const improved = deltas.filter((d) => d.improved);
      expect(improved.length).toBe(6); // everything except exam score improved
      const exam = deltas.find((d) => d.key === 'examScorePct')!;
      expect(exam.improved).toBe(false);
    });
  });

  describe('effectivenessScore + band', () => {
    const before = {
      activeUsers: 10,
      focusMinutes: 100,
      quizAccuracyPct: 50,
      examScorePct: 60,
      teachBackDepth: 40,
      campfireDepth: 30,
      stpEarned: 100,
      avgStudyStreak: 2,
    };
    const after = {
      activeUsers: 20,
      focusMinutes: 250, // +150%
      quizAccuracyPct: 90, // +80%
      examScorePct: 85, // +41%
      teachBackDepth: 80, // +100%
      campfireDepth: 70, // +133%
      stpEarned: 220, // +120%
      avgStudyStreak: 4,
    };

    it('scores dramatic improvement as transformative', () => {
      const deltas = computeDeltas(before, after);
      const score = effectivenessScore(deltas);
      // Accuracy 50%→90%, exam 60%→85%, +150% focus etc. → ~93/100.
      expect(score).toBeGreaterThanOrEqual(70);
      expect(effectivenessBand(score)).toBe('transformative');
    });

    it('returns 0 for no weighted movement', () => {
      const deltas = computeDeltas(before, before);
      expect(effectivenessScore(deltas)).toBe(0);
    });

    it('maps bands', () => {
      expect(effectivenessBand(80)).toBe('transformative');
      expect(effectivenessBand(60)).toBe('strong');
      expect(effectivenessBand(40)).toBe('moderate');
      expect(effectivenessBand(20)).toBe('neutral');
      expect(effectivenessBand(5)).toBe('negative');
    });
  });

  describe('buildEffectivenessReport', () => {
    it('produces a grounded summary listing improved metrics', () => {
      const before = {
        activeUsers: 10,
        focusMinutes: 100,
        quizAccuracyPct: 50,
        examScorePct: 60,
        teachBackDepth: 40,
        campfireDepth: 30,
        stpEarned: 100,
        avgStudyStreak: 2,
      };
      const after = {
        ...before,
        quizAccuracyPct: 80,
        focusMinutes: 160,
      };
      const report = buildEffectivenessReport(before, after);
      expect(report.summary).toContain('Improved on');
      expect(report.summary).toContain('Quiz accuracy');
      expect(report.deltas.length).toBe(7);
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    });

    it('handles an all-equal comparison', () => {
      const before = {
        activeUsers: 5,
        focusMinutes: 50,
        quizAccuracyPct: 60,
        examScorePct: 70,
        teachBackDepth: 50,
        campfireDepth: 40,
        stpEarned: 20,
        avgStudyStreak: 1,
      };
      const report = buildEffectivenessReport(before, { ...before });
      expect(report.summary).toMatch(/No material change/);
      expect(report.band).toBe('neutral');
    });
  });

  describe('helpers', () => {
    it('mean guards empty sets', () => {
      expect(mean([])).toBe(0);
      expect(mean([1, 2, 3])).toBe(2);
    });

    it('pct guards zero denominators', () => {
      expect(pct(3, 0)).toBe(0);
      expect(pct(3, 4)).toBe(75);
    });
  });
});
