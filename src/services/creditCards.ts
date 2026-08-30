import { apiRequest } from './api';
import {
  CreditCardResponse,
  CreditCardCreate,
  CreditCardUpdate,
  MessageResponse,
} from './types';

export const creditCardService = {
  async listCreditCards(): Promise<CreditCardResponse[]> {
    return apiRequest<CreditCardResponse[]>('/api/credit-cards', {
      method: 'GET',
    });
  },

  async createCreditCard(data: CreditCardCreate): Promise<CreditCardResponse> {
    return apiRequest<CreditCardResponse>('/api/credit-cards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getCreditCard(id: string): Promise<CreditCardResponse> {
    return apiRequest<CreditCardResponse>(`/api/credit-cards/${id}`, {
      method: 'GET',
    });
  },

  async updateCreditCard(id: string, data: CreditCardUpdate): Promise<CreditCardResponse> {
    return apiRequest<CreditCardResponse>(`/api/credit-cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteCreditCard(id: string): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(`/api/credit-cards/${id}`, {
      method: 'DELETE',
    });
  },
};
