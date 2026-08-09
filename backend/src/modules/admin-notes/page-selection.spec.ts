import {
  defaultAllPages,
  filterPagesBySelection,
  isPageSelected,
  normalizeSelectedPages,
} from './page-selection';

describe('page-selection', () => {
  describe('normalizeSelectedPages', () => {
    it('keeps valid single pages in range', () => {
      expect(normalizeSelectedPages([1, 3, 5], 10)).toEqual([1, 3, 5]);
    });

    it('supports ranges [[1,3],[7,9]]', () => {
      expect(
        normalizeSelectedPages(
          [
            [1, 3],
            [7, 9],
          ],
          10,
        ),
      ).toEqual([1, 2, 3, 7, 8, 9]);
    });

    it('drops out-of-range and invalid entries', () => {
      expect(normalizeSelectedPages([0, 4, 99, 'x'], 5)).toEqual([4]);
    });

    it('falls back to all pages when the selection is empty/invalid', () => {
      expect(normalizeSelectedPages([], 4)).toEqual([1, 2, 3, 4]);
      expect(normalizeSelectedPages([0, -1, 500], 4)).toEqual([1, 2, 3, 4]);
    });

    it('falls back to all pages for non-array input', () => {
      expect(normalizeSelectedPages('everything', 3)).toEqual([1, 2, 3]);
    });

    it('returns empty for zero-page documents', () => {
      expect(normalizeSelectedPages([1], 0)).toEqual([]);
    });
  });

  describe('defaultAllPages', () => {
    it('builds a 1-based page list', () => {
      expect(defaultAllPages(3)).toEqual([1, 2, 3]);
    });
  });

  describe('isPageSelected', () => {
    it('checks membership', () => {
      expect(isPageSelected(2, [2, 5])).toBe(true);
      expect(isPageSelected(3, [2, 5])).toBe(false);
    });
  });

  describe('filterPagesBySelection', () => {
    const pages = [
      { page: 1, text: 'Cover' },
      { page: 2, text: 'The real formula' },
      { page: 3, text: 'Email address' },
      { page: 4, text: 'More content' },
    ];

    it('returns only selected pages in order', () => {
      const result = filterPagesBySelection(pages, [2, 4]);
      expect(result).toContain('The real formula');
      expect(result).toContain('More content');
      expect(result).not.toContain('Email address');
      expect(result).not.toContain('Cover');
    });

    it('prevents the wrong-page quote failure (NCERT email scenario)', () => {
      // The student selects only the content page, so the AI can never quote the email page.
      const result = filterPagesBySelection(pages, [2]);
      expect(result).toBe('The real formula');
    });
  });
});
