import { apiRequest } from './api';
import {
  CategoryResponse,
  CategoryCreate,
  CategoryUpdate,
  CategoryType,
  MessageResponse,
} from './types';

export const categoryService = {
  async listCategories(type?: CategoryType): Promise<CategoryResponse[]> {
    return apiRequest<CategoryResponse[]>('/api/categories', {
      method: 'GET',
      params: type ? { type } : undefined,
    });
  },

  async createCategory(data: CategoryCreate): Promise<CategoryResponse> {
    return apiRequest<CategoryResponse>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getCategory(id: string): Promise<CategoryResponse> {
    return apiRequest<CategoryResponse>(`/api/categories/${id}`, {
      method: 'GET',
    });
  },

  async updateCategory(id: string, data: CategoryUpdate): Promise<CategoryResponse> {
    return apiRequest<CategoryResponse>(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteCategory(id: string): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  },
};
