import api from './api';
import { ENDPOINTS } from '@/config/api';
import type { ElectionResult, Faction, FactionMember, HelpPledge } from '@/types';

export const factionsService = {
  async list(programmeId?: string): Promise<Faction[]> {
    const response = await api.get<Faction[]>(ENDPOINTS.factions.list, {
      params: programmeId ? { programmeId } : {},
    });
    return response.data;
  },

  async mine(): Promise<Faction | null> {
    const response = await api.get<Faction | null>(ENDPOINTS.factions.mine);
    return response.data;
  },

  async leaderboard(programmeId?: string): Promise<Faction[]> {
    const response = await api.get<Faction[]>(ENDPOINTS.factions.leaderboard, {
      params: programmeId ? { programmeId } : {},
    });
    return response.data;
  },

  async helpPledges(): Promise<HelpPledge[]> {
    const response = await api.get<HelpPledge[]>(ENDPOINTS.factions.helpPledges);
    return response.data;
  },

  async autoAssign(programmeId?: string | null): Promise<Faction> {
    const response = await api.post<Faction>(ENDPOINTS.factions.autoAssign, { programmeId });
    return response.data;
  },

  async vote(factionId: string, candidateId: string): Promise<void> {
    await api.post(ENDPOINTS.factions.vote(factionId), { candidateId });
  },

  async members(factionId: string): Promise<FactionMember[]> {
    const response = await api.get<FactionMember[]>(ENDPOINTS.factions.members(factionId));
    return response.data;
  },

  async election(factionId: string): Promise<ElectionResult[]> {
    const response = await api.get<ElectionResult[]>(ENDPOINTS.factions.election(factionId));
    return response.data;
  },

  async recordHelp(factionId: string, note?: string): Promise<void> {
    await api.post(ENDPOINTS.factions.help(factionId), { note });
  },

  async promoteLeaders(factionId: string): Promise<string[]> {
    const response = await api.post<string[]>(ENDPOINTS.factions.promoteLeaders(factionId));
    return response.data;
  },
};
