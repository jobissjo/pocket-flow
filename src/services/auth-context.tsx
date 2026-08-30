import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserResponse,
  UserLoginRequest,
  UserRegisterRequest,
  VerifyOTPRequest,
  ResendOTPRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UserUpdate,
} from './types';
import { authService } from './auth';
import { userService } from './users';
import { getStoredToken, setStoredToken, setUnauthorizedHandler } from './api';

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: UserLoginRequest) => Promise<void>;
  register: (data: UserRegisterRequest) => Promise<{ message?: string; detail?: string }>;
  verifyOtp: (data: VerifyOTPRequest) => Promise<void>;
  resendOtp: (data: ResendOTPRequest) => Promise<{ message?: string }>;
  forgotPassword: (data: ForgotPasswordRequest) => Promise<{ message?: string }>;
  resetPassword: (data: ResetPasswordRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: UserUpdate) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    await setStoredToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
    } catch {
      await logout();
    }
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });

    const initAuth = async () => {
      try {
        const storedToken = await getStoredToken();
        if (storedToken) {
          setTokenState(storedToken);
          const currentUser = await authService.getMe();
          setUser(currentUser);
        }
      } catch (err) {
        console.log('Auth check error (session may be invalid or expired):', err);
        await setStoredToken(null);
        setTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [logout]);

  const login = async (credentials: UserLoginRequest) => {
    const res = await authService.login(credentials);
    await setStoredToken(res.access_token);
    setTokenState(res.access_token);
    const currentUser = await authService.getMe();
    setUser(currentUser);
  };

  const register = async (data: UserRegisterRequest) => {
    return await authService.register(data);
  };

  const verifyOtp = async (data: VerifyOTPRequest) => {
    const res = await authService.verifyOtp(data);
    await setStoredToken(res.access_token);
    setTokenState(res.access_token);
    const currentUser = await authService.getMe();
    setUser(currentUser);
  };

  const resendOtp = async (data: ResendOTPRequest) => {
    return await authService.resendOtp(data);
  };

  const forgotPassword = async (data: ForgotPasswordRequest) => {
    return await authService.forgotPassword(data);
  };

  const resetPassword = async (data: ResetPasswordRequest) => {
    await authService.resetPassword(data);
  };

  const updateProfile = async (data: UserUpdate) => {
    const updated = await userService.updateProfile(data);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        verifyOtp,
        resendOtp,
        forgotPassword,
        resetPassword,
        logout,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
