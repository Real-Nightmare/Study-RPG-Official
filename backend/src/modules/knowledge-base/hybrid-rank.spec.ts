import {
  reciprocalRankFusion,
  normalizeContent,
  removeDuplicateContent,
  filterByMinScore,
  enforceSourceDiversity,
} from './hybrid-rank';

describe('HybridRank', () => {
  describe('reciprocalRankFusion', () => {
    it('boosts candidates present in both lists', () => {
      const dense = [
        { id: 'a', score: 0.9 },
        { id: 'b', score: 0.8 },
        { id: 'c', score: 0.7 },
      ];
      const lexical = [
        { id: 'b', score: 0.5 },
        { id: 'd', score: 0.4 },
      ];

      const fused = reciprocalRankFusion([dense, lexical], 60);

      expect(fused[0].id).toBe('b'); // in both lists
      expect(fused.some((c) => c.id === 'd')).toBe(true);
      expect(fused).toHaveLength(4);
    });

    it('preserves order from a single list', () => {
      const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const fused = reciprocalRankFusion([list], 60);
      expect(fused.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('handles empty lists', () => {
      expect(reciprocalRankFusion([], 60)).toEqual([]);
      expect(reciprocalRankFusion([[], []], 60)).toEqual([]);
    });
  });

  describe('removeDuplicateContent', () => {
    it('removes content duplicates regardless of whitespace/case', () => {
      const candidates = [
        { id: '1', content: 'Photosynthesis occurs in chloroplasts.' },
        { id: '2', content: '  photosynthesis   occurs in chloroplasts. ' },
        { id: '3', content: 'A completely different sentence.' },
      ];
      const result = removeDuplicateContent(candidates);
      expect(result.map((c) => c.id)).toEqual(['1', '3']);
    });

    it('keeps candidates without content', () => {
      const candidates = [{ id: 'a' }, { id: 'b' }];
      expect(removeDuplicateContent(candidates)).toHaveLength(2);
    });
  });

  describe('normalizeContent', () => {
    it('collapses whitespace and lowercases', () => {
      expect(normalizeContent('  Hello   World \n again ')).toBe('hello world again');
    });
  });

  describe('filterByMinScore', () => {
    it('filters dense candidates below the threshold', () => {
      const candidates = [
        { id: 'a', score: 0.8 },
        { id: 'b', score: 0.4 },
      ];
      expect(filterByMinScore(candidates, 0.5, 'dense').map((c) => c.id)).toEqual(['a']);
    });

    it('keeps lexical candidates when no dense score applies', () => {
      const candidates = [{ id: 'a', score: 0.1 }];
      expect(filterByMinScore(candidates, 0.5, 'lexical')).toHaveLength(1);
    });

    it('keeps everything when no threshold is set', () => {
      const candidates = [{ id: 'a', score: 0.01 }];
      expect(filterByMinScore(candidates, undefined, 'dense')).toHaveLength(1);
    });
  });

  describe('enforceSourceDiversity', () => {
    it('caps results per source document', () => {
      const candidates = [
        { id: 'a', documentId: 'doc1' },
        { id: 'b', documentId: 'doc1' },
        { id: 'c', documentId: 'doc1' },
        { id: 'd', documentId: 'doc2' },
      ];
      const result = enforceSourceDiversity(candidates, 2);
      expect(result.map((c) => c.id)).toEqual(['a', 'b', 'd']);
    });

    it('keeps everything when no cap is set', () => {
      const candidates = [{ id: 'a', documentId: 'doc1' }, { id: 'b' }];
      expect(enforceSourceDiversity(candidates, undefined)).toHaveLength(2);
    });
  });
});
