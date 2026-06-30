import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';

import AppTabs from '@/components/app-tabs';
import { initializeDatabase } from '@/services/db';
import { CustomThemeProvider, useTheme } from '@/services/theme-context';

function InnerLayout() {
  const { isDark } = useTheme();
  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AppTabs />
    </ThemeProvider>
  );
}

export default function TabLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initializeDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('DB Init Error:', err);
        setDbReady(true);
      });
  }, []); // only run once on mount

  if (!dbReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <CustomThemeProvider>
      <InnerLayout />
    </CustomThemeProvider>
  );
}
