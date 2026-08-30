import { DarkTheme, DefaultTheme, ThemeProvider, useSegments, useRouter, Slot } from 'expo-router';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { CustomThemeProvider, useTheme } from '@/services/theme-context';
import { AuthProvider, useAuth } from '@/services/auth-context';
import { SecurityProvider } from '@/services/security-context';
import SecurityLock from '@/components/security-lock';
import { BackgroundBlobs } from '@/components/ui/background-blobs';

function AppNavigationGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { isDark } = useTheme();

  const inAuthGroup = (segments as string[])[0] === 'auth';

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/login' as any);
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/' as any);
    }
  }, [isAuthenticated, isLoading, inAuthGroup, router]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? '#08080C' : '#F8FAFC',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (inAuthGroup) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#08080C' : '#F8FAFC' }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <BackgroundBlobs isDark={isDark} />
        <Slot />
      </View>
    );
  }

  return (
    <SecurityLock>
      <View style={{ flex: 1, backgroundColor: isDark ? '#08080C' : '#F6F6F9' }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <BackgroundBlobs isDark={isDark} />
        <AppTabs />
      </View>
    </SecurityLock>
  );
}

function InnerLayout() {
  const { isDark } = useTheme();
  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <SecurityProvider>
        <AppNavigationGuard />
      </SecurityProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <CustomThemeProvider>
      <AuthProvider>
        <InnerLayout />
      </AuthProvider>
    </CustomThemeProvider>
  );
}
