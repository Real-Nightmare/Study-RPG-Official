-- ---------------------------------------------------------------------------
-- 032: Playable character archetypes (completion plan T9)
-- Six original archetypes; selection locked at profile creation, one free
-- respec token granted on first reaching level 10. Modifiers live in
-- game_config ('rpg.characters') so systems adopt them without migrations.
-- ---------------------------------------------------------------------------

ALTER TABLE player_profiles
    ADD COLUMN IF NOT EXISTS character_key VARCHAR(40),
    ADD COLUMN IF NOT EXISTS respec_tokens SMALLINT NOT NULL DEFAULT 0;

INSERT INTO game_config (key, value, description)
VALUES (
    'rpg.characters',
    '{
      "respecTokenLevel": 10,
      "characters": [
        {
          "key": "lorekeeper",
          "name": "Wren, the Lorekeeper",
          "title": "Memory archivist",
          "lore": "Keeps a ledger of everything ever learned and refuses to let facts fade. Every lesson revisited pays a little more.",
          "accentColor": "#7c5cff",
          "modifiers": { "xpBonusPct": 5, "xpTypeBonus": {}, "battleMaxHpBonus": 0, "pvpStartRatingBonus": 0, "burnValueBonusPct": 0, "streakShieldBonus": 0 }
        },
        {
          "key": "focuser",
          "name": "Tomas, the Focuser",
          "title": "Deep-work sentinel",
          "lore": "Trained in the old art of the untouched timer. Enters every battle rested, patient and harder to knock off balance.",
          "accentColor": "#16a34a",
          "modifiers": { "xpBonusPct": 0, "xpTypeBonus": {}, "battleMaxHpBonus": 20, "pvpStartRatingBonus": 0, "burnValueBonusPct": 0, "streakShieldBonus": 0 }
        },
        {
          "key": "solver",
          "name": "Ines, the Solver",
          "title": "Problem hunter",
          "lore": "Believes every hard question is a monster wearing a costume. Problems and quizzes feed her faster than any other path.",
          "accentColor": "#ea580c",
          "modifiers": { "xpBonusPct": 0, "xpTypeBonus": { "problem_solved": 10, "quiz_completed": 5 }, "battleMaxHpBonus": 0, "pvpStartRatingBonus": 0, "burnValueBonusPct": 0, "streakShieldBonus": 0 }
        },
        {
          "key": "duelist",
          "name": "Kai, the Duelist",
          "title": "Rating climber",
          "lore": "Reads opponents like exam papers — skim the questions first. Steps onto the ladder with a head start over the field.",
          "accentColor": "#dc2626",
          "modifiers": { "xpBonusPct": 0, "xpTypeBonus": {}, "battleMaxHpBonus": 0, "pvpStartRatingBonus": 50, "burnValueBonusPct": 0, "streakShieldBonus": 0 }
        },
        {
          "key": "alchemist",
          "name": "Sable, the Alchemist",
          "title": "Value distiller",
          "lore": "Turns forgotten cards into pure essence. Where others see dust, Sable sees a better exchange rate.",
          "accentColor": "#d97706",
          "modifiers": { "xpBonusPct": 0, "xpTypeBonus": {}, "battleMaxHpBonus": 0, "pvpStartRatingBonus": 0, "burnValueBonusPct": 15, "streakShieldBonus": 0 }
        },
        {
          "key": "warden",
          "name": "Petra, the Warden",
          "title": "Streak guardian",
          "lore": "Swore an oath at the campfire: no streak breaks on her watch. Study habits under her protection simply last longer.",
          "accentColor": "#2563eb",
          "modifiers": { "xpBonusPct": 0, "xpTypeBonus": {}, "battleMaxHpBonus": 10, "pvpStartRatingBonus": 0, "burnValueBonusPct": 0, "streakShieldBonus": 2 }
        }
      ]
    }'::jsonb,
    'Playable character archetypes (T9): stat modifiers + respec rules'
)
ON CONFLICT (key) DO NOTHING;
