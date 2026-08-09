import api from './api';
import { ENDPOINTS } from '@/config/api';
import type { CampfireReflection, CampfireSourceKind, CampfireStatus } from '@/types';

export interface StartCampfirePayload {
  sourceKind?: CampfireSourceKind;
  sourceId?: string;
  subject?: string;
  title?: string;
}

/**
 * Study RPG Integrity (spec 014): the metacognitive campfire loop.
 * The AI tutor asks one targeted synthesis question; a depth score maps to a
 * 1.0x–1.5x reward multiplier applied to subsequent reward claims.
 */
export const studyIntegrityService = {
  async getCampfireStatus(): Promise<CampfireStatus> {
    const res = await api.get<CampfireStatus>(ENDPOINTS.studyIntegrity.campfireStatus);
    return res.data;
  },

  async startCampfire(payload: StartCampfirePayload): Promise<CampfireReflection> {
    const res = await api.post<CampfireReflection>(
      ENDPOINTS.studyIntegrity.campfireStart,
      payload,
    );
    return res.data;
  },

  async answerCampfire(id: string, answer: string): Promise<CampfireReflection> {
    const res = await api.post<CampfireReflection>(
      ENDPOINTS.studyIntegrity.campfireAnswer(id),
      { answer },
    );
    return res.data;
  },

  async skipCampfire(id: string): Promise<CampfireReflection> {
    const res = await api.post<CampfireReflection>(ENDPOINTS.studyIntegrity.campfireSkip(id));
    return res.data;
  },
};
