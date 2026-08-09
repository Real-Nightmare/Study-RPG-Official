import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  CreateRpgBattleRequest,
  CreateRpgDeckRequest,
  CreateRpgPvpDuelRequest,
  RpgBattle,
  RpgBattleActionRequest,
  RpgBattleHistoryItem,
  RpgCardDefinition,
  RpgCardInstance,
  RpgDamageChallengeRequest,
  RpgDeck,
  RpgManaQuizRequest,
  RpgProfile,
  RpgPvpDuel,
  RpgPvpLeaderboardEntry,
  RpgWalletEntry,
  UpdateRpgDeckRequest,
  RpgExamBoss,
  RpgParty,
  RpgPartyBattle,
} from '@/types';

export const rpgService = {
  // ---------------- Profile & wallet ----------------
  async getProfile(): Promise<RpgProfile> {
    const response = await api.get<RpgProfile>(ENDPOINTS.rpg.profile);
    return response.data;
  },

  async getLedger(limit = 50): Promise<RpgWalletEntry[]> {
    const response = await api.get<RpgWalletEntry[]>(ENDPOINTS.rpg.ledger, {
      params: { limit },
    });
    return response.data;
  },

  // ---------------- Cards & collection ----------------
  async getCards(): Promise<RpgCardDefinition[]> {
    const response = await api.get<RpgCardDefinition[]>(ENDPOINTS.rpg.cards);
    return response.data;
  },

  async getCollection(): Promise<RpgCardInstance[]> {
    const response = await api.get<RpgCardInstance[]>(ENDPOINTS.rpg.collection);
    return response.data;
  },

  // ---------------- Decks ----------------
  async listDecks(): Promise<RpgDeck[]> {
    const response = await api.get<RpgDeck[]>(ENDPOINTS.rpg.decks);
    return response.data;
  },

  async createDeck(data: CreateRpgDeckRequest): Promise<RpgDeck> {
    const response = await api.post<RpgDeck>(ENDPOINTS.rpg.decks, data);
    return response.data;
  },

  async getDeck(id: string): Promise<RpgDeck> {
    const response = await api.get<RpgDeck>(ENDPOINTS.rpg.deck(id));
    return response.data;
  },

  async updateDeck(id: string, data: UpdateRpgDeckRequest): Promise<RpgDeck> {
    const response = await api.put<RpgDeck>(ENDPOINTS.rpg.deck(id), data);
    return response.data;
  },

  async equipDeck(id: string): Promise<RpgDeck> {
    const response = await api.post<RpgDeck>(ENDPOINTS.rpg.equipDeck(id));
    return response.data;
  },

  async deleteDeck(id: string): Promise<void> {
    await api.delete(ENDPOINTS.rpg.deck(id));
  },

  // ---------------- Battles ----------------
  async createBattle(data: CreateRpgBattleRequest): Promise<RpgBattle> {
    const response = await api.post<RpgBattle>(ENDPOINTS.rpg.battles, data);
    return response.data;
  },

  async getBattle(id: string): Promise<RpgBattle> {
    const response = await api.get<RpgBattle>(ENDPOINTS.rpg.battle(id));
    return response.data;
  },

  async battleHistory(limit = 20): Promise<RpgBattleHistoryItem[]> {
    const response = await api.get<RpgBattleHistoryItem[]>(ENDPOINTS.rpg.battleHistory, {
      params: { limit },
    });
    return response.data;
  },

  async playCard(id: string, data: RpgBattleActionRequest): Promise<RpgBattle> {
    const response = await api.post<RpgBattle>(ENDPOINTS.rpg.battleAction(id), data);
    return response.data;
  },

  async submitManaQuiz(id: string, data: RpgManaQuizRequest): Promise<RpgBattle> {
    const response = await api.post<RpgBattle>(ENDPOINTS.rpg.battleQuiz(id), data);
    return response.data;
  },

  async submitDamageChallenge(id: string, data: RpgDamageChallengeRequest): Promise<RpgBattle> {
    const response = await api.post<RpgBattle>(ENDPOINTS.rpg.battleChallenge(id), data);
    return response.data;
  },

  async forfeitBattle(id: string): Promise<RpgBattle> {
    const response = await api.post<RpgBattle>(ENDPOINTS.rpg.battleForfeit(id));
    return response.data;
  },

  // ---------------- PvP duels (Phase 5) ----------------
  async createPvpDuel(data: CreateRpgPvpDuelRequest): Promise<RpgPvpDuel> {
    const response = await api.post<RpgPvpDuel>(ENDPOINTS.rpg.pvpDuels, data);
    return response.data;
  },

  async listPvpDuels(): Promise<RpgPvpDuel[]> {
    const response = await api.get<RpgPvpDuel[]>(ENDPOINTS.rpg.pvpDuels);
    return response.data;
  },

  async getPvpDuel(id: string): Promise<RpgPvpDuel> {
    const response = await api.get<RpgPvpDuel>(ENDPOINTS.rpg.pvpDuel(id));
    return response.data;
  },

  async startPvpBattle(id: string): Promise<RpgBattle> {
    const response = await api.post<RpgBattle>(ENDPOINTS.rpg.pvpDuelBattle(id));
    return response.data;
  },

  async getPvpLeaderboard(limit = 20): Promise<RpgPvpLeaderboardEntry[]> {
    const response = await api.get<RpgPvpLeaderboardEntry[]>(ENDPOINTS.rpg.pvpLeaderboard, {
      params: { limit },
    });
    return response.data;
  },

  // ---------------- Party battles (Phase 6) ----------------
  async examBosses(): Promise<RpgExamBoss[]> {
    const response = await api.get<RpgExamBoss[]>(ENDPOINTS.rpgParty.examBosses);
    return response.data;
  },

  async myParty(): Promise<RpgParty | null> {
    const response = await api.get<RpgParty | null>(ENDPOINTS.rpgParty.mine);
    return response.data;
  },

  async createParty(name?: string): Promise<RpgParty> {
    const response = await api.post<RpgParty>(ENDPOINTS.rpgParty.create, { name });
    return response.data;
  },

  async getParty(id: string): Promise<RpgParty> {
    const response = await api.get<RpgParty>(ENDPOINTS.rpgParty.get(id));
    return response.data;
  },

  async inviteToParty(id: string, friendId: string): Promise<RpgParty> {
    const response = await api.post<RpgParty>(ENDPOINTS.rpgParty.invite(id), { friendId });
    return response.data;
  },

  async leaveParty(id: string): Promise<void> {
    await api.post(ENDPOINTS.rpgParty.leave(id));
  },

  async startPartyBattle(id: string, body: { examId?: string; bossKey?: string }): Promise<RpgPartyBattle> {
    const response = await api.post<RpgPartyBattle>(ENDPOINTS.rpgParty.startBattle(id), body);
    return response.data;
  },

  async listPartyBattles(id: string): Promise<RpgPartyBattle[]> {
    const response = await api.get<RpgPartyBattle[]>(ENDPOINTS.rpgParty.battles(id));
    return response.data;
  },

  async getPartyBattle(id: string): Promise<RpgPartyBattle> {
    const response = await api.get<RpgPartyBattle>(ENDPOINTS.rpgParty.battle(id));
    return response.data;
  },

  async partyBattleAction(id: string, cardInstanceId: string): Promise<RpgPartyBattle> {
    const response = await api.post<RpgPartyBattle>(ENDPOINTS.rpgParty.battleAction(id), {
      cardInstanceId,
    });
    return response.data;
  },

  async forfeitPartyBattle(id: string): Promise<RpgPartyBattle> {
    const response = await api.post<RpgPartyBattle>(ENDPOINTS.rpgParty.battleForfeit(id));
    return response.data;
  },
};
