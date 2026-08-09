import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { programmesService } from '@/services/programmes';
import { learningPathsService } from '@/services/learningPaths';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Sparkles,
  BookOpen,
  Users2,
  Target,
  CheckCircle2,
  XCircle,
  Archive,
  GraduationCap,
  Hourglass,
  Flame,
  Coins,
  Layers,
  LayoutTemplate,
  Wand2,
  ListChecks,
  History,
  ShieldCheck,
  Route,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Programme, ProgrammeTemplate } from '@/types';

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  suggested: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30',
  building: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30',
  rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30',
  archived: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
};

export default function ProgrammesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [filter, setFilter] = useState<'active' | 'mine' | 'suggested'>('active');
  const [showQueue, setShowQueue] = useState(false);
  const [queue, setQueue] = useState<Programme[]>([]);
  const [templates, setTemplates] = useState<ProgrammeTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suggest form
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestForm, setSuggestForm] = useState({
    name: '',
    description: '',
    kind: 'custom',
    hasFactions: false,
    factionSize: 7,
  });
  const [suggesting, setSuggesting] = useState(false);

  // Review form
  const [reviewing, setReviewing] = useState<Programme | null>(null);
  const [reviewVerdict, setReviewVerdict] = useState<'accepted' | 'rejected'>('accepted');
  const [reviewReason, setReviewReason] = useState('');

  // Batch review (queue)
  const [batchVerdicts, setBatchVerdicts] = useState<Record<string, { verdict: 'accepted' | 'rejected'; reason: string }>>({});
  const [batchReviewing, setBatchReviewing] = useState(false);

  // Template creation
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', kind: 'custom', reason: '' });
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Learning path conversion
  const [buildingPath, setBuildingPath] = useState<string | null>(null);
  const [pathNotice, setPathNotice] = useState<string | null>(null);

  const fetchProgrammes = useCallback(async () => {
    try {
      const data = await programmesService.list({
        status: filter === 'mine' ? undefined : filter,
        mine: filter === 'mine',
      });
      setProgrammes(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load programmes:', err);
      setError(t('programmes.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    fetchProgrammes();
  }, [fetchProgrammes]);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await programmesService.listTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openQueue = async () => {
    const next = !showQueue;
    setShowQueue(next);
    if (next) {
      try {
        const data = await programmesService.reviewQueue();
        setQueue(data);
        const initial: Record<string, { verdict: 'accepted' | 'rejected'; reason: string }> = {};
        data.forEach((p) => {
          initial[p.id] = { verdict: 'accepted', reason: '' };
        });
        setBatchVerdicts(initial);
      } catch (err) {
        console.error('Failed to load review queue:', err);
        setError(t('programmes.reviewQueueError'));
      }
    }
  };

  const submitBatchReview = async () => {
    const items = Object.entries(batchVerdicts)
      .filter(([, v]) => v.reason.trim().length > 0)
      .map(([id, v]) => ({ id, verdict: v.verdict, reason: v.reason.trim() }));
    if (items.length === 0) return;
    setBatchReviewing(true);
    try {
      await programmesService.batchReview(items);
      setQueue((prev) => prev.filter((p) => !items.some((i) => i.id === p.id)));
      await fetchProgrammes();
      setPathNotice(t('programmes.batchReviewDone'));
    } catch (err) {
      console.error('Failed batch review:', err);
      setError(t('programmes.reviewError'));
    } finally {
      setBatchReviewing(false);
    }
  };

  const createTemplate = async () => {
    if (templateForm.name.trim().length < 3 || !templateForm.reason.trim()) return;
    setCreatingTemplate(true);
    try {
      await programmesService.createTemplate({
        name: templateForm.name.trim(),
        description: templateForm.description.trim() || undefined,
        kind: templateForm.kind,
        reason: templateForm.reason.trim(),
      });
      setTemplateForm({ name: '', description: '', kind: 'custom', reason: '' });
      setShowTemplateForm(false);
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to create template:', err);
      setError(t('programmes.templateError'));
    } finally {
      setCreatingTemplate(false);
    }
  };

  const instantiateTemplate = async (template: ProgrammeTemplate) => {
    try {
      const created = await programmesService.suggestFromTemplate(template.id);
      setProgrammes((prev) => [created, ...prev]);
      setFilter('mine');
      setShowTemplates(false);
      setError(null);
    } catch (err) {
      console.error('Failed to suggest from template:', err);
      setError(t('programmes.suggestError'));
    }
  };

  const deleteTemplate = async (template: ProgrammeTemplate) => {
    const reason = window.prompt(t('programmes.templateDeletePrompt'));
    if (!reason) return;
    try {
      await programmesService.deleteTemplate(template.id, reason);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (err) {
      console.error('Failed to delete template:', err);
      setError(t('programmes.templateError'));
    }
  };

  const startLearningPath = async (p: Programme) => {
    setBuildingPath(p.id);
    try {
      const path = await learningPathsService.fromProgramme(p.id);
      setPathNotice(t('programmes.pathCreated', { title: path.title }));
    } catch (err) {
      console.error('Failed to build learning path:', err);
      setError(t('programmes.pathError'));
    } finally {
      setBuildingPath(null);
    }
  };

  const suggest = async () => {
    if (suggestForm.name.trim().length < 3) return;
    setSuggesting(true);
    try {
      const created = await programmesService.suggest({
        name: suggestForm.name.trim(),
        description: suggestForm.description.trim() || undefined,
        kind: suggestForm.kind,
        hasFactions: suggestForm.hasFactions,
        factionSize: suggestForm.factionSize,
      });
      setProgrammes((prev) => [created, ...prev]);
      setSuggestForm({ name: '', description: '', kind: 'custom', hasFactions: false, factionSize: 7 });
      setShowSuggest(false);
      setFilter('mine');
      setError(null);
    } catch (err) {
      console.error('Failed to suggest programme:', err);
      setError(t('programmes.suggestError'));
    } finally {
      setSuggesting(false);
    }
  };

  const joinProgramme = async (p: Programme) => {
    try {
      const updated = await programmesService.join(p.id);
      setProgrammes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      console.error('Failed to join:', err);
    }
  };

  const leaveProgramme = async (p: Programme) => {
    try {
      const updated = await programmesService.leave(p.id);
      setProgrammes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      console.error('Failed to leave:', err);
    }
  };

  const submitReview = async () => {
    if (!reviewing || !reviewReason.trim()) return;
    try {
      const updated = await programmesService.review(reviewing.id, {
        verdict: reviewVerdict,
        reason: reviewReason.trim(),
      });
      setProgrammes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setReviewing(null);
      setReviewReason('');
    } catch (err) {
      console.error('Failed to review:', err);
      setError(t('programmes.reviewError'));
    }
  };

  const archiveProgramme = async (p: Programme) => {
    const reason = window.prompt(t('programmes.archiveReasonPrompt'));
    if (!reason) return;
    try {
      const updated = await programmesService.archive(p.id, reason);
      setProgrammes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      console.error('Failed to archive:', err);
      setError(t('programmes.reviewError'));
    }
  };

  const content = (p: Programme) => (p.content ?? {}) as Record<string, unknown>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-violet-600" />
              {t('programmes.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('programmes.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={openQueue}>
                {showQueue ? <XCircle className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                {showQueue ? t('programmes.hideQueue') : t('programmes.reviewQueue')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowTemplates((v) => !v)}>
              {showTemplates ? <XCircle className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
              {showTemplates ? t('programmes.hideTemplates') : t('programmes.templates')}
            </Button>
            <Button onClick={() => setShowSuggest((v) => !v)}>
              {showSuggest ? <XCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {showSuggest ? t('programmes.hideForm') : t('programmes.suggest')}
            </Button>
          </div>
        </div>

        {pathNotice && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {pathNotice}
            <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setPathNotice(null)}>
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Templates strip (Phase 8) */}
        {showTemplates && (
          <Card className="border-sky-500/30 bg-gradient-to-br from-sky-500/5 to-transparent">
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{t('programmes.templatesHint')}</p>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setShowTemplateForm((v) => !v)}>
                    <Plus className="h-4 w-4" />
                    {t('programmes.newTemplate')}
                  </Button>
                )}
              </div>

              {showTemplateForm && (
                <div className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-2">
                  <Input
                    placeholder={t('programmes.templateNamePlaceholder')}
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  />
                  <select
                    value={templateForm.kind}
                    onChange={(e) => setTemplateForm({ ...templateForm, kind: e.target.value })}
                    className="rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <option value="custom">{t('programmes.kind.custom')}</option>
                    <option value="revision_centre">{t('programmes.kind.revision_centre')}</option>
                    <option value="competency_testing">{t('programmes.kind.competency_testing')}</option>
                  </select>
                  <Input
                    placeholder={t('programmes.templateDescPlaceholder')}
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    className="sm:col-span-2"
                  />
                  <Input
                    placeholder={t('programmes.reasonPlaceholder')}
                    value={templateForm.reason}
                    onChange={(e) => setTemplateForm({ ...templateForm, reason: e.target.value })}
                    className="sm:col-span-2"
                  />
                  <div className="flex justify-end gap-2 sm:col-span-2">
                    <Button variant="ghost" onClick={() => setShowTemplateForm(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button onClick={createTemplate} disabled={creatingTemplate}>
                      {creatingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {t('programmes.saveTemplate')}
                    </Button>
                  </div>
                </div>
              )}

              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('programmes.noTemplates')}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((tp) => (
                    <div key={tp.id} className="flex flex-col gap-2 rounded-lg border bg-background p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{tp.name}</p>
                          <p className="text-xs text-muted-foreground">{t(`programmes.kind.${tp.kind}`, { defaultValue: 'Custom' })}</p>
                        </div>
                        {isAdmin && (
                          <button
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTemplate(tp)}
                            title={t('programmes.deleteTemplate')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {tp.description && <p className="text-xs text-muted-foreground">{tp.description}</p>}
                      <Button size="sm" variant="outline" className="mt-auto" onClick={() => instantiateTemplate(tp)}>
                        <Wand2 className="h-3.5 w-3.5" />
                        {t('programmes.useTemplate')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Review queue (Phase 8, admin) */}
        {showQueue && isAdmin && (
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{t('programmes.queueHint')}</p>
                <Button
                  size="sm"
                  onClick={submitBatchReview}
                  disabled={batchReviewing || Object.values(batchVerdicts).filter((v) => v.reason.trim()).length === 0}
                >
                  {batchReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {t('programmes.applyVerdicts')}
                </Button>
              </div>
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('programmes.queueEmpty')}</p>
              ) : (
                <div className="space-y-3">
                  {queue.map((p) => {
                    const v = batchVerdicts[p.id] ?? { verdict: 'accepted', reason: '' };
                    return (
                      <div key={p.id} className="rounded-lg border bg-background p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {t(`programmes.kind.${p.kind}`, { defaultValue: 'Custom' })}
                              {p.suggesterName ? ` · ${t('programmes.by')} ${p.suggesterName}` : ''}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setBatchVerdicts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], verdict: 'accepted' } }))
                              }
                              className={cn(
                                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                                v.verdict === 'accepted'
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                                  : 'text-muted-foreground hover:bg-accent',
                              )}
                            >
                              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                              {t('programmes.accept')}
                            </button>
                            <button
                              onClick={() =>
                                setBatchVerdicts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], verdict: 'rejected' } }))
                              }
                              className={cn(
                                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                                v.verdict === 'rejected'
                                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                                  : 'text-muted-foreground hover:bg-accent',
                              )}
                            >
                              <XCircle className="mr-1 inline h-3.5 w-3.5" />
                              {t('programmes.reject')}
                            </button>
                          </div>
                        </div>
                        {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
                        <Input
                          className="mt-2"
                          placeholder={t('programmes.reviewReasonPlaceholder')}
                          value={v.reason}
                          onChange={(e) =>
                            setBatchVerdicts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], reason: e.target.value } }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Suggest form */}
        {showSuggest && (
          <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
            <CardContent className="space-y-4 pt-6">
              <p className="text-sm text-muted-foreground">{t('programmes.suggestHint')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder={t('programmes.namePlaceholder')}
                  value={suggestForm.name}
                  onChange={(e) => setSuggestForm({ ...suggestForm, name: e.target.value })}
                />
                <select
                  value={suggestForm.kind}
                  onChange={(e) => setSuggestForm({ ...suggestForm, kind: e.target.value })}
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <option value="custom">{t('programmes.kind.custom')}</option>
                  <option value="revision_centre">{t('programmes.kind.revision_centre')}</option>
                  <option value="competency_testing">{t('programmes.kind.competency_testing')}</option>
                </select>
                <textarea
                  placeholder={t('programmes.descriptionPlaceholder')}
                  value={suggestForm.description}
                  onChange={(e) => setSuggestForm({ ...suggestForm, description: e.target.value })}
                  rows={3}
                  className="sm:col-span-2 rounded-lg border bg-background px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={suggestForm.hasFactions}
                    onChange={(e) => setSuggestForm({ ...suggestForm, hasFactions: e.target.checked })}
                    className="h-4 w-4"
                  />
                  {t('programmes.hasFactions')}
                </label>
                {suggestForm.hasFactions && (
                  <Input
                    type="number"
                    min={2}
                    max={20}
                    placeholder={t('programmes.factionSizePlaceholder')}
                    value={String(suggestForm.factionSize)}
                    onChange={(e) => setSuggestForm({ ...suggestForm, factionSize: Number(e.target.value) || 7 })}
                    className="sm:col-span-2"
                  />
                )}
              </div>
              <Button onClick={suggest} disabled={suggesting || suggestForm.name.trim().length < 3}>
                {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {t('programmes.suggestBtn')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-1 rounded-xl border bg-card p-1 w-fit">
          {(['active', 'mine', 'suggested'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                filter === f ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {t(`programmes.filter.${f}`)}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Programme list */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : programmes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('programmes.none')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {programmes.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Card className={cn(p.hasFactions && 'border-violet-500/30')}>
                    <CardContent className="space-y-3 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{p.name}</h3>
                            <Badge variant="outline" className={cn('border', statusStyles[p.status])}>
                              {t(`programmes.status.${p.status}`)}
                            </Badge>
                            {p.hasFactions && (
                              <Badge variant="secondary" className="text-[10px]">
                                <Users2 className="h-3 w-3" /> {t('programmes.factionsEnabled')}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t(`programmes.kind.${p.kind}`)}
                            {p.suggesterName ? ` · ${t('programmes.by')} ${p.suggesterName}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {p.status === 'active' && !p.joined && (
                            <Button size="sm" onClick={() => joinProgramme(p)}>
                              <BookOpen className="h-4 w-4" />
                              {t('programmes.join')}
                            </Button>
                          )}
                          {p.status === 'active' && p.joined && (
                            <Button size="sm" variant="outline" onClick={() => leaveProgramme(p)}>
                              {t('programmes.leave')}
                            </Button>
                          )}
                          {p.status === 'active' && p.joined && (
                            <Button size="sm" variant="outline" onClick={() => startLearningPath(p)} disabled={buildingPath === p.id}>
                              {buildingPath === p.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Route className="h-4 w-4" />
                              )}
                              {t('programmes.startPath')}
                            </Button>
                          )}
                          {isAdmin && p.status === 'active' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setReviewing(p)}>
                                <Target className="h-4 w-4" />
                                {t('programmes.review')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => archiveProgramme(p)}>
                                <Archive className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {p.description && (
                        <p className="text-sm text-muted-foreground">{p.description}</p>
                      )}

                      {/* AI-built content */}
                      {p.aiBuilt && (content(p).objectives as string[] | undefined) && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Target className="h-3.5 w-3.5" /> {t('programmes.objectives')}
                          </p>
                          <ul className="mt-2 space-y-1">
                            {(content(p).objectives as string[]).map((o, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                {o}
                              </li>
                            ))}
                          </ul>
                          {Array.isArray(content(p).milestones) && (content(p).milestones as Array<Record<string, unknown>>).length > 0 && (
                            <div className="mt-3 space-y-2">
                              {(content(p).milestones as Array<Record<string, unknown>>).map((m, i) => (
                                <div key={i} className="rounded-md border bg-background px-3 py-2">
                                  <p className="flex items-center gap-1.5 text-sm font-medium">
                                    <Layers className="h-3.5 w-3.5 text-violet-500" />
                                    {String(m.title ?? '')}
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      {String(m.weeks ?? 1)} {t('programmes.weeks')}
                                    </span>
                                  </p>
                                  {Array.isArray(m.activities) && (
                                    <ul className="mt-1 space-y-0.5 pl-5">
                                      {(m.activities as string[]).map((a, j) => (
                                        <li key={j} className="text-xs text-muted-foreground">
                                          • {a}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {typeof content(p).estimatedWeeklyHours === 'number' && (
                              <Badge variant="secondary">
                                <Hourglass className="h-3 w-3" /> ~{String(content(p).estimatedWeeklyHours)} {t('programmes.hoursWeek')}
                              </Badge>
                            )}
                            {p.rewardPolicy && (p.rewardPolicy.kind as string) !== 'none' && (
                              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-300">
                                {p.rewardPolicy.kind === 'stp' ? (
                                  <Coins className="h-3 w-3" />
                                ) : (
                                  <Flame className="h-3 w-3" />
                                )}
                                {t('programmes.reward')}: {String(p.rewardPolicy.kind ?? '')}
                                {typeof p.rewardPolicy.amount === 'number' && Number(p.rewardPolicy.amount) > 0
                                  ? ` +${p.rewardPolicy.amount}`
                                  : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Review history (Phase 8) */}
                      {p.reviewHistory && p.reviewHistory.length > 0 && (
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <History className="h-3.5 w-3.5" /> {t('programmes.reviewHistory')}
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {p.reviewHistory.map((ev, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs">
                                {ev.verdict === 'accepted' ? (
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                ) : (
                                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                                )}
                                <div className="min-w-0">
                                  <span className="font-medium">
                                    {ev.verdict === 'accepted' ? t('programmes.reviewAccepted') : t('programmes.reviewRejected')}
                                    {typeof ev.score === 'number' ? ` · ${ev.score}/100` : ''}
                                  </span>
                                  <span className="ml-1 text-muted-foreground">
                                    {ev.reviewer ? `${ev.reviewer} · ` : ''}
                                    {new Date(ev.reviewedAt).toLocaleDateString()}
                                  </span>
                                  {ev.reasons.length > 0 && (
                                    <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
                                      {ev.reasons.map((r, j) => (
                                        <li key={j}>• {r}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* AI review */}
                      {p.review && (p.review.verdict as string | undefined) && (
                        <div
                          className={cn(
                            'rounded-lg border px-3 py-2 text-sm',
                            p.review.verdict === 'accepted'
                              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                              : 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300',
                          )}
                        >
                          <span className="font-medium">
                            {p.review.verdict === 'accepted' ? t('programmes.reviewAccepted') : t('programmes.reviewRejected')}
                          </span>
                          {typeof p.review.score === 'number' && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {t('programmes.score')}: {p.review.score}/100
                            </span>
                          )}
                          {Array.isArray(p.review.reasons) && (p.review.reasons as string[]).length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-xs">
                              {(p.review.reasons as string[]).map((r, i) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Review dialog */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setReviewing(null)} />
          <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold">{t('programmes.review')}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{reviewing.name}</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setReviewVerdict('accepted')}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    reviewVerdict === 'accepted'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  {t('programmes.accept')}
                </button>
                <button
                  onClick={() => setReviewVerdict('rejected')}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    reviewVerdict === 'rejected'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  <XCircle className="mr-1 inline h-4 w-4" />
                  {t('programmes.reject')}
                </button>
              </div>
              <Input
                placeholder={t('programmes.reviewReasonPlaceholder')}
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setReviewing(null)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={submitReview} disabled={!reviewReason.trim()}>
                  {t('programmes.reviewBtn')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
