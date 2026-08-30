import { apiRequest } from './api';
import {
  TransactionResponse,
  TransactionCreate,
  TransactionUpdate,
  PaginatedResponse,
  TransactionFilterParams,
  MessageResponse,
} from './types';

export const transactionService = {
  async listTransactions(params: TransactionFilterParams = {}): Promise<PaginatedResponse<TransactionResponse>> {
    return apiRequest<PaginatedResponse<TransactionResponse>>('/api/transactions', {
      method: 'GET',
      params: {
        page: params.page,
        limit: params.limit,
        search: params.search,
        type: params.type,
        category: params.category,
        account: params.account,
        credit_card: params.credit_card,
        start_date: params.start_date,
        end_date: params.end_date,
        min_amount: params.min_amount,
        max_amount: params.max_amount,
        sort_by: params.sort_by,
        sort_order: params.sort_order,
      },
    });
  },

  async createTransaction(data: TransactionCreate): Promise<TransactionResponse> {
    return apiRequest<TransactionResponse>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getTransaction(id: string): Promise<TransactionResponse> {
    return apiRequest<TransactionResponse>(`/api/transactions/${id}`, {
      method: 'GET',
    });
  },

  async updateTransaction(id: string, data: TransactionUpdate): Promise<TransactionResponse> {
    return apiRequest<TransactionResponse>(`/api/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteTransaction(id: string): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
  },
};
