import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { rpgService } from '@/services/rpg';
import { socialService } from '@/services/social';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Users2,
  Swords,
  Heart,
  Zap,
  UserPlus,
  LogOut,
  ChevronRight,
  ScrollText,
  Crown,
} from 'lucide-react';
import type {
  FriendUser,
  RpgExamBoss,
  RpgParty,
  RpgPartyBattle,
} from '@/types';

const bossEmoji: Record<string, string> = {
  exam_syllabus_sentinel: '🗿',
  exam_math_colossus: '🧮',
  exam_science_golem: '⚗️',
  exam_language_wraith: '👻',
  exam_history_tyrant: '🗡️',
  exam_geography_giant: '🗺️',
};

const cardEmoji: Record<string, string> = {
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

export default function PartyTab() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [party, setParty] = useState<RpgParty | null>(null);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [bosses, setBosses] = useState<RpgExamBoss[]>([]);
  const [battles, setBattles] = useState<RpgPartyBattle[]>([]);
  const [activeBattle, setActiveBattle] = useState<RpgPartyBattle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [partyName, setPartyName] = useState('');
  const [creatingParty, setCreatingParty] = useState(false);
  const [inviteId, setInviteId] = useState('');
  const [selectedBoss, setSelectedBoss] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [partyData, friendData, bossData] = await Promise.all([
        rpgService.myParty(),
        socialService.friends(),
        rpgService.examBosses(),
      ]);
      setParty(partyData);
      setFriends(friendData.filter((f) => f.status === 'accepted'));
      setBosses(bossData);
      setError(null);
      if (partyData) {
        const history = await rpgService.listPartyBattles(partyData.id);
        setBattles(history);
        const active = history.find((b) => b.phase === 'active');
        if (active) setActiveBattle(active);
      }
    } catch (err) {
      console.error('Failed to load party data:', err);
      setError(t('rpg.party.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const myRole = useMemo(() => {
    if (!party || !user) return 'member';
    return party.leaderId === user.id ? 'leader' : 'member';
  }, [party, user]);

  const createParty = async () => {
    setCreatingParty(true);
    try {
      const created = await rpgService.createParty(partyName.trim() || undefined);
      setParty(created);
      setPartyName('');
      setError(null);
    } catch (err) {
      console.error('Failed to create party:', err);
      setError(t('rpg.party.createError'));
    } finally {
      setCreatingParty(false);
    }
  };

  const invite = async () => {
    if (!party || !inviteId) return;
    try {
      const updated = await rpgService.inviteToParty(party.id, inviteId);
      setParty(updated);
      setInviteId('');
      setError(null);
    } catch (err) {
      console.error('Failed to invite:', err);
      setError(t('rpg.party.inviteError'));
    }
  };

  const leaveParty = async () => {
    if (!party) return;
    try {
      await rpgService.leaveParty(party.id);
      setParty(null);
      setBattles([]);
      setActiveBattle(null);
    } catch (err) {
      console.error('Failed to leave party:', err);
      setError(t('rpg.party.leaveError'));
    }
  };

  const startBattle = async () => {
    if (!party) return;
    setStarting(true);
    try {
      const battle = await rpgService.startPartyBattle(party.id, {
        bossKey: selectedBoss || undefined,
      });
      setActiveBattle(battle);
      setBattles((prev) => [battle, ...prev]);
      setError(null);
    } catch (err) {
      console.error('Failed to start party battle:', err);
      setError(t('rpg.party.battleStartError'));
    } finally {
      setStarting(false);
    }
  };

  const playCard = async (cardInstanceId: string) => {
    if (!activeBattle) return;
    setActing(true);
    try {
      const updated = await rpgService.partyBattleAction(activeBattle.id, cardInstanceId);
      setActiveBattle(updated);
      setBattles((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setError(null);
    } catch (err) {
      console.error('Failed to play card:', err);
      setError(t('rpg.party.actionError'));
    } finally {
      setActing(false);
    }
  };

  const forfeit = async () => {
    if (!activeBattle) return;
    try {
      const updated = await rpgService.forfeitPartyBattle(activeBattle.id);
      setActiveBattle(updated);
      setBattles((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      console.error('Failed to forfeit:', err);
    }
  };

  const openBattle = (battle: RpgPartyBattle) => {
    setActiveBattle(battle);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!party ? (
        /* ---------------- No party yet ---------------- */
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <Users2 className="h-12 w-12 text-amber-500" />
            <div>
              <p className="text-lg font-semibold">{t('rpg.party.noParty')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('rpg.party.noPartyHint')}</p>
            </div>
            <div className="flex w-full max-w-xs gap-2">
              <input
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createParty()}
                placeholder={t('rpg.party.namePlaceholder')}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
              />
              <Button onClick={createParty} disabled={creatingParty}>
                {creatingParty ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users2 className="h-4 w-4" />}
                {t('rpg.party.create')}
              </Button>
            </div>
            {friends.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('rpg.party.needFriends')}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ---------------- Party card ---------------- */}
          <Card>
            <CardContent className="space-y-4 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-2xl">
                    🎓
                  </div>
                  <div>
                    <p className="font-semibold">{party.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {party.memberCount}/{party.maxMembers} {t('rpg.party.members')}
                      {myRole === 'leader' && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          <Crown className="h-3 w-3" /> {t('rpg.party.leader')}
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={leaveParty}>
                  <LogOut className="h-4 w-4" />
                  {t('rpg.party.leave')}
                </Button>
              </div>

              {/* Members */}
              <div className="flex flex-wrap gap-2">
                {party.members.map((member) => (
                  <div
                    key={member.userId}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                      member.userId === party.leaderId && 'border-amber-500/40 bg-amber-500/10',
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium">{member.name}</span>
                    {member.userId === party.leaderId && <Crown className="h-3 w-3 text-amber-500" />}
                  </div>
                ))}
                {Array.from({ length: Math.max(0, party.maxMembers - party.memberCount) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-2 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground/50"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t('rpg.party.emptySlot')}
                  </div>
                ))}
              </div>

              {/* Invite (leader only) */}
              {myRole === 'leader' && party.memberCount < party.maxMembers && (
                <div className="flex flex-wrap gap-2">
                  <select
                    value={inviteId}
                    onChange={(e) => setInviteId(e.target.value)}
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">{t('rpg.party.selectFriend')}</option>
                    {friends
                      .filter((f) => !party.members.some((m) => m.userId === f.userId))
                      .map((f) => (
                        <option key={f.userId} value={f.userId}>
                          {f.name}
                          {f.username ? ` (@${f.username})` : ''}
                        </option>
                      ))}
                  </select>
                  <Button variant="outline" onClick={invite} disabled={!inviteId}>
                    <UserPlus className="h-4 w-4" />
                    {t('rpg.party.invite')}
                  </Button>
                </div>
              )}
              {myRole !== 'leader' && (
                <p className="text-xs text-muted-foreground">{t('rpg.party.inviteHint')}</p>
              )}
            </CardContent>
          </Card>

          {/* ---------------- Boss roster ---------------- */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Swords className="h-4 w-4 text-amber-500" />
                {t('rpg.party.chooseBoss')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {bosses.map((boss) => (
                  <button
                    key={boss.key}
                    onClick={() => setSelectedBoss(boss.key)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent',
                      selectedBoss === boss.key && 'border-amber-500/40 bg-amber-500/5',
                    )}
                  >
                    <span className="text-2xl">{bossEmoji[boss.key] ?? '👾'}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{boss.name}</span>
                      <span className="block text-xs text-muted-foreground">{boss.lore}</span>
                    </span>
                  </button>
                ))}
              </div>
              <Button
                className="w-full"
                onClick={startBattle}
                disabled={starting || party.memberCount < 2}
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                {t('rpg.party.startBattle')}
              </Button>
              {party.memberCount < 2 && (
                <p className="text-center text-xs text-muted-foreground">{t('rpg.party.needTwo')}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ---------------- Active battle ---------------- */}
      {activeBattle && (
        <PartyBattleScreen
          battle={activeBattle}
          onPlayCard={playCard}
          onForfeit={forfeit}
          acting={acting}
          t={t}
        />
      )}

      {/* ---------------- Battle history ---------------- */}
      {party && battles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              {t('rpg.party.history')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {battles.map((battle) => (
              <button
                key={battle.id}
                onClick={() => openBattle(battle)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                  activeBattle?.id === battle.id && 'border-amber-500/40',
                )}
              >
                <span className="text-xl">{bossEmoji[battle.boss.key] ?? '👾'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{battle.boss.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(battle.createdAt).toLocaleString()}
                  </span>
                </span>
                <Badge
                  variant="outline"
                  className={
                    battle.phase === 'won'
                      ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                      : battle.phase === 'active'
                        ? 'border-sky-500/30 text-sky-600 dark:text-sky-300'
                        : 'border-rose-500/30 text-rose-600 dark:text-rose-300'
                  }
                >
                  {t(`rpg.party.phase.${battle.phase}`)}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PartyBattleScreen({
  battle,
  onPlayCard,
  onForfeit,
  acting,
  t,
}: {
  battle: RpgPartyBattle;
  onPlayCard: (instanceId: string) => void;
  onForfeit: () => void;
  acting: boolean;
  t: (key: string) => string;
}) {
  const state = battle.state;
  const ended = state.phase !== 'active';
  const bossHpPct = Math.round((state.boss.hp / state.boss.maxHp) * 100);
  const lastEvents = state.log.slice(-6).reverse();

  const activeHero = state.heroes.find((h) => !h.isDown && !h.actedThisRound);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t('rpg.party.round')} {state.round}</p>
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
          </div>
        </div>

        {/* Boss */}
        <div className="rounded-2xl border bg-gradient-to-br from-rose-500/10 via-transparent to-amber-500/10 p-5 text-center">
          <div className="text-6xl">{bossEmoji[state.boss.key] ?? '👾'}</div>
          <p className="mt-2 font-semibold">{state.boss.name}</p>
          <div className="mx-auto mt-3 flex max-w-xs items-center gap-2">
            <Heart className="h-4 w-4 shrink-0 text-rose-500" />
            <Bar value={bossHpPct} className="bg-rose-500/20" indicatorClassName="bg-rose-500" />
            <span className="text-xs font-medium">
              {state.boss.hp}/{state.boss.maxHp}
            </span>
          </div>
          {state.boss.attack > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              ⚔️ {state.boss.attack} {t('rpg.party.attack')}
            </p>
          )}
        </div>

        {/* Heroes */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {state.heroes.map((hero) => {
            const hpPct = hero.isDown
              ? 0
              : Math.round((hero.state.playerHp / hero.state.maxHp) * 100);
            return (
              <div
                key={hero.userId}
                className={cn(
                  'rounded-xl border p-3',
                  hero.isDown
                    ? 'border-rose-500/30 bg-rose-500/5 opacity-50'
                    : hero.actedThisRound
                      ? 'border-emerald-500/30'
                      : 'border-amber-500/40 ring-1 ring-amber-500/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium">{hero.name}</p>
                  {hero.isDown && <Badge variant="destructive" className="text-[9px]">KO</Badge>}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Heart className="h-3 w-3 shrink-0 text-rose-500" />
                  <Bar value={hpPct} className="h-1.5 bg-rose-500/20" indicatorClassName="bg-rose-500" />
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Zap className="h-3 w-3 shrink-0 text-sky-500" />
                  <Bar
                    value={Math.round((hero.state.playerMana / hero.state.maxMana) * 100)}
                    className="h-1.5 bg-sky-500/20"
                    indicatorClassName="bg-sky-500"
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {hero.state.playerHp}/{hero.state.maxHp} HP
                </p>
              </div>
            );
          })}
        </div>

        {/* Result banner */}
        {ended && (
          <div
            className={cn(
              'rounded-xl border px-4 py-3 text-center font-semibold',
              state.phase === 'won'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300',
            )}
          >
            {state.phase === 'won'
              ? `${t('rpg.victory')} ${battle.reward ? `+${battle.reward.xp} XP · +${battle.reward.stp} STP` : ''}`
              : state.phase === 'forfeited'
                ? t('rpg.forfeited')
                : t('rpg.defeat')}
          </div>
        )}

        {/* Active hero hand */}
        {!ended && activeHero && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Crown className="h-4 w-4 text-amber-500" />
              {activeHero.name} {t('rpg.party.turn')}
            </p>
            <div className="grid grid-cols-5 gap-2">
              {activeHero.state.hand.map((card) => {
                const disabled =
                  acting || activeHero.state.playerMana < (card.ability?.manaCost ?? 99);
                return (
                  <button
                    key={card.instanceId}
                    onClick={() => onPlayCard(card.instanceId)}
                    disabled={disabled}
                    className={cn(
                      'rounded-xl border p-2 text-center transition-all',
                      'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
                      disabled
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:-translate-y-1 hover:shadow-lg active:translate-y-0',
                    )}
                  >
                    <div className="text-xl">{cardEmoji[card.cardKey] ?? '🎴'}</div>
                    <p className="mt-1 text-[10px] font-semibold leading-tight">
                      {card.ability?.name ?? card.cardKey}
                    </p>
                    <p className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
                      <Zap className="h-2.5 w-2.5" />
                      {card.ability?.manaCost ?? '—'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!ended && !activeHero && (
          <p className="text-center text-sm text-muted-foreground">{t('rpg.party.waiting')}</p>
        )}

        {/* Log */}
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border bg-muted/40 p-3">
          {lastEvents.map((event, index) => (
            <div key={index} className="flex items-start gap-2 text-xs">
              <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">R{event.round}:</span>
              <span>{String(event.payload?.text ?? event.eventType)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
