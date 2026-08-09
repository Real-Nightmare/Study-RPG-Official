import api from './api';
import { ENDPOINTS } from '@/config/api';
import type { DirectMessage, FriendUser, SearchUserResult } from '@/types';

export const socialService = {
  async searchUsers(q: string): Promise<SearchUserResult[]> {
    const response = await api.get<SearchUserResult[]>(ENDPOINTS.social.searchUsers, {
      params: { q },
    });
    return response.data;
  },

  async friends(): Promise<FriendUser[]> {
    const response = await api.get<FriendUser[]>(ENDPOINTS.social.friends);
    return response.data;
  },

  async conversations(): Promise<FriendUser[]> {
    const response = await api.get<FriendUser[]>(ENDPOINTS.social.conversations);
    return response.data;
  },

  async sendRequest(addresseeId: string): Promise<void> {
    await api.post(ENDPOINTS.social.request, { addresseeId });
  },

  async accept(friendshipId: string): Promise<void> {
    await api.post(ENDPOINTS.social.accept(friendshipId));
  },

  async decline(friendshipId: string): Promise<void> {
    await api.post(ENDPOINTS.social.decline(friendshipId));
  },

  async block(targetId: string): Promise<void> {
    await api.post(ENDPOINTS.social.block, { targetId });
  },

  async messages(friendId: string): Promise<DirectMessage[]> {
    const response = await api.get<DirectMessage[]>(ENDPOINTS.social.messages(friendId));
    return response.data;
  },

  async sendMessage(friendId: string, content: string): Promise<DirectMessage> {
    const response = await api.post<DirectMessage>(ENDPOINTS.social.messages(friendId), {
      content,
    });
    return response.data;
  },

  async unread(): Promise<number> {
    const response = await api.get<{ count: number }>(ENDPOINTS.social.unread);
    return response.data.count;
  },
};
