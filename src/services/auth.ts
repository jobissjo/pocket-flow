import { apiRequest } from './api';
import {
  UserRegisterRequest,
  VerifyOTPRequest,
  UserLoginRequest,
  ResendOTPRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  TokenResponse,
  UserResponse,
  MessageResponse,
} from './types';

export const authService = {
  async register(data: UserRegisterRequest): Promise<{ message?: string; detail?: string }> {
    return apiRequest<{ message?: string; detail?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  },

  async verifyOtp(data: VerifyOTPRequest): Promise<TokenResponse> {
    return apiRequest<TokenResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  },

  async login(data: UserLoginRequest): Promise<TokenResponse> {
    return apiRequest<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  },

  async resendOtp(data: ResendOTPRequest): Promise<{ message?: string }> {
    return apiRequest<{ message?: string }>('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message?: string }> {
    return apiRequest<{ message?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  },

  async resetPassword(data: ResetPasswordRequest): Promise<MessageResponse> {
    return apiRequest<MessageResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  },

  async getMe(): Promise<UserResponse> {
    return apiRequest<UserResponse>('/api/auth/me', {
      method: 'GET',
    });
  },
};
