import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { academicsService } from '@/services/academics';
import { studyToolsService } from '@/services/studyTools';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Plus,
  Trash2,
  CalendarRange,
  CalendarClock,
  ClipboardCheck,
  TrendingUp,
  GraduationCap,
} from 'lucide-react';
import type { ExamPeriod, ExamResult } from '@/types';

const statusStyles: Record<string, { badge: string; dot: string }> = {
  upcoming: { badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-300', dot: 'bg-sky-500' },
  live: { badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', dot: 'bg-emerald-500 animate-pulse' },
  ended: { badge: 'bg-slate-500/10 text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' },
};

export default function ExamCentrePage() {
  const { t } = useTranslation();
  const [periods, setPeriods] = useState<ExamPeriod[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [exams, setExams] = useState<Array<{ id: string; name: string; examDate: string | null; subjectName: string | null }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', notes: '' });

  // Result modal state
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ marksObtained: '', marksTotal: '', mistakeAnalysis: '', revisionPlan: '' });
  const [isSavingResult, setIsSavingResult] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [periodData, resultData] = await Promise.all([
        studyToolsService.listExamPeriods(),
        studyToolsService.listExamResults(),
      ]);
      setPeriods(periodData);
      setResults(resultData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch exam centre data:', err);
      setError(t('examCentre.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchExams = useCallback(async () => {
    try {
      const data = await academicsService.listExams();
      setExams(data.map((e) => ({ id: e.id, name: e.name, examDate: e.examDate ?? null, subjectName: null })));
    } catch (err) {
      console.error('Failed to fetch exams:', err);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) return;
    try {
      setIsSaving(true);
      await studyToolsService.createExamPeriod({
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes.trim() || undefined,
      });
      setShowForm(false);
      setForm({ name: '', startDate: '', endDate: '', notes: '' });
      await fetchData();
    } catch (err) {
      console.error('Failed to create exam period:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('examCentre.deleteConfirm'))) return;
    try {
      await studyToolsService.deleteExamPeriod(id);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete exam period:', err);
    }
  };

  const handleRecordResult = async (examId: string) => {
    if (!resultForm.marksTotal) return;
    try {
      setIsSavingResult(true);
      await studyToolsService.recordExamResult(examId, {
        marksObtained: Number(resultForm.marksObtained || 0),
        marksTotal: Number(resultForm.marksTotal),
        mistakeAnalysis: resultForm.mistakeAnalysis.trim() || undefined,
        revisionPlan: resultForm.revisionPlan.trim() || undefined,
      });
      setResultFor(null);
      setResultForm({ marksObtained: '', marksTotal: '', mistakeAnalysis: '', revisionPlan: '' });
      await fetchData();
    } catch (err) {
      console.error('Failed to record result:', err);
    } finally {
      setIsSavingResult(false);
    }
  };

  const formatDate = (d: string) => new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString();

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-sky-600" />
              {t('examCentre.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('examCentre.subtitle')}</p>
          </div>
          <Button
            onClick={() => setShowForm((v) => !v)}
            className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> {t('examCentre.addPeriod')}
          </Button>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-center text-sm text-amber-600">{error}</CardContent>
          </Card>
        )}

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('examCentre.periodName')}</label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mid-term 2026" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('examCentre.startDate')}</label>
                      <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('examCentre.endDate')}</label>
                      <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('examCentre.notes')}</label>
                    <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={isSaving || !form.name.trim() || !form.startDate || !form.endDate} className="bg-sky-600 hover:bg-sky-500 text-white">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      {t('examCentre.create')}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowForm(false)}>{t('examCentre.cancel')}</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Periods */}
        <div className="grid gap-4 lg:grid-cols-2">
          {isLoading ? (
            <Card><CardContent className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
          ) : periods.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <CalendarRange className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('examCentre.noPeriods')}</p>
              </CardContent>
            </Card>
          ) : (
            periods.map((period) => {
              const style = statusStyles[period.status] ?? statusStyles.upcoming;
              const isCurrentPeriod = todayStr >= period.startDate && todayStr <= period.endDate;
              return (
                <Card key={period.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/15 to-indigo-500/15 flex items-center justify-center">
                          <CalendarClock className="w-4 h-4 text-sky-600" />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{period.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(period.startDate)} → {formatDate(period.endDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide', style.badge)}>
                          {t(`examCentre.status_${period.status}`)}
                        </span>
                        <button
                          onClick={() => handleDelete(period.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {period.notes && <p className="text-xs text-muted-foreground">{period.notes}</p>}
                    <div className="flex flex-wrap gap-2">
                      {period.exams.length === 0 ? (
                        <span className="text-xs text-muted-foreground">{t('examCentre.noExamsInPeriod')}</span>
                      ) : (
                        period.exams.map((exam) => (
                          <span key={exam.id} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                            {exam.name}
                            {exam.examDate && <span className="text-muted-foreground">· {new Date(exam.examDate).toLocaleDateString()}</span>}
                          </span>
                        ))
                      )}
                    </div>
                    {isCurrentPeriod && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {exams.map((exam) => (
                          <button
                            key={exam.id}
                            onClick={() => setResultFor(exam.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground hover:text-sky-600 hover:border-sky-500/50 transition-colors"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" /> {t('examCentre.recordResult', { exam: exam.name })}
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Result recording modal */}
        <AnimatePresence>
          {resultFor && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={() => setResultFor(null)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl"
              >
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-sky-600" />
                  {t('examCentre.recordResultTitle')}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('examCentre.marksObtained')}</label>
                      <Input type="number" min="0" value={resultForm.marksObtained} onChange={(e) => setResultForm({ ...resultForm, marksObtained: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('examCentre.marksTotal')}</label>
                      <Input type="number" min="1" value={resultForm.marksTotal} onChange={(e) => setResultForm({ ...resultForm, marksTotal: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('examCentre.mistakeAnalysis')}</label>
                    <textarea value={resultForm.mistakeAnalysis} onChange={(e) => setResultForm({ ...resultForm, mistakeAnalysis: e.target.value })}
                      className="w-full min-h-[70px] rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('examCentre.revisionPlan')}</label>
                    <textarea value={resultForm.revisionPlan} onChange={(e) => setResultForm({ ...resultForm, revisionPlan: e.target.value })}
                      className="w-full min-h-[70px] rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => handleRecordResult(resultFor)} disabled={isSavingResult || !resultForm.marksTotal} className="bg-sky-600 hover:bg-sky-500 text-white flex-1">
                      {isSavingResult ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {t('examCentre.saveResult')}
                    </Button>
                    <Button variant="ghost" onClick={() => setResultFor(null)}>{t('examCentre.cancel')}</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-600" /> {t('examCentre.results')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {results.map((r) => {
                  const pct = r.marksTotal > 0 ? Math.round((r.marksObtained / r.marksTotal) * 100) : 0;
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                      <span className="text-muted-foreground">{new Date(r.completedAt).toLocaleDateString()}</span>
                      <span className="font-semibold tabular-nums">{r.marksObtained}/{r.marksTotal}</span>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        pct >= 75 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : pct >= 50 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
                      )}>
                        {pct}%
                      </span>
                      {r.mistakeAnalysis && <span className="text-xs text-muted-foreground truncate flex-1">{r.mistakeAnalysis}</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
