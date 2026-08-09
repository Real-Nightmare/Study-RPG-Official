/**
 * RAG ingestion state machine (master prompt §8.3).
 *
 * Explicit, persisted states for every document going through the RAG
 * pipeline so users can see ingestion progress and failures can be retried
 * without losing history.
 */

export const RAG_INGESTION_STATES = [
  'uploaded',
  'validating',
  'rejected',
  'queued',
  'parsing',
  'parsed',
  'chunking',
  'embedding',
  'indexing',
  'ready',
  'partially_ready',
  'failed',
  'deleting',
  'deleted',
] as const;

export type RagIngestionState = (typeof RAG_INGESTION_STATES)[number];

/**
 * Allowed forward transitions. Terminal states are `ready`, `partially_ready`,
 * `rejected`, `failed` and `deleted` (plus `deleting` → `deleted`).
 * `failed` may transition back into the pipeline through an explicit retry,
 * and `ready`/`partially_ready` may enter the deletion pipeline.
 */
const TRANSITIONS: Record<RagIngestionState, readonly RagIngestionState[]> = {
  uploaded: ['validating', 'queued', 'rejected', 'failed'],
  validating: ['queued', 'parsing', 'rejected', 'failed'],
  rejected: ['uploaded', 'failed'],
  queued: ['parsing', 'failed'],
  parsing: ['parsed', 'failed'],
  parsed: ['chunking', 'failed'],
  chunking: ['embedding', 'failed'],
  embedding: ['indexing', 'failed'],
  indexing: ['ready', 'partially_ready', 'failed'],
  ready: ['deleting'],
  partially_ready: ['deleting', 'failed'],
  failed: ['uploaded', 'queued', 'parsing', 'failed'],
  deleting: ['deleted', 'failed'],
  deleted: [],
};

/** Terminal states — ingestion for this document has concluded. */
export const TERMINAL_STATES: readonly RagIngestionState[] = [
  'ready',
  'partially_ready',
  'rejected',
  'deleted',
];

export const FAILURE_STATES: readonly RagIngestionState[] = ['failed', 'rejected'];

/** Steps that represent active pipeline work (for progress reporting). */
export const PIPELINE_STATES: readonly RagIngestionState[] = [
  'validating',
  'parsing',
  'chunking',
  'embedding',
  'indexing',
];

export function isValidIngestionState(value: string): value is RagIngestionState {
  return (RAG_INGESTION_STATES as readonly string[]).includes(value);
}

export function canTransition(from: RagIngestionState, to: RagIngestionState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export interface TransitionResult {
  ok: boolean;
  state: RagIngestionState;
  reason?: string;
}

export function transition(from: RagIngestionState, to: RagIngestionState): TransitionResult {
  if (from === to) {
    return { ok: true, state: from };
  }
  if (!canTransition(from, to)) {
    return {
      ok: false,
      state: from,
      reason: `Cannot transition from '${from}' to '${to}'`,
    };
  }
  return { ok: true, state: to };
}

/** Human-readable progress 0..1 for the current pipeline step. */
export function progressOf(state: RagIngestionState): number {
  const step = PIPELINE_STATES.indexOf(state);
  if (step >= 0) {
    return (step + 1) / (PIPELINE_STATES.length + 1);
  }
  switch (state) {
    case 'uploaded':
      return 0.05;
    case 'queued':
      return 0.1;
    case 'ready':
    case 'partially_ready':
      return 1;
    case 'failed':
    case 'rejected':
    case 'deleting':
    case 'deleted':
      return 0;
    default:
      return 0;
  }
}

export interface RetryRecord {
  at: string;
  from: RagIngestionState;
  reason?: string;
}

export function buildRetryHistory(existing: RetryRecord[], record: RetryRecord): RetryRecord[] {
  return [...existing, record].slice(-20);
}
