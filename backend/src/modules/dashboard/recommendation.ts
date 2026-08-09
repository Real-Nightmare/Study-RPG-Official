/**
 * Pure rule-based "recommended next study action" (master prompt §7.2).
 * Priority order:
 *   1. Nearest upcoming exam (within 30 days)  → "exam"
 *   2. Flashcards due today                    → "flashcards"
 *   3. Overdue tasks                          → "tasks"
 *   4. Unresolved mistakes                    → "mistakes"
 *   5. Available puzzle streak                → "puzzle"
 *   6. No pending work                        → "relax"
 */

export interface RecommendationInput {
  nearestExam: { name: string; examDate: string; daysUntil: number } | null;
  flashcardsDue: number;
  overdueTasks: number;
  openMistakes: number;
  puzzleStreakAvailable: boolean;
}

export type RecommendationAction =
  | { kind: 'exam'; label: string; examName: string; daysUntil: number }
  | { kind: 'flashcards'; label: string; count: number }
  | { kind: 'tasks'; label: string; count: number }
  | { kind: 'mistakes'; label: string; count: number }
  | { kind: 'puzzle'; label: string }
  | { kind: 'relax'; label: string };

export function recommendNextAction(input: RecommendationInput): RecommendationAction {
  if (input.nearestExam && input.nearestExam.daysUntil <= 30) {
    const { name, daysUntil } = input.nearestExam;
    return {
      kind: 'exam',
      label: daysUntil === 0 ? `exam-today:${name}` : `exam-in:${name}:${daysUntil}`,
      examName: name,
      daysUntil,
    };
  }
  if (input.flashcardsDue > 0) {
    return {
      kind: 'flashcards',
      label: `flashcards-due:${input.flashcardsDue}`,
      count: input.flashcardsDue,
    };
  }
  if (input.overdueTasks > 0) {
    return {
      kind: 'tasks',
      label: `tasks-overdue:${input.overdueTasks}`,
      count: input.overdueTasks,
    };
  }
  if (input.openMistakes > 0) {
    return {
      kind: 'mistakes',
      label: `mistakes-open:${input.openMistakes}`,
      count: input.openMistakes,
    };
  }
  if (input.puzzleStreakAvailable) {
    return { kind: 'puzzle', label: 'puzzle-streak-available' };
  }
  return { kind: 'relax', label: 'no-pending-work' };
}
