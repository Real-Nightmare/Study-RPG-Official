import { STUDY_RPG_PHILOSOPHY, withPhilosophy } from './study-rpg-philosophy';

describe('study-rpg-philosophy', () => {
  it('includes the canonical product philosophy pillars', () => {
    expect(STUDY_RPG_PHILOSOPHY).toContain('Depth over length');
    expect(STUDY_RPG_PHILOSOPHY).toContain('Mastery over memorisation');
    expect(STUDY_RPG_PHILOSOPHY).toContain('Health first');
    expect(STUDY_RPG_PHILOSOPHY).toContain('Free to Win');
    expect(STUDY_RPG_PHILOSOPHY).toContain('Bridge game to reality');
    expect(STUDY_RPG_PHILOSOPHY).toContain('Socratic, not spoon-feeding');
  });

  it('acts as an anti-overstudy guardian — never encourages cramming', () => {
    expect(STUDY_RPG_PHILOSOPHY).toContain('anti-overstudy guardian');
    expect(STUDY_RPG_PHILOSOPHY).toMatch(/NEVER encourage cramming/i);
    expect(STUDY_RPG_PHILOSOPHY).toMatch(/all-nighters/i);
  });

  it('keeps effort the only currency (Free-to-Win)', () => {
    expect(STUDY_RPG_PHILOSOPHY).toMatch(/Effort is the only currency/i);
  });

  it('withPhilosophy appends the feature role after the shared block', () => {
    const prompt = withPhilosophy('You are the Feynman teach-back evaluator.');
    expect(prompt.startsWith(STUDY_RPG_PHILOSOPHY)).toBe(true);
    expect(prompt).toContain(
      'Your role in this session: You are the Feynman teach-back evaluator.',
    );
  });
});
