import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ModalSheet } from '../ui/modal-sheet';
import { CustomInput } from '../ui/custom-input';
import { useAuth } from '@/services/auth-context';
import { useTheme } from '@/services/theme-context';
import { hapticImpactMedium, hapticNotificationSuccess } from '@/services/haptics';

interface OTPModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function OTPModal({ visible, email, onClose, onSuccess }: OTPModalProps) {
  const { verifyOtp, resendOtp } = useAuth();
  const { isDark } = useTheme();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    let interval: any = null;
    if (visible && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible, timer]);

  const handleVerify = async () => {
    if (otp.length < 4) {
      setError('Please enter the verification code');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await verifyOtp({ email, otp });
      hapticNotificationSuccess();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      setError(null);
      await resendOtp({ email });
      setTimer(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="Verify Account"
      subtitle={`Enter the 6-digit OTP sent to ${email}`}
    >
      <View style={styles.container}>
        <CustomInput
          label="Verification Code"
          placeholder="e.g. 123456"
          value={otp}
          onChangeText={(text) => {
            setOtp(text);
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          leftIcon="shield-checkmark-outline"
          error={error || undefined}
          autoFocus
        />

        <TouchableOpacity
          onPress={handleVerify}
          disabled={loading || otp.length < 4}
          style={[
            styles.submitButton,
            {
              backgroundColor:
                loading || otp.length < 4
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
            <Text style={styles.submitText}>Verify & Continue</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendRow}>
          <Text
            style={[
              styles.resendHint,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {"Didn't receive code? "}
          </Text>
          {timer > 0 ? (
            <Text style={[styles.timerText, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
              Resend in {timer}s
            </Text>
          ) : (
            <TouchableOpacity
              onPress={() => {
                hapticImpactMedium();
                handleResend();
              }}
              disabled={resending}
            >
              <Text
                style={[
                  styles.resendAction,
                  { color: isDark ? '#60A5FA' : '#2563EB' },
                ]}
              >
                {resending ? 'Sending...' : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  submitButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  resendHint: {
    fontSize: 14,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendAction: {
    fontSize: 14,
    fontWeight: '700',
  },
});
