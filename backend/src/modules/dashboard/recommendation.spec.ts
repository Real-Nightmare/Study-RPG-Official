import { recommendNextAction } from './recommendation';

describe('recommendNextAction', () => {
  const base = {
    nearestExam: null,
    flashcardsDue: 0,
    overdueTasks: 0,
    openMistakes: 0,
    puzzleStreakAvailable: false,
  };

  it('prioritises the nearest exam within 30 days', () => {
    const action = recommendNextAction({
      ...base,
      nearestExam: { name: 'Maths Finals', examDate: '2026-08-20', daysUntil: 15 },
    });
    expect(action.kind).toBe('exam');
  });

  it('prioritises flashcards over tasks when no exam is near', () => {
    const action = recommendNextAction({ ...base, flashcardsDue: 12, overdueTasks: 3 });
    expect(action.kind).toBe('flashcards');
  });

  it('prioritises overdue tasks over mistakes', () => {
    const action = recommendNextAction({ ...base, overdueTasks: 2, openMistakes: 5 });
    expect(action.kind).toBe('tasks');
  });

  it('suggests mistakes review when nothing else is pending', () => {
    const action = recommendNextAction({ ...base, openMistakes: 4 });
    expect(action.kind).toBe('mistakes');
  });

  it('suggests a puzzle when a streak is available', () => {
    const action = recommendNextAction({ ...base, puzzleStreakAvailable: true });
    expect(action.kind).toBe('puzzle');
  });

  it('relaxes when there is no pending work', () => {
    const action = recommendNextAction(base);
    expect(action.kind).toBe('relax');
  });
});
