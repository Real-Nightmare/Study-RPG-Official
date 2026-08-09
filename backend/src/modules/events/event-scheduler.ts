/**
 * Event scheduler (§25). One event must ALWAYS be active: events transition
 * `scheduled → active → ended` lazily, and when nothing is live and nothing
 * is scheduled next, a safe **Study Sprint** fallback event is activated.
 * Pure decision logic — the service layer owns the advisory lock.
 */

export type EventStatus = 'scheduled' | 'active' | 'ended';

export interface SchedulableEvent {
  id: string;
  slug: string;
  kind: string;
  status: EventStatus;
  startsAt: Date;
  endsAt: Date;
  graceHours: number;
  claimDeadline: Date;
}

/** The status an event should have right now (ends only after claim deadline). */
export function nextStatusFor(event: Pick<SchedulableEvent, 'status' | 'startsAt' | 'claimDeadline'>, now: Date): EventStatus {
  if (now >= event.claimDeadline) return 'ended';
  if (now >= event.startsAt) return 'active';
  return 'scheduled';
}

/** Whether `now` falls inside the event's playable window (start → claim deadline). */
export function isActiveWindow(event: Pick<SchedulableEvent, 'startsAt' | 'claimDeadline'>, now: Date): boolean {
  return now >= event.startsAt && now < event.claimDeadline;
}

/**
 * True when no event is currently live AND no future event is scheduled — in
 * which case the Study Sprint fallback must be created.
 */
export function needsFallback(events: SchedulableEvent[], now: Date): boolean {
  const active = events.find((e) => isActiveWindow(e, now) && e.status !== 'ended');
  if (active) return false;
  const upcoming = events.find((e) => e.startsAt > now && e.status !== 'ended');
  return !upcoming;
}

/** Claims the advisory lock key used to guard fallback creation (§25). */
export const EVENT_ADVISORY_LOCK_KEY = 724010;
