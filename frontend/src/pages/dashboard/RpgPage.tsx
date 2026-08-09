import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { rpgService } from '@/services/rpg';
import PartyTab from '@/components/rpg/PartyTab';
import { CampfireReflectionModal } from '@/components/rpg/CampfireReflectionModal';
import {
  Loader2,
  Swords,
  Layers,
  Shield,
  Heart,
  Zap,
  Coins,
  Sparkles,
  Trophy,
  Flame,
  ScrollText,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronRight,
  Crosshair,
  UserPlus,
  Users2,
} from 'lucide-react';
import type {
  RpgBattle,
  RpgCardDefinition,
  RpgCardInstance,
  RpgDeck,
  RpgProfile,
  RpgPvpDuel,
  RpgPvpLeaderboardEntry,
} from '@/types';

type Tab = 'character' | 'decks' | 'battle' | 'duel' | 'party';

const rarityStyles: Record<string, string> = {
  common: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
  rare: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
  legendary: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200',
};

const monsterEmoji: Record<string, string> = {
  procrastiwraith: '👻',
  forgottenfog: '🌫️',
  misconceptionslime: '🟢',
  distractionimp: '😈',
  fearwisp: '🕯️',
  abstractederror: '💀',
};

export default function RpgPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('character');
  const [profile, setProfile] = useState<RpgProfile | null>(null);
  const [collection, setCollection] = useState<RpgCardInstance[]>([]);
  const [definitions, setDefinitions] = useState<RpgCardDefinition[]>([]);
  const [decks, setDecks] = useState<RpgDeck[]>([]);
  const [battle, setBattle] = useState<RpgBattle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PvP duel state
  const [duels, setDuels] = useState<RpgPvpDuel[]>([]);
  const [leaderboard, setLeaderboard] = useState<RpgPvpLeaderboardEntry[]>([]);
  const [opponentEmail, setOpponentEmail] = useState('');
  const [creatingDuel, setCreatingDuel] = useState(false);
  const [startingDuel, setStartingDuel] = useState(false);
  const [battleSource, setBattleSource] = useState<'pve' | 'pvp'>('pve');

  // Deck builder state
  const [deckName, setDeckName] = useState('');
  const [deckSlots, setDeckSlots] = useState<string[]>([]); // instance ids (max 5)
  const [savingDeck, setSavingDeck] = useState(false);

  // Battle state
  const [battling, setBattling] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [profileData, collectionData, definitionData, deckData] = await Promise.all([
        rpgService.getProfile(),
        rpgService.getCollection(),
        rpgService.getCards(),
        rpgService.listDecks(),
      ]);
      setProfile(profileData);
      setCollection(collectionData);
      setDefinitions(definitionData);
      setDecks(deckData);
      setError(null);
    } catch (err) {
      console.error('Failed to load RPG data:', err);
      setError(t('rpg.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const fetchDuels = useCallback(async () => {
    try {
      const [duelData, boardData] = await Promise.all([
        rpgService.listPvpDuels(),
        rpgService.getPvpLeaderboard(20),
      ]);
      setDuels(duelData);
      setLeaderboard(boardData);
    } catch (err) {
      console.error('Failed to load duels:', err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (tab === 'duel') {
      fetchDuels();
    }
  }, [tab, fetchDuels]);

  const activeDeck = useMemo(() => decks.find((d) => d.isActive) ?? null, [decks]);
  const xpProgress = useMemo(() => {
    if (!profile) return 0;
    const { currentLevelXp, nextLevelXp, totalXp } = profile.levelInfo;
    const span = nextLevelXp - currentLevelXp;
    if (span <= 0) return 100;
    return Math.min(100, Math.round(((totalXp - currentLevelXp) / span) * 100));
  }, [profile]);

  // ---------------- Deck builder ----------------
  const toggleSlot = (instanceId: string) => {
    setDeckSlots((prev) =>
      prev.includes(instanceId)
        ? prev.filter((id) => id !== instanceId)
        : prev.length >= 5
          ? prev
          : [...prev, instanceId],
    );
  };

  const createDeck = async () => {
    if (deckSlots.length !== 5) return;
    setSavingDeck(true);
    try {
      const created = await rpgService.createDeck({
        name: deckName || t('rpg.defaultDeckName'),
        cardInstanceIds: deckSlots,
      });
      setDecks((prev) => [...prev, created]);
      setDeckSlots([]);
      setDeckName('');
    } catch (err) {
      console.error('Failed to create deck:', err);
      setError(t('rpg.deckError'));
    } finally {
      setSavingDeck(false);
    }
  };

  const equipDeck = async (deckId: string) => {
    try {
      const updated = await rpgService.equipDeck(deckId);
      setDecks((prev) => prev.map((d) => ({ ...d, isActive: d.id === updated.id })));
    } catch (err) {
      console.error('Failed to equip deck:', err);
    }
  };

  const deleteDeck = async (deckId: string) => {
    try {
      await rpgService.deleteDeck(deckId);
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (err) {
      console.error('Failed to delete deck:', err);
    }
  };

  // ---------------- Battle ----------------
  const startBattle = async () => {
    setBattling(true);
    try {
      const created = await rpgService.createBattle({
        subject: activeDeck?.cards[0]?.name ?? undefined,
      });
      setBattle(created);
      setTab('battle');
      setError(null);
    } catch (err) {
      console.error('Failed to start battle:', err);
      setError(t('rpg.battleError'));
    } finally {
      setBattling(false);
    }
  };

  const playCard = async (instanceId: string) => {
    if (!battle) return;
    try {
      const updated = await rpgService.playCard(battle.id, { cardInstanceId: instanceId });
      setBattle(updated);
      setError(null);
    } catch (err) {
      console.error('Failed to play card:', err);
      setError(t('rpg.actionError'));
    }
  };

  const forfeit = async () => {
    if (!battle) return;
    try {
      const updated = await rpgService.forfeitBattle(battle.id);
      setBattle(updated);
    } catch (err) {
      console.error('Failed to forfeit:', err);
    }
  };

  const exitBattle = () => {
    setBattle(null);
    if (battleSource === 'pvp') {
      setBattleSource('pve');
      setTab('duel');
      fetchDuels();
    } else {
      setTab('character');
    }
    fetchAll();
  };

  // ---------------- PvP duels ----------------
  const challengeByEmail = async () => {
    if (!opponentEmail.trim()) return;
    setCreatingDuel(true);
    try {
      const created = await rpgService.createPvpDuel({
        opponentEmail: opponentEmail.trim(),
      });
      setOpponentEmail('');
      setDuels((prev) => [created, ...prev]);
      setError(null);
    } catch (err) {
      console.error('Failed to create duel:', err);
      setError(t('rpg.pvp.duelError'));
    } finally {
      setCreatingDuel(false);
    }
  };

  const challengeRandom = async () => {
    setCreatingDuel(true);
    try {
      const created = await rpgService.createPvpDuel({});
      setDuels((prev) => [created, ...prev]);
      setError(null);
    } catch (err) {
      console.error('Failed to create duel:', err);
      setError(t('rpg.pvp.duelError'));
    } finally {
      setCreatingDuel(false);
    }
  };

  const startDuelBattle = async (duel: RpgPvpDuel) => {
    if (duel.myBattle && duel.myBattle.state.phase !== 'active') {
      // Re-open the finished battle to view its result.
      setBattle(duel.myBattle);
      setBattleSource('pvp');
      setTab('battle');
      return;
    }
    setStartingDuel(true);
    try {
      const created = duel.myBattle ?? (await rpgService.startPvpBattle(duel.id));
      setBattle(created);
      setBattleSource('pvp');
      setTab('battle');
      setError(null);
    } catch (err) {
      console.error('Failed to start duel battle:', err);
      setError(t('rpg.pvp.battleError'));
    } finally {
      setStartingDuel(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Swords className="h-6 w-6 text-amber-500" />
              {t('rpg.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('rpg.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="font-semibold">{profile ? profile.stp : '—'}</span>
            <span className="text-xs text-muted-foreground">{t('rpg.stp')}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border bg-card p-1 w-fit">
          {(
            [
              ['character', 'rpg.tab.character', ScrollText],
              ['decks', 'rpg.tab.decks', Layers],
              ['battle', 'rpg.tab.battle', Swords],
              ['duel', 'rpg.tab.duel', Crosshair],
              ['party', 'rpg.tab.party', Users2],
            ] as Array<[Tab, string, typeof Layers]>
          ).map(([key, labelKey, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                tab === key
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {tab === 'character' && profile && (
              <motion.div
                key="character"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {/* Character sheet */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-purple-500/20 text-4xl ring-1 ring-amber-500/30">
                          {monsterEmoji[profile.currentWorld] ?? '🎓'}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-base px-3 py-1">
                              {t('rpg.level')} {profile.level}
                            </Badge>
                            <span className="text-sm font-medium text-amber-500">
                              ⚔️ {profile.battleRating}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t('rpg.xp')}: {profile.xp} / {profile.levelInfo.nextLevelXp}
                          </p>
                          <div className="mt-1.5 w-56">
                            <Bar value={xpProgress} className="h-2" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <Stat icon={Flame} label={t('rpg.studyStreak')} value={`${profile.studyStreak} 🔥`} />
                        <Stat icon={Trophy} label={t('rpg.bestPuzzleStreak')} value={String(profile.bestPuzzleStreak)} />
                        <Stat icon={Sparkles} label={t('rpg.eventExp')} value={String(profile.eventExp)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick actions */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{t('rpg.equippedDeck')}</p>
                          <p className="mt-1 text-lg font-bold">
                            {activeDeck?.name ?? t('rpg.noDeck')}
                          </p>
                        </div>
                        <Swords className="h-8 w-8 text-amber-500" />
                      </div>
                      <Button
                        className="mt-4 w-full"
                        onClick={startBattle}
                        disabled={battling || !activeDeck}
                      >
                        {battling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                        {t('rpg.startBattle')}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm font-medium">{t('rpg.collectionCount')}</p>
                      <p className="mt-1 text-lg font-bold">{collection.length}</p>
                      <Button
                        variant="outline"
                        className="mt-4 w-full"
                        onClick={() => setTab('decks')}
                      >
                        <Layers className="h-4 w-4" />
                        {t('rpg.manageDecks')}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm font-medium">{t('rpg.cardLibrary')}</p>
                      <p className="mt-1 text-lg font-bold">{definitions.length}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{t('rpg.libraryHint')}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Ledger preview */}
                <LedgerPreview profile={profile} />
              </motion.div>
            )}

            {tab === 'decks' && (
              <motion.div
                key="decks"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Deck builder */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-amber-500" />
                        {t('rpg.buildDeck')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        placeholder={t('rpg.deckNamePlaceholder')}
                        value={deckName}
                        onChange={(e) => setDeckName(e.target.value)}
                        maxLength={100}
                      />
                      <div>
                        <p className="mb-2 text-sm text-muted-foreground">
                          {deckSlots.length} / 5 — {t('rpg.deckHint')}
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                          {Array.from({ length: 5 }).map((_, i) => {
                            const instance = collection.find((c) => c.id === deckSlots[i]);
                            return (
                              <div
                                key={i}
                                className={cn(
                                  'flex aspect-[3/4] items-center justify-center rounded-lg border-2 text-2xl',
                                  instance
                                    ? rarityStyles[instance.rarity] ?? rarityStyles.common
                                    : 'border-dashed border-muted text-muted-foreground/40',
                                )}
                              >
                                {instance ? emojiFor(instance.cardKey) : '+'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={createDeck}
                        disabled={savingDeck || deckSlots.length !== 5}
                      >
                        {savingDeck ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {t('rpg.saveDeck')}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Collection picker */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        {t('rpg.collection')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                        {collection.map((card) => {
                          const selected = deckSlots.includes(card.id);
                          return (
                            <button
                              key={card.id}
                              onClick={() => toggleSlot(card.id)}
                              className={cn(
                                'rounded-xl border p-3 text-left transition-all',
                                rarityStyles[card.rarity] ?? rarityStyles.common,
                                selected && 'ring-2 ring-primary',
                                !selected && 'hover:-translate-y-0.5 hover:shadow-md',
                              )}
                            >
                              <div className="text-2xl">{emojiFor(card.cardKey)}</div>
                              <p className="mt-1 text-xs font-semibold leading-tight">{card.name}</p>
                              <div className="mt-1 flex items-center gap-1 text-[10px] opacity-80">
                                <Zap className="h-3 w-3" />
                                {card.ability.manaCost}
                                {selected && <CheckCircle2 className="ml-auto h-3 w-3" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Deck list */}
                <div className="space-y-3">
                  {decks.map((deck) => (
                    <Card key={deck.id} className={cn(deck.isActive && 'border-amber-500/40')}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex -space-x-2">
                            {deck.cards.map((card) => (
                              <div
                                key={card.slot}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-lg shadow"
                              >
                                {emojiFor(card.cardKey)}
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="font-semibold">
                              {deck.name}
                              {deck.isActive && (
                                <Badge className="ml-2 bg-amber-500 text-white">{t('rpg.active')}</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {deck.validated
                                ? t('rpg.deckValid')
                                : `${t('rpg.deckInvalid')}: ${deck.invalidReason ?? ''}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!deck.isActive && (
                            <Button size="sm" variant="outline" onClick={() => equipDeck(deck.id)}>
                              {t('rpg.equip')}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => deleteDeck(deck.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {tab === 'battle' && (
              <motion.div
                key="battle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {!battle ? (
                  <Card>
                    <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                      <Swords className="h-12 w-12 text-amber-500" />
                      <div>
                        <p className="text-lg font-semibold">{t('rpg.noBattle')}</p>
                        <p className="text-sm text-muted-foreground">{t('rpg.noBattleHint')}</p>
                      </div>
                      <Button onClick={startBattle} disabled={battling || !activeDeck}>
                        {battling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                        {t('rpg.startBattle')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <BattleScreen
                    battle={battle}
                    onPlayCard={playCard}
                    onForfeit={forfeit}
                    onExit={exitBattle}
                    t={t}
                  />
                )}
              </motion.div>
            )}

            {tab === 'duel' && (
              <motion.div
                key="duel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <DuelTab
                  duels={duels}
                  leaderboard={leaderboard}
                  opponentEmail={opponentEmail}
                  setOpponentEmail={setOpponentEmail}
                  creatingDuel={creatingDuel}
                  startingDuel={startingDuel}
                  hasValidDeck={Boolean(activeDeck?.validated)}
                  onChallengeByEmail={challengeByEmail}
                  onChallengeRandom={challengeRandom}
                  onStartBattle={startDuelBattle}
                  t={t}
                />
              </motion.div>
            )}

            {tab === 'party' && (
              <motion.div
                key="party"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <PartyTab />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </DashboardLayout>
  );
}

function Bar({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full bg-primary transition-all duration-500', indicatorClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function LedgerPreview({ profile }: { profile: RpgProfile }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-4 w-4 text-amber-500" />
          {t('rpg.balance')}: <span className="font-bold">{profile.stp} STP</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>{t('rpg.ledgerHint')}</p>
      </CardContent>
    </Card>
  );
}

function BattleScreen({
  battle,
  onPlayCard,
  onForfeit,
  onExit,
  t,
}: {
  battle: RpgBattle;
  onPlayCard: (instanceId: string) => void;
  onForfeit: () => void;
  onExit: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const state = battle.state;
  const ended = state.phase !== 'active';
  const playerHpPct = Math.round((state.playerHp / state.maxHp) * 100);
  const manaPct = Math.round((state.playerMana / state.maxMana) * 100);
  const monsterHpPct = Math.round((state.monster.hp / state.monster.maxHp) * 100);
  const lastEvents = state.log.slice(-6).reverse();
  const [showCampfire, setShowCampfire] = useState(false);
  const [boostMultiplier, setBoostMultiplier] = useState<number | null>(null);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t('rpg.turn')} {state.turn}
            </p>
            {battle.reward && !ended && (
              <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                {t('rpg.pendingReward')}: +{battle.reward.xp} XP · +{battle.reward.stp} STP
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {!ended && (
              <Button size="sm" variant="ghost" onClick={onForfeit}>
                {t('rpg.forfeit')}
              </Button>
            )}
            {ended && (
              <Button size="sm" onClick={onExit}>
                {t('rpg.done')}
              </Button>
            )}
          </div>
        </div>

        {/* Monster */}
        <div className="rounded-2xl border bg-gradient-to-br from-purple-500/10 via-transparent to-amber-500/10 p-5 text-center">
          <div className="text-6xl">{monsterEmoji[state.monster.key] ?? '👾'}</div>
          <p className="mt-2 font-semibold">{state.monster.name}</p>
          <div className="mx-auto mt-3 flex max-w-xs items-center gap-2">
            <Heart className="h-4 w-4 shrink-0 text-rose-500" />
            <Bar value={monsterHpPct} className="bg-rose-500/20" indicatorClassName="bg-rose-500" />
            <span className="text-xs font-medium">
              {state.monster.hp}/{state.monster.maxHp}
            </span>
          </div>
          {state.shieldRemaining > 0 && (
            <Badge variant="secondary" className="mt-2">
              <Shield className="h-3 w-3" /> {t('rpg.shield')} {state.shieldRemaining}
            </Badge>
          )}
        </div>

        {/* Player bars */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 shrink-0 text-rose-500" />
            <Bar value={playerHpPct} indicatorClassName="bg-rose-500" />
            <span className="text-xs font-medium">
              {state.playerHp}/{state.maxHp}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 shrink-0 text-sky-500" />
            <Bar value={manaPct} className="bg-sky-500/20" indicatorClassName="bg-sky-500" />
            <span className="text-xs font-medium">
              {state.playerMana}/{state.maxMana}
            </span>
          </div>
          {state.statuses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {state.statuses.map((s) => (
                <Badge key={s.type} variant="outline" className="text-xs">
                  {s.type} · {s.remaining}t
                  {s.damagePerTurn ? ` · ${s.damagePerTurn}/t` : ''}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Result banner */}
        {ended && (
          <div
            className={cn(
              'rounded-xl border px-4 py-3 text-center font-semibold',
              state.phase === 'player_won'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300',
            )}
          >
            {state.phase === 'player_won'
              ? `${t('rpg.victory')} ${battle.reward ? `+${battle.reward.xp} XP · +${battle.reward.stp} STP` : ''}`
              : state.phase === 'forfeited'
                ? t('rpg.forfeited')
                : t('rpg.defeat')}
          </div>
        )}

        {/* Metacognitive campfire check (spec 014, US5) */}
        {ended && state.phase === 'player_won' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                <Flame className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t('campfire.checkTitle')}</p>
                <p className="text-xs text-muted-foreground">
                  {boostMultiplier !== null && boostMultiplier > 1
                    ? t('campfire.boostActive', { mult: boostMultiplier.toFixed(2) })
                    : t('campfire.checkSubtitleBattle')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCampfire(true)}
              className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
            >
              {boostMultiplier !== null && boostMultiplier > 1
                ? t('campfire.answeredLabel')
                : t('campfire.reflectBoost')}
            </Button>
          </div>
        )}

        <CampfireReflectionModal
          open={showCampfire}
          onClose={() => setShowCampfire(false)}
          source={{ kind: 'battle', id: battle.id, subject: battle.subject ?? undefined }}
          onResolved={(mult) => setBoostMultiplier(mult)}
        />

        {/* Hand */}
        {!ended && (
          <div className="grid grid-cols-5 gap-2">
            {state.hand.map((card) => {
              const disabled = state.playerMana < card.ability.manaCost || !!state.cooldowns[card.ability.key];
              const cooldown = state.cooldowns[card.ability.key] ?? 0;
              return (
                <button
                  key={card.instanceId}
                  onClick={() => onPlayCard(card.instanceId)}
                  disabled={disabled}
                  className={cn(
                    'rounded-xl border p-2 text-center transition-all',
                    rarityStyles[defRarity(card.cardKey)] ?? rarityStyles.common,
                    disabled
                      ? 'cursor-not-allowed opacity-40'
                      : 'hover:-translate-y-1 hover:shadow-lg active:translate-y-0',
                  )}
                >
                  <div className="text-xl">{emojiFor(card.cardKey)}</div>
                  <p className="mt-1 text-[10px] font-semibold leading-tight">{card.ability.name}</p>
                  <p className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
                    <Zap className="h-2.5 w-2.5" />
                    {cooldown > 0 ? `⏳${cooldown}` : card.ability.manaCost}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Log */}
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border bg-muted/40 p-3">
          {lastEvents.map((event) => (
            <div key={event.sequence} className="flex items-start gap-2 text-xs">
              <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">T{event.turn}:</span>
              <span>{formatEvent(event, t)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DuelTab({
  duels,
  leaderboard,
  opponentEmail,
  setOpponentEmail,
  creatingDuel,
  startingDuel,
  hasValidDeck,
  onChallengeByEmail,
  onChallengeRandom,
  onStartBattle,
  t,
}: {
  duels: RpgPvpDuel[];
  leaderboard: RpgPvpLeaderboardEntry[];
  opponentEmail: string;
  setOpponentEmail: (v: string) => void;
  creatingDuel: boolean;
  startingDuel: boolean;
  hasValidDeck: boolean;
  onChallengeByEmail: () => void;
  onChallengeRandom: () => void;
  onStartBattle: (duel: RpgPvpDuel) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Challenge + leaderboard column */}
      <div className="space-y-6 lg:col-span-1">
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-amber-500" />
              {t('rpg.pvp.challengeByEmail')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="email"
              placeholder={t('rpg.pvp.emailPlaceholder')}
              value={opponentEmail}
              onChange={(e) => setOpponentEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onChallengeByEmail();
              }}
            />
            <Button
              className="w-full"
              onClick={onChallengeByEmail}
              disabled={creatingDuel || !hasValidDeck || !opponentEmail.trim()}
            >
              {creatingDuel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              {t('rpg.pvp.challengeBtn')}
            </Button>
            <div className="relative py-1 text-center">
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <span className="relative bg-card px-2 text-xs text-muted-foreground">or</span>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={onChallengeRandom}
              disabled={creatingDuel || !hasValidDeck}
            >
              <Crosshair className="h-4 w-4" />
              {t('rpg.pvp.randomMatchmaking')}
            </Button>
            {!hasValidDeck && (
              <p className="text-xs text-muted-foreground">{t('rpg.pvp.needDeck')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-500" />
              {t('rpg.pvp.leaderboard')}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-y-auto pr-1">
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('rpg.pvp.noDuels')}</p>
            ) : (
              <div className="space-y-1.5">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.userId}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
                      index === 0 && 'border-amber-500/40 bg-amber-500/10',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-center font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="truncate font-medium">{entry.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">{t('rpg.pvp.level')} {entry.level}</span>
                      <span className="font-semibold text-amber-500">⚔️ {entry.rating}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Duels column */}
      <div className="space-y-3 lg:col-span-2">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold">{t('rpg.pvp.yourDuels')}</h2>
        </div>
        {duels.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Crosshair className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="font-medium">{t('rpg.pvp.noDuels')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          duels.map((duel) => (
            <DuelCard key={duel.id} duel={duel} onStartBattle={onStartBattle} startingDuel={startingDuel} t={t} />
          ))
        )}
      </div>
    </div>
  );
}

function DuelCard({
  duel,
  onStartBattle,
  startingDuel,
  t,
}: {
  duel: RpgPvpDuel;
  onStartBattle: (duel: RpgPvpDuel) => void;
  startingDuel: boolean;
  t: (key: string) => string;
}) {
  const me = duel.mySide === 'challenger' ? duel.challenger : duel.defender;
  const opponent = duel.mySide === 'challenger' ? duel.defender : duel.challenger;
  const myBattleEnded = duel.myBattle ? duel.myBattle.state.phase !== 'active' : false;
  const active =
    (duel.status === 'challenged' || duel.status === 'in_progress') && !duel.myBattleId && !myBattleEnded;
  const hasBattle = Boolean(duel.myBattle);
  const won = duel.winner === duel.mySide;
  const lost = duel.winner !== null && duel.winner !== 'draw' && !won;

  return (
    <Card className={cn(duel.status === 'in_progress' && 'border-sky-500/40')}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-amber-500/20 text-xl ring-1 ring-amber-500/30">
              👤
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {opponent.name} <span className="text-xs font-normal text-muted-foreground">({t('rpg.pvp.rating')}: {opponent.rating})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t('rpg.pvp.vs')} {t('rpg.pvp.you')} · {t('rpg.pvp.rating')}: {me.rating}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn('border', duelStatusBadge(duel.status))}>
            {t(`rpg.pvp.status.${duel.status}`)}
          </Badge>
        </div>

        {duel.status === 'settled' && (
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium',
              won
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : lost
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
            )}
          >
            {won ? t('rpg.pvp.youWon') : lost ? t('rpg.pvp.youLost') : t('rpg.pvp.draw')}
            {duel.ratingChange && (
              <span className="ml-2 text-xs text-muted-foreground">
                {t('rpg.pvp.ratingChange')}: {duel.ratingChange.challenger} / {duel.ratingChange.defender}
              </span>
            )}
            {duel.rewards && (
              <span className="ml-2 text-xs text-muted-foreground">
                +{duel.rewards.xp} XP · +{duel.rewards.stp} STP
                {duel.rewards.limited ? ` (${t('rpg.pvp.limited')})` : ''}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {t('rpg.pvp.expires')}: {new Date(duel.expiresAt).toLocaleString()}
          </span>
          {(active || hasBattle) && (
            <Button
              size="sm"
              onClick={() => onStartBattle(duel)}
              disabled={startingDuel}
            >
              {startingDuel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              {hasBattle && !myBattleEnded ? t('rpg.pvp.continue') : t('rpg.pvp.fight')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function duelStatusBadge(status: string): string {
  const map: Record<string, string> = {
    challenged: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30',
    in_progress: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30',
    settled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    expired: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
  };
  return map[status] ?? map.challenged;
}

function emojiFor(cardKey: string): string {
  const map: Record<string, string> = {
    mana_slash: '⚔️',
    study_burst: '📚',
    poison_vial: '🧪',
    decay_curse: '🕸️',
    focus_shield: '🛡️',
    revival_note: '💚',
    mana_battery: '🔋',
    silence_pact: '🤫',
    abstracted_recall: '🌀',
  };
  return map[cardKey] ?? '🎴';
}

function defRarity(cardKey: string): string {
  const map: Record<string, string> = {
    abstracted_recall: 'legendary',
    decay_curse: 'rare',
    mana_battery: 'rare',
    silence_pact: 'rare',
  };
  return map[cardKey] ?? 'common';
}

function formatEvent(
  event: { eventType: string; payload: Record<string, unknown> },
  t: (key: string) => string,
): string {
  const p = event.payload;
  switch (event.eventType) {
    case 'start':
      return `${t('rpg.log.start')} ${String(p.monsterName ?? '')}`;
    case 'action':
      return `${t('rpg.log.action')} ${String(p.cardKey ?? '')} (${String(p.cost ?? '')} mana)`;
    case 'damage':
      return `${t('rpg.log.damage')} ${String(p.amount ?? '')} → ${String(p.target ?? '')}`;
    case 'dot_damage':
      return `${t('rpg.log.dot')} ${String(p.amount ?? '')} (${String(p.status ?? '')})`;
    case 'heal':
      return `${t('rpg.log.heal')} +${String(p.amount ?? '')}`;
    case 'shield':
      return `${t('rpg.log.shield')} ${String(p.source ?? '')}`;
    case 'status':
      return `${t('rpg.log.status')} ${String(p.type ?? '')} (${String(p.duration ?? '')}t)`;
    case 'mana':
      return `${t('rpg.log.mana')} ${String(p.change ?? '')}`;
    case 'quiz':
      return `${t('rpg.log.quiz')} +${String(p.manaRestored ?? 0)}`;
    case 'challenge':
      return p.allCorrect ? t('rpg.log.challengeWin') : t('rpg.log.challengeFail');
    case 'defeat':
      return String(p.winner ?? '') === 'player' ? t('rpg.log.defeatWin') : t('rpg.log.defeatLoss');
    case 'end':
      return t('rpg.log.end');
    default:
      return event.eventType;
  }
}
