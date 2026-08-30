import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const DEFAULT_API_BASE_URL = 'https://api-pocket-flow.onrender.com';
const TOKEN_KEY = 'pocketflow_auth_token';
const API_URL_KEY = 'pocketflow_custom_api_url';

// In-memory token cache for faster synchronous access
let inMemoryToken: string | null = null;
let customBaseUrl: string | null = null;

export async function getStoredToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  try {
    if (Platform.OS === 'web') {
      inMemoryToken = localStorage.getItem(TOKEN_KEY);
    } else {
      inMemoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
    }
  } catch {
    inMemoryToken = null;
  }
  return inMemoryToken;
}

export async function setStoredToken(token: string | null): Promise<void> {
  inMemoryToken = token;
  try {
    if (!token) {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } else {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    }
  } catch (err) {
    console.error('Failed to save token to storage:', err);
  }
}

export async function getBaseUrl(): Promise<string> {
  if (customBaseUrl) return customBaseUrl;
  try {
    if (Platform.OS === 'web') {
      customBaseUrl = localStorage.getItem(API_URL_KEY);
    } else {
      customBaseUrl = await SecureStore.getItemAsync(API_URL_KEY);
    }
  } catch {
    customBaseUrl = null;
  }
  return customBaseUrl || DEFAULT_API_BASE_URL;
}

export async function setCustomBaseUrl(url: string | null): Promise<void> {
  customBaseUrl = url?.trim() || null;
  try {
    if (!customBaseUrl) {
      if (Platform.OS === 'web') {
        localStorage.removeItem(API_URL_KEY);
      } else {
        await SecureStore.deleteItemAsync(API_URL_KEY);
      }
    } else {
      if (Platform.OS === 'web') {
        localStorage.setItem(API_URL_KEY, customBaseUrl);
      } else {
        await SecureStore.setItemAsync(API_URL_KEY, customBaseUrl);
      }
    }
  } catch (err) {
    console.error('Failed to save custom base URL:', err);
  }
}

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let onUnauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedHandler(callback: () => void) {
  onUnauthorizedCallback = callback;
}

export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const baseUrl = await getBaseUrl();
  let url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  if (options.params) {
    const query = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth) {
    const token = await getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: any = null;
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;

    try {
      errorData = await response.json();
      if (errorData) {
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
    } catch {
      // response wasn't JSON
    }

    if (response.status === 401 && !options.skipAuth) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    throw new ApiError(errorMessage, response.status, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
