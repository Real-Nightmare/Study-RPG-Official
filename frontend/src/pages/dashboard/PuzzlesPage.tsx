import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { studyToolsService } from '@/services/studyTools';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Puzzle as PuzzleIcon,
  Flame,
  Trophy,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { NextPuzzleResponse, PuzzleSubjectOverview } from '@/types';

type Mode = 'ranked' | 'practice';

export default function PuzzlesPage() {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState<PuzzleSubjectOverview[]>([]);
  const [activeSubject, setActiveSubject] = useState('');
  const [mode, setMode] = useState<Mode>('ranked');
  const [next, setNext] = useState<NextPuzzleResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: boolean; answerKey: string; explanation: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState<Array<{ id: string; subject: string; mode: string; isCorrect: boolean; streakAfter: number; createdAt: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    try {
      const data = await studyToolsService.puzzleSubjects();
      setSubjects(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch puzzle subjects:', err);
      setError(t('puzzles.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const fetchAttempts = useCallback(async () => {
    try {
      setAttempts(await studyToolsService.puzzleAttempts());
    } catch (err) {
      console.error('Failed to fetch attempts:', err);
    }
  }, []);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  const activeOverview = useMemo(
    () => subjects.find((s) => s.subject === activeSubject) ?? null,
    [subjects, activeSubject],
  );

  const handleSubjectChange = async (subject: string) => {
    setActiveSubject(subject);
    setSelected(null);
    setResult(null);
    setNext(null);
    if (!subject) return;
    await handleNext(subject, mode);
  };

  const handleModeChange = async (nextMode: Mode) => {
    setMode(nextMode);
    setSelected(null);
    setResult(null);
    if (activeSubject) {
      await handleNext(activeSubject, nextMode);
    }
  };

  const handleNext = async (subject: string, m: Mode) => {
    try {
      setIsFetching(true);
      const data = await studyToolsService.nextPuzzle(subject, m);
      setNext(data);
      setSelected(null);
      setResult(null);
    } catch (err) {
      console.error('Failed to fetch next puzzle:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSelect = (key: string) => {
    if (result) return;
    setSelected(key);
  };

  const handleSubmit = async () => {
    if (!selected || !next?.puzzle) return;
    try {
      setIsSubmitting(true);
      const data = await studyToolsService.submitPuzzle(next.puzzle.id, {
        selectedKey: selected,
        mode,
      });
      setResult({ correct: data.correct, answerKey: data.answerKey, explanation: data.explanation });
      await Promise.all([fetchSubjects(), fetchAttempts()]);
    } catch (err) {
      console.error('Failed to submit puzzle:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PuzzleIcon className="w-6 h-6 text-violet-600" />
            {t('puzzles.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('puzzles.subtitle')}</p>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-center text-sm text-amber-600">{error}</CardContent>
          </Card>
        )}

        {/* Subject streak cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <Card><CardContent className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
          ) : subjects.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t('puzzles.noSubjects')}
              </CardContent>
            </Card>
          ) : (
            subjects.map((s) => (
              <button
                key={s.subject}
                onClick={() => handleSubjectChange(s.subject)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all hover:shadow-md',
                  activeSubject === s.subject
                    ? 'border-violet-500/50 bg-violet-500/5 ring-2 ring-violet-500/20'
                    : 'bg-card hover:border-violet-500/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{s.subject}</span>
                  <span className="flex items-center gap-1 text-xs text-orange-500 font-semibold">
                    <Flame className="w-3.5 h-3.5" /> {s.streak}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-500" /> {s.personalBest}</span>
                  <span>{s.total} {t('puzzles.total')}</span>
                  <span>{s.rankedToday} {t('puzzles.rankedToday')}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Mode toggle */}
        <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1">
          {(['ranked', 'practice'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                mode === m
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {t(`puzzles.mode_${m}`)}
            </button>
          ))}
        </div>

        {/* Puzzle card */}
        <Card className="overflow-hidden">
          <CardContent className="py-8">
            {!activeSubject ? (
              <div className="text-center py-8">
                <PuzzleIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('puzzles.pickSubject')}</p>
              </div>
            ) : isFetching ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
              </div>
            ) : next?.dailyLimitReached ? (
              <div className="text-center py-10">
                <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <p className="text-sm font-medium">{t('puzzles.dailyLimit')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('puzzles.dailyLimitHint')}</p>
              </div>
            ) : !next?.puzzle ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">{t('puzzles.noneLeft')}</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => handleNext(activeSubject, mode)}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {t('puzzles.retry')}
                </Button>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300 text-xs font-semibold">
                    {activeSubject} · {next.puzzle.difficulty}
                  </span>
                  {activeOverview && (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-500">
                      <Flame className="w-4 h-4" /> {next.streak.streak}
                      <span className="text-xs text-muted-foreground font-normal">
                        / {t('puzzles.best', { best: next.streak.personalBest })}
                      </span>
                    </span>
                  )}
                </div>

                <p className="text-lg font-semibold leading-relaxed">{next.puzzle.question}</p>

                <div className="space-y-2.5">
                  <AnimatePresence>
                    {next.puzzle.choices.map((choice) => {
                      const isSelected = selected === choice.key;
                      const showCorrect = result !== null && choice.key === result.answerKey;
                      const showWrong = result !== null && isSelected && choice.key !== result.answerKey;
                      return (
                        <motion.button
                          key={choice.key}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => handleSelect(choice.key)}
                          disabled={!!result}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all',
                            showCorrect
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : showWrong
                                ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                : isSelected
                                  ? 'border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/20'
                                  : 'border-border hover:border-violet-500/40 hover:bg-muted/40',
                            !result && !isSelected && 'cursor-pointer',
                          )}
                        >
                          <span className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0">
                            {choice.key}
                          </span>
                          {choice.text}
                          {showCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />}
                          {showWrong && <XCircle className="w-4 h-4 text-rose-500 ml-auto shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {result ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-xl p-4 text-sm',
                      result.correct ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                    )}
                  >
                    <p className="font-semibold flex items-center gap-2">
                      {result.correct ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {result.correct ? t('puzzles.correct') : t('puzzles.incorrect')}
                      <span className="font-normal text-xs opacity-80">
                        {t('puzzles.answer')}: {result.answerKey}
                      </span>
                    </p>
                    {result.explanation && <p className="mt-2 text-xs opacity-90">{result.explanation}</p>}
                    <Button
                      size="sm"
                      className="mt-4 bg-violet-600 hover:bg-violet-500 text-white"
                      onClick={() => handleNext(activeSubject, mode)}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {t('puzzles.next')}
                    </Button>
                  </motion.div>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!selected || isSubmitting}
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {t('puzzles.submit')}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent attempts */}
        {attempts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('puzzles.history')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {attempts.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', a.isCorrect ? 'bg-emerald-500' : 'bg-rose-500')} />
                    <span className="font-medium">{a.subject}</span>
                    <span className="text-xs text-muted-foreground">{t(`puzzles.mode_${a.mode}`)}</span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-orange-500 font-semibold">
                      <Flame className="w-3 h-3" /> {a.streakAfter}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
