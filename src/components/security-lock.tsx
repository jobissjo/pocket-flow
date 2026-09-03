import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useSecurity } from '@/services/security-context';
import { useTheme } from '@/services/theme-context';
import { Colors } from '@/constants/theme';

export default function SecurityLock({ children }: { children: React.ReactNode }) {
  const { isLocked, isAuthenticating, unlockVault } = useSecurity();
  const { isDark } = useTheme();
  const colors = Colors[isDark ? 'dark' : 'light'];

  useEffect(() => {
    if (isLocked) {
      // Auto-trigger authentication prompt shortly after lock screen is shown
      const timer = setTimeout(() => {
        unlockVault();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLocked, unlockVault]);

  return (
    <View style={styles.root}>
      {children}
      {isLocked && (
        <View style={styles.lockOverlay}>
          <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <View style={styles.content}>
              {/* Header Logo/Title */}
              <View style={styles.header}>
                <Text style={[styles.logoText, { color: colors.text }]}>POCKETFLOW</Text>
                <Text style={styles.vaultSubtitle}>SECURE OFFLINE VAULT</Text>
              </View>

              {/* Security Icon & Status */}
              <View style={styles.iconContainer}>
                <View
                  style={[
                    styles.circlePulse,
                    {
                      backgroundColor: isDark
                        ? 'rgba(166, 200, 255, 0.05)'
                        : 'rgba(32, 138, 239, 0.05)',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.circleInner,
                      {
                        backgroundColor: isDark
                          ? 'rgba(166, 200, 255, 0.1)'
                          : 'rgba(32, 138, 239, 0.1)',
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="lock"
                      size={64}
                      color={isDark ? '#a6c8ff' : '#208aef'}
                    />
                  </View>
                </View>
                <Text style={[styles.lockTitle, { color: colors.text }]}>Vault Locked</Text>
                <Text style={styles.lockDesc}>
                  Biometric or device passcode security is active. Authenticate to access your pocket data.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.unlockBtn,
                    { backgroundColor: isDark ? '#ffffff' : '#208aef' },
                  ]}
                  onPress={() => unlockVault()}
                  activeOpacity={0.8}
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <ActivityIndicator size="small" color={isDark ? '#000000' : '#ffffff'} />
                  ) : (
                    <>
                      <MaterialIcons
                        name="fingerprint"
                        size={20}
                        color={isDark ? '#000000' : '#ffffff'}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[styles.unlockBtnText, { color: isDark ? '#000000' : '#ffffff' }]}>
                        Unlock Vault
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 999999,
    elevation: 999999,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
  },
  vaultSubtitle: {
    fontSize: 11,
    color: '#8e9192',
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 6,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  circlePulse: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  circleInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  lockDesc: {
    fontSize: 14,
    color: '#8e9192',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    width: '100%',
    marginBottom: 20,
  },
  unlockBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  unlockBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
