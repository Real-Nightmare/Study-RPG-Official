import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { studyToolsService } from '@/services/studyTools';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Timer,
  Play,
  Pause,
  Square,
  Trash2,
  Flame,
  Clock,
  HeartPulse,
  Moon,
  Coffee,
  TrendingDown,
} from 'lucide-react';
import type { FocusSession, FocusWellbeing, StudyHealthBand } from '@/types';

const bandStyles: Record<StudyHealthBand, { bar: string; chip: string; text: string }> = {
  fresh: { bar: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
  focused: { bar: 'bg-sky-500', chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', text: 'text-sky-600 dark:text-sky-400' },
  draining: { bar: 'bg-amber-500', chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  depleted: { bar: 'bg-rose-500', chip: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', text: 'text-rose-600 dark:text-rose-400' },
};

export default function FocusSessionsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [today, setToday] = useState<{ totalMinutes: number; bySubject: Array<{ subject: string; minutes: number }> }>({ totalMinutes: 0, bySubject: [] });
  const [wellbeing, setWellbeing] = useState<FocusWellbeing | null>(null);
  const [subject, setSubject] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(() => sessions.find((s) => s.status !== 'completed'), [sessions]);

  const fetchData = useCallback(async () => {
    try {
      const [list, todayData, wellbeingData] = await Promise.all([
        studyToolsService.listFocusSessions(),
        studyToolsService.focusToday(),
        studyToolsService.focusWellbeing().catch(() => null),
      ]);
      setSessions(list);
      setToday(todayData);
      setWellbeing(wellbeingData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch focus sessions:', err);
      setError(t('focusSessions.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live elapsed timer for the running/paused session.
  useEffect(() => {
    if (!active || active.status === 'completed') {
      setElapsed(0);
      return;
    }
    if (active.status === 'paused') {
      setElapsed(active.focusMinutes * 60);
      return;
    }
    const started = new Date(active.startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [active]);

  const format = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const handleStart = async () => {
    try {
      setIsStarting(true);
      await studyToolsService.startFocusSession({ subject: subject.trim() || undefined });
      setSubject('');
      await fetchData();
    } catch (err) {
      console.error('Failed to start session:', err);
      // Surface the server's health-first message when available.
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
          : '';
      setError(msg || t('focusSessions.alreadyActive'));
    } finally {
      setIsStarting(false);
    }
  };

  const handleAction = async (action: 'pause' | 'resume' | 'complete', id: string) => {
    try {
      if (action === 'pause') await studyToolsService.pauseFocusSession(id);
      if (action === 'resume') await studyToolsService.resumeFocusSession(id);
      if (action === 'complete') await studyToolsService.completeFocusSession(id);
      await fetchData();
    } catch (err) {
      console.error('Failed focus action:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('focusSessions.deleteConfirm'))) return;
    try {
      await studyToolsService.deleteFocusSession(id);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const band = wellbeing?.band ?? 'fresh';
  const styles = bandStyles[band];
  const startDisabled =
    isStarting || (wellbeing !== null && !wellbeing.canStart) || (wellbeing === null && isLoading);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Timer className="w-6 h-6 text-emerald-600" />
            {t('focusSessions.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('focusSessions.subtitle')}</p>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-center text-sm text-amber-600">{error}</CardContent>
          </Card>
        )}

        {/* Study Health — anti-overstudy meter (spec 015) */}
        {wellbeing && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HeartPulse className={cn('w-4 h-4', styles.text)} />
                {t('wellbeing.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>
                    {t('wellbeing.today')}: <span className="font-semibold text-foreground">{wellbeing.todayMinutes} {t('focusSessions.minutes')}</span>
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 font-medium', styles.chip)}>
                    {t(`wellbeing.band.${wellbeing.band}`)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={cn('h-full rounded-full', styles.bar)}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, wellbeing.healthPercent)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {t('wellbeing.optimal', { min: wellbeing.optimalDailyMinutes })} ·{' '}
                  {t('wellbeing.budget', { min: wellbeing.budgetRemaining })}
                </p>
              </div>

              {/* Cooldown — rest window between long blocks */}
              {wellbeing.cooldownActive && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-xl border border-sky-500/25 bg-sky-500/10 p-3.5"
                >
                  <Coffee className="h-4 w-4 shrink-0 text-sky-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('wellbeing.cooldownTitle')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('wellbeing.cooldownBody', { min: wellbeing.cooldownMinutesLeft })}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Night-window nudge */}
              {!active && wellbeing.nightStudy && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3.5"
                >
                  <Moon className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('wellbeing.nightTitle')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('wellbeing.nightBody')}</p>
                  </div>
                </motion.div>
              )}

              {/* Diminishing returns */}
              {!active && wellbeing.band !== 'fresh' && wellbeing.band !== 'focused' && !wellbeing.cooldownActive && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5">
                  <TrendingDown className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('wellbeing.diminishingTitle')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('wellbeing.diminishingBody', { mult: wellbeing.rewardFactor.toFixed(2) })}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Active session card */}
        <Card className="overflow-hidden">
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {active ? t('focusSessions.nowFocusing') : t('focusSessions.startFocus')}
              </p>
              <div className="text-5xl md:text-6xl font-bold tabular-nums tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                {format(elapsed)}
              </div>
              {active?.subject && (
                <p className="text-sm text-muted-foreground">
                  {active.subject} · {active.status === 'paused' ? t('focusSessions.paused') : ''}
                </p>
              )}
              {!active && (
                <div className="flex justify-center gap-2 max-w-sm mx-auto">
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !startDisabled && handleStart()}
                    placeholder={t('focusSessions.subjectPlaceholder')}
                    className="text-center"
                  />
                </div>
              )}
              <div className="flex justify-center gap-3 pt-2">
                {!active && (
                  <Button
                    onClick={handleStart}
                    disabled={startDisabled}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-8"
                  >
                    {isStarting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {t('focusSessions.start')}
                  </Button>
                )}
                {active?.status === 'running' && (
                  <>
                    <Button variant="outline" onClick={() => handleAction('pause', active.id)}>
                      <Pause className="w-4 h-4 mr-2" /> {t('focusSessions.pause')}
                    </Button>
                    <Button
                      onClick={() => handleAction('complete', active.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <Square className="w-4 h-4 mr-2" /> {t('focusSessions.complete')}
                    </Button>
                  </>
                )}
                {active?.status === 'paused' && (
                  <>
                    <Button onClick={() => handleAction('resume', active.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      <Play className="w-4 h-4 mr-2" /> {t('focusSessions.resume')}
                    </Button>
                    <Button
                      onClick={() => handleAction('complete', active.id)}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                    >
                      <Square className="w-4 h-4 mr-2" /> {t('focusSessions.complete')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" /> {t('focusSessions.today')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{today.totalMinutes} <span className="text-sm font-normal text-muted-foreground">{t('focusSessions.minutes')}</span></p>
            </CardContent>
          </Card>
          {today.bySubject.slice(0, 2).map((entry) => (
            <Card key={entry.subject}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 truncate">
                  <Clock className="w-4 h-4 text-emerald-500 shrink-0" /> {entry.subject}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{entry.minutes} <span className="text-sm font-normal text-muted-foreground">{t('focusSessions.minutes')}</span></p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('focusSessions.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('focusSessions.noSessions')}</p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {sessions.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 rounded-lg border px-4 py-3"
                    >
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          session.status === 'completed' ? 'bg-emerald-500' : session.status === 'paused' ? 'bg-amber-500' : 'bg-sky-500 animate-pulse',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{session.subject ?? t('focusSessions.general')}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.startedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {session.focusMinutes} <span className="text-xs text-muted-foreground font-normal">{t('focusSessions.minutes')}</span>
                      </span>
                      {session.status === 'completed' && (
                        <button
                          onClick={() => handleDelete(session.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
