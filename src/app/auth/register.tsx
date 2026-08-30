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
import { OTPModal } from '@/components/auth/otp-modal';
import { useAuth } from '@/services/auth-context';
import { useTheme } from '@/services/theme-context';
import { hapticNotificationSuccess } from '@/services/haptics';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { isDark } = useTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOTPModal, setShowOTPModal] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!mobileNumber.trim()) {
      setError('Please enter your mobile number');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        mobile_number: mobileNumber.trim(),
        password,
      });
      hapticNotificationSuccess();
      setShowOTPModal(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Try again.');
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
            Create Account
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Start tracking and growing your finances
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <CustomInput
            label="Full Name"
            placeholder="John Doe"
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              setError(null);
            }}
            leftIcon="person-outline"
          />

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

          <CustomInput
            label="Mobile Number"
            placeholder="+1 555 019 2834"
            value={mobileNumber}
            onChangeText={(t) => {
              setMobileNumber(t);
              setError(null);
            }}
            keyboardType="phone-pad"
            leftIcon="call-outline"
          />

          <CustomInput
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            secureTextEntry={!showPassword}
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            style={[
              styles.registerButton,
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
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </GlassCard>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login' as any)}>
            <Text style={[styles.signInLink, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <OTPModal
        visible={showOTPModal}
        email={email.trim().toLowerCase()}
        onClose={() => setShowOTPModal(false)}
        onSuccess={() => {
          setShowOTPModal(false);
          router.replace('/');
        }}
      />
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
  registerButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 14,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
