/**
 * Direct-message content moderation (PDF Phase 9 §32: no unrestricted private
 * messaging). Pure logic — no database access. Moderation is deliberately
 * conservative: exact blocked words + a link-spam heuristic (many bare links),
 * so normal study chat is never false-flagged.
 */

const BLOCKED_WORDS: string[] = [
  // Grooming / contact-sharing patterns that never belong in a student chat.
  'onlyfans',
  'nsfw',
  'porn',
  'sex now',
  'send nudes',
  'meet me at',
  'my address is',
  'your address',
  'buy drugs',
  'sell drugs',
  'kill yourself',
  'kys',
  'cut yourself',
];

const MAX_BARE_LINKS = 3;

/** Case-insensitive hits of exact blocked phrases in the body. */
export function blockedWordHits(body: string): string[] {
  const lower = (body || '').toLowerCase();
  return BLOCKED_WORDS.filter((word) => lower.includes(word));
}

/** Count of bare http(s) links in the body. */
export function countBareLinks(body: string): number {
  const matches = (body || '').match(/https?:\/\/\S+/gi);
  return matches ? matches.length : 0;
}

/** 0 = clean · 1 = spammy (too many links) · 2 = blocked (deny-list hit). */
export type ModerationSeverity = 0 | 1 | 2;

export interface ModerationVerdict {
  severity: ModerationSeverity;
  blockedWords: string[];
  linkCount: number;
  reason: string | null;
}

/** Full moderation check used by SocialService.sendMessage. */
export function moderationVerdict(body: string): ModerationVerdict {
  const blocked = blockedWordHits(body);
  if (blocked.length > 0) {
    return {
      severity: 2,
      blockedWords: blocked,
      linkCount: countBareLinks(body),
      reason: `Message contains blocked content: ${blocked.join(', ')}`,
    };
  }
  const links = countBareLinks(body);
  if (links > MAX_BARE_LINKS) {
    return {
      severity: 1,
      blockedWords: [],
      linkCount: links,
      reason: 'Message contains too many links',
    };
  }
  return { severity: 0, blockedWords: [], linkCount: links, reason: null };
}

/** Pure rate-limit check for a sliding minute window. */
export function isRateLimited(sentInWindow: number, maxPerMinute: number): boolean {
  if (!Number.isFinite(maxPerMinute) || maxPerMinute <= 0) return false;
  return sentInWindow >= maxPerMinute;
}
