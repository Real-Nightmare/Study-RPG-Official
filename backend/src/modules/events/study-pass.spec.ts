import { buildStudyPassView, claimableLevels, levelForExp } from './study-pass';

const THRESHOLDS = [0, 100, 200, 300, 400, 550, 700, 900, 1100, 1300, 1450, 1550, 1650, 1750];

describe('study-pass (§26)', () => {
  it('maps event EXP to the 14 levels', () => {
    expect(THRESHOLDS).toHaveLength(14);
    expect(levelForExp(0, THRESHOLDS)).toBe(0);
    expect(levelForExp(99, THRESHOLDS)).toBe(0);
    expect(levelForExp(100, THRESHOLDS)).toBe(1);
    expect(levelForExp(400, THRESHOLDS)).toBe(4);
    expect(levelForExp(1749, THRESHOLDS)).toBe(12);
    expect(levelForExp(1750, THRESHOLDS)).toBe(13);
    expect(levelForExp(100000, THRESHOLDS)).toBe(13);
  });

  it('reports only reached and unclaimed levels', () => {
    expect(claimableLevels(250, THRESHOLDS, [])).toEqual([0, 1, 2]);
    expect(claimableLevels(250, THRESHOLDS, [0])).toEqual([1, 2]);
    expect(claimableLevels(250, THRESHOLDS, [0, 1, 2])).toEqual([]);
    // Level 3 (300 EXP) is not reached at 250 EXP.
    expect(claimableLevels(250, THRESHOLDS, [0, 1, 2])).not.toContain(3);
  });

  it('maxes out at level 14 (index 13) only at 1750 EXP', () => {
    const view = buildStudyPassView(1750, THRESHOLDS, []);
    expect(view.level).toBe(13);
    expect(view.maxed).toBe(true);
    expect(view.nextThreshold).toBeNull();
    expect(view.claimableLevels).toHaveLength(14);
    expect(view.levelProgressPct).toBe(100);
  });

  it('computes progress into the next level', () => {
    const view = buildStudyPassView(150, THRESHOLDS, []);
    expect(view.level).toBe(1);
    expect(view.currentThreshold).toBe(100);
    expect(view.nextThreshold).toBe(200);
    expect(view.levelProgressPct).toBe(50);
  });
});
