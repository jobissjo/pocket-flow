import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Hardware-backed Encrypted Storage Service.
 * Uses iOS Keychain & Android KeyStore via expo-secure-store on mobile devices.
 * Falls back to scoped localStorage on Web.
 */

export async function saveSecureItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`_secure_${key}`, value);
      }
    } else {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  } catch (error) {
    console.error(`Error saving secure item (${key}):`, error);
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(`_secure_${key}`);
      }
      return null;
    } else {
      return await SecureStore.getItemAsync(key);
    }
  } catch (error) {
    console.error(`Error fetching secure item (${key}):`, error);
    return null;
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`_secure_${key}`);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (error) {
    console.error(`Error deleting secure item (${key}):`, error);
  }
}
