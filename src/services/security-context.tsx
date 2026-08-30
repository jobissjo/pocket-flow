import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { getSecureItem, saveSecureItem } from './secure-storage';

interface SecurityContextType {
  isLocked: boolean;
  biometricsEnabled: boolean;
  hasSecurity: boolean;
  isAuthenticating: boolean;
  lockVault: () => void;
  unlockVault: () => Promise<boolean>;
  toggleBiometrics: (val: boolean) => Promise<boolean>;
}

const SecurityContext = createContext<SecurityContextType>({
  isLocked: false,
  biometricsEnabled: false,
  hasSecurity: false,
  isAuthenticating: false,
  lockVault: () => {},
  unlockVault: async () => false,
  toggleBiometrics: async () => false,
});

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [hasSecurity, setHasSecurity] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const checkSecuritySetup = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      setHasSecurity(false);
      return false;
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
      const supported = hasHardware && enrolledLevel > 0;
      setHasSecurity(supported);
      return supported;
    } catch (e) {
      console.error('Error checking security setup:', e);
      setHasSecurity(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const isSecured = await checkSecuritySetup();
      const secureBioSetting = await getSecureItem('biometrics_enabled');
      const isBioEnabled = secureBioSetting === 'true';

      if (active) {
        setBiometricsEnabled(isBioEnabled);
        if (isSecured && isBioEnabled) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [checkSecuritySetup]);

  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (lastBackgroundTime.current) {
          const elapsed = Date.now() - lastBackgroundTime.current;
          if (elapsed > 2000) {
            const bioSetting = await getSecureItem('biometrics_enabled');
            const isBioEnabled = bioSetting === 'true';
            const isSecured = await checkSecuritySetup();
            if (isBioEnabled && isSecured) {
              setIsLocked(true);
            }
          }
        }
      }

      if (nextAppState === 'background') {
        lastBackgroundTime.current = Date.now();
      }

      appState.current = nextAppState as any;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [checkSecuritySetup]);

  const lockVault = useCallback(() => {
    setIsLocked(true);
  }, []);

  const unlockVault = useCallback(async (): Promise<boolean> => {
    if (isAuthenticating) return false;

    setIsAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock PocketFlow',
        fallbackLabel: 'Enter Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        setIsAuthenticating(false);
        return true;
      }
      setIsAuthenticating(false);
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      setIsAuthenticating(false);
      return false;
    }
  }, [isAuthenticating]);

  const toggleBiometrics = useCallback(async (val: boolean): Promise<boolean> => {
    if (isAuthenticating) return false;

    if (!val) {
      const isSecured = await checkSecuritySetup();
      if (isSecured) {
        setIsAuthenticating(true);
        try {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Confirm identity to disable biometric lock',
            fallbackLabel: 'Enter Passcode',
            disableDeviceFallback: false,
          });
          if (!result.success) {
            setIsAuthenticating(false);
            return false;
          }
        } catch (error) {
          console.error('Authentication error during disable:', error);
          setIsAuthenticating(false);
          return false;
        } finally {
          setIsAuthenticating(false);
        }
      }
    } else {
      const isSecured = await checkSecuritySetup();
      if (!isSecured) {
        return false;
      }
    }

    await saveSecureItem('biometrics_enabled', val ? 'true' : 'false');
    setBiometricsEnabled(val);
    return true;
  }, [checkSecuritySetup, isAuthenticating]);

  return (
    <SecurityContext.Provider
      value={{
        isLocked,
        biometricsEnabled,
        hasSecurity,
        isAuthenticating,
        lockVault,
        unlockVault,
        toggleBiometrics,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  return useContext(SecurityContext);
}
