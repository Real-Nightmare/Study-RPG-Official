import { levelFromXp } from './level-curve';

const THRESHOLDS = [0, 100, 300, 600, 1000];

describe('levelFromXp', () => {
  it('starts at level 1 with zero XP', () => {
    const info = levelFromXp(0, THRESHOLDS);
    expect(info.level).toBe(1);
    expect(info.currentLevelXp).toBe(0);
    expect(info.nextLevelXp).toBe(100);
  });

  it('levels up at each threshold boundary', () => {
    expect(levelFromXp(99, THRESHOLDS).level).toBe(1);
    expect(levelFromXp(100, THRESHOLDS).level).toBe(2);
    expect(levelFromXp(300, THRESHOLDS).level).toBe(3);
    expect(levelFromXp(600, THRESHOLDS).level).toBe(4);
    expect(levelFromXp(1000, THRESHOLDS).level).toBe(5);
  });

  it('caps at max level beyond the last threshold', () => {
    const info = levelFromXp(999999, THRESHOLDS);
    expect(info.level).toBe(5);
    expect(info.currentLevelXp).toBe(1000);
  });

  it('handles unsorted thresholds', () => {
    // 250 sits between threshold 100 (level 2) and 300 (level 3).
    const info = levelFromXp(250, [1000, 0, 100, 300, 600]);
    expect(info.level).toBe(2);
  });
});
