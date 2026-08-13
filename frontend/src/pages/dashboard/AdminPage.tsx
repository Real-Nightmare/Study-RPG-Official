import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { adminService } from '@/services/admin';
import { cn } from '@/lib/utils';
import {
  Loader2,
  ShieldCheck,
  Users,
  ScrollText,
  FileText,
  BookOpenCheck,
  Search,
  UserPlus,
  ShieldAlert,
  KeyRound,
  Trash2,
  UploadCloud,
  Plus,
  Eye,
  Activity,
  Download,
  Database,
  Server,
  CalendarClock,
  Flag,
  Boxes,
  Trash2 as TrashIcon,
} from 'lucide-react';
import type {
  AdminNote,
  AdminUserRow,
  AuditLogEntry,
  AuditRetention,
  SyllabusEntry,
  SystemStatus,
} from '@/types';

type Tab = 'users' | 'audit' | 'notes' | 'syllabus' | 'system';

export default function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('users');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
            {t('admin.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('admin.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-1 w-fit">
          {(
            [
              ['users', 'admin.tab.users', Users],
              ['audit', 'admin.tab.audit', ScrollText],
              ['notes', 'admin.tab.notes', FileText],
              ['syllabus', 'admin.tab.syllabus', BookOpenCheck],
              ...(isAdmin ? ([['system', 'admin.tab.system', Activity]] as Array<[Tab, string, typeof Users]>) : []),
            ] as Array<[Tab, string, typeof Users]>
          ).map(([key, labelKey, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                tab === key
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <UsersTab />
            </motion.div>
          )}
          {tab === 'audit' && (
            <motion.div key="audit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <AuditTab />
            </motion.div>
          )}
          {tab === 'notes' && (
            <motion.div key="notes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <NotesTab />
            </motion.div>
          )}
          {tab === 'syllabus' && (
            <motion.div key="syllabus" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <SyllabusTab />
            </motion.div>
          )}
          {tab === 'system' && (
            <motion.div key="system" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <SystemTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

// ------------------------------------------------------------------
// Users tab
// ------------------------------------------------------------------
function UsersTab() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-user form
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'user' as 'user' | 'teacher' | 'admin',
    reason: '',
  });
  const [creating, setCreating] = useState(false);

  // Edit user
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editReason, setEditReason] = useState('');

  // Password reset
  const [resetting, setResetting] = useState<AdminUserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetReason, setResetReason] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const result = await adminService.listUsers({ search: search || undefined });
      setUsers(result.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(t('admin.users.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = async () => {
    if (!newUser.name.trim() || !newUser.reason.trim()) return;
    setCreating(true);
    try {
      await adminService.createUser({
        name: newUser.name.trim(),
        email: newUser.email.trim() || undefined,
        username: newUser.username.trim() || undefined,
        password: newUser.password,
        role: newUser.role,
        reason: newUser.reason.trim(),
      });
      setNewUser({ name: '', email: '', username: '', password: '', role: 'user', reason: '' });
      setShowCreate(false);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to create user:', err);
      setError(t('admin.users.createError'));
    } finally {
      setCreating(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editReason.trim()) return;
    try {
      await adminService.updateUser(editing.id, {
        role: editRole as 'user' | 'teacher' | 'admin',
        isActive: editActive,
        reason: editReason.trim(),
      });
      setEditing(null);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
      setError(t('admin.users.updateError'));
    }
  };

  const doResetPassword = async () => {
    if (!resetting || !newPassword || !resetReason.trim()) return;
    try {
      await adminService.resetPassword(resetting.id, newPassword, resetReason.trim());
      setResetting(null);
      setNewPassword('');
      setResetReason('');
    } catch (err) {
      console.error('Failed to reset password:', err);
      setError(t('admin.users.resetError'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.users.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? <Eye className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {showCreate ? t('admin.users.hideForm') : t('admin.users.create')}
        </Button>
      </div>

      {/* Create user form */}
      {showCreate && (
        <Card className="border-purple-500/30">
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
            <Input
              placeholder={t('admin.users.namePlaceholder')}
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <Input
              placeholder={t('admin.users.emailPlaceholder')}
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <Input
              placeholder={t('admin.users.usernamePlaceholder')}
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            />
            <Input
              type="password"
              placeholder={t('admin.users.passwordPlaceholder')}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'user' | 'teacher' | 'admin' })}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="user">{t('admin.users.role.user')}</option>
              <option value="teacher">{t('admin.users.role.teacher')}</option>
              <option value="admin">{t('admin.users.role.admin')}</option>
            </select>
            <Input
              placeholder={t('admin.users.reasonPlaceholder')}
              value={newUser.reason}
              onChange={(e) => setNewUser({ ...newUser, reason: e.target.value })}
            />
            <Button
              className="sm:col-span-2"
              onClick={createUser}
              disabled={creating || !newUser.name.trim() || !newUser.reason.trim()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {t('admin.users.createBtn')}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* User list */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('admin.users.none')}</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/10 text-sm font-semibold text-purple-600">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {user.name}
                      <Badge variant="secondary" className="ml-2 text-[10px] capitalize">
                        {user.role}
                      </Badge>
                      {!user.isActive && (
                        <Badge variant="destructive" className="ml-1 text-[10px]">
                          {t('admin.users.disabled')}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.username ? `@${user.username}` : ''}
                      {user.email ? ` · ${user.email}` : ''}
                      {!user.email && !user.username ? t('admin.users.noIdentifier') : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(user);
                        setEditRole(user.role);
                        setEditActive(user.isActive);
                        setEditReason('');
                      }}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      {t('admin.users.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setResetting(user);
                        setNewPassword('');
                        setResetReason('');
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                      {t('admin.users.reset')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      {editing && (
        <DialogShell title={t('admin.users.editUser')} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{editing.name}</p>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="user">{t('admin.users.role.user')}</option>
              <option value="teacher">{t('admin.users.role.teacher')}</option>
              <option value="admin">{t('admin.users.role.admin')}</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="h-4 w-4"
              />
              {t('admin.users.activeLabel')}
            </label>
            <Input
              placeholder={t('admin.users.reasonPlaceholder')}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={saveEdit} disabled={!editReason.trim()}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogShell>
      )}

      {/* Reset password dialog */}
      {resetting && (
        <DialogShell title={t('admin.users.resetPassword')} onClose={() => setResetting(null)}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{resetting.name}</p>
            <Input
              type="password"
              placeholder={t('admin.users.newPasswordPlaceholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              placeholder={t('admin.users.reasonPlaceholder')}
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setResetting(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={doResetPassword} disabled={!newPassword || !resetReason.trim()}>
                <KeyRound className="h-4 w-4" />
                {t('admin.users.resetBtn')}
              </Button>
            </div>
          </div>
        </DialogShell>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Audit tab
// ------------------------------------------------------------------
function AuditTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 9: export + retention
  const [exportBusy, setExportBusy] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [retention, setRetention] = useState<AuditRetention | null>(null);
  const [retentionInput, setRetentionInput] = useState('');
  const [retentionReason, setRetentionReason] = useState('');
  const [retentionBusy, setRetentionBusy] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const result = await adminService.auditLogs({ limit: 100 });
      setLogs(result.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError(t('admin.audit.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchLogs();
    if (isAdmin) {
      adminService.auditRetention().then(setRetention).catch(() => undefined);
    }
  }, [fetchLogs, isAdmin]);

  const doExport = async () => {
    setExportBusy(true);
    try {
      const csv = await adminService.exportAuditLogs('csv');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-log.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export audit log:', err);
      setError(t('admin.audit.exportError'));
    } finally {
      setExportBusy(false);
    }
  };

  const doSetRetention = async () => {
    const days = Number(retentionInput);
    if (!Number.isInteger(days) || days <= 0 || !retentionReason.trim()) return;
    setRetentionBusy(true);
    try {
      const result = await adminService.setAuditRetention(days, retentionReason.trim());
      setRetention(result);
      setRetentionInput('');
      setRetentionReason('');
    } catch (err) {
      console.error('Failed to set retention:', err);
      setError(t('admin.audit.retentionError'));
    } finally {
      setRetentionBusy(false);
    }
  };

  const doPurge = async () => {
    setPurgeBusy(true);
    try {
      const result = await adminService.purgeAuditLogs();
      setError(null);
      await fetchLogs();
      window.alert(t('admin.audit.purged', { count: result.deleted }));
    } catch (err) {
      console.error('Failed to purge audit log:', err);
      setError(t('admin.audit.purgeError'));
    } finally {
      setPurgeBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Phase 9: export + retention controls */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Button size="sm" variant="outline" disabled={exportBusy} onClick={() => void doExport()}>
            {exportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t('admin.audit.export')}
          </Button>
          {isAdmin && (
            <>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="w-28"
                  placeholder={t('admin.audit.retentionPlaceholder')}
                  value={retentionInput}
                  onChange={(e) => setRetentionInput(e.target.value)}
                />
                <Input
                  className="w-52"
                  placeholder={t('admin.audit.retentionReason')}
                  value={retentionReason}
                  onChange={(e) => setRetentionReason(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retentionBusy || !retentionInput || !retentionReason.trim()}
                  onClick={() => void doSetRetention()}
                >
                  {retentionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  {t('admin.audit.setRetention')}
                </Button>
              </div>
              <Button size="sm" variant="destructive" disabled={purgeBusy} onClick={() => void doPurge()}>
                {purgeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
                {t('admin.audit.purge')}
              </Button>
              {retention && (
                <span className="text-xs text-muted-foreground">
                  {t('admin.audit.retentionNow')}: {retention.retentionDays} {t('admin.audit.days')}
                </span>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4 text-purple-600" />
          {t('admin.audit.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('admin.audit.none')}</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      {log.action}
                    </Badge>
                    <span className="text-sm font-medium">{log.actorName ?? t('admin.audit.system')}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">{t('admin.audit.reason')}:</span>{' '}
                  {log.reason}
                </p>
                {log.targetType && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('admin.audit.target')}: {log.targetType}
                    {log.targetId ? ` · ${log.targetId}` : ''}
                  </p>
                )}
                {Object.keys(log.details ?? {}).length > 0 && (
                  <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-[11px]">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------
// System status tab (Phase 9)
// ------------------------------------------------------------------
function SystemTab() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await adminService.systemStatus();
      setStatus(result);
      setError(null);
    } catch (err) {
      console.error('Failed to load system status:', err);
      setError(t('admin.system.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error ?? t('admin.system.loadError')}
      </div>
    );
  }

  const healthRows = [
    { key: 'database' as const, label: t('admin.system.health.database'), icon: Database },
    { key: 'redis' as const, label: t('admin.system.health.redis'), icon: Server },
    { key: 'qdrant' as const, label: t('admin.system.health.qdrant'), icon: Boxes },
    { key: 'queue' as const, label: t('admin.system.health.queue'), icon: Activity },
  ];

  return (
    <div className="space-y-4">
      {/* Counts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-purple-600" />
              {t('admin.system.users')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {(Object.keys(status.users).length === 0 ? ['user'] : Object.keys(status.users)).map(
              (role) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-muted-foreground capitalize">{role}</span>
                  <span className="font-semibold tabular-nums">{status.users[role] ?? 0}</span>
                </div>
              ),
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ScrollText className="h-4 w-4 text-purple-600" />
              {t('admin.system.auditCount')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {status.auditCount.toLocaleString()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-purple-600" />
              {t('admin.system.activeEvents')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {status.activeEvents}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flag className="h-4 w-4 text-purple-600" />
              {t('admin.system.activeFactions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {status.activeFactions}
          </CardContent>
        </Card>
      </div>

      {/* Health + queue */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-purple-600" />
              {t('admin.system.health.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {healthRows.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </span>
                <Badge
                  variant={status.health[key] ? 'outline' : 'destructive'}
                  className={status.health[key] ? 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300' : ''}
                >
                  {status.health[key] ? t('admin.system.health.ok') : t('admin.system.health.down')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4 text-purple-600" />
              {t('admin.system.queue')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {(
              [
                ['waiting', t('admin.system.queueWaiting')],
                ['active', t('admin.system.queueActive')],
                ['completed', t('admin.system.queueCompleted')],
                ['failed', t('admin.system.queueFailed')],
                ['delayed', t('admin.system.queueDelayed')],
              ] as Array<[keyof SystemStatus['queue'], string]>
            ).map(([key, label]) => (
              <div key={key} className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold tabular-nums">{status.queue[key]}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Admin Notes tab
// ------------------------------------------------------------------
function NotesTab() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const result = await adminService.listNotes({ limit: 100 });
      setNotes(result.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load admin notes:', err);
      setError(t('admin.notes.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const doUpload = async () => {
    if (!uploadTitle.trim() || !uploadFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('title', uploadTitle.trim());
      if (uploadSubject.trim()) form.append('subject', uploadSubject.trim());
      form.append('file', uploadFile);
      await adminService.uploadNote(form);
      setUploadTitle('');
      setUploadSubject('');
      setUploadFile(null);
      setShowUpload(false);
      await fetchNotes();
    } catch (err) {
      console.error('Failed to upload note:', err);
      setError(t('admin.notes.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const deleteNote = async (note: AdminNote) => {
    const reason = window.prompt(t('admin.notes.deleteReasonPrompt'));
    if (!reason) return;
    try {
      await adminService.deleteNote(note.id, reason);
      await fetchNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError(t('admin.notes.deleteError'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('admin.notes.hint')}</p>
        <Button onClick={() => setShowUpload((v) => !v)}>
          {showUpload ? <Eye className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
          {showUpload ? t('admin.notes.hideForm') : t('admin.notes.upload')}
        </Button>
      </div>

      {showUpload && (
        <Card className="border-purple-500/30">
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
            <Input
              placeholder={t('admin.notes.titlePlaceholder')}
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
            <Input
              placeholder={t('admin.notes.subjectPlaceholder')}
              value={uploadSubject}
              onChange={(e) => setUploadSubject(e.target.value)}
            />
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="sm:col-span-2 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <Button className="sm:col-span-2" onClick={doUpload} disabled={uploading || !uploadTitle.trim() || !uploadFile}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {t('admin.notes.uploadBtn')}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('admin.notes.none')}</p>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <div key={note.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-purple-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{note.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {note.subject ? `${note.subject} · ` : ''}
                      {note.pageCount > 0 ? `${t('admin.notes.pages')}: ${note.pageCount}` : t('admin.notes.textNote')}
                      {note.selectedPages && note.selectedPages.length > 0 && (
                        <> · {t('admin.notes.selectedPages')}: {note.selectedPages.join(', ')}</>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNote(note)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------
// Syllabus tab
// ------------------------------------------------------------------
function SyllabusTab() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<SyllabusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    board: '',
    grade: '',
    subject: '',
    chaptersText: '',
    reason: '',
  });

  const fetchSyllabus = useCallback(async () => {
    try {
      const result = await adminService.listSyllabus({});
      setEntries(result);
      setError(null);
    } catch (err) {
      console.error('Failed to load syllabus:', err);
      setError(t('admin.syllabus.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSyllabus();
  }, [fetchSyllabus]);

  const saveSyllabus = async () => {
    if (!form.board.trim() || !form.grade.trim() || !form.subject.trim() || !form.reason.trim()) return;
    let chapters: Array<{ name: string; topics?: string[] }> = [];
    try {
      const parsed = JSON.parse(form.chaptersText || '[]');
      if (Array.isArray(parsed)) chapters = parsed;
    } catch {
      chapters = form.chaptersText
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => ({ name: l.trim() }));
    }
    setSaving(true);
    try {
      await adminService.upsertSyllabus({
        board: form.board.trim(),
        grade: form.grade.trim(),
        subject: form.subject.trim(),
        chapters,
        reason: form.reason.trim(),
      });
      setForm({ board: '', grade: '', subject: '', chaptersText: '', reason: '' });
      setShowForm(false);
      await fetchSyllabus();
    } catch (err) {
      console.error('Failed to save syllabus:', err);
      setError(t('admin.syllabus.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSyllabus = async (entry: SyllabusEntry) => {
    const reason = window.prompt(t('admin.syllabus.deleteReasonPrompt'));
    if (!reason) return;
    try {
      await adminService.deleteSyllabus(entry.id, reason);
      await fetchSyllabus();
    } catch (err) {
      console.error('Failed to delete syllabus:', err);
      setError(t('admin.syllabus.deleteError'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('admin.syllabus.hint')}</p>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <Eye className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? t('admin.syllabus.hideForm') : t('admin.syllabus.add')}
        </Button>
      </div>

      {showForm && (
        <Card className="border-purple-500/30">
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
            <Input placeholder={t('admin.syllabus.boardPlaceholder')} value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} />
            <Input placeholder={t('admin.syllabus.gradePlaceholder')} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
            <Input placeholder={t('admin.syllabus.subjectPlaceholder')} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <textarea
              placeholder={t('admin.syllabus.chaptersPlaceholder')}
              value={form.chaptersText}
              onChange={(e) => setForm({ ...form, chaptersText: e.target.value })}
              rows={4}
              className="sm:col-span-3 rounded-lg border bg-background px-3 py-2 text-sm"
            />
            <Input
              placeholder={t('admin.syllabus.reasonPlaceholder')}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="sm:col-span-3"
            />
            <Button className="sm:col-span-3" onClick={saveSyllabus} disabled={saving || !form.board.trim() || !form.grade.trim() || !form.subject.trim() || !form.reason.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t('admin.syllabus.save')}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('admin.syllabus.none')}</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{entry.board}</Badge>
                      <Badge variant="outline">{entry.grade}</Badge>
                      <span className="text-sm font-semibold">{entry.subject}</span>
                    </div>
                    <button
                      onClick={() => deleteSyllabus(entry)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {entry.chapters.map((chapter, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        • {chapter.name}
                        {chapter.topics && chapter.topics.length > 0 && ` (${chapter.topics.join(', ')})`}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Simple modal shell (kept local to avoid new deps)
function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50 border-0 p-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
