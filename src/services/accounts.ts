import { apiRequest } from './api';
import {
  AccountResponse,
  AccountCreate,
  AccountUpdate,
  MessageResponse,
} from './types';

export const accountService = {
  async listAccounts(): Promise<AccountResponse[]> {
    return apiRequest<AccountResponse[]>('/api/accounts', {
      method: 'GET',
    });
  },

  async createAccount(data: AccountCreate): Promise<AccountResponse> {
    return apiRequest<AccountResponse>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getAccount(id: string): Promise<AccountResponse> {
    return apiRequest<AccountResponse>(`/api/accounts/${id}`, {
      method: 'GET',
    });
  },

  async updateAccount(id: string, data: AccountUpdate): Promise<AccountResponse> {
    return apiRequest<AccountResponse>(`/api/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteAccount(id: string): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(`/api/accounts/${id}`, {
      method: 'DELETE',
    });
  },
};
