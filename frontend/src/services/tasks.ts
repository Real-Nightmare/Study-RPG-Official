import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  StudyTask,
  CreateTaskRequest,
  UpdateTaskRequest,
  TodayTaskSummary,
} from '@/types';

export const tasksService = {
  async list(params?: {
    status?: string;
    type?: string;
    parentId?: string;
  }): Promise<StudyTask[]> {
    const response = await api.get<StudyTask[]>(ENDPOINTS.tasks.list, { params });
    return response.data;
  },

  async todaySummary(): Promise<TodayTaskSummary> {
    const response = await api.get<TodayTaskSummary>(ENDPOINTS.tasks.today);
    return response.data;
  },

  async get(id: string): Promise<StudyTask> {
    const response = await api.get<StudyTask>(ENDPOINTS.tasks.get(id));
    return response.data;
  },

  async create(data: CreateTaskRequest): Promise<StudyTask> {
    const response = await api.post<StudyTask>(ENDPOINTS.tasks.create, data);
    return response.data;
  },

  async update(id: string, data: UpdateTaskRequest): Promise<StudyTask> {
    const response = await api.put<StudyTask>(ENDPOINTS.tasks.update(id), data);
    return response.data;
  },

  async complete(id: string, actualMinutes?: number): Promise<StudyTask> {
    const response = await api.post<StudyTask>(ENDPOINTS.tasks.complete(id), {
      actualMinutes,
    });
    return response.data;
  },

  async reopen(id: string): Promise<StudyTask> {
    const response = await api.post<StudyTask>(ENDPOINTS.tasks.reopen(id));
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(ENDPOINTS.tasks.delete(id));
  },
};
