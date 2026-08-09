/**
 * Exam bosses (Phase 6) — exams are boss fights. Each subject maps to an
 * original blocky-style boss (BlockTales-inspired *style*, all names original
 * — no third-party IP). Difficulty scales with days-until-exam.
 */

export interface ExamBossDefinition {
  key: string;
  name: string;
  subject: string;
  baseHp: number;
  baseAttack: number;
  lore: string;
}

export const EXAM_BOSSES: ExamBossDefinition[] = [
  {
    key: 'exam_syllabus_sentinel',
    name: 'Syllabus Sentinel',
    subject: 'all',
    baseHp: 220,
    baseAttack: 12,
    lore: 'A towering block guardian that rattles off every chapter heading you skipped.',
  },
  {
    key: 'exam_math_colossus',
    name: 'Formula Colossus',
    subject: 'Mathematics',
    baseHp: 260,
    baseAttack: 14,
    lore: 'Built from stacked textbooks. Each correct derivation cracks one of its blocks.',
  },
  {
    key: 'exam_science_golem',
    name: 'Labwork Golem',
    subject: 'Science',
    baseHp: 240,
    baseAttack: 13,
    lore: 'A bubbling, beaker-armed golem that throws half-remembered chemical equations.',
  },
  {
    key: 'exam_language_wraith',
    name: 'Grammar Wraith',
    subject: 'English',
    baseHp: 210,
    baseAttack: 11,
    lore: 'A whispery phantom that misplaces every apostrophe in your revision notes.',
  },
  {
    key: 'exam_history_tyrant',
    name: 'Date Tyrant',
    subject: 'History',
    baseHp: 230,
    baseAttack: 12,
    lore: 'Charges at you with a war-axe made of chronological errors.',
  },
  {
    key: 'exam_geography_giant',
    name: 'Map Giant',
    subject: 'Geography',
    baseHp: 225,
    baseAttack: 12,
    lore: 'A giant made of misplaced rivers and mislabeled mountain ranges.',
  },
];

export function getExamBoss(subject: string | null | undefined): ExamBossDefinition {
  const normalized = (subject || '').toLowerCase();
  const match = EXAM_BOSSES.find(
    (b) => b.subject.toLowerCase() === normalized || b.subject === 'all',
  );
  return (
    match ||
    EXAM_BOSSES[0] || {
      key: 'exam_syllabus_sentinel',
      name: 'Syllabus Sentinel',
      subject: 'all',
      baseHp: 220,
      baseAttack: 12,
      lore: 'A towering block guardian.',
    }
  );
}

/** Scale boss stats by days-until-exam (closer exam → tougher boss). */
export function scaleExamBoss(
  boss: ExamBossDefinition,
  daysUntilExam: number | null,
  partySize = 1,
): { hp: number; attack: number } {
  const urgency =
    daysUntilExam === null ? 1 : Math.max(0.6, Math.min(1.4, 28 / Math.max(1, daysUntilExam)));
  const partyMultiplier = Math.pow(1.6, partySize - 1);
  return {
    hp: Math.round(boss.baseHp * urgency * partyMultiplier),
    attack: Math.round(boss.baseAttack * urgency),
  };
}
