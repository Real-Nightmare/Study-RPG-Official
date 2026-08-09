import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  AbstractedCard,
  ClaimLevelResult,
  CreateEventRequest,
  CurrentEventView,
  EventQuest,
  ExtinctionTargetView,
  LimboResult,
  MilestoneView,
  StudyEvent,
  StudyPassTrackView,
  UnabstractRequest,
  UnabstractResult,
} from '@/types';

export const eventsService = {
  // ---------------- Current event & catalogue (§25) ----------------
  async current(): Promise<CurrentEventView | null> {
    const response = await api.get<CurrentEventView | null>(ENDPOINTS.events.current);
    return response.data;
  },

  async list(): Promise<StudyEvent[]> {
    const response = await api.get<StudyEvent[]>(ENDPOINTS.events.list);
    return response.data;
  },

  async get(slug: string): Promise<{ event: StudyEvent; studyPass: StudyPassTrackView }> {
    const response = await api.get<{ event: StudyEvent; studyPass: StudyPassTrackView }>(
      ENDPOINTS.events.get(slug),
    );
    return response.data;
  },

  // ---------------- StudyPass & tracks (§26, §27) ----------------
  async chooseTrack(track: 'free' | 'gold'): Promise<StudyPassTrackView> {
    const response = await api.post<StudyPassTrackView>(ENDPOINTS.events.chooseTrack, { track });
    return response.data;
  },

  async claimLevel(level: number): Promise<ClaimLevelResult> {
    const response = await api.post<ClaimLevelResult>(ENDPOINTS.events.claimLevel, { level });
    return response.data;
  },

  // ---------------- Quests (§30) ----------------
  async currentQuests(): Promise<EventQuest[]> {
    const response = await api.get<EventQuest[]>(ENDPOINTS.events.quests);
    return response.data;
  },

  async claimQuest(id: string): Promise<{ questId: string; granted: string[]; completed: boolean }> {
    const response = await api.post(ENDPOINTS.events.claimQuest(id));
    return response.data;
  },

  // ---------------- Items & sigils (§28, §29) ----------------
  async transferSigil(toUserId: string, quantity: number): Promise<{ transferred: boolean }> {
    const response = await api.post(ENDPOINTS.events.transferSigil, { toUserId, quantity });
    return response.data;
  },

  // ---------------- Abstracted event (§28) ----------------
  async myAbstracted(): Promise<AbstractedCard[]> {
    const response = await api.get<AbstractedCard[]>(ENDPOINTS.events.myAbstracted);
    return response.data;
  },

  async unabstract(payload: UnabstractRequest): Promise<UnabstractResult> {
    const response = await api.post<UnabstractResult>(ENDPOINTS.events.unabstract, payload);
    return response.data;
  },

  async limbo(confirm: boolean): Promise<LimboResult> {
    const response = await api.post<LimboResult>(ENDPOINTS.events.limbo, { confirm });
    return response.data;
  },

  // ---------------- Great Extinction (§29) ----------------
  async extinctionTargets(slug: string): Promise<ExtinctionTargetView[]> {
    const response = await api.get<ExtinctionTargetView[]>(ENDPOINTS.events.extinctionTargets(slug));
    return response.data;
  },

  async seedTargets(
    slug: string,
    cardKeys: string[],
    reason: string,
  ): Promise<ExtinctionTargetView[]> {
    const response = await api.post<ExtinctionTargetView[]>(ENDPOINTS.events.seedTargets(slug), {
      cardKeys,
      reason,
    });
    return response.data;
  },

  async milestones(slug: string): Promise<MilestoneView[]> {
    const response = await api.get<MilestoneView[]>(ENDPOINTS.events.milestones(slug));
    return response.data;
  },

  async claimMilestone(slug: string, id: string): Promise<{ claimed: boolean }> {
    const response = await api.post<{ claimed: boolean }>(ENDPOINTS.events.claimMilestone(slug, id));
    return response.data;
  },

  // ---------------- Admin scheduling (audited) ----------------
  async create(payload: CreateEventRequest): Promise<StudyEvent> {
    const response = await api.post<StudyEvent>(ENDPOINTS.events.create, payload);
    return response.data;
  },

  async activate(id: string, reason: string): Promise<StudyEvent> {
    const response = await api.post<StudyEvent>(ENDPOINTS.events.activate(id), { reason });
    return response.data;
  },
};
