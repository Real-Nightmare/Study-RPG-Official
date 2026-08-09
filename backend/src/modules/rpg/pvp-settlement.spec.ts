import { outcomeOf, settleDuel } from './pvp-settlement';

describe('pvp-settlement', () => {
  it('decisive win beats a loss', () => {
    const result = settleDuel(
      outcomeOf('player_won', 80, 100, 6),
      outcomeOf('monster_won', 10, 100, 9),
    );
    expect(result.winner).toBe('challenger');
    expect(result.reason).toBe('decisive');
  });

  it('both won -> higher remaining HP% wins', () => {
    const result = settleDuel(
      outcomeOf('player_won', 60, 100, 7),
      outcomeOf('player_won', 40, 100, 6),
    );
    expect(result.winner).toBe('challenger');
    expect(result.reason).toBe('hp_percent');
  });

  it('both lost -> higher remaining HP% wins', () => {
    const result = settleDuel(
      outcomeOf('monster_won', 15, 100, 4),
      outcomeOf('monster_won', 45, 100, 8),
    );
    expect(result.winner).toBe('defender');
    expect(result.reason).toBe('hp_percent');
  });

  it('equal HP% -> fewer turns wins', () => {
    const result = settleDuel(
      outcomeOf('player_won', 50, 100, 9),
      outcomeOf('player_won', 50, 100, 5),
    );
    expect(result.winner).toBe('defender');
    expect(result.reason).toBe('turns');
  });

  it('fully equal -> draw', () => {
    const result = settleDuel(
      outcomeOf('player_won', 50, 100, 6),
      outcomeOf('player_won', 50, 100, 6),
    );
    expect(result.winner).toBe('draw');
    expect(result.reason).toBe('draw');
  });

  it('forfeit: unplayed side loses by default', () => {
    const played = outcomeOf('player_won', 70, 100, 5);
    const abandoned = outcomeOf('active', 0, 100, 0, false);
    const result = settleDuel(played, abandoned);
    expect(result.winner).toBe('challenger');
    expect(result.reason).toBe('forfeit');
  });

  it('no contest when neither side played', () => {
    const result = settleDuel(
      outcomeOf('active', 0, 100, 0, false),
      outcomeOf('active', 0, 100, 0, false),
    );
    expect(result.winner).toBe('draw');
    expect(result.reason).toBe('no_contest');
  });

  it('records margins for both sides', () => {
    const result = settleDuel(
      outcomeOf('player_won', 75, 100, 6),
      outcomeOf('monster_won', 20, 100, 10),
    );
    expect(result.margins).toEqual({
      challengerHpPct: 75,
      defenderHpPct: 20,
      challengerTurns: 6,
      defenderTurns: 10,
    });
  });
});
