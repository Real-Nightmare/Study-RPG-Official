/**
 * Pure PDF page-selection logic (Phase 6). Users pick which pages of an
 * uploaded PDF the AI may cite — preventing wrong-page failures (e.g. the
 * "NCERT email on page 3" problem). Page numbers are 1-based.
 */

/**
 * Normalize a raw selection into a sorted, deduped, in-range list of pages.
 * Supports single pages (3) and ranges ([1,3] means pages 1..3).
 */
export function normalizeSelectedPages(input: unknown, pageCount: number): number[] {
  if (pageCount <= 0) {
    return [];
  }
  if (!Array.isArray(input)) {
    return defaultAllPages(pageCount);
  }

  const pages = new Set<number>();
  for (const item of input) {
    if (typeof item === 'number' && Number.isInteger(item) && item >= 1 && item <= pageCount) {
      pages.add(item);
      continue;
    }
    if (Array.isArray(item) && item.length === 2) {
      const [start, end] = item as [number, number];
      if (
        Number.isInteger(start) &&
        Number.isInteger(end) &&
        start >= 1 &&
        end >= start &&
        end <= pageCount
      ) {
        for (let p = start; p <= end; p++) {
          pages.add(p);
        }
      }
    }
  }

  const result = [...pages].sort((a, b) => a - b);
  // Invalid/empty selection falls back to all pages (safe default).
  return result.length > 0 ? result : defaultAllPages(pageCount);
}

export function defaultAllPages(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, i) => i + 1);
}

/** True when `page` is inside the selection (used to filter extracted text). */
export function isPageSelected(page: number, selectedPages: number[]): boolean {
  return selectedPages.includes(page);
}

/** Filter per-page text to only selected pages, joined in page order. */
export function filterPagesBySelection(
  pages: Array<{ page: number; text: string }>,
  selectedPages: number[],
): string {
  return pages
    .filter((p) => isPageSelected(p.page, selectedPages))
    .sort((a, b) => a.page - b.page)
    .map((p) => p.text)
    .join('\n\n');
}
