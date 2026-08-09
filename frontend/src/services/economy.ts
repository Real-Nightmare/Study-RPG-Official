import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  EconomyBurnResult,
  EconomyBurnStatus,
  EconomyCollectionCard,
  EconomyInstalmentRun,
  EconomyListing,
  EconomyOffer,
  EconomyPricePoint,
  EconomyReconcileResult,
  EconomyScrapeResult,
  EconomySettlement,
  EconomySupplyRow,
} from '@/types';

export const economyService = {
  // ---------------- Marketplace (§20) ----------------
  async marketplace(params?: {
    rarity?: string;
    cardKey?: string;
    mine?: boolean;
  }): Promise<EconomyListing[]> {
    const response = await api.get<EconomyListing[]>(ENDPOINTS.economy.marketplace, { params });
    return response.data;
  },

  async listCard(cardInstanceId: string, price: number): Promise<EconomyListing> {
    const response = await api.post<EconomyListing>(ENDPOINTS.economy.listings, {
      cardInstanceId,
      price,
    });
    return response.data;
  },

  async cancelListing(id: string): Promise<{ cancelled: boolean }> {
    const response = await api.delete<{ cancelled: boolean }>(ENDPOINTS.economy.listing(id));
    return response.data;
  },

  async buyListing(id: string): Promise<EconomySettlement> {
    const response = await api.post<EconomySettlement>(ENDPOINTS.economy.buyListing(id));
    return response.data;
  },

  // ---------------- Offers (§20) ----------------
  async myOffers(): Promise<EconomyOffer[]> {
    const response = await api.get<EconomyOffer[]>(ENDPOINTS.economy.offers);
    return response.data;
  },

  async makeOffer(listingId: string, amount: number): Promise<EconomyOffer> {
    const response = await api.post<EconomyOffer>(ENDPOINTS.economy.makeOffer(listingId), {
      amount,
    });
    return response.data;
  },

  async acceptOffer(id: string): Promise<EconomySettlement> {
    const response = await api.post<EconomySettlement>(ENDPOINTS.economy.acceptOffer(id));
    return response.data;
  },

  async declineOffer(id: string): Promise<{ declined: boolean }> {
    const response = await api.post<{ declined: boolean }>(ENDPOINTS.economy.declineOffer(id));
    return response.data;
  },

  async cancelOffer(id: string): Promise<{ cancelled: boolean }> {
    const response = await api.post<{ cancelled: boolean }>(ENDPOINTS.economy.cancelOffer(id));
    return response.data;
  },

  // ---------------- Collection & vault (§18) ----------------
  async myCards(): Promise<EconomyCollectionCard[]> {
    const response = await api.get<EconomyCollectionCard[]>(ENDPOINTS.economy.cards);
    return response.data;
  },

  async moveCard(id: string, location: 'inventory' | 'vault'): Promise<EconomyCollectionCard> {
    const response = await api.post<EconomyCollectionCard>(ENDPOINTS.economy.moveCard(id), {
      location,
    });
    return response.data;
  },

  // ---------------- Scraper & burner (§22, §23) ----------------
  async scrapeCard(id: string): Promise<EconomyScrapeResult> {
    const response = await api.post<EconomyScrapeResult>(ENDPOINTS.economy.scrapeCard(id), {
      confirm: true,
    });
    return response.data;
  },

  async burnCard(id: string): Promise<EconomyBurnResult> {
    const response = await api.post<EconomyBurnResult>(ENDPOINTS.economy.burnCard(id), {
      confirm: true,
    });
    return response.data;
  },

  async burnStatus(id: string): Promise<EconomyBurnStatus> {
    const response = await api.get<EconomyBurnStatus>(ENDPOINTS.economy.burnStatus(id));
    return response.data;
  },

  // ---------------- Supply (§16.3, §21, §24) ----------------
  async supplyReport(): Promise<EconomySupplyRow[]> {
    const response = await api.get<EconomySupplyRow[]>(ENDPOINTS.economy.supply);
    return response.data;
  },

  async priceHistory(cardKey: string): Promise<EconomyPricePoint[]> {
    const response = await api.get<EconomyPricePoint[]>(ENDPOINTS.economy.priceHistory(cardKey));
    return response.data;
  },

  // ---------------- Admin housekeeping ----------------
  async reconcile(): Promise<EconomyReconcileResult> {
    const response = await api.post<EconomyReconcileResult>(ENDPOINTS.economy.adminReconcile);
    return response.data;
  },

  async processBurnInstalments(): Promise<EconomyInstalmentRun> {
    const response = await api.post<EconomyInstalmentRun>(
      ENDPOINTS.economy.adminProcessInstalments,
    );
    return response.data;
  },
};
