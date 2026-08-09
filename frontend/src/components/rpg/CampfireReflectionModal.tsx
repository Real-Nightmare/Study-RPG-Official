import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Brain, Flame, Loader2, Sparkles, X } from 'lucide-react';
import { studyIntegrityService } from '@/services/studyIntegrity';
import type { CampfireReflection, CampfireSourceKind, CampfireStatus } from '@/types';

interface CampfireReflectionModalProps {
  open: boolean;
  onClose: () => void;
  source?: {
    kind: CampfireSourceKind;
    id?: string;
    subject?: string;
    title?: string;
  };
  /** Fired when a reflection is answered or skipped (receives the multiplier). */
  onResolved?: (multiplier: number) => void;
}

/**
 * Metacognitive "Campfire" loop (spec 014, US5): before a student cashes in
 * session rewards or logs off, the AI tutor asks a single, targeted synthesis
 * question about the material just reviewed. The depth of the answer maps to a
 * 1.0x–1.5x reward multiplier. Deferring is allowed but forfeits the boost.
 */
export function CampfireReflectionModal({
  open,
  onClose,
  source,
  onResolved,
}: CampfireReflectionModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reflection, setReflection] = useState<CampfireReflection | null>(null);
  const [status, setStatus] = useState<CampfireStatus | null>(null);
  const [answer, setAnswer] = useState('');
  const [minChars, setMinChars] = useState(60);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setAnswer('');
      setReflection(null);
      try {
        const s = await studyIntegrityService.getCampfireStatus();
        if (cancelled) return;
        setStatus(s);
        setMinChars(60);
        if (s.pending) {
          setReflection(s.pending);
        } else if (source) {
          const r = await studyIntegrityService.startCampfire({
            sourceKind: source.kind,
            sourceId: source.id,
            subject: source.subject,
            title: source.title,
          });
          if (cancelled) return;
          setReflection(r);
        } else {
          setError(t('campfire.error'));
        }
      } catch {
        if (!cancelled) setError(t('campfire.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, source, t]);

  const handleSubmit = async () => {
    if (!reflection || reflection.status !== 'pending') return;
    if (answer.trim().length < minChars) {
      setError(t('campfire.tooShort'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resolved = await studyIntegrityService.answerCampfire(reflection.id, answer);
      setReflection(resolved);
      onResolved?.(resolved.multiplier);
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
          : '';
      setError(msg || t('campfire.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!reflection) return;
    setSubmitting(true);
    try {
      const skipped = await studyIntegrityService.skipCampfire(reflection.id);
      setReflection(skipped);
      onResolved?.(1);
    } catch {
      setError(t('campfire.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const atLimit =
    status !== null && status.usedToday >= status.maxPerDay && !status.pending;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative w-full max-w-lg rounded-2xl border border-amber-500/20 bg-card shadow-2xl"
          >
            {/* Ember glow header */}
            <div className="relative overflow-hidden rounded-t-2xl border-b border-border bg-gradient-to-br from-amber-500/15 via-transparent to-orange-500/10 px-6 py-5">
              <Flame className="absolute -right-2 -top-2 h-16 w-16 text-amber-500/10" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold leading-tight">{t('campfire.title')}</h2>
                    <p className="text-xs text-muted-foreground">{t('campfire.subtitle')}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : atLimit ? (
                <div className="py-6 text-center">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-amber-500" />
                  <p className="text-sm text-muted-foreground">{t('campfire.limitReached')}</p>
                </div>
              ) : reflection?.status === 'answered' ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4 text-center"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/15 text-green-500">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {t('campfire.reflectionLogged')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t('campfire.depthLabel')}</p>
                    <p className="mt-1 text-3xl font-bold">
                      {reflection.depthScore}
                      <span className="text-lg text-muted-foreground">/100</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      {t('campfire.multiplierApplied')}:{' '}
                      <span className="font-bold">{reflection.multiplier.toFixed(2)}×</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('campfire.masteryFrame', {
                        skill: source?.subject || source?.title || t('campfire.yourSubject'),
                      })}
                    </p>
                  </div>
                  <Button onClick={onClose} className="mt-2">
                    {t('campfire.done')}
                  </Button>
                </motion.div>
              ) : reflection ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('campfire.tutorQuestion')}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed">{reflection.question}</p>
                  </div>

                  <textarea
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      setError(null);
                    }}
                    rows={4}
                    placeholder={t('campfire.answerPlaceholder')}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />

                  {error && <p className="text-xs text-rose-500">{error}</p>}

                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={handleSkip}
                      disabled={submitting}
                      className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                      {t('campfire.skip')}
                    </button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || answer.trim().length === 0}
                    >
                      {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="mr-2 h-4 w-4" />
                      )}
                      {t('campfire.submit')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-rose-500">{error}</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
