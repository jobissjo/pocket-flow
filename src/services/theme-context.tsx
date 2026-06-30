import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme, ColorSchemeName } from 'react-native';
import { getSetting, setSetting } from './db';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  isDark: true,
  setThemeMode: async () => {},
});

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [isDark, setIsDark] = useState(true);

  // Load saved theme once on mount
  useEffect(() => {
    let cancelled = false;
    getSetting('theme', 'dark').then((saved) => {
      if (cancelled) return;
      const mode = saved as ThemeMode;
      setThemeModeState(mode);
      if (mode === 'system') {
        setIsDark(systemScheme === 'dark');
      } else {
        setIsDark(mode === 'dark');
      }
    }).catch((e) => console.error('Failed to load theme:', e));
    return () => { cancelled = true; };
  }, []); // only on mount

  // Sync system scheme changes when mode is 'system'
  useEffect(() => {
    if (themeMode === 'system') {
      setIsDark(systemScheme === 'dark');
    }
  }, [systemScheme, themeMode]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    await setSetting('theme', mode);
    setThemeModeState(mode);
    if (mode === 'system') {
      setIsDark(systemScheme === 'dark');
    } else {
      setIsDark(mode === 'dark');
    }
  }, [systemScheme]);

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}

// Kept for backward compatibility with _layout.tsx call
export async function initializeTheme(_systemScheme: ColorSchemeName) {
  // No-op: CustomThemeProvider handles initialization
}
