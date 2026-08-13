import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { academicsService } from '@/services/academics';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  BookOpen,
  GraduationCap,
  CalendarClock,
  Layers,
  Target,
  CheckCircle2,
  School,
  Save,
} from 'lucide-react';
import type {
  AcademicStructure,
  Subject,
  Chapter,
  Exam,
} from '@/types';

type Tab = 'profile' | 'subjects' | 'exams';

const subjectColors = [
  'indigo',
  'emerald',
  'amber',
  'sky',
  'rose',
  'violet',
  'teal',
  'orange',
  'fuchsia',
  'lime',
] as const;

const colorClasses: Record<string, { dot: string; soft: string; ring: string }> = {
  indigo: { dot: 'bg-indigo-500', soft: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300', ring: 'ring-indigo-500/30' },
  emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', ring: 'ring-emerald-500/30' },
  amber: { dot: 'bg-amber-500', soft: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', ring: 'ring-amber-500/30' },
  sky: { dot: 'bg-sky-500', soft: 'bg-sky-500/10 text-sky-600 dark:text-sky-300', ring: 'ring-sky-500/30' },
  rose: { dot: 'bg-rose-500', soft: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', ring: 'ring-rose-500/30' },
  violet: { dot: 'bg-violet-500', soft: 'bg-violet-500/10 text-violet-600 dark:text-violet-300', ring: 'ring-violet-500/30' },
  teal: { dot: 'bg-teal-500', soft: 'bg-teal-500/10 text-teal-600 dark:text-teal-300', ring: 'ring-teal-500/30' },
  orange: { dot: 'bg-orange-500', soft: 'bg-orange-500/10 text-orange-600 dark:text-orange-300', ring: 'ring-orange-500/30' },
  fuchsia: { dot: 'bg-fuchsia-500', soft: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300', ring: 'ring-fuchsia-500/30' },
  lime: { dot: 'bg-lime-500', soft: 'bg-lime-500/10 text-lime-600 dark:text-lime-300', ring: 'ring-lime-500/30' },
  blue: { dot: 'bg-blue-500', soft: 'bg-blue-500/10 text-blue-600 dark:text-blue-300', ring: 'ring-blue-500/30' },
  slate: { dot: 'bg-slate-500', soft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', ring: 'ring-slate-500/30' },
};

function confirmDelete(message: string): boolean {
  return window.confirm(message);
}

export default function AcademicsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('subjects');
  const [structure, setStructure] = useState<AcademicStructure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile form state
  const [profile, setProfile] = useState({
    country: '',
    board: '',
    school: '',
    grade: '',
    academicYear: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Subject creation state
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState<string>('indigo');
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

  // Expanded accordion state
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Inline chapter/topic creation
  const [newChapterFor, setNewChapterFor] = useState<string | null>(null);
  const [newChapterName, setNewChapterName] = useState('');
  const [newTopicFor, setNewTopicFor] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicObjective, setNewTopicObjective] = useState('');

  // Exam creation state
  const [newExamName, setNewExamName] = useState('');
  const [newExamSubjectId, setNewExamSubjectId] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [portionFor, setPortionFor] = useState<string | null>(null);
  const [portionChapterId, setPortionChapterId] = useState('');
  const [isAddingPortion, setIsAddingPortion] = useState(false);

  const fetchStructure = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await academicsService.structure();
      setStructure(data);
      if (data.profile) {
        setProfile({
          country: data.profile.country || '',
          board: data.profile.board || '',
          school: data.profile.school || '',
          grade: data.profile.grade || '',
          academicYear: data.profile.academicYear || '',
        });
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch academics structure:', err);
      setError(t('academics.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchStructure();
  }, [fetchStructure]);

  const subjects = useMemo(() => structure?.subjects ?? [], [structure]);
  const exams = useMemo(() => structure?.exams ?? [], [structure]);
  const allChapters = useMemo(
    () => subjects.flatMap((s) => s.chapters.map((c) => ({ ...c, subjectName: s.name }))),
    [subjects],
  );

  // ---------- Profile ----------

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      await academicsService.updateProfile({
        country: profile.country.trim() || undefined,
        board: profile.board.trim() || undefined,
        school: profile.school.trim() || undefined,
        grade: profile.grade.trim() || undefined,
        academicYear: profile.academicYear.trim() || undefined,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ---------- Subjects ----------

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return;
    try {
      setIsCreatingSubject(true);
      await academicsService.createSubject({
        name: newSubjectName.trim(),
        color: newSubjectColor,
      });
      setNewSubjectName('');
      setNewSubjectColor('indigo');
      await fetchStructure();
    } catch (err) {
      console.error('Failed to create subject:', err);
    } finally {
      setIsCreatingSubject(false);
    }
  };

  const handleDeleteSubject = async (subject: Subject) => {
    if (!confirmDelete(t('academics.deleteSubjectConfirm'))) return;
    try {
      await academicsService.deleteSubject(subject.id);
      await fetchStructure();
    } catch (err) {
      console.error('Failed to delete subject:', err);
    }
  };

  const handleCreateChapter = async (subjectId: string) => {
    if (!newChapterName.trim()) return;
    try {
      await academicsService.createChapter(subjectId, { name: newChapterName.trim() });
      setNewChapterFor(null);
      setNewChapterName('');
      await fetchStructure();
    } catch (err) {
      console.error('Failed to create chapter:', err);
    }
  };

  const handleDeleteChapter = async (chapter: Chapter) => {
    if (!confirmDelete(t('academics.deleteChapterConfirm'))) return;
    try {
      await academicsService.deleteChapter(chapter.id);
      await fetchStructure();
    } catch (err) {
      console.error('Failed to delete chapter:', err);
    }
  };

  const handleCreateTopic = async (chapterId: string) => {
    if (!newTopicName.trim()) return;
    try {
      await academicsService.createTopic(chapterId, {
        name: newTopicName.trim(),
        learningObjective: newTopicObjective.trim() || undefined,
      });
      setNewTopicFor(null);
      setNewTopicName('');
      setNewTopicObjective('');
      await fetchStructure();
    } catch (err) {
      console.error('Failed to create topic:', err);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirmDelete(t('academics.deleteTopicConfirm'))) return;
    try {
      await academicsService.deleteTopic(id);
      await fetchStructure();
    } catch (err) {
      console.error('Failed to delete topic:', err);
    }
  };

  const toggleSubject = (id: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleChapter = (id: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---------- Exams ----------

  const handleCreateExam = async () => {
    if (!newExamName.trim()) return;
    try {
      setIsCreatingExam(true);
      await academicsService.createExam({
        name: newExamName.trim(),
        subjectId: newExamSubjectId || undefined,
        examDate: newExamDate ? new Date(newExamDate).toISOString() : undefined,
      });
      setNewExamName('');
      setNewExamSubjectId('');
      setNewExamDate('');
      await fetchStructure();
    } catch (err) {
      console.error('Failed to create exam:', err);
    } finally {
      setIsCreatingExam(false);
    }
  };

  const handleDeleteExam = async (exam: Exam) => {
    if (!confirmDelete(t('academics.deleteExamConfirm'))) return;
    try {
      await academicsService.deleteExam(exam.id);
      await fetchStructure();
    } catch (err) {
      console.error('Failed to delete exam:', err);
    }
  };

  const handleAddPortion = async (examId: string) => {
    if (!portionChapterId) return;
    try {
      setIsAddingPortion(true);
      await academicsService.addPortion(examId, { chapterId: portionChapterId });
      setPortionFor(null);
      setPortionChapterId('');
      await fetchStructure();
    } catch (err) {
      console.error('Failed to add portion:', err);
    } finally {
      setIsAddingPortion(false);
    }
  };

  const handleRemovePortion = async (examId: string, portionId: string) => {
    try {
      await academicsService.removePortion(examId, portionId);
      await fetchStructure();
    } catch (err) {
      console.error('Failed to remove portion:', err);
    }
  };

  const tabs: Array<{ key: Tab; label: string; icon: typeof BookOpen }> = [
    { key: 'subjects', label: t('academics.subjectsTab'), icon: BookOpen },
    { key: 'exams', label: t('academics.examsTab'), icon: CalendarClock },
    { key: 'profile', label: t('academics.profileTab'), icon: School },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-emerald-600" />
            {t('academics.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('academics.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                tab === tabItem.key
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <tabItem.icon className="w-4 h-4" />
              {tabItem.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-red-500">{error}</CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="wait">
            {/* ---------------- Subjects tab ---------------- */}
            {tab === 'subjects' && (
              <motion.div
                key="subjects"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-600" />
                      {t('academics.addSubject')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateSubject()}
                        placeholder={t('academics.subjectNamePlaceholder')}
                        className="sm:max-w-sm"
                      />
                      <div className="flex items-center gap-1.5">
                        {subjectColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewSubjectColor(color)}
                            aria-label={color}
                            className={cn(
                              'w-6 h-6 rounded-full transition-transform hover:scale-110',
                              colorClasses[color]?.dot ?? 'bg-slate-400',
                              newSubjectColor === color && 'ring-2 ring-offset-2 ring-offset-card',
                            )}
                            style={
                              newSubjectColor === color
                                ? { boxShadow: '0 0 0 2px var(--ring)' }
                                : undefined
                            }
                          />
                        ))}
                      </div>
                      <Button
                        onClick={handleCreateSubject}
                        disabled={isCreatingSubject || !newSubjectName.trim()}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                      >
                        {isCreatingSubject ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        {t('academics.create')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {subjects.length === 0 ? (
                  <Card>
                    <CardContent className="py-14 text-center">
                      <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t('academics.noSubjects')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {subjects.map((subject) => {
                      const isExpanded = expandedSubjects.has(subject.id);
                      const color = colorClasses[subject.color ?? ''] ?? colorClasses.indigo;
                      return (
                        <Card key={subject.id} className="overflow-hidden">
                          <button
                            onClick={() => toggleSubject(subject.id)}
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                          >
                            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', color.dot)} />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-semibold truncate">
                                {subject.name}
                              </span>
                              <span className="block text-xs text-muted-foreground mt-0.5">
                                {subject.chapters.length}{' '}
                                {t('academics.chapters', { count: subject.chapters.length })}
                              </span>
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
                                color.soft,
                              )}
                            >
                              {subject.color ?? '—'}
                            </span>
                            <ChevronDown
                              className={cn(
                                'w-4 h-4 text-muted-foreground transition-transform',
                                isExpanded && 'rotate-180',
                              )}
                            />
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t"
                              >
                                <div className="p-4 space-y-3">
                                  {subject.chapters.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      {t('academics.noChapters')}
                                    </p>
                                  )}
                                  {subject.chapters.map((chapter) => {
                                    const chapterOpen = expandedChapters.has(chapter.id);
                                    return (
                                      <div
                                        key={chapter.id}
                                        className="rounded-lg border bg-muted/30"
                                      >
                                        <div className="flex items-center gap-2 px-3 py-2.5">
                                          <button
                                            onClick={() => toggleChapter(chapter.id)}
                                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                          >
                                            <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-sm font-medium truncate">
                                              {chapter.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                              {chapter.topics.length}
                                            </span>
                                            <ChevronDown
                                              className={cn(
                                                'w-3.5 h-3.5 text-muted-foreground transition-transform',
                                                chapterOpen && 'rotate-180',
                                              )}
                                            />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteChapter(chapter)}
                                            className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                            aria-label={t('common.delete')}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        <AnimatePresence initial={false}>
                                          {chapterOpen && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: 'auto', opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              transition={{ duration: 0.2 }}
                                              className="px-3 pb-3 space-y-2"
                                            >
                                              {chapter.topics.map((topic) => (
                                                <div
                                                  key={topic.id}
                                                  className="flex items-start gap-2 rounded-md bg-card border px-3 py-2 group"
                                                >
                                                  <Target className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium">
                                                      {topic.name}
                                                    </p>
                                                    {topic.learningObjective && (
                                                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                                        {topic.learningObjective}
                                                      </p>
                                                    )}
                                                  </div>
                                                  <button
                                                    onClick={() => handleDeleteTopic(topic.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-red-500 transition-all"
                                                    aria-label={t('common.delete')}
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              ))}

                                              {newTopicFor === chapter.id ? (
                                                <div className="space-y-2 rounded-md bg-card border p-3">
                                                  <Input
                                                    value={newTopicName}
                                                    onChange={(e) => setNewTopicName(e.target.value)}
                                                    onKeyDown={(e) =>
                                                      e.key === 'Enter' &&
                                                      handleCreateTopic(chapter.id)
                                                    }
                                                    placeholder={t('academics.topicNamePlaceholder')}
                                                    className="h-9 text-sm"
                                                  />
                                                  <Input
                                                    value={newTopicObjective}
                                                    onChange={(e) => setNewTopicObjective(e.target.value)}
                                                    onKeyDown={(e) =>
                                                      e.key === 'Enter' &&
                                                      handleCreateTopic(chapter.id)
                                                    }
                                                    placeholder={t('academics.learningObjective')}
                                                    className="h-9 text-sm"
                                                  />
                                                  <div className="flex gap-2">
                                                    <Button
                                                      size="sm"
                                                      onClick={() => handleCreateTopic(chapter.id)}
                                                      disabled={!newTopicName.trim()}
                                                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                                    >
                                                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                                                      {t('academics.add')}
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => {
                                                        setNewTopicFor(null);
                                                        setNewTopicName('');
                                                        setNewTopicObjective('');
                                                      }}
                                                    >
                                                      {t('academics.cancel')}
                                                    </Button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <button
                                                  onClick={() => setNewTopicFor(chapter.id)}
                                                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-600 transition-colors"
                                                >
                                                  <Plus className="w-3.5 h-3.5" />
                                                  {t('academics.addTopic')}
                                                </button>
                                              )}
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}

                                  {newChapterFor === subject.id ? (
                                    <div className="flex gap-2">
                                      <Input
                                        value={newChapterName}
                                        onChange={(e) => setNewChapterName(e.target.value)}
                                        onKeyDown={(e) =>
                                          e.key === 'Enter' && handleCreateChapter(subject.id)
                                        }
                                        placeholder={t('academics.chapterNamePlaceholder')}
                                        className="h-9 text-sm"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleCreateChapter(subject.id)}
                                        disabled={!newChapterName.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                                      >
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                        {t('academics.add')}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setNewChapterFor(null);
                                          setNewChapterName('');
                                        }}
                                        className="shrink-0"
                                      >
                                        {t('academics.cancel')}
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setNewChapterFor(subject.id)}
                                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-600 transition-colors"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      {t('academics.addChapter')}
                                    </button>
                                  )}

                                  <div className="flex justify-end pt-1">
                                    <button
                                      onClick={() => handleDeleteSubject(subject)}
                                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      {t('academics.deleteSubject')}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ---------------- Exams tab ---------------- */}
            {tab === 'exams' && (
              <motion.div
                key="exams"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-600" />
                      {t('academics.addExam')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Input
                        value={newExamName}
                        onChange={(e) => setNewExamName(e.target.value)}
                        placeholder={t('academics.examNamePlaceholder')}
                        className="md:col-span-2"
                      />
                      <select
                        value={newExamSubjectId}
                        onChange={(e) => setNewExamSubjectId(e.target.value)}
                        className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">{t('academics.subjectLabel')}</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="date"
                        value={newExamDate}
                        onChange={(e) => setNewExamDate(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="mt-3">
                      <Button
                        onClick={handleCreateExam}
                        disabled={isCreatingExam || !newExamName.trim()}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                      >
                        {isCreatingExam ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        {t('academics.create')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {exams.length === 0 ? (
                  <Card>
                    <CardContent className="py-14 text-center">
                      <CalendarClock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t('academics.noExams')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {exams.map((exam) => {
                      const subject = subjects.find((s) => s.id === exam.subjectId);
                      return (
                        <Card key={exam.id}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 flex items-center justify-center">
                                  <CalendarClock className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                  <CardTitle className="text-sm">{exam.name}</CardTitle>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {subject?.name ?? t('academics.subjectLabel')}
                                    {exam.examDate
                                      ? ` · ${new Date(exam.examDate).toLocaleDateString()}`
                                      : ''}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteExam(exam)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                aria-label={t('common.delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {t('academics.portions')}
                            </p>
                            {exam.portions.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                {t('academics.noPortions')}
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {exam.portions.map((portion) => (
                                  <span
                                    key={portion.id}
                                    className="group inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs"
                                  >
                                    {portion.chapterName}
                                    <button
                                      onClick={() => handleRemovePortion(exam.id, portion.id)}
                                      className="text-muted-foreground hover:text-red-500 transition-colors"
                                      aria-label={t('academics.removePortion')}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            {portionFor === exam.id ? (
                              <div className="flex gap-2">
                                <select
                                  value={portionChapterId}
                                  onChange={(e) => setPortionChapterId(e.target.value)}
                                  className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                >
                                  <option value="">{t('academics.addPortion')}</option>
                                  {allChapters
                                    .filter(
                                      (c) =>
                                        !exam.portions.some((p) => p.chapterId === c.id),
                                    )
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.subjectName} · {c.name}
                                      </option>
                                    ))}
                                </select>
                                <Button
                                  size="sm"
                                  onClick={() => handleAddPortion(exam.id)}
                                  disabled={!portionChapterId || isAddingPortion}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                                >
                                  {isAddingPortion ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setPortionFor(null);
                                    setPortionChapterId('');
                                  }}
                                  className="shrink-0"
                                >
                                  {t('academics.cancel')}
                                </Button>
                              </div>
                            ) : (
                              allChapters.length > 0 && (
                                <button
                                  onClick={() => setPortionFor(exam.id)}
                                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-600 transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  {t('academics.addPortion')}
                                </button>
                              )
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ---------------- Profile tab ---------------- */}
            {tab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-2xl"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <School className="w-4 h-4 text-emerald-600" />
                      {t('academics.profileTitle')}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t('academics.profileSubtitle')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          {t('academics.country')}
                        </label>
                        <Input
                          value={profile.country}
                          onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                          placeholder="India"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          {t('academics.board')}
                        </label>
                        <Input
                          value={profile.board}
                          onChange={(e) => setProfile({ ...profile, board: e.target.value })}
                          placeholder="CBSE"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          {t('academics.school')}
                        </label>
                        <Input
                          value={profile.school}
                          onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          {t('academics.grade')}
                        </label>
                        <Input
                          value={profile.grade}
                          onChange={(e) => setProfile({ ...profile, grade: e.target.value })}
                          placeholder="9"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          {t('academics.academicYear')}
                        </label>
                        <Input
                          value={profile.academicYear}
                          onChange={(e) =>
                            setProfile({ ...profile, academicYear: e.target.value })
                          }
                          placeholder="2026-27"
                        />
                      </div>
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                      >
                        {isSavingProfile ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        {t('academics.saveProfile')}
                      </Button>
                      <AnimatePresence>
                        {profileSaved && (
                          <motion.span
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="inline-flex items-center gap-1.5 text-sm text-emerald-600"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {t('academics.profileSaved')}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </DashboardLayout>
  );
}
