import {
  recallAtK,
  precisionAtK,
  f1AtK,
  percentile,
  mean,
  buildRunReport,
} from './rag-eval-metrics';

describe('RagEvalMetrics', () => {
  describe('recallAtK', () => {
    it('scores 1 when all relevant chunks are retrieved', () => {
      expect(recallAtK(['a', 'b'], ['a', 'b'])).toBe(1);
    });

    it('scores 0.5 when half the relevant chunks are retrieved', () => {
      expect(recallAtK(['a', 'c'], ['a', 'b'])).toBe(0.5);
    });

    it('returns 0 when there are no relevant chunks', () => {
      expect(recallAtK(['a'], [])).toBe(0);
    });
  });

  describe('precisionAtK', () => {
    it('divides hits by k', () => {
      expect(precisionAtK(['a', 'b', 'c'], ['a', 'd'], 5)).toBe(0.2);
    });

    it('considers only the top K retrieved', () => {
      expect(precisionAtK(['a', 'b'], ['a'], 1)).toBe(1);
    });
  });

  describe('f1AtK', () => {
    it('is the harmonic mean of recall and precision', () => {
      expect(f1AtK(1, 0.5)).toBeCloseTo(2 / 3, 5);
    });

    it('returns 0 when both are zero', () => {
      expect(f1AtK(0, 0)).toBe(0);
    });
  });

  describe('percentile / mean', () => {
    it('computes nearest-rank p95', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
      expect(percentile(values, 95)).toBe(95);
    });

    it('returns null for empty lists', () => {
      expect(percentile([], 95)).toBeNull();
      expect(mean([])).toBeNull();
    });
  });

  describe('buildRunReport', () => {
    it('aggregates metrics and counts empty cases', () => {
      const report = buildRunReport({
        k: 5,
        caseResults: [
          {
            caseId: 'c1',
            query: 'q1',
            retrievedIds: ['a', 'b'],
            relevantIds: ['a', 'b'],
            latencyMs: 10,
          },
          { caseId: 'c2', query: 'q2', retrievedIds: [], relevantIds: ['x'], latencyMs: 5 },
        ],
        leakageChunkIds: [],
      });

      expect(report.caseCount).toBe(2);
      expect(report.emptyCount).toBe(1);
      expect(report.emptyRate).toBe(0.5);
      expect(report.aggregateRecall).toBeCloseTo(0.5, 5); // (1 + 0) / 2
      expect(report.aggregateF1).toBeGreaterThan(0);
      expect(report.avgLatencyMs).toBe(7.5);
      expect(report.p95LatencyMs).toBe(10);
      expect(report.unsupportedClaimRate).toBeNull();
      expect(report.leakage).toEqual({ count: 0, chunkIds: [] });
    });

    it('reports leakage violations', () => {
      const report = buildRunReport({
        k: 5,
        caseResults: [
          { caseId: 'c1', query: 'q', retrievedIds: ['leak1'], relevantIds: [], latencyMs: 1 },
        ],
        leakageChunkIds: ['leak1'],
      });
      expect(report.leakage.count).toBe(1);
      expect(report.leakage.chunkIds).toEqual(['leak1']);
    });
  });
});
