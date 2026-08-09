import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  AdminNote,
  AdminUserRow,
  AuditLogEntry,
  AuditRetention,
  SyllabusEntry,
  SystemStatus,
} from '@/types';

export const adminService = {
  async listUsers(params: { search?: string; role?: string; limit?: number; offset?: number } = {}) {
    const response = await api.get<{ data: AdminUserRow[]; total: number }>(ENDPOINTS.admin.users, {
      params,
    });
    return response.data;
  },

  async createUser(data: {
    name: string;
    email?: string;
    username?: string;
    password: string;
    role?: 'user' | 'teacher' | 'admin';
    reason: string;
  }): Promise<AdminUserRow> {
    const response = await api.post<AdminUserRow>(ENDPOINTS.admin.createUser, data);
    return response.data;
  },

  async updateUser(
    id: string,
    data: {
      name?: string;
      email?: string;
      username?: string;
      role?: 'user' | 'teacher' | 'admin';
      isActive?: boolean;
      reason: string;
    },
  ): Promise<AdminUserRow> {
    const response = await api.post<AdminUserRow>(ENDPOINTS.admin.updateUser(id), data);
    return response.data;
  },

  async resetPassword(id: string, newPassword: string, reason: string): Promise<void> {
    await api.post(ENDPOINTS.admin.resetPassword(id), { newPassword, reason });
  },

  async auditLogs(params: {
    actorId?: string;
    action?: string;
    targetType?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const response = await api.get<{ data: AuditLogEntry[]; total: number }>(
      ENDPOINTS.admin.auditLogs,
      { params },
    );
    return response.data;
  },

  // ---- Admin notes ----
  async listNotes(params: { subject?: string; limit?: number; offset?: number } = {}) {
    const response = await api.get<{ data: AdminNote[]; total: number }>(ENDPOINTS.adminNotes.list, {
      params,
    });
    return response.data;
  },

  async uploadNote(form: FormData): Promise<AdminNote> {
    const response = await api.post<AdminNote>(ENDPOINTS.adminNotes.create, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async deleteNote(id: string, reason: string): Promise<void> {
    await api.delete(ENDPOINTS.adminNotes.remove(id), { data: { reason } });
  },

  // ---- Syllabus ----
  async listSyllabus(params: { board?: string; grade?: string; subject?: string } = {}) {
    const response = await api.get<SyllabusEntry[]>(ENDPOINTS.adminNotes.syllabus, { params });
    return response.data;
  },

  async upsertSyllabus(data: {
    board: string;
    grade: string;
    subject: string;
    chapters: Array<{ name: string; topics?: string[] }>;
    reason: string;
  }): Promise<SyllabusEntry> {
    const response = await api.post<SyllabusEntry>(ENDPOINTS.adminNotes.syllabus, data);
    return response.data;
  },

  async deleteSyllabus(id: string, reason: string): Promise<void> {
    await api.delete(ENDPOINTS.adminNotes.syllabusItem(id), { data: { reason } });
  },

  // ---- Phase 9: audit export + retention + status ----
  async exportAuditLogs(format: 'csv' | 'json' = 'csv'): Promise<string> {
    const response = await api.get<string>(ENDPOINTS.admin.auditExport, {
      params: { format },
      responseType: 'text',
    });
    return response.data;
  },

  async auditRetention(): Promise<AuditRetention> {
    const response = await api.get<AuditRetention>(ENDPOINTS.admin.auditRetention);
    return response.data;
  },

  async setAuditRetention(retentionDays: number, reason: string): Promise<AuditRetention> {
    const response = await api.post<AuditRetention>(ENDPOINTS.admin.auditRetention, {
      retentionDays,
      reason,
    });
    return response.data;
  },

  async purgeAuditLogs(): Promise<{ deleted: number }> {
    const response = await api.post<{ deleted: number }>(ENDPOINTS.admin.auditPurge);
    return response.data;
  },

  async systemStatus(): Promise<SystemStatus> {
    const response = await api.get<SystemStatus>(ENDPOINTS.admin.status);
    return response.data;
  },
};
