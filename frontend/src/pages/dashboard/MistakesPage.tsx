import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { studyToolsService } from '@/services/studyTools';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  NotebookPen,
  Search,
} from 'lucide-react';
import type { Mistake } from '@/types';

const categoryColors: Record<string, string> = {
  concept: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  careless: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  time: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  guess: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  other: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

const statusBadge: Record<string, string> = {
  open: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  reopened: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
};

export default function MistakesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Mistake[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    questionText: '',
    subject: '',
    chapter: '',
    correctAnswer: '',
    wrongAnswer: '',
    category: 'concept',
    cause: '',
    correctionNote: '',
  });

  const fetchMistakes = useCallback(async () => {
    try {
      const data = await studyToolsService.listMistakes({ status: filter || undefined });
      setItems(data.items);
      setCounts(data.counts);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch mistakes:', err);
      setError(t('mistakes.error'));
    } finally {
      setIsLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    fetchMistakes();
  }, [fetchMistakes]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (m) =>
        m.questionText.toLowerCase().includes(q) ||
        (m.subject ?? '').toLowerCase().includes(q) ||
        (m.chapter ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const tabs = ['open', 'resolved', 'reopened'] as const;

  const handleSubmit = async () => {
    if (!form.questionText.trim()) return;
    try {
      setIsSaving(true);
      await studyToolsService.createMistake({
        questionText: form.questionText.trim(),
        subject: form.subject.trim() || undefined,
        chapter: form.chapter.trim() || undefined,
        correctAnswer: form.correctAnswer.trim() || undefined,
        wrongAnswer: form.wrongAnswer.trim() || undefined,
        category: form.category,
        cause: form.cause.trim() || undefined,
        correctionNote: form.correctionNote.trim() || undefined,
      });
      setShowForm(false);
      setForm({ questionText: '', subject: '', chapter: '', correctAnswer: '', wrongAnswer: '', category: 'concept', cause: '', correctionNote: '' });
      await fetchMistakes();
    } catch (err) {
      console.error('Failed to create mistake:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolve = async (m: Mistake) => {
    try {
      const note = window.prompt(t('mistakes.resolvePrompt'), m.correctionNote ?? '') ?? undefined;
      await studyToolsService.resolveMistake(m.id, note);
      await fetchMistakes();
    } catch (err) {
      console.error('Failed to resolve mistake:', err);
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await studyToolsService.reopenMistake(id);
      await fetchMistakes();
    } catch (err) {
      console.error('Failed to reopen mistake:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('mistakes.deleteConfirm'))) return;
    try {
      await studyToolsService.deleteMistake(id);
      await fetchMistakes();
    } catch (err) {
      console.error('Failed to delete mistake:', err);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <NotebookPen className="w-6 h-6 text-rose-600" />
              {t('mistakes.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('mistakes.subtitle')}</p>
          </div>
          <Button
            onClick={() => setShowForm((v) => !v)}
            className="bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> {t('mistakes.addMistake')}
          </Button>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-center text-sm text-amber-600">{error}</CardContent>
          </Card>
        )}

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Card className="mb-1">
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('mistakes.questionLabel')}</label>
                    <textarea
                      value={form.questionText}
                      onChange={(e) => setForm({ ...form, questionText: e.target.value })}
                      className="w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      placeholder={t('mistakes.questionPlaceholder')}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('mistakes.subject')}</label>
                      <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('mistakes.chapter')}</label>
                      <Input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('mistakes.correctAnswer')}</label>
                      <Input value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('mistakes.wrongAnswer')}</label>
                      <Input value={form.wrongAnswer} onChange={(e) => setForm({ ...form, wrongAnswer: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('mistakes.category')}</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      >
                        {['concept', 'careless', 'time', 'guess', 'other'].map((c) => (
                          <option key={c} value={c}>{t(`mistakes.category_${c}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('mistakes.cause')}</label>
                      <Input value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('mistakes.correctionNote')}</label>
                    <Input value={form.correctionNote} onChange={(e) => setForm({ ...form, correctionNote: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSubmit} disabled={isSaving || !form.questionText.trim()} className="bg-rose-600 hover:bg-rose-500 text-white">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      {t('mistakes.save')}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowForm(false)}>{t('mistakes.cancel')}</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs + search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1">
            {tabs.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(filter === status ? '' : status)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filter === status ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {t(`mistakes.status_${status}`)} ({counts[status] ?? 0})
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('mistakes.search')} className="pl-9" />
          </div>
        </div>

        {/* List */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">{t('mistakes.empty')}</p>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {filtered.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium flex-1">{m.questionText}</p>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0', statusBadge[m.status])}>
                          {t(`mistakes.status_${m.status}`)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {m.subject && <span className="px-2 py-0.5 rounded-full border">{m.subject}</span>}
                        {m.chapter && <span className="px-2 py-0.5 rounded-full border">{m.chapter}</span>
                        }
                        {m.category && (
                          <span className={cn('px-2 py-0.5 rounded-full', categoryColors[m.category])}>
                            {t(`mistakes.category_${m.category}`)}
                          </span>
                        )}
                        <span className="text-[11px]">{new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                      {m.correctionNote && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-300 bg-emerald-500/5 rounded-md px-3 py-2">
                          {m.correctionNote}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        {m.status !== 'resolved' ? (
                          <Button size="sm" variant="outline" onClick={() => handleResolve(m)} className="text-emerald-600 hover:text-emerald-500">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {t('mistakes.resolve')}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleReopen(m.id)}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> {t('mistakes.reopen')}
                          </Button>
                        )}
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
