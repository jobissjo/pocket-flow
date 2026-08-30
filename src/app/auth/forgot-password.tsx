import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CustomInput } from '@/components/ui/custom-input';
import { GlassCard } from '@/components/ui/glass-card';
import { useAuth } from '@/services/auth-context';
import { useTheme } from '@/services/theme-context';
import { hapticNotificationSuccess } from '@/services/haptics';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword, resetPassword } = useAuth();
  const { isDark } = useTheme();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await forgotPassword({ email: email.trim().toLowerCase() });
      hapticNotificationSuccess();
      setSuccessMsg(`Reset code sent to ${email}`);
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to request reset OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (otp.length < 4) {
      setError('Please enter the OTP code');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        new_password: newPassword,
      });
      hapticNotificationSuccess();
      router.replace('/auth/login' as any);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Check your OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.container,
        { backgroundColor: isDark ? '#08080C' : '#F8FAFC' },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? '#FFFFFF' : '#0F172A'}
          />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {step === 'request' ? 'Reset Password' : 'Set New Password'}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {step === 'request'
              ? "Enter your account's verified email address"
              : `Enter the code sent to ${email}`}
          </Text>
        </View>

        <GlassCard style={styles.card}>
          {step === 'request' ? (
            <>
              <CustomInput
                label="Email Address"
                placeholder="you@example.com"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={handleRequestOtp}
                disabled={loading}
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: loading
                      ? isDark
                        ? '#1E293B'
                        : '#CBD5E1'
                      : '#2563EB',
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {successMsg ? (
                <Text style={styles.successText}>{successMsg}</Text>
              ) : null}

              <CustomInput
                label="Reset Code (OTP)"
                placeholder="e.g. 123456"
                value={otp}
                onChangeText={(t) => {
                  setOtp(t);
                  setError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                leftIcon="shield-checkmark-outline"
              />

              <CustomInput
                label="New Password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChangeText={(t) => {
                  setNewPassword(t);
                  setError(null);
                }}
                secureTextEntry={!showPassword}
                leftIcon="lock-closed-outline"
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowPassword(!showPassword)}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={handleReset}
                disabled={loading}
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: loading
                      ? isDark
                        ? '#1E293B'
                        : '#CBD5E1'
                      : '#2563EB',
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    marginBottom: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    padding: 24,
    borderRadius: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 14,
    textAlign: 'center',
  },
  successText: {
    color: '#10B981',
    fontSize: 13,
    marginBottom: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
