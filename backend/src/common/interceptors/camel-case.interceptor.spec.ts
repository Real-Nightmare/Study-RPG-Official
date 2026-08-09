import { CamelCaseTransformer } from './camel-case.interceptor';

describe('CamelCaseTransformer', () => {
  describe('toCamelCase', () => {
    it('converts snake_case object keys to camelCase', () => {
      const input = { user_id: 1, first_name: 'Ada', is_active: true };
      const result = CamelCaseTransformer.toCamelCase(input);
      expect(result).toEqual({ userId: 1, firstName: 'Ada', isActive: true });
    });

    it('recursively transforms nested objects and arrays', () => {
      const input = {
        study_set_id: 's1',
        questions: [{ question_id: 'q1', correct_answer: 'A' }],
      };
      const result = CamelCaseTransformer.toCamelCase(input);
      expect(result).toEqual({
        studySetId: 's1',
        questions: [{ questionId: 'q1', correctAnswer: 'A' }],
      });
    });

    it('leaves Date instances untouched', () => {
      const date = new Date('2026-01-01T00:00:00Z');
      const result = CamelCaseTransformer.toCamelCase<{ createdAt: Date }>({ created_at: date });
      expect(result.createdAt).toBe(date);
    });

    it('returns null/undefined as-is', () => {
      expect(CamelCaseTransformer.toCamelCase(null)).toBeNull();
      expect(CamelCaseTransformer.toCamelCase(undefined)).toBeUndefined();
    });
  });

  describe('toSnakeCase', () => {
    it('converts camelCase object keys to snake_case', () => {
      const input = { userId: 1, firstName: 'Ada', isActive: true };
      const result = CamelCaseTransformer.toSnakeCase(input);
      expect(result).toEqual({ user_id: 1, first_name: 'Ada', is_active: true });
    });
  });
});
