import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useStudySetsStore } from '@/stores/useStudySetsStore';
import { useGamificationStore } from '@/stores/useGamificationStore';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { XPProgressBar } from '@/components/XPProgressBar';
import { studyToolsService } from '@/services/studyTools';
import { cn } from '@/lib/utils';
import {
  Plus,
  Library,
  Brain,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Trophy,
  PlayCircle,
  Zap,
  Calendar,
  Gamepad2,
  ListTodo,
  Flame,
  Timer,
  BookOpen,
  GraduationCap,
  NotebookPen,
  Target,
  Eye,
  EyeOff,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { DashboardSummary, StudySet } from '@/types';

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 17) return 'dashboard.greeting.afternoon';
  return 'dashboard.greeting.evening';
}

function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      to={href}
      className="bg-card border border-border rounded-xl p-5 hover:border-emerald-500/50 hover:shadow-lg transition-all group"
    >
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold mb-1 group-hover:text-emerald-500 transition-colors">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  color,
  delay = 0,
  href,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  color: string;
  delay?: number;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  const cls = "bg-card border border-border rounded-xl p-5 hover:border-emerald-500/40 transition-all";
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={cls}>
      {href ? <Link to={href} className="block">{inner}</Link> : inner}
    </motion.div>
  );
}

function Widget({
  icon: Icon,
  title,
  children,
  delay = 0,
  href,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  delay?: number;
  href?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-emerald-600" />
          {title}
        </h3>
        {href && (
          <Link to={href} className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors">
            {title === '' ? '' : '→'}
          </Link>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function recommendationColor(kind: string): string {
  switch (kind) {
    case 'exam': return 'from-sky-600 to-indigo-600';
    case 'flashcards': return 'from-blue-600 to-cyan-600';
    case 'tasks': return 'from-amber-600 to-orange-600';
    case 'mistakes': return 'from-rose-600 to-pink-600';
    case 'puzzle': return 'from-violet-600 to-fuchsia-600';
    default: return 'from-emerald-600 to-teal-600';
  }
}

export function DashboardHomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { studySets, isLoading, fetchStudySets } = useStudySetsStore();
  const { fetchGamification } = useGamificationStore();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [prefs, setPrefs] = useState<{ hideGameStats: boolean }>({ hideGameStats: false });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    fetchStudySets({ limit: 5 });
    fetchGamification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStudySets]);

  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const [data, preferenceData] = await Promise.all([
        studyToolsService.dashboardSummary(),
        studyToolsService.getPreferences(),
      ]);
      setSummary(data);
      setPrefs(preferenceData);
      setSummaryError(false);
    } catch (error) {
      console.error('Failed to fetch dashboard summary:', error);
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const toggleHideGameStats = async () => {
    const next = !prefs.hideGameStats;
    setPrefs({ hideGameStats: next });
    try {
      await studyToolsService.setPreferences({ hideGameStats: next });
      await fetchSummary();
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  };

  const recentStudySets = studySets.slice(0, 5);
  const totalDue = summary?.flashcardsDue ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                {t('dashboard.welcome', { greeting: t(getGreetingKey()), name: user?.name?.split(' ')[0] || 'Learner' })}{' '}
                <span className="inline-block origin-[70%_70%] animate-wave">👋</span>
              </h1>
              <p className="text-muted-foreground">
                {summaryError
                  ? t('dashboard.summaryUnavailable')
                  : totalDue > 0
                    ? t('dashboard.cardsWaiting', { count: totalDue })
                    : t('dashboard.readyToContinue')}
              </p>
            </div>
            {/* Hide game stats toggle */}
            <button
              onClick={toggleHideGameStats}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                prefs.hideGameStats
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'border-border text-muted-foreground hover:border-emerald-500/40',
              )}
            >
              {prefs.hideGameStats ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {prefs.hideGameStats ? t('dashboard.gameStatsHidden') : t('dashboard.hideGameStats')}
            </button>
          </div>
        </motion.div>

        {/* Recommended next action */}
        {summary && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Link
              to={recommendationHref(summary.recommendedAction.kind)}
              className={cn(
                'flex items-center gap-4 rounded-2xl bg-gradient-to-r p-5 text-white shadow-lg transition-transform hover:scale-[1.01]',
                recommendationColor(summary.recommendedAction.kind),
              )}
            >
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                  {t('dashboard.recommendedNext')}
                </p>
                <p className="font-semibold truncate">{recommendationLabel(summary.recommendedAction, t)}</p>
              </div>
              <ArrowRight className="w-5 h-5 shrink-0" />
            </Link>
          </motion.div>
        )}

        {/* XP Progress Bar (hidden when game stats hidden) */}
        {!prefs.hideGameStats && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-4">
            <XPProgressBar />
          </motion.div>
        )}

        {summaryLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : summary ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Timer}
                value={`${summary.focusMinutesToday}m`}
                label={t('dashboard.stats.focusToday')}
                color="bg-emerald-500/10 text-emerald-500"
                delay={0.1}
                href="/dashboard/focus"
              />
              <StatCard
                icon={ListTodo}
                value={summary.todayPlan.tasksDueToday}
                label={t('dashboard.stats.tasksDue')}
                color="bg-amber-500/10 text-amber-500"
                delay={0.15}
                href="/dashboard/tasks"
              />
              <StatCard
                icon={BookOpen}
                value={summary.flashcardsDue}
                label={t('dashboard.stats.dueToday')}
                color="bg-blue-500/10 text-blue-500"
                delay={0.2}
                href="/dashboard/study-sets"
              />
              <StatCard
                icon={Target}
                value={summary.quizAccuracy30d !== null ? `${summary.quizAccuracy30d}%` : '—'}
                label={t('dashboard.stats.quizAccuracy')}
                color="bg-purple-500/10 text-purple-500"
                delay={0.25}
                href="/dashboard/analytics"
              />
            </div>

            {/* Widgets row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Today's plan */}
              <Widget icon={ListTodo} title={t('dashboard.todaysPlan')} delay={0.3} href="/dashboard/tasks">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('dashboard.tasksDueToday')}</span>
                    <span className="font-bold">{summary.todayPlan.tasksDueToday}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('dashboard.overdue')}</span>
                    <span className={cn('font-bold', summary.todayPlan.tasksDueNow > 0 ? 'text-rose-500' : 'text-emerald-500')}>
                      {summary.todayPlan.tasksDueNow}
                    </span>
                  </div>
                  {summary.todayPlan.nextTask && (
                    <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                      <p className="text-muted-foreground mb-0.5">{t('dashboard.nextUp')}</p>
                      <p className="font-medium truncate">{summary.todayPlan.nextTask.title}</p>
                    </div>
                  )}
                </div>
              </Widget>

              {/* Upcoming exams */}
              <Widget icon={Calendar} title={t('dashboard.upcomingExams')} delay={0.35} href="/dashboard/exam-centre">
                {summary.upcomingExams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('dashboard.noUpcomingExams')}</p>
                ) : (
                  <div className="space-y-2">
                    {summary.upcomingExams.slice(0, 3).map((exam) => (
                      <div key={exam.id} className="flex items-center gap-3 text-sm">
                        <div className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                          exam.daysUntil > 14 ? 'bg-emerald-500/10 text-emerald-500' : exam.daysUntil > 7 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500',
                        )}>
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{exam.name}</p>
                          <p className="text-xs text-muted-foreground">{exam.subject ?? t('dashboard.exam')}</p>
                        </div>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0',
                          exam.daysUntil > 14 ? 'bg-emerald-500/10 text-emerald-600' : exam.daysUntil > 7 ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600',
                        )}>
                          {t('common.daysLeft', { count: exam.daysUntil })}
                        </span>
                      </div>
                    ))}
                    {summary.currentExamPortions > 0 && (
                      <p className="text-xs text-muted-foreground pt-1">
                        {t('dashboard.examPortions', { count: summary.currentExamPortions })}
                      </p>
                    )}
                  </div>
                )}
              </Widget>

              {/* Focus + flashcards */}
              <Widget icon={Timer} title={t('dashboard.focusThisWeek')} delay={0.4} href="/dashboard/focus">
                <div className="flex items-end gap-1.5 h-20">
                  {summary.focusMinutesToday > 0 ? (
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-teal-500 flex items-end justify-center pb-1 text-[10px] font-semibold text-white"
                      style={{ height: `${Math.min(100, (summary.focusMinutesToday / 120) * 100)}%` }}>
                      {summary.focusMinutesToday}m
                    </div>
                  ) : (
                    <div className="w-full h-1.5 rounded-full bg-muted self-center" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {summary.focusMinutesToday > 0
                    ? t('dashboard.focusTodayMsg', { minutes: summary.focusMinutesToday })
                    : t('dashboard.noFocusYet')}
                </p>
              </Widget>
            </div>

            {/* Second widget row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Mistakes */}
              <Widget icon={NotebookPen} title={t('dashboard.recentMistakes')} delay={0.45} href="/dashboard/mistakes">
                {summary.recentMistakes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('dashboard.noMistakes')}</p>
                ) : (
                  <div className="space-y-2">
                    {summary.recentMistakes.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <p className="truncate text-xs">{m.questionText}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Widget>

              {/* Weak topics */}
              <Widget icon={TrendingUp} title={t('dashboard.weakTopics')} delay={0.5} href="/dashboard/analytics">
                {summary.weakTopics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('dashboard.noWeakTopics')}</p>
                ) : (
                  <div className="space-y-2">
                    {summary.weakTopics.map((topic) => (
                      <div key={topic.topic} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate text-xs">{topic.topic}</span>
                        <span className="text-xs font-semibold text-rose-500">{topic.accuracy}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </Widget>

              {/* Streaks / game stats */}
              <Widget
                icon={prefs.hideGameStats ? Flame : Trophy}
                title={prefs.hideGameStats ? t('dashboard.studyStreak') : t('dashboard.gameStats')}
                delay={0.55}
              >
                {prefs.hideGameStats ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('dashboard.studyStreak')}</span>
                      <span className="font-bold flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-500" /> {summary.studyStreakDays}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('dashboard.puzzleBest')}</span>
                      <span className="font-bold">{summary.puzzleStreak.best}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('dashboard.playerXp')}</span>
                      <span className="font-bold text-violet-600 dark:text-violet-300">{summary.gameStats.playerXp}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('dashboard.eventExp')}</span>
                      <span className="font-bold">{summary.gameStats.eventExp}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('dashboard.stpToday')}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-300">{summary.gameStats.stpToday}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('dashboard.studyStreak')}</span>
                      <span className="font-bold flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-500" /> {summary.studyStreakDays}
                      </span>
                    </div>
                    {summary.gameStats.dailyQuests.map((quest) => (
                      <div key={quest.id} className="flex items-center gap-2 text-xs">
                        <span className={cn('w-4 h-4 rounded-md border flex items-center justify-center', quest.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border')}>
                          {quest.done && '✓'}
                        </span>
                        <span className={quest.done ? 'line-through text-muted-foreground' : ''}>{quest.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Widget>
            </div>

            {/* Continue studying */}
            {totalDue > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                <Link to="/dashboard/study-sets" className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-5 flex items-center justify-between gap-4 hover:border-emerald-500/40 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <PlayCircle className="w-7 h-7 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t('dashboard.continueStudying')}</p>
                      <h3 className="font-semibold text-lg">
                        {t('dashboard.cardsDueForReview', { count: totalDue })}
                      </h3>
                    </div>
                  </div>
                  <Button className="bg-emerald-500 hover:bg-emerald-600" asChild>
                    <span><Zap className="w-4 h-4 mr-2" />{t('dashboard.studyNow')}</span>
                  </Button>
                </Link>
              </motion.div>
            )}
          </>
        ) : null}

        {/* Quick actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <h2 className="text-lg font-semibold mb-4">{t('dashboard.quickActions.title')}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionCard
              icon={Plus}
              title={t('dashboard.quickActions.newStudySet')}
              description={t('dashboard.quickActions.newStudySetDesc')}
              href="/dashboard/study-sets/create"
              color="bg-emerald-500/10 text-emerald-500"
            />
            <QuickActionCard
              icon={Brain}
              title={t('dashboard.quickActions.knowledgeBase')}
              description={t('dashboard.quickActions.knowledgeBaseDesc')}
              href="/dashboard/knowledge-base"
              color="bg-purple-500/10 text-purple-500"
            />
            <QuickActionCard
              icon={MessageSquare}
              title={t('dashboard.quickActions.aiChat')}
              description={t('dashboard.quickActions.aiChatDesc')}
              href="/dashboard/chat"
              color="bg-blue-500/10 text-blue-500"
            />
            <QuickActionCard
              icon={Gamepad2}
              title={t('dashboard.quickActions.joinLiveQuiz')}
              description={t('dashboard.quickActions.joinLiveQuizDesc')}
              href="/dashboard/live-quiz"
              color="bg-pink-500/10 text-pink-500"
            />
          </div>
        </motion.div>

        {/* Recent study sets */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('dashboard.recentStudySets')}</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/study-sets">
                {t('common.viewAll')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="w-6 h-6" />
            </div>
          ) : recentStudySets.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Library className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('dashboard.noStudySetsYet')}</h3>
              <p className="text-muted-foreground mb-4">{t('dashboard.createFirstStudySet')}</p>
              <Button className="bg-emerald-500 hover:bg-emerald-600" asChild>
                <Link to="/dashboard/study-sets/create">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('dashboard.createStudySet')}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentStudySets.map((studySet) => (
                <RecentStudySetCard key={studySet.id} studySet={studySet} />
              ))}
            </div>
          )}
        </motion.div>

        {/* Pro banner */}
        {user?.plan === 'free' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('dashboard.upgradeBanner.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('dashboard.upgradeBanner.description')}</p>
                </div>
              </div>
              <Button className="bg-emerald-500 hover:bg-emerald-600" asChild>
                <Link to="/pricing">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t('common.upgradeNow')}
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

function recommendationLabel(
  action: DashboardSummary['recommendedAction'],
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  switch (action.kind) {
    case 'exam':
      return action.daysUntil === 0
        ? t('dashboard.recommend.examToday', { name: action.examName })
        : t('dashboard.recommend.examIn', { name: action.examName, days: action.daysUntil });
    case 'flashcards':
      return t('dashboard.recommend.flashcards', { count: action.count });
    case 'tasks':
      return t('dashboard.recommend.tasks', { count: action.count });
    case 'mistakes':
      return t('dashboard.recommend.mistakes', { count: action.count });
    case 'puzzle':
      return t('dashboard.recommend.puzzle');
    default:
      return t('dashboard.recommend.relax');
  }
}

function recommendationHref(kind: string): string {
  switch (kind) {
    case 'exam': return '/dashboard/exam-centre';
    case 'flashcards': return '/dashboard/study-sets';
    case 'tasks': return '/dashboard/tasks';
    case 'mistakes': return '/dashboard/mistakes';
    case 'puzzle': return '/dashboard/puzzles';
    default: return '/dashboard';
  }
}

function RecentStudySetCard({ studySet }: { studySet: StudySet }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/dashboard/study-sets/${studySet.id}`}
      className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-emerald-500/50 hover:shadow-md transition-all"
    >
      {studySet.coverImageUrl ? (
        <img src={studySet.coverImageUrl} alt={studySet.title} className="w-12 h-12 rounded-lg object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <Library className="w-6 h-6 text-emerald-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate">{studySet.title}</h4>
        <p className="text-sm text-muted-foreground">
          {studySet.flashcardsCount} {t('common.cards')}
        </p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}
