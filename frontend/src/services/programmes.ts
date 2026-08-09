import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  BatchReviewItem,
  CreateProgrammeTemplateRequest,
  Programme,
  ProgrammeTemplate,
  SuggestProgrammeRequest,
} from '@/types';

export const programmesService = {
  async list(params: { status?: string; kind?: string; mine?: boolean } = {}): Promise<Programme[]> {
    const response = await api.get<Programme[]>(ENDPOINTS.programmes.list, {
      params: {
        status: params.status,
        kind: params.kind,
        mine: params.mine ? 'true' : undefined,
      },
    });
    return response.data;
  },

  async suggest(data: SuggestProgrammeRequest): Promise<Programme> {
    const response = await api.post<Programme>(ENDPOINTS.programmes.suggest, data);
    return response.data;
  },

  // ---- Templates (Phase 8) ----
  async listTemplates(): Promise<ProgrammeTemplate[]> {
    const response = await api.get<ProgrammeTemplate[]>(ENDPOINTS.programmes.templates);
    return response.data;
  },

  async createTemplate(data: CreateProgrammeTemplateRequest): Promise<ProgrammeTemplate> {
    const response = await api.post<ProgrammeTemplate>(ENDPOINTS.programmes.templates, data);
    return response.data;
  },

  async updateTemplate(
    id: string,
    data: Partial<CreateProgrammeTemplateRequest>,
  ): Promise<ProgrammeTemplate> {
    const response = await api.put<ProgrammeTemplate>(ENDPOINTS.programmes.template(id), data);
    return response.data;
  },

  async deleteTemplate(id: string, reason: string): Promise<void> {
    await api.delete(ENDPOINTS.programmes.template(id), { data: { reason } });
  },

  async suggestFromTemplate(templateId: string, hasFactions = false, factionSize = 7): Promise<Programme> {
    const response = await api.post<Programme>(ENDPOINTS.programmes.suggestFromTemplate, {
      templateId,
      hasFactions,
      factionSize,
    });
    return response.data;
  },

  // ---- Review queue + batch (Phase 8) ----
  async reviewQueue(): Promise<Programme[]> {
    const response = await api.get<Programme[]>(ENDPOINTS.programmes.reviewQueue);
    return response.data;
  },

  async batchReview(items: BatchReviewItem[]): Promise<{ reviewed: number }> {
    const response = await api.post<{ reviewed: number }>(ENDPOINTS.programmes.batchReview, {
      items,
    });
    return response.data;
  },

  async get(id: string): Promise<Programme> {
    const response = await api.get<Programme>(ENDPOINTS.programmes.get(id));
    return response.data;
  },

  async join(id: string): Promise<Programme> {
    const response = await api.post<Programme>(ENDPOINTS.programmes.join(id));
    return response.data;
  },

  async leave(id: string): Promise<Programme> {
    const response = await api.post<Programme>(ENDPOINTS.programmes.leave(id));
    return response.data;
  },

  async review(
    id: string,
    data: { verdict: 'accepted' | 'rejected'; reason: string; score?: number },
  ): Promise<Programme> {
    const response = await api.post<Programme>(ENDPOINTS.programmes.review(id), data);
    return response.data;
  },

  async archive(id: string, reason: string): Promise<Programme> {
    const response = await api.post<Programme>(ENDPOINTS.programmes.archive(id), { reason });
    return response.data;
  },
};
