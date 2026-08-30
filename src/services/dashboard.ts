import { apiRequest } from './api';
import {
  SummaryResponse,
  AnalyticsResponse,
  TransactionResponse,
  EMIResponse,
} from './types';

export const dashboardService = {
  async getSummary(startDate?: string, endDate?: string): Promise<SummaryResponse> {
    return apiRequest<SummaryResponse>('/api/dashboard/summary', {
      method: 'GET',
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });
  },

  async getAnalytics(startDate?: string, endDate?: string): Promise<AnalyticsResponse> {
    return apiRequest<AnalyticsResponse>('/api/dashboard/analytics', {
      method: 'GET',
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });
  },

  async getRecentTransactions(limit: number = 10): Promise<TransactionResponse[]> {
    return apiRequest<TransactionResponse[]>('/api/dashboard/recent-transactions', {
      method: 'GET',
      params: { limit },
    });
  },

  async getUpcomingEMI(limit: number = 10): Promise<EMIResponse[]> {
    return apiRequest<EMIResponse[]>('/api/dashboard/upcoming-emi', {
      method: 'GET',
      params: { limit },
    });
  },
};
