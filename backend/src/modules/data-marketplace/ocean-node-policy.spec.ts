import { decideNodeAction, NodePolicyInput, updateIdleSince } from './ocean-node-policy';

const MIN = 60_000;
const base = {
  idleWindowMs: 10 * MIN,
  cooldownMs: 60 * MIN,
};

function input(overrides: Partial<NodePolicyInput>): NodePolicyInput {
  return { ...base, activity: false, nodeRunning: false, idleSinceMs: null, stoppedAtMs: null, now: 1_000_000, ...overrides };
}

describe('updateIdleSince', () => {
  it('resets to null while there is activity', () => {
    expect(updateIdleSince(500, true, 700)).toBeNull();
    expect(updateIdleSince(null, true, 700)).toBeNull();
  });

  it('starts the idle streak when activity first stops', () => {
    expect(updateIdleSince(null, false, 700)).toBe(700);
  });

  it('keeps the original streak start while idle continues', () => {
    expect(updateIdleSince(500, false, 700)).toBe(500);
  });
});

describe('decideNodeAction', () => {
  it('stops a running node the moment any activity appears', () => {
    expect(decideNodeAction(input({ activity: true, nodeRunning: true }))).toBe('stop');
  });

  it('keeps a running node running while idle', () => {
    expect(decideNodeAction(input({ nodeRunning: true, idleSinceMs: 100 }))).toBe('none');
  });

  it('does nothing with activity and no node', () => {
    expect(decideNodeAction(input({ activity: true, nodeRunning: false }))).toBe('none');
  });

  it('does not start before the idle window elapses', () => {
    const now = 1_000_000;
    expect(
      decideNodeAction(input({ idleSinceMs: now - 9 * MIN, now })),
    ).toBe('none');
    // Idle streak just began this tick
    expect(decideNodeAction(input({ idleSinceMs: now, now }))).toBe('none');
  });

  it('starts once the idle window has elapsed and there is no cooldown', () => {
    const now = 1_000_000;
    expect(decideNodeAction(input({ idleSinceMs: now - 10 * MIN, now }))).toBe('start');
    expect(
      decideNodeAction(input({ idleSinceMs: now - 30 * MIN, now, stoppedAtMs: null })),
    ).toBe('start');
  });

  it('respects the post-stop cooldown', () => {
    const now = 1_000_000;
    const stoppedAtMs = now - 10 * MIN;
    expect(
      decideNodeAction(input({ idleSinceMs: now - 30 * MIN, now, stoppedAtMs })),
    ).toBe('none');
  });

  it('starts again after the cooldown has elapsed', () => {
    const now = 1_000_000;
    const stoppedAtMs = now - 60 * MIN;
    expect(
      decideNodeAction(input({ idleSinceMs: now - 30 * MIN, now, stoppedAtMs })),
    ).toBe('start');
  });

  it('treats a never-started node as not in cooldown', () => {
    const now = 1_000_000;
    expect(
      decideNodeAction(input({ idleSinceMs: now - 11 * MIN, now, stoppedAtMs: null })),
    ).toBe('start');
  });
});
