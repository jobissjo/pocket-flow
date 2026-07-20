import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/services/theme-context';
import { GlassCard } from '@/components/ui/glass-card';
import { getSetting, setSetting, markOnboardingCompleted, getDatabase } from '@/services/db';

const { width } = Dimensions.get('window');

interface OnboardingModalProps {
  visible: boolean;
  onFinish: () => void;
}

const SLIDES = [
  {
    id: 'track',
    icon: 'account-balance-wallet' as const,
    badge: 'SMART WALLETS',
    badgeColor: '#3B82F6',
    title: 'Track All Your Money in One Place',
    description: 'Effortlessly log cash, cards, bank accounts, and digital wallets with instant balance updates and clear visual analytics.',
  },
  {
    id: 'goals',
    icon: 'track-changes' as const,
    badge: 'GOALS & BILLS',
    badgeColor: '#10B981',
    title: 'Automate Bills & Achieve Savings',
    description: 'Set custom monthly budgets, track recurring subscriptions, and save toward your dream goals automatically.',
  },
  {
    id: 'ai',
    icon: 'psychology' as const,
    badge: 'AI COACHING',
    badgeColor: '#8B5CF6',
    title: 'Offline AI Financial Companion',
    description: 'Ask questions, get smart spending insights, and receive personalized advice anytime without sending your private data anywhere.',
  },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
];

export default function OnboardingModal({ visible, onFinish }: OnboardingModalProps) {
  const { isDark } = useTheme();
  const [currentStep, setCurrentStep] = useState(0); // 0, 1, 2 = slides, 3 = setup form

  // Setup form state
  const [name, setName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [startingBalance, setStartingBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      getSetting('username', 'Alex').then((existingName) => {
        if (existingName && existingName !== 'Friend') {
          setName(existingName);
        }
      });
      getSetting('currency', 'USD').then((curr) => {
        setSelectedCurrency(curr);
      });
    }
  }, [visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    await markOnboardingCompleted();
    onFinish();
  };

  const handleCompleteSetup = async () => {
    try {
      setIsSaving(true);
      const existingName = await getSetting('username', 'Alex');
      const trimmedName = name.trim() || (existingName && existingName !== 'Friend' ? existingName : 'Alex');

      // 1. Save user settings
      await setSetting('username', trimmedName);
      await setSetting('currency', selectedCurrency);

      // 2. Update initial wallet balance in db ONLY if user explicitly typed a balance
      if (startingBalance.trim() !== '') {
        const initialBalanceNum = parseFloat(startingBalance);
        if (!isNaN(initialBalanceNum)) {
          const db = await getDatabase();
          const firstAccount = await db.getFirstAsync<{ id: string }>('SELECT id FROM accounts LIMIT 1');
          if (firstAccount) {
            await db.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [initialBalanceNum, firstAccount.id]);
          } else {
            await db.runAsync(
              "INSERT INTO accounts (id, name, type, balance, details, color) VALUES ('main-1', 'Main Account', 'bank', ?, 'Primary Wallet', '#1e3a8a,#0f172a')",
              [initialBalanceNum]
            );
          }
        }
      }

      // 3. Mark onboarding as completed
      await markOnboardingCompleted();

      setIsSaving(false);
      onFinish();
    } catch (err) {
      console.error('Error in onboarding setup:', err);
      setIsSaving(false);
      await markOnboardingCompleted();
      onFinish();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(5, 5, 8, 0.95)' : 'rgba(240, 243, 249, 0.95)' }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header branding */}
            <View style={styles.header}>
              <View style={styles.logoRow}>
                <View style={styles.logoIcon}>
                  <MaterialIcons name="account-balance-wallet" size={24} color="#3B82F6" />
                </View>
                <Text style={[styles.appName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Pocket<Text style={{ color: '#3B82F6' }}>Flow</Text>
                </Text>
              </View>
              {currentStep < 3 && (
                <TouchableOpacity onPress={handleSkip} hitSlop={10}>
                  <Text style={styles.skipText}>Skip Setup</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Stepper Dots */}
            <View style={styles.dotsRow}>
              {[0, 1, 2, 3].map((idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    currentStep === idx
                      ? [styles.activeDot, { backgroundColor: '#3B82F6', width: 24 }]
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' },
                  ]}
                />
              ))}
            </View>

            {/* SLIDES (Step 0, 1, 2) */}
            {currentStep < 3 && (
              <GlassCard style={styles.slideCard}>
                <View style={[styles.badge, { backgroundColor: SLIDES[currentStep].badgeColor + '20' }]}>
                  <Text style={[styles.badgeText, { color: SLIDES[currentStep].badgeColor }]}>
                    {SLIDES[currentStep].badge}
                  </Text>
                </View>

                <View style={[styles.iconContainer, { backgroundColor: SLIDES[currentStep].badgeColor + '15' }]}>
                  <MaterialIcons
                    name={SLIDES[currentStep].icon}
                    size={56}
                    color={SLIDES[currentStep].badgeColor}
                  />
                </View>

                <Text style={[styles.slideTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {SLIDES[currentStep].title}
                </Text>

                <Text style={[styles.slideDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {SLIDES[currentStep].description}
                </Text>
              </GlassCard>
            )}

            {/* QUICK SETUP FORM (Step 3) */}
            {currentStep === 3 && (
              <GlassCard style={styles.formCard}>
                <View style={styles.formHeader}>
                  <MaterialIcons name="handshake" size={32} color="#3B82F6" />
                  <Text style={[styles.formTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Let's personalize your setup!
                  </Text>
                  <Text style={[styles.formSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Takes less than 10 seconds. You can change these anytime in Profile.
                  </Text>
                </View>

                {/* Input: Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                    What is your name?
                  </Text>
                  <View style={[styles.inputBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}>
                    <MaterialIcons name="person-outline" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                      placeholder="e.g. Alex, Sarah..."
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                </View>

                {/* Input: Currency Selection */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                    Choose your primary currency:
                  </Text>
                  <View style={styles.currencyGrid}>
                    {CURRENCIES.map((c) => (
                      <TouchableOpacity
                        key={c.code}
                        onPress={() => setSelectedCurrency(c.code)}
                        style={[
                          styles.currencyChip,
                          selectedCurrency === c.code
                            ? styles.selectedCurrencyChip
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.currencyChipText,
                            selectedCurrency === c.code
                              ? { color: '#FFFFFF', fontWeight: '700' }
                              : { color: isDark ? '#94A3B8' : '#475569' },
                          ]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Input: Starting Balance */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                    Current wallet / bank balance (optional):
                  </Text>
                  <View style={[styles.inputBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}>
                    <Text style={{ fontSize: 16, color: '#3B82F6', fontWeight: '700', marginRight: 8 }}>
                      {CURRENCIES.find((c) => c.code === selectedCurrency)?.symbol || '$'}
                    </Text>
                    <TextInput
                      style={[styles.input, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                      placeholder="0.00"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      keyboardType="decimal-pad"
                      value={startingBalance}
                      onChangeText={setStartingBalance}
                    />
                  </View>
                </View>
              </GlassCard>
            )}

            {/* Action Buttons */}
            <View style={styles.footerRow}>
              {currentStep > 0 && currentStep < 3 && (
                <TouchableOpacity onPress={handlePrev} style={styles.secondaryBtn}>
                  <Text style={[styles.secondaryBtnText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Back</Text>
                </TouchableOpacity>
              )}

              {currentStep < 3 ? (
                <TouchableOpacity onPress={handleNext} style={styles.primaryBtn} activeOpacity={0.85}>
                  <Text style={styles.primaryBtnText}>Next</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleCompleteSetup}
                  disabled={isSaving}
                  style={[styles.primaryBtn, { backgroundColor: '#10B981', flex: 1 }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>
                    {isSaving ? 'Setting up...' : 'Get Started with PocketFlow'}
                  </Text>
                  <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },
  activeDot: {
    height: 8,
    borderRadius: 4,
  },
  slideCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 28,
    marginBottom: 24,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideDesc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  formCard: {
    padding: 24,
    borderRadius: 28,
    marginBottom: 24,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: (width - 100) / 3,
    alignItems: 'center',
  },
  selectedCurrencyChip: {
    backgroundColor: '#3B82F6',
  },
  currencyChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 18,
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
