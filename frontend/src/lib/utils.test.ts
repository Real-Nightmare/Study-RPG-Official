import { describe, it, expect } from 'vitest';
import { cn, formatDate, formatDateTime } from './utils';

describe('cn', () => {
  it('merges class names with tailwind-merge (later wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('accepts clsx conditional object syntax', () => {
    expect(cn({ active: true, hidden: false }, 'base')).toBe('active base');
  });
});

describe('formatDate', () => {
  it('formats a date string', () => {
    expect(formatDate('2026-08-04')).toBe('Aug 4, 2026');
  });

  it('formats a Date object', () => {
    expect(formatDate(new Date('2026-01-15T00:00:00Z'))).toBe('Jan 15, 2026');
  });
});

describe('formatDateTime', () => {
  it('includes the time in the output', () => {
    const out = formatDateTime(new Date('2026-08-04T14:30:00Z'));
    expect(out).toContain('2026');
    expect(out).toContain('2:30');
  });
});
