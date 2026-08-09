import { hashText, hashBuffer, hashNormalizedText, hashChunks } from './content-hash';

describe('ContentHash', () => {
  it('produces a 64-char hex SHA-256', () => {
    const hash = hashText('hello world');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashText('same input')).toBe(hashText('same input'));
  });

  it('differs for different content', () => {
    expect(hashText('one')).not.toBe(hashText('two'));
  });

  it('hashBuffer matches hashText for the same bytes', () => {
    expect(hashBuffer(Buffer.from('abc', 'utf-8'))).toBe(hashText('abc'));
  });

  it('normalised hash ignores formatting-only differences', () => {
    expect(hashNormalizedText('Line one\n\n  Line TWO ')).toBe(
      hashNormalizedText('line one  line two'),
    );
  });

  it('hashes chunks and derives a stable document hash', () => {
    const a = hashChunks([
      { content: 'Alpha', index: 0 },
      { content: 'Beta', index: 1 },
    ]);
    const b = hashChunks([
      { content: 'Alpha', index: 0 },
      { content: 'Beta', index: 1 },
    ]);
    expect(a.documentHash).toBe(b.documentHash);
    expect(a.chunks).toHaveLength(2);
    expect(a.chunks[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('document hash is order-insensitive to chunk order', () => {
    const a = hashChunks([
      { content: 'Alpha', index: 0 },
      { content: 'Beta', index: 1 },
    ]);
    const b = hashChunks([
      { content: 'Beta', index: 0 },
      { content: 'Alpha', index: 1 },
    ]);
    expect(a.documentHash).toBe(b.documentHash);
  });
});
