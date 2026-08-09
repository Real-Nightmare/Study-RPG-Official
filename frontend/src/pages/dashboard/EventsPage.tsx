import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { eventsService } from '@/services/events';
import {
  Loader2,
  CalendarDays,
  Trophy,
  ListChecks,
  PackageOpen,
  Skull,
  Gavel,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Crown,
  Lock,
  Send,
  Flame,
  Coins,
  Target,
  RefreshCw,
  Swords,
  CalendarPlus,
  Zap,
  ScrollText,
  Users,
} from 'lucide-react';
import type {
  AbstractedCard,
  CurrentEventView,
  EventQuest,
  ExtinctionTargetView,
  MilestoneView,
  StudyEvent,
  StudyPassTrackView,
} from '@/types';

type Tab = 'event' | 'quests' | 'items' | 'extinction' | 'admin';

const rarityStyles: Record<string, string> = {
  common: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
  rare: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
  legendary: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200',
};

const categoryStyles: Record<string, string> = {
  daily: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
  weekly: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
  study: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  puzzle: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200',
};

export default function EventsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<Tab>('event');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [current, setCurrent] = useState<CurrentEventView | null>(null);
  const [abstracted, setAbstracted] = useState<AbstractedCard[]>([]);
  const [targets, setTargets] = useState<ExtinctionTargetView[]>([]);
  const [milestones, setMilestones] = useState<MilestoneView[]>([]);
  const [allEvents, setAllEvents] = useState<StudyEvent[]>([]);

  // Item / sigil transfer state
  const [transferTo, setTransferTo] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [transferBusy, setTransferBusy] = useState(false);

  // Abstracted action state
  const [unabstractReason, setUnabstractReason] = useState('');
  const [abstractedBusy, setAbstractedBusy] = useState<string | null>(null);
  const [limboBusy, setLimboBusy] = useState(false);

  // Claim busy state
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);
  const [claimingQuest, setClaimingQuest] = useState<string | null>(null);
  const [claimingMilestone, setClaimingMilestone] = useState<string | null>(null);
  const [choosingTrack, setChoosingTrack] = useState<'free' | 'gold' | null>(null);

  // Admin form state
  const [adminForm, setAdminForm] = useState({
    slug: '',
    name: '',
    story: '',
    startsAt: '',
    endsAt: '',
    graceHours: '48',
    reason: '',
  });
  const [seedKeys, setSeedKeys] = useState('');
  const [seedReason, setSeedReason] = useState('');
  const [activateReason, setActivateReason] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const flashError = useCallback((err: unknown) => {
    const message =
      err && typeof err === 'object' && 'response' in err
        ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
        : '';
    setError(message || t('events.loadError'));
  }, [t]);

  const refreshCurrent = useCallback(async () => {
    const data = await eventsService.current();
    setCurrent(data);
    if (data) {
      try {
        const [targetRows, milestoneRows, myCards] = await Promise.all([
          eventsService.extinctionTargets('great-extinction').catch(() => []),
          eventsService.milestones('great-extinction').catch(() => []),
          eventsService.myAbstracted().catch(() => []),
        ]);
        setTargets(targetRows);
        setMilestones(milestoneRows);
        setAbstracted(myCards);
      } catch {
        // optional satellite data — the main view still renders
      }
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([refreshCurrent(), eventsService.list().then(setAllEvents)]);
    } catch (err) {
      flashError(err);
    } finally {
      setIsLoading(false);
    }
  }, [flashError, refreshCurrent]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const studyPass = current?.studyPass ?? null;
  const event = current?.event ?? null;

  const claimableLevels = useMemo(() => studyPass?.claimableLevels ?? [], [studyPass]);
  const questsByCategory = useMemo(() => {
    const groups: Record<string, EventQuest[]> = { daily: [], weekly: [], study: [], puzzle: [] };
    for (const q of current?.quests ?? []) {
      (groups[q.category] ??= []).push(q);
    }
    return groups;
  }, [current]);

  const daysLeft = useMemo(() => {
    if (!event) return null;
    const diff = new Date(event.endsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }, [event]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleChooseTrack = async (track: 'free' | 'gold') => {
    setChoosingTrack(track);
    setError(null);
    try {
      await eventsService.chooseTrack(track);
      await refreshCurrent();
    } catch (err) {
      flashError(err);
    } finally {
      setChoosingTrack(null);
    }
  };

  const handleClaimLevel = async (level: number) => {
    setClaimingLevel(level);
    setError(null);
    try {
      const result = await eventsService.claimLevel(level);
      showNotice(
        `${t('events.studyPass.level', { level: level + 1 })} — ${result.granted.join(', ')}`,
      );
      await refreshCurrent();
    } catch (err) {
      flashError(err);
    } finally {
      setClaimingLevel(null);
    }
  };

  const handleClaimQuest = async (id: string) => {
    setClaimingQuest(id);
    setError(null);
    try {
      const result = await eventsService.claimQuest(id);
      showNotice(result.granted.join(', '));
      await refreshCurrent();
    } catch (err) {
      flashError(err);
    } finally {
      setClaimingQuest(null);
    }
  };

  const handleTransfer = async () => {
    const toUserId = transferTo.trim();
    const quantity = Number(transferQty);
    if (!toUserId || !Number.isInteger(quantity) || quantity <= 0) return;
    setTransferBusy(true);
    setError(null);
    try {
      await eventsService.transferSigil(toUserId, quantity);
      showNotice(t('events.items.transferred'));
      setTransferTo('');
      setTransferQty('1');
      await refreshCurrent();
    } catch (err) {
      flashError(err);
    } finally {
      setTransferBusy(false);
    }
  };

  const handleUnabstract = async (card: AbstractedCard) => {
    setAbstractedBusy(card.instanceId);
    setError(null);
    try {
      const result = await eventsService.unabstract({
        instanceId: card.instanceId,
        confirm: true,
        reason: unabstractReason || undefined,
      });
      showNotice(
        t('events.abstracted.done', { result: result.resultCardKey }),
      );
      setUnabstractReason('');
      await Promise.all([refreshCurrent(), eventsService.myAbstracted().then(setAbstracted)]);
    } catch (err) {
      flashError(err);
    } finally {
      setAbstractedBusy(null);
    }
  };

  const handleLimbo = async () => {
    setLimboBusy(true);
    setError(null);
    try {
      await eventsService.limbo(true);
      showNotice(t('events.items.limboDone'));
      await Promise.all([refreshCurrent(), eventsService.myAbstracted().then(setAbstracted)]);
    } catch (err) {
      flashError(err);
    } finally {
      setLimboBusy(false);
    }
  };

  const handleClaimMilestone = async (id: string) => {
    setClaimingMilestone(id);
    setError(null);
    try {
      await eventsService.claimMilestone('great-extinction', id);
      showNotice(t('events.extinction.milestoneClaimed'));
      await refreshCurrent();
    } catch (err) {
      flashError(err);
    } finally {
      setClaimingMilestone(null);
    }
  };

  const handleCreateEvent = async () => {
    setAdminBusy(true);
    setError(null);
    try {
      await eventsService.create({
        slug: adminForm.slug,
        name: adminForm.name,
        story: adminForm.story || undefined,
        startsAt: new Date(adminForm.startsAt).toISOString(),
        endsAt: new Date(adminForm.endsAt).toISOString(),
        graceHours: Number(adminForm.graceHours),
        reason: adminForm.reason,
      });
      showNotice(t('events.admin.created'));
      setAdminForm({
        slug: '',
        name: '',
        story: '',
        startsAt: '',
        endsAt: '',
        graceHours: '48',
        reason: '',
      });
      setAllEvents(await eventsService.list());
    } catch (err) {
      flashError(err);
    } finally {
      setAdminBusy(false);
    }
  };

  const handleActivate = async (id: string) => {
    setActivatingId(id);
    setError(null);
    try {
      await eventsService.activate(id, activateReason);
      showNotice(t('events.admin.activated'));
      setActivateReason('');
      setAllEvents(await eventsService.list());
      await refreshCurrent();
    } catch (err) {
      flashError(err);
    } finally {
      setActivatingId(null);
    }
  };

  const handleSeedTargets = async () => {
    const cardKeys = seedKeys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    setAdminBusy(true);
    setError(null);
    try {
      setTargets(await eventsService.seedTargets('great-extinction', cardKeys, seedReason));
      showNotice(t('events.admin.seeded'));
      setSeedKeys('');
      setSeedReason('');
    } catch (err) {
      flashError(err);
    } finally {
      setAdminBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const statusBadge = (status: string) => (
    <Badge
      variant="outline"
      className={cn(
        'border',
        status === 'active'
          ? 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300'
          : status === 'scheduled'
            ? 'border-sky-300 text-sky-600 dark:border-sky-700 dark:text-sky-300'
            : 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400',
      )}
    >
      {t(`events.status.${status}`)}
    </Badge>
  );

  const rarityBadge = (rarity: string) => (
    <Badge className={cn('border', rarityStyles[rarity] ?? rarityStyles.common)}>
      {t(`economy.rarity.${rarity}`)}
    </Badge>
  );

  const renderStudyPass = (sp: StudyPassTrackView) => {
    const totalLevels = 14;
    const pipStates = Array.from({ length: totalLevels }, (_, i) => {
      if (sp.claimedLevels.includes(i)) return 'claimed' as const;
      if (claimableLevels.includes(i)) return 'claimable' as const;
      return 'locked' as const;
    });

    return (
      <Card className="overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-violet-500/20" />
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                {t('events.studyPass.title')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('events.studyPass.hint')}</p>
            </div>
            <Badge variant="secondary" className="gap-1 tabular-nums">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              {sp.maxed
                ? t('events.studyPass.maxed')
                : t('events.studyPass.exp', {
                    exp: sp.exp.toLocaleString(),
                    next: (sp.nextThreshold ?? sp.currentThreshold).toLocaleString(),
                  })}
            </Badge>
          </div>

          {/* Progress bar */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('events.studyPass.level', { level: sp.level + 1 })}</span>
              <span className="tabular-nums">{sp.levelProgressPct}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500"
                initial={{ width: 0 }}
                animate={{ width: `${sp.levelProgressPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* 14 level pips */}
          <div className="grid grid-cols-7 gap-1.5">
            {pipStates.map((state, i) => (
              <button
                key={i}
                disabled={state !== 'claimable' || claimingLevel !== null}
                onClick={() => handleClaimLevel(i)}
                title={
                  state === 'claimed'
                    ? `${t('events.studyPass.claimed')} — ${t('events.studyPass.level', { level: i + 1 })}`
                    : state === 'claimable'
                      ? `${t('events.studyPass.claim')} — ${t('events.studyPass.level', { level: i + 1 })}`
                      : t('events.studyPass.level', { level: i + 1 })
                }
                className={cn(
                  'flex aspect-square items-center justify-center rounded-lg border text-xs font-semibold transition-all',
                  state === 'claimed' &&
                    'border-emerald-300 bg-emerald-500/15 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300',
                  state === 'claimable' &&
                    'border-amber-300 bg-amber-400/20 text-amber-600 shadow-sm hover:bg-amber-400/30 hover:shadow-md dark:border-amber-600 dark:text-amber-300 cursor-pointer',
                  state === 'locked' &&
                    'border-border bg-muted/40 text-muted-foreground/50',
                )}
              >
                {state === 'claimed' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : state === 'claimable' && claimingLevel === i ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  i + 1
                )}
              </button>
            ))}
          </div>

          <Separator />

          {/* Track picker */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-amber-500" />
                {sp.track
                  ? t('events.studyPass.trackLocked')
                  : t('events.studyPass.trackNone')}
              </p>
              {sp.track && (
                <Badge
                  variant={sp.track === 'gold' ? 'default' : 'secondary'}
                  className={cn(
                    'gap-1',
                    sp.track === 'gold' &&
                      'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0',
                  )}
                >
                  {sp.track === 'gold' ? <Crown className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {sp.track === 'gold'
                    ? t('events.studyPass.gold')
                    : t('events.studyPass.free')}
                </Badge>
              )}
            </div>

            {!sp.track ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  disabled={choosingTrack !== null}
                  onClick={() => handleChooseTrack('free')}
                >
                  {choosingTrack === 'free' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  {t('events.studyPass.chooseFree')}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600"
                      disabled={choosingTrack !== null}
                    >
                      {choosingTrack === 'gold' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Crown className="h-4 w-4" />
                      )}
                      {t('events.studyPass.chooseGold')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('events.studyPass.goldConfirmTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('events.studyPass.goldConfirmBody', {
                          cost: (current?.goldCost ?? 1500).toLocaleString(),
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
                        onClick={(e) => {
                          e.preventDefault();
                          void handleChooseTrack('gold');
                        }}
                      >
                        <Coins className="h-4 w-4" />
                        {t('events.studyPass.goldCost', {
                          cost: (current?.goldCost ?? 1500).toLocaleString(),
                        })}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {claimableLevels.length > 0
                  ? t('events.studyPass.claimHint', { count: claimableLevels.length })
                  : t('events.studyPass.claimed')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderQuestCard = (quest: EventQuest) => {
    const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));
    const canClaim = quest.completed && !quest.claimed;
    return (
      <Card key={quest.id} className="overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-sky-500/20 to-violet-500/20" />
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={cn('border', categoryStyles[quest.category] ?? categoryStyles.daily)}>
                  {t(`events.quests.category.${quest.category}`)}
                </Badge>
                {quest.claimed && (
                  <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('events.quests.claimed')}
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 font-semibold leading-tight">{quest.title}</p>
              {quest.story && <p className="mt-0.5 text-xs text-muted-foreground">{quest.story}</p>}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">
                {quest.progress.toLocaleString()} / {quest.target.toLocaleString()}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  canClaim
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                    : 'bg-gradient-to-r from-sky-500 to-violet-500',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {(Object.keys(quest.rewards) as string[]).map((key) => {
                const value = quest.rewards[key];
                const label =
                  key === 'stp'
                    ? `${String(value).toLocaleString()} STP`
                    : key === 'eventExp'
                      ? `${String(value)} EXP`
                      : String(value);
                return (
                  <Badge key={key} variant="secondary" className="gap-1 tabular-nums text-[11px]">
                    {key === 'stp' ? (
                      <Coins className="h-3 w-3 text-amber-500" />
                    ) : key === 'eventExp' ? (
                      <Zap className="h-3 w-3 text-violet-500" />
                    ) : (
                      <PackageOpen className="h-3 w-3 text-sky-500" />
                    )}
                    {label}
                  </Badge>
                );
              })}
            </div>
            {canClaim && (
              <Button
                size="sm"
                className="shrink-0"
                disabled={claimingQuest === quest.id}
                onClick={() => handleClaimQuest(quest.id)}
              >
                {claimingQuest === quest.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t('events.quests.claim')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderQuestSection = (category: 'daily' | 'weekly' | 'study' | 'puzzle') => {
    const quests = questsByCategory[category] ?? [];
    if (quests.length === 0) return null;
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t(`events.quests.category.${category}`)}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">{quests.map(renderQuestCard)}</div>
      </div>
    );
  };

  const tabs: Array<{ key: Tab; label: string; icon: typeof Trophy }> = [
    { key: 'event', label: t('events.studyPass.title'), icon: Trophy },
    { key: 'quests', label: t('events.quests.title'), icon: ListChecks },
    { key: 'items', label: t('events.items.title'), icon: PackageOpen },
    { key: 'extinction', label: t('events.extinction.title'), icon: Skull },
    ...(isAdmin ? [{ key: 'admin' as Tab, label: t('events.admin.title'), icon: Gavel }] : []),
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('common.loading')}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarDays className="h-6 w-6 text-emerald-500" />
            {t('events.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('events.subtitle')}</p>
        </div>

        {/* Notice + error banners */}
        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-emerald-300/60 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {notice}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-red-300/60 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300"
            >
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current event banner */}
        {event && (
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-violet-500/10" />
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-violet-500/10 blur-2xl" />
            <CardContent className="relative space-y-4 p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1 border-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                  <Zap className="h-3 w-3" />
                  {event.kind === 'fallback' ? t('events.fallbackBadge') : event.kind}
                </Badge>
                {statusBadge(event.status)}
                {daysLeft !== null && (
                  <Badge variant="secondary" className="gap-1 tabular-nums">
                    <CalendarDays className="h-3 w-3" />
                    {t('events.daysLeft', { count: daysLeft })}
                  </Badge>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight">{event.name}</h2>
                {event.story && (
                  <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {event.story}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t('events.startsOn')}: {new Date(event.startsAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t('events.endsOn')}: {new Date(event.endsAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <ScrollText className="h-3.5 w-3.5" />
                  {t('events.studyPass.claim')}: {new Date(event.claimDeadline).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {!event && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
            <CalendarDays className="h-8 w-8 opacity-50" />
            <p className="text-sm">{t('events.none')}</p>
            <Button size="sm" variant="outline" onClick={() => void fetchAll()}>
              <RefreshCw className="h-4 w-4" />
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border bg-card p-1 shadow-sm">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab === key
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'event' && studyPass && (
            <motion.div
              key="event"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {renderStudyPass(studyPass)}
            </motion.div>
          )}

          {tab === 'quests' && (
            <motion.div
              key="quests"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <ListChecks className="h-5 w-5 text-sky-500" />
                  {t('events.quests.title')}
                </h2>
                <p className="text-sm text-muted-foreground">{t('events.quests.subtitle')}</p>
              </div>
              {!current || current.quests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-14 text-muted-foreground">
                  <ListChecks className="h-8 w-8 opacity-50" />
                  <p className="text-sm">{t('events.quests.none')}</p>
                </div>
              ) : (
                <>
                  {renderQuestSection('daily')}
                  {renderQuestSection('weekly')}
                  {renderQuestSection('study')}
                  {renderQuestSection('puzzle')}
                </>
              )}
            </motion.div>
          )}

          {tab === 'items' && (
            <motion.div
              key="items"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <PackageOpen className="h-5 w-5 text-violet-500" />
                  {t('events.items.title')}
                </h2>
                <p className="text-sm text-muted-foreground">{t('events.items.subtitle')}</p>
              </div>

              {/* Item inventory */}
              {(!current || current.items.length === 0) ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-muted-foreground">
                  <PackageOpen className="h-8 w-8 opacity-50" />
                  <p className="text-sm">{t('events.items.none')}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {current.items.map((item) => (
                    <Card key={item.slug} className="overflow-hidden">
                      <div className="h-1 w-full bg-gradient-to-r from-violet-500/30 to-fuchsia-500/20" />
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold leading-tight">{item.name}</p>
                            {item.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                          <Badge className="gap-1 border-0 bg-violet-500/15 text-violet-600 dark:text-violet-300">
                            <PackageOpen className="h-3 w-3" />
                            ×{item.quantity}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {item.tradable ? (
                            <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300">
                              <Send className="h-3 w-3" />
                              {t('events.items.transfer')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Lock className="h-3 w-3" />
                              {t('events.studyPass.locked')}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Sigil transfer */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Send className="h-4 w-4 text-emerald-500" />
                    {t('events.items.transfer')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">{t('events.items.transferHint')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="max-w-xs"
                      placeholder={t('events.items.friendId')}
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                    />
                    <Input
                      className="w-24"
                      type="number"
                      min={1}
                      placeholder={t('events.items.quantity')}
                      value={transferQty}
                      onChange={(e) => setTransferQty(e.target.value)}
                    />
                    <Button disabled={transferBusy} onClick={() => void handleTransfer()}>
                      {transferBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {t('events.items.send')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Abstracted section */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Swords className="h-5 w-5 text-fuchsia-500" />
                    {t('events.abstracted.title')}
                  </h2>
                  <p className="text-sm text-muted-foreground">{t('events.abstracted.subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary" className="gap-1">
                    <PackageOpen className="h-3.5 w-3.5" />
                    {t('events.items.errorsHave', {
                      count:
                        current?.items.find((i) => i.slug === 'abstracted_error')?.quantity ?? 0,
                    })}
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400"
                      >
                        <Flame className="h-4 w-4" />
                        {t('events.items.redeemLimbo')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('events.items.limboTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('events.items.limboBody')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white"
                          disabled={limboBusy}
                          onClick={(e) => {
                            e.preventDefault();
                            void handleLimbo();
                          }}
                        >
                          {limboBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                          {t('events.items.redeemLimbo')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {abstracted.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-muted-foreground">
                    <Swords className="h-8 w-8 opacity-50" />
                    <p className="text-sm">{t('events.abstracted.none')}</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {abstracted.map((card) => (
                      <Card key={card.instanceId} className="overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-fuchsia-500/30 to-violet-500/20" />
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold leading-tight">{card.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground capitalize">{card.rarity}</p>
                            </div>
                            {rarityBadge(card.rarity)}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              className="h-9 text-xs"
                              placeholder={t('events.abstracted.reason')}
                              value={unabstractReason}
                              onChange={(e) => setUnabstractReason(e.target.value)}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="shrink-0 text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400">
                                  <Swords className="h-4 w-4" />
                                  {t('events.abstracted.unabstract')}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t('events.abstracted.unabstractTitle', { name: card.name })}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('events.abstracted.unabstractBody', {
                                      result: t('economy.rarity.legendary'),
                                      stp: '500',
                                    })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white"
                                    disabled={abstractedBusy === card.instanceId}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      void handleUnabstract(card);
                                    }}
                                  >
                                    {abstractedBusy === card.instanceId ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Swords className="h-4 w-4" />
                                    )}
                                    {t('events.abstracted.confirm')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {tab === 'extinction' && (
            <motion.div
              key="extinction"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Skull className="h-5 w-5 text-orange-500" />
                  {t('events.extinction.title')}
                </h2>
                <p className="text-sm text-muted-foreground">{t('events.extinction.subtitle')}</p>
              </div>

              {/* Milestones */}
              {milestones.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-orange-500" />
                      {t('events.extinction.milestone')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {milestones.map((m) => {
                      const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                      return (
                        <div key={m.id} className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <div>
                              <p className="font-semibold">{m.title}</p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {t('events.extinction.milestoneProgress', {
                                  progress: m.progress.toLocaleString(),
                                  target: m.target.toLocaleString(),
                                })}
                              </p>
                            </div>
                            {m.completed && !m.claimed ? (
                              <Button
                                size="sm"
                                disabled={claimingMilestone === m.id}
                                onClick={() => handleClaimMilestone(m.id)}
                              >
                                {claimingMilestone === m.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                                {t('events.extinction.claimMilestone')}
                              </Button>
                            ) : m.claimed ? (
                              <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('events.extinction.milestoneClaimed')}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Targets */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-orange-500" />
                    {t('events.extinction.targets')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {targets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('events.extinction.none')}</p>
                  ) : (
                    targets.map((target) => (
                      <div
                        key={target.cardKey}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Skull className="h-4 w-4 text-orange-500/70" />
                          <span className="font-medium">{target.name}</span>
                          {rarityBadge(target.rarity)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 tabular-nums">
                            <Coins className="h-3.5 w-3.5 text-amber-500" />
                            {t('events.extinction.value')}: {target.officialValue.toLocaleString()} STP
                          </span>
                          <span className="hidden sm:inline">· {target.reason}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {isAdmin && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Gavel className="h-4 w-4" />
                      {t('events.admin.seedTargets')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder={t('events.admin.cardKeys')}
                      value={seedKeys}
                      onChange={(e) => setSeedKeys(e.target.value)}
                    />
                    <Input
                      placeholder={t('events.admin.reason')}
                      value={seedReason}
                      onChange={(e) => setSeedReason(e.target.value)}
                    />
                    <Button size="sm" variant="outline" disabled={adminBusy} onClick={() => void handleSeedTargets()}>
                      {adminBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      {t('events.admin.seedTargets')}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {tab === 'admin' && isAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Gavel className="h-5 w-5" />
                  {t('events.admin.title')}
                </h2>
                <p className="text-sm text-muted-foreground">{t('events.admin.subtitle')}</p>
              </div>

              {/* Create event */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CalendarPlus className="h-4 w-4" />
                    {t('events.admin.create')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder={t('events.admin.slug')}
                    value={adminForm.slug}
                    onChange={(e) => setAdminForm((p) => ({ ...p, slug: e.target.value }))}
                  />
                  <Input
                    placeholder={t('events.admin.name')}
                    value={adminForm.name}
                    onChange={(e) => setAdminForm((p) => ({ ...p, name: e.target.value }))}
                  />
                  <Input
                    className="sm:col-span-2"
                    placeholder={t('events.admin.story')}
                    value={adminForm.story}
                    onChange={(e) => setAdminForm((p) => ({ ...p, story: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    placeholder={t('events.admin.startsAt')}
                    value={adminForm.startsAt}
                    onChange={(e) => setAdminForm((p) => ({ ...p, startsAt: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    placeholder={t('events.admin.endsAt')}
                    value={adminForm.endsAt}
                    onChange={(e) => setAdminForm((p) => ({ ...p, endsAt: e.target.value }))}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder={t('events.admin.graceHours')}
                    value={adminForm.graceHours}
                    onChange={(e) => setAdminForm((p) => ({ ...p, graceHours: e.target.value }))}
                  />
                  <Input
                    placeholder={t('events.admin.reason')}
                    value={adminForm.reason}
                    onChange={(e) => setAdminForm((p) => ({ ...p, reason: e.target.value }))}
                  />
                  <Button
                    className="sm:col-span-2"
                    disabled={adminBusy || !adminForm.slug || !adminForm.name || !adminForm.startsAt || !adminForm.endsAt}
                    onClick={() => void handleCreateEvent()}
                  >
                    {adminBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                    {t('events.admin.create')}
                  </Button>
                </CardContent>
              </Card>

              {/* Event list + activate */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4" />
                    {t('events.admin.activate')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input
                    placeholder={t('events.admin.reason')}
                    value={activateReason}
                    onChange={(e) => setActivateReason(e.target.value)}
                  />
                  {allEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ev.name}</span>
                        <span className="text-xs text-muted-foreground">{ev.slug}</span>
                        {statusBadge(ev.status)}
                      </div>
                      {ev.status === 'scheduled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activatingId === ev.id}
                          onClick={() => handleActivate(ev.id)}
                        >
                          {activatingId === ev.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          {t('events.admin.activate')}
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer hint */}
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
          <Users className="h-4 w-4 shrink-0 text-emerald-500" />
          {t('events.subtitle')}
        </div>
      </div>
    </DashboardLayout>
  );
}
