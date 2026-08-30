import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { ModalSheet } from '@/components/ui/modal-sheet';
import { CustomInput } from '@/components/ui/custom-input';
import { useAuth } from '@/services/auth-context';
import { useTheme } from '@/services/theme-context';
import { useSecurity } from '@/services/security-context';
import { useCurrency } from '@/services/currency';
import { userService } from '@/services/users';
import { hapticImpactMedium, hapticNotificationSuccess, hapticLight } from '@/services/haptics';

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee (₹)' },
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'JPY', name: 'Japanese Yen (¥)' },
  { code: 'CAD', name: 'Canadian Dollar (CA$)' },
  { code: 'AUD', name: 'Australian Dollar (AU$)' },
];

export default function ProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { biometricsEnabled, toggleBiometrics, hasSecurity } = useSecurity();
  const { currencyCode, updateCurrency } = useCurrency();

  // Edit Profile State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(user?.full_name || '');
  const [editPhone, setEditPhone] = useState(user?.mobile_number || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Currency Modal State
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const handleOpenEdit = () => {
    hapticLight();
    setEditName(user?.full_name || '');
    setEditPhone(user?.mobile_number || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      await updateProfile({
        full_name: editName.trim(),
        mobile_number: editPhone.trim(),
      });
      hapticNotificationSuccess();
      setShowEditModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    hapticImpactMedium();
    if (Platform.OS === 'web') {
      if (window.confirm('Log out from PocketFlow?')) {
        logout();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]);
    }
  };

  const handleDeleteAccount = () => {
    hapticImpactMedium();
    const confirmDelete = async () => {
      try {
        await userService.deleteAccount();
        await logout();
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not delete account');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('PERMANENT ACTION: Delete your entire account and all associated financial records?')) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Delete Account',
        'This action is irreversible. All your transaction history, bank accounts, cards, and EMIs will be permanently deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Permanently',
            style: 'destructive',
            onPress: confirmDelete,
          },
        ]
      );
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#08080C' : '#F6F6F9' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Profile & Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <GlassCard style={styles.userCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.userName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {user?.full_name || 'PocketFlow User'}
              </Text>
              <Text style={[styles.userEmail, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {user?.email}
              </Text>
              <Text style={[styles.userPhone, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                {user?.mobile_number || 'No phone set'}
              </Text>
            </View>

            <TouchableOpacity onPress={handleOpenEdit} style={styles.editProfileBtn}>
              <Ionicons name="create-outline" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Preferences Section */}
        <Text style={[styles.groupLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          PREFERENCES
        </Text>

        <GlassCard style={styles.groupCard}>
          {/* Currency */}
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setShowCurrencyModal(true);
            }}
            style={styles.settingRow}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="cash-outline" size={20} color="#3B82F6" style={styles.settingIcon} />
              <Text style={[styles.settingTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Display Currency
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
                {currencyCode}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Dark Mode */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons
                name={isDark ? 'moon-outline' : 'sunny-outline'}
                size={20}
                color="#A855F7"
                style={styles.settingIcon}
              />
              <Text style={[styles.settingTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Dark Appearance
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => {
                hapticLight();
                toggleTheme();
              }}
              trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
            />
          </View>
        </GlassCard>

        {/* Security Section */}
        <Text style={[styles.groupLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          SECURITY & PRIVACY
        </Text>

        <GlassCard style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="finger-print-outline" size={20} color="#10B981" style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Biometric App Lock
                </Text>
                <Text style={[styles.settingSub, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                  Require Face ID / fingerprint to unlock
                </Text>
              </View>
            </View>
            <Switch
              value={biometricsEnabled}
              disabled={!hasSecurity && Platform.OS !== 'web'}
              onValueChange={(val) => {
                hapticLight();
                toggleBiometrics(val);
              }}
              trackColor={{ false: '#CBD5E1', true: '#10B981' }}
            />
          </View>
        </GlassCard>

        {/* Account Actions */}
        <Text style={[styles.groupLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          ACCOUNT ACTIONS
        </Text>

        <GlassCard style={styles.groupCard}>
          <TouchableOpacity onPress={handleLogout} style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="log-out-outline" size={20} color="#3B82F6" style={styles.settingIcon} />
              <Text style={[styles.settingTitle, { color: '#3B82F6', fontWeight: '700' }]}>
                Sign Out
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity onPress={handleDeleteAccount} style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="trash-bin-outline" size={20} color="#EF4444" style={styles.settingIcon} />
              <Text style={[styles.settingTitle, { color: '#EF4444', fontWeight: '700' }]}>
                Delete Account
              </Text>
            </View>
          </TouchableOpacity>
        </GlassCard>

        <Text style={[styles.versionText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
          PocketFlow v1.0.0 • Connected to FastAPI & MongoDB
        </Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <ModalSheet
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Profile"
        subtitle="Update your personal details"
      >
        <View style={{ paddingVertical: 8 }}>
          <CustomInput
            label="Full Name"
            value={editName}
            onChangeText={setEditName}
            leftIcon="person-outline"
          />

          <CustomInput
            label="Mobile Number"
            value={editPhone}
            onChangeText={setEditPhone}
            keyboardType="phone-pad"
            leftIcon="call-outline"
          />

          <TouchableOpacity
            onPress={handleSaveProfile}
            disabled={savingProfile}
            style={styles.modalSaveBtn}
          >
            {savingProfile ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.modalSaveText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ModalSheet>

      {/* Currency Picker Modal */}
      <ModalSheet
        visible={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
        title="Select Currency"
        subtitle="Choose your preferred display currency"
      >
        <View style={{ paddingVertical: 8 }}>
          {CURRENCIES.map((curr) => {
            const isSelected = currencyCode === curr.code;
            return (
              <TouchableOpacity
                key={curr.code}
                onPress={() => {
                  hapticNotificationSuccess();
                  updateCurrency(curr.code);
                  setShowCurrencyModal(false);
                }}
                style={[
                  styles.currencyItem,
                  {
                    backgroundColor: isSelected
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.currencyName,
                    {
                      color: isSelected
                        ? '#3B82F6'
                        : isDark
                        ? '#FFFFFF'
                        : '#0F172A',
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {curr.name}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  userCard: {
    padding: 20,
    borderRadius: 22,
    marginBottom: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  editProfileBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingSub: {
    fontSize: 12,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  modalSaveBtn: {
    height: 50,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  currencyName: {
    fontSize: 15,
  },
});
