import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { factionsService } from '@/services/factions';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Users2,
  Trophy,
  Vote,
  HandHeart,
  ShieldCheck,
  ChevronRight,
  Crown,
  Target,
  HeartHandshake,
} from 'lucide-react';
import type { ElectionResult, Faction, FactionMember, HelpPledge } from '@/types';

const colorStyles: Record<string, string> = {
  indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  sky: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300',
};

export default function FactionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'teacher';

  const [factions, setFactions] = useState<Faction[]>([]);
  const [mine, setMine] = useState<Faction | null>(null);
  const [pledges, setPledges] = useState<HelpPledge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Faction | null>(null);
  const [members, setMembers] = useState<FactionMember[]>([]);
  const [election, setElection] = useState<ElectionResult[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [factionData, mineData, pledgeData] = await Promise.all([
        factionsService.leaderboard(),
        factionsService.mine(),
        factionsService.helpPledges(),
      ]);
      setFactions(factionData);
      setMine(mineData);
      setPledges(pledgeData);
      setError(null);
    } catch (err) {
      console.error('Failed to load factions:', err);
      setError(t('factions.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openDetail = async (faction: Faction) => {
    setSelected(faction);
    setDetailLoading(true);
    try {
      const [memberData, electionData] = await Promise.all([
        factionsService.members(faction.id),
        factionsService.election(faction.id),
      ]);
      setMembers(memberData);
      setElection(electionData);
    } catch (err) {
      console.error('Failed to load faction detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const joinDefault = async () => {
    try {
      const assigned = await factionsService.autoAssign(null);
      setMine(assigned);
      await fetchAll();
    } catch (err) {
      console.error('Failed to auto-assign:', err);
      setError(t('factions.assignError'));
    }
  };

  const vote = async (candidateId: string) => {
    if (!mine) return;
    try {
      await factionsService.vote(mine.id, candidateId);
      const [memberData, electionData] = await Promise.all([
        factionsService.members(mine.id),
        factionsService.election(mine.id),
      ]);
      setMembers(memberData);
      setElection(electionData);
    } catch (err) {
      console.error('Failed to vote:', err);
      setError(t('factions.voteError'));
    }
  };

  const recordHelp = async () => {
    if (!mine) return;
    const note = window.prompt(t('factions.helpNotePrompt'));
    if (note === null) return;
    try {
      await factionsService.recordHelp(mine.id, note || undefined);
      await fetchAll();
    } catch (err) {
      console.error('Failed to record help:', err);
      setError(t('factions.helpError'));
    }
  };

  const promoteLeaders = async (faction: Faction) => {
    try {
      await factionsService.promoteLeaders(faction.id);
      if (selected?.id === faction.id) {
        await openDetail(faction);
      }
      await fetchAll();
    } catch (err) {
      console.error('Failed to promote leaders:', err);
      setError(t('factions.promoteError'));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users2 className="w-6 h-6 text-emerald-600" />
            {t('factions.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('factions.subtitle')}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* My faction */}
            <Card className={cn(mine && 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-transparent')}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {t('factions.myFaction')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!mine ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <Users2 className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">{t('factions.noFaction')}</p>
                    <Button onClick={joinDefault} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      <Target className="h-4 w-4" />
                      {t('factions.joinDefault')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl',
                          colorStyles[mine.color] ?? colorStyles.indigo,
                        )}
                      >
                        🎓
                      </div>
                      <div>
                        <p className="font-semibold">{mine.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {mine.memberCount} {t('factions.members')} · {t('factions.targetSize')} {mine.targetSize}
                        </p>
                        {mine.myRole === 'leader' && (
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            <Crown className="h-3 w-3" /> {t('factions.leader')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">{mine.score}</p>
                      <p className="text-xs text-muted-foreground">{t('factions.score')}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openDetail(mine)}>
                      {t('factions.viewMembers')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  {t('factions.leaderboard')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {factions.map((faction, index) => (
                    <button
                      key={faction.id}
                      onClick={() => openDetail(faction)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent',
                        index === 0 && 'border-amber-500/40 bg-amber-500/5',
                        mine?.id === faction.id && 'border-emerald-500/40',
                      )}
                    >
                      <span className="w-6 shrink-0 text-center font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg',
                          colorStyles[faction.color] ?? colorStyles.indigo,
                        )}
                      >
                        {index === 0 ? '👑' : '🎓'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {faction.name}
                          {faction.programmeName && (
                            <span className="ml-2 text-xs text-muted-foreground">· {faction.programmeName}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {faction.memberCount} {t('factions.members')}
                        </p>
                      </div>
                      <span className="shrink-0 text-lg font-bold tabular-nums">{faction.score}</span>
                    </button>
                  ))}
                  {factions.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">{t('factions.none')}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Help pledges */}
            {pledges.length > 0 && (
              <Card className="border-emerald-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HeartHandshake className="h-4 w-4 text-emerald-600" />
                    {t('factions.helpPledges')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pledges.map((pledge) => (
                    <div key={pledge.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{pledge.helperName}</span>{' '}
                          {t('factions.pledgesTo')}{' '}
                          <span className="font-medium">{pledge.helpedName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('factions.period')} {pledge.periodKey} · {pledge.activityCount} {t('factions.helpActivities')}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          pledge.status === 'fulfilled'
                            ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                            : pledge.status === 'forfeited'
                              ? 'border-rose-500/30 text-rose-600 dark:text-rose-300'
                              : 'border-amber-500/30 text-amber-600 dark:text-amber-300'
                        }
                      >
                        {t(`factions.pledgeStatus.${pledge.status}`)}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Help action */}
            {mine && (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <HandHeart className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium">{t('factions.recordHelp')}</p>
                      <p className="text-xs text-muted-foreground">{t('factions.recordHelpHint')}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={recordHelp}>
                    <HeartHandshake className="h-4 w-4" />
                    {t('factions.recordHelpBtn')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl border text-xl',
                    colorStyles[selected.color] ?? colorStyles.indigo,
                  )}
                >
                  🎓
                </div>
                <div>
                  <h2 className="font-semibold">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.memberCount} {t('factions.members')} · {t('factions.score')} {selected.score}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto pr-1">
              {/* Members */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Users2 className="h-4 w-4 text-muted-foreground" />
                  {t('factions.members')}
                </p>
                {detailLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {members.map((member) => (
                      <div key={member.userId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        {member.role === 'leader' ? (
                          <Crown className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Users2 className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">{member.name}</span>
                        {member.role === 'leader' && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t('factions.leader')}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Election */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Vote className="h-4 w-4 text-muted-foreground" />
                  {t('factions.election')}
                </p>
                {detailLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : election.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('factions.noVotes')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {election.map((candidate, index) => {
                      const isMe = mine?.myRole === 'leader';
                      return (
                        <div key={candidate.userId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                          <span className="w-5 text-center font-bold text-muted-foreground">{index + 1}</span>
                          <span className="min-w-0 flex-1 truncate font-medium">{candidate.name}</span>
                          <span className="text-xs text-muted-foreground">{candidate.votes} 🗳️</span>
                          {!isMe && (
                            <Button size="sm" variant="outline" onClick={() => vote(candidate.userId)}>
                              {t('factions.vote')}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {isStaff && (
                  <Button size="sm" className="mt-3" variant="outline" onClick={() => promoteLeaders(selected)}>
                    <Crown className="h-4 w-4" />
                    {t('factions.promoteLeaders')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
