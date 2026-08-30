import { apiRequest } from './api';
import {
  UserResponse,
  UserUpdate,
  MessageResponse,
} from './types';

export const userService = {
  async getProfile(): Promise<UserResponse> {
    return apiRequest<UserResponse>('/api/users/me', {
      method: 'GET',
    });
  },

  async updateProfile(data: UserUpdate): Promise<UserResponse> {
    return apiRequest<UserResponse>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteAccount(): Promise<MessageResponse> {
    return apiRequest<MessageResponse>('/api/users/me', {
      method: 'DELETE',
    });
  },
};
