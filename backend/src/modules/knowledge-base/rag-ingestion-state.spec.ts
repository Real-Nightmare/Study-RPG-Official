import {
  RAG_INGESTION_STATES,
  TERMINAL_STATES,
  PIPELINE_STATES,
  isValidIngestionState,
  transition,
  progressOf,
  buildRetryHistory,
  RetryRecord,
} from './rag-ingestion-state';

describe('RagIngestionState', () => {
  it('exposes the full state list from §8.3', () => {
    expect(RAG_INGESTION_STATES).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });

  it('validates state strings', () => {
    expect(isValidIngestionState('parsing')).toBe(true);
    expect(isValidIngestionState('ready')).toBe(true);
    expect(isValidIngestionState('bogus')).toBe(false);
  });

  describe('transition', () => {
    it('follows the happy path to ready', () => {
      const path = [
        'uploaded',
        'queued',
        'parsing',
        'parsed',
        'chunking',
        'embedding',
        'indexing',
        'ready',
      ] as const;
      for (let i = 0; i < path.length - 1; i++) {
        const result = transition(path[i], path[i + 1]);
        expect(result.ok).toBe(true);
        expect(result.state).toBe(path[i + 1]);
      }
    });

    it('rejects illegal transitions', () => {
      expect(transition('uploaded', 'ready').ok).toBe(false);
      expect(transition('queued', 'deleted').ok).toBe(false);
      expect(transition('ready', 'parsing').ok).toBe(false);
      expect(transition('deleted', 'uploaded').ok).toBe(false);
    });

    it('allows retry from failed back into the pipeline', () => {
      expect(transition('failed', 'queued').ok).toBe(true);
      expect(transition('failed', 'parsing').ok).toBe(true);
    });

    it('allows deletion only from ready or partially_ready', () => {
      expect(transition('ready', 'deleting').ok).toBe(true);
      expect(transition('partially_ready', 'deleting').ok).toBe(true);
      expect(transition('parsing', 'deleting').ok).toBe(false);
    });

    it('treats identical states as a no-op success', () => {
      expect(transition('ready', 'ready')).toEqual({ ok: true, state: 'ready' });
    });

    it('returns a reason on failure', () => {
      const result = transition('queued', 'deleted');
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });
  });

  it('defines terminal and failure states', () => {
    expect(TERMINAL_STATES).toEqual(
      expect.arrayContaining(['ready', 'partially_ready', 'rejected', 'deleted']),
    );
    expect(PIPELINE_STATES).toContain('embedding');
  });

  describe('progressOf', () => {
    it('monotonically increases through the pipeline', () => {
      const values = PIPELINE_STATES.map((s) => progressOf(s));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });

    it('reports 1 for ready and 0 for failed', () => {
      expect(progressOf('ready')).toBe(1);
      expect(progressOf('partially_ready')).toBe(1);
      expect(progressOf('failed')).toBe(0);
    });
  });

  describe('buildRetryHistory', () => {
    it('appends records and caps the history', () => {
      let history: RetryRecord[] = [];
      for (let i = 0; i < 25; i++) {
        history = buildRetryHistory(history, {
          at: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
          from: 'failed',
          reason: `attempt ${i}`,
        });
      }
      expect(history).toHaveLength(20);
      expect(history[19].reason).toBe('attempt 24');
    });
  });
});
