import { apiRequest } from './api';
import {
  EMIResponse,
  EMICreate,
  EMIUpdate,
  EMIMarkPaidResponse,
  EMIStatus,
  MessageResponse,
} from './types';

export const emiService = {
  async listEMIs(status?: EMIStatus): Promise<EMIResponse[]> {
    return apiRequest<EMIResponse[]>('/api/emi', {
      method: 'GET',
      params: status ? { status } : undefined,
    });
  },

  async createEMI(data: EMICreate): Promise<EMIResponse> {
    return apiRequest<EMIResponse>('/api/emi', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getEMI(id: string): Promise<EMIResponse> {
    return apiRequest<EMIResponse>(`/api/emi/${id}`, {
      method: 'GET',
    });
  },

  async updateEMI(id: string, data: EMIUpdate): Promise<EMIResponse> {
    return apiRequest<EMIResponse>(`/api/emi/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteEMI(id: string): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(`/api/emi/${id}`, {
      method: 'DELETE',
    });
  },

  async markPaid(id: string): Promise<EMIMarkPaidResponse> {
    return apiRequest<EMIMarkPaidResponse>(`/api/emi/${id}/mark-paid`, {
      method: 'POST',
    });
  },
};
