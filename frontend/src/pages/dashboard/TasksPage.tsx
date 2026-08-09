import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tasksService } from '@/services/tasks';
import { cn } from '@/lib/utils';
import {
  Plus,
  Loader2,
  Trash2,
  Calendar,
  Clock,
  RefreshCcw,
  CheckCircle2,
  Circle,
  ListTodo,
  ClipboardCheck,
  Flame,
} from 'lucide-react';
import type { StudyTask, TaskPriority, TaskType } from '@/types';

const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  medium: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  high: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  urgent: 'bg-red-500/10 text-red-600 dark:text-red-300',
};

const typeLabels: Record<TaskType, string> = {
  homework: '📘',
  revision: '🔁',
  exam_prep: '🎯',
  project: '🗂️',
  reading: '📖',
  practice: '✏️',
};

function TaskItem({
  task,
  onToggle,
  onDelete,
  onReopen,
}: {
  task: StudyTask;
  onToggle: (task: StudyTask) => void;
  onDelete: (id: string) => void;
  onReopen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const isDone = task.status === 'done';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className={cn(
        'group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors',
        isDone ? 'border-muted opacity-60' : 'border-border hover:border-green-500/40',
      )}
    >
      <button
        onClick={() => (isDone ? onReopen(task.id) : onToggle(task))}
        className="mt-0.5 text-green-600 dark:text-green-400 hover:scale-110 transition-transform"
        aria-label={isDone ? t('tasks.reopen') : t('tasks.complete')}
      >
        {isDone ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Circle className="w-5 h-5 opacity-50 group-hover:opacity-100" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">{typeLabels[task.taskType]}</span>
          <h4
            className={cn(
              'text-sm font-medium break-words',
              isDone && 'line-through text-muted-foreground',
            )}
          >
            {task.title}
          </h4>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
              priorityStyles[task.priority],
            )}
          >
            {t(`tasks.priority.${task.priority}`)}
          </span>
        </div>

        {(task.subject || task.chapter) && (
          <p className="text-xs text-muted-foreground mt-1">
            {[task.subject, task.chapter].filter(Boolean).join(' · ')}
          </p>
        )}
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          {task.dueDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
          {task.estimatedMinutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.estimatedMinutes} min
            </span>
          ) : null}
          {task.recurrence !== 'none' && (
            <span className="inline-flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" />
              {t(`tasks.recurrence.${task.recurrence}`)}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
        aria-label={t('common.delete')}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export default function TasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [taskType, setTaskType] = useState<TaskType>('homework');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [summary, setSummary] = useState<{ total: number; completed: number; dueToday: number }>({
    total: 0,
    completed: 0,
    dueToday: 0,
  });

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const [taskList, today] = await Promise.all([
        tasksService.list(),
        tasksService.todaySummary(),
      ]);
      setTasks(taskList);
      setSummary(today);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      setIsCreating(true);
      await tasksService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        taskType,
        subject: subject.trim() || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      setTitle('');
      setDescription('');
      setSubject('');
      setDueDate('');
      setPriority('medium');
      setTaskType('homework');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (task: StudyTask) => {
    try {
      await tasksService.complete(task.id);
      await fetchTasks();
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await tasksService.reopen(id);
      await fetchTasks();
    } catch (err) {
      console.error('Failed to reopen task:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksService.delete(id);
      await fetchTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const openTasks = tasks.filter((task) => task.status !== 'done');
  const doneTasks = tasks.filter((task) => task.status === 'done');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('tasks.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('tasks.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">{summary.dueToday}</span>
              <span className="text-xs text-muted-foreground">{t('tasks.dueToday')}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">
                {summary.completed}/{summary.total}
              </span>
              <span className="text-xs text-muted-foreground">{t('tasks.completedCount')}</span>
            </div>
          </div>
        </div>

        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-green-600" />
              {t('tasks.addTask')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('tasks.titlePlaceholder')}
                className="md:col-span-2 lg:col-span-2"
              />
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
                className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
              >
                {(Object.keys(typeLabels) as TaskType[]).map((type) => (
                  <option key={type} value={type}>
                    {t(`tasks.type.${type}`)}
                  </option>
                ))}
              </select>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
              >
                {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {t(`tasks.priority.${p}`)}
                  </option>
                ))}
              </select>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('tasks.subjectPlaceholder')}
              />
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-sm"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('tasks.descriptionPlaceholder')}
                rows={2}
                className="md:col-span-3 h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none"
              />
              <Button
                onClick={handleCreate}
                disabled={isCreating || !title.trim()}
                className="h-10 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white self-end"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {t('tasks.create')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Task lists */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-blue-500" />
                {t('tasks.openTasks')}
                <span className="ml-auto text-xs text-muted-foreground">{openTasks.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : openTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('tasks.noOpenTasks')}
                </p>
              ) : (
                <AnimatePresence>
                  {openTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onReopen={handleReopen}
                    />
                  ))}
                </AnimatePresence>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-green-500" />
                {t('tasks.completedTasks')}
                <span className="ml-auto text-xs text-muted-foreground">{doneTasks.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : doneTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('tasks.noCompletedTasks')}
                </p>
              ) : (
                <AnimatePresence>
                  {doneTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onReopen={handleReopen}
                    />
                  ))}
                </AnimatePresence>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
