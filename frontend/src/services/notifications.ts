import api from './api';
import { ENDPOINTS } from '@/config/api';
import type { WebPushPublicKey } from '@/types';

export const notificationsService = {
  async webPushPublicKey(): Promise<WebPushPublicKey> {
    const response = await api.get<WebPushPublicKey>(ENDPOINTS.notifications.webPushPublicKey);
    return response.data;
  },

  async webPushSubscribe(payload: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }): Promise<{ subscribed: boolean }> {
    const response = await api.post<{ subscribed: boolean }>(
      ENDPOINTS.notifications.webPushSubscribe,
      payload,
    );
    return response.data;
  },

  async webPushUnsubscribe(endpoint: string): Promise<void> {
    await api.post(ENDPOINTS.notifications.webPushUnsubscribe, { endpoint });
  },
};
