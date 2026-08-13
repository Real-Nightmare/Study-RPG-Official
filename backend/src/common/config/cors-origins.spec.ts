import { parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('returns the local dev defaults when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual([
      'http://localhost:3010',
      'http://localhost:5189',
      'http://127.0.0.1:5189',
    ]);
    expect(parseCorsOrigins('')).toEqual(parseCorsOrigins(undefined));
  });

  it('parses a comma-separated allowlist', () => {
    expect(parseCorsOrigins('https://app.example.com, https://study.example.org')).toEqual([
      'https://app.example.com',
      'https://study.example.org',
    ]);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(parseCorsOrigins(' https://a.com ,,https://b.com ')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('falls back to defaults when the allowlist is empty after cleaning', () => {
    expect(parseCorsOrigins(' , , ')).toEqual(parseCorsOrigins(undefined));
  });
});
