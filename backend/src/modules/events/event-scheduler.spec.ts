import { isActiveWindow, needsFallback, nextStatusFor, SchedulableEvent } from './event-scheduler';

function event(overrides: Partial<SchedulableEvent> = {}): SchedulableEvent {
  return {
    id: 'e1',
    slug: 'test',
    kind: 'normal',
    status: 'scheduled',
    startsAt: new Date('2026-08-01T00:00:00Z'),
    endsAt: new Date('2026-08-10T00:00:00Z'),
    graceHours: 48,
    claimDeadline: new Date('2026-08-12T00:00:00Z'),
    ...overrides,
  };
}

describe('event-scheduler (§25)', () => {
  it('transitions scheduled → active → ended lazily', () => {
    const ev = event();
    expect(nextStatusFor(ev, new Date('2026-07-31T00:00:00Z'))).toBe('scheduled');
    expect(nextStatusFor(ev, new Date('2026-08-01T00:00:00Z'))).toBe('active');
    // Within the grace window after end: still active for claiming.
    expect(nextStatusFor(ev, new Date('2026-08-11T00:00:00Z'))).toBe('active');
    // Past the claim deadline: ended.
    expect(nextStatusFor(ev, new Date('2026-08-12T00:00:00Z'))).toBe('ended');
  });

  it('detects the active window', () => {
    const ev = event();
    expect(isActiveWindow(ev, new Date('2026-07-31T00:00:00Z'))).toBe(false);
    expect(isActiveWindow(ev, new Date('2026-08-05T00:00:00Z'))).toBe(true);
    expect(isActiveWindow(ev, new Date('2026-08-12T00:00:00Z'))).toBe(false);
  });

  it('never needs a fallback while an event is live or scheduled next', () => {
    const now = new Date('2026-08-05T00:00:00Z');
    expect(needsFallback([event({ status: 'active' })], now)).toBe(false);
    expect(
      needsFallback(
        [
          event({ status: 'ended', claimDeadline: new Date('2026-08-01T00:00:00Z') }),
          event({ id: 'e2', slug: 'next', startsAt: new Date('2026-08-20T00:00:00Z') }),
        ],
        now,
      ),
    ).toBe(false);
  });

  it('requires a fallback only when nothing is live and nothing is scheduled', () => {
    const now = new Date('2026-08-05T00:00:00Z');
    expect(needsFallback([], now)).toBe(true);
    expect(
      needsFallback(
        [event({ status: 'ended', claimDeadline: new Date('2026-08-01T00:00:00Z') })],
        now,
      ),
    ).toBe(true);
  });
});
