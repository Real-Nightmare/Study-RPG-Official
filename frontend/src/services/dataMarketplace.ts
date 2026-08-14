import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  BenchmarkRun,
  DataConsentView,
  DataMarketplaceStatus,
  MarketplaceDataset,
  MarketplaceDatasetType,
} from '@/types';

export const dataMarketplaceService = {
  // ---- Student consent ----
  async getConsent(): Promise<DataConsentView> {
    const response = await api.get<DataConsentView>(ENDPOINTS.dataMarketplace.consent);
    return response.data;
  },

  async setConsent(consented: boolean): Promise<DataConsentView> {
    const response = await api.put<DataConsentView>(ENDPOINTS.dataMarketplace.consent, {
      consented,
    });
    return response.data;
  },

  // ---- Datasets ----
  async listDatasets(): Promise<MarketplaceDataset[]> {
    const response = await api.get<MarketplaceDataset[]>(ENDPOINTS.dataMarketplace.datasets);
    return response.data;
  },

  async createDataset(data: {
    name: string;
    description?: string;
    datasetType: MarketplaceDatasetType;
    cohortFilters?: { country?: string; board?: string; grade?: string };
    priceCurrency?: string;
    priceAmount?: number;
    reason: string;
  }): Promise<MarketplaceDataset> {
    const response = await api.post<MarketplaceDataset>(ENDPOINTS.dataMarketplace.datasets, data);
    return response.data;
  },

  async updateDataset(
    id: string,
    data: {
      name?: string;
      description?: string;
      datasetType?: MarketplaceDatasetType;
      cohortFilters?: { country?: string; board?: string; grade?: string };
      priceCurrency?: string;
      priceAmount?: number;
      reason: string;
    },
  ): Promise<MarketplaceDataset> {
    const response = await api.patch<MarketplaceDataset>(
      ENDPOINTS.dataMarketplace.dataset(id),
      data,
    );
    return response.data;
  },

  async deleteDataset(id: string, reason: string): Promise<{ id: string }> {
    const response = await api.delete<{ id: string }>(ENDPOINTS.dataMarketplace.dataset(id), {
      data: { reason },
    });
    return response.data;
  },

  async publishDataset(id: string, reason: string): Promise<MarketplaceDataset> {
    const response = await api.post<MarketplaceDataset>(
      ENDPOINTS.dataMarketplace.publishDataset(id),
      { reason },
    );
    return response.data;
  },

  async revokeDataset(id: string, reason: string): Promise<MarketplaceDataset> {
    const response = await api.post<MarketplaceDataset>(
      ENDPOINTS.dataMarketplace.revokeDataset(id),
      { reason },
    );
    return response.data;
  },

  // ---- AI benchmarking (admin) ----
  async startBenchmark(data: {
    windowDays?: number;
    cohortFilters?: { country?: string; board?: string; grade?: string };
    note?: string;
  }): Promise<BenchmarkRun> {
    const response = await api.post<BenchmarkRun>(ENDPOINTS.dataMarketplace.benchmarks, data);
    return response.data;
  },

  async listBenchmarks(): Promise<BenchmarkRun[]> {
    const response = await api.get<BenchmarkRun[]>(ENDPOINTS.dataMarketplace.benchmarks);
    return response.data;
  },

  async getBenchmark(id: string): Promise<BenchmarkRun> {
    const response = await api.get<BenchmarkRun>(ENDPOINTS.dataMarketplace.benchmark(id));
    return response.data;
  },

  // ---- Publish-mode status (admin) ----
  async getStatus(): Promise<DataMarketplaceStatus> {
    const response = await api.get<DataMarketplaceStatus>(ENDPOINTS.dataMarketplace.status);
    return response.data;
  },
};
