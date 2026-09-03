import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/services/theme-context';

interface StepItem {
  id: string;
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: StepItem[] = [
  {
    id: 'upload',
    label: 'Image uploaded securely',
    detail: 'Transmitting receipt image to AI pipeline',
    icon: 'cloud-done-outline',
  },
  {
    id: 'reading',
    label: 'Reading payment & transaction details',
    detail: 'Extracting merchant, total, date & line items',
    icon: 'document-text-outline',
  },
  {
    id: 'matching',
    label: 'Matching account & category',
    detail: 'Matching bank account, card, and category',
    icon: 'wallet-outline',
  },
  {
    id: 'duplicate',
    label: 'Verifying ledger integrity',
    detail: 'Checking for potential duplicate records',
    icon: 'shield-checkmark-outline',
  },
];

export function AIProcessingStep() {
  const { isDark } = useTheme();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStepIndex(1), 600);
    const timer2 = setTimeout(() => setCurrentStepIndex(2), 1600);
    const timer3 = setTimeout(() => setCurrentStepIndex(3), 2600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Central Pulsing AI Icon */}
      <View style={styles.pulseContainer}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)' },
          ]}
        >
          <Ionicons name="sparkles" size={36} color="#3B82F6" />
        </View>
      </View>

      {/* Title & subtitle */}
      <View style={styles.titleContainer}>
        <Text style={[styles.mainTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Analyzing Transaction...
        </Text>
        <Text style={[styles.subTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          Extracting financial data from your document. Please wait a moment.
        </Text>
      </View>

      {/* Step pipeline list */}
      <View style={styles.stepsList}>
        {STEPS.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <View
              key={step.id}
              style={[
                styles.stepCard,
                {
                  backgroundColor: isCurrent
                    ? isDark
                      ? 'rgba(59, 130, 246, 0.12)'
                      : '#EFF6FF'
                    : isDone
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.08)'
                      : '#F0FDF4'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.02)'
                    : '#F8FAFC',
                  borderColor: isCurrent
                    ? '#3B82F6'
                    : isDone
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.3)'
                      : '#BBF7D0'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : '#E2E8F0',
                  opacity: !isDone && !isCurrent ? 0.45 : 1,
                },
              ]}
            >
              <View style={styles.stepStatusIcon}>
                {isDone ? (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                ) : isCurrent ? (
                  <ActivityIndicator size="small" color="#3B82F6" />
                ) : (
                  <Ionicons
                    name={step.icon}
                    size={18}
                    color={isDark ? '#64748B' : '#94A3B8'}
                  />
                )}
              </View>

              <View style={styles.stepTextContent}>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: isCurrent
                        ? isDark
                          ? '#93C5FD'
                          : '#1D4ED8'
                        : isDone
                        ? isDark
                          ? '#FFFFFF'
                          : '#0F172A'
                        : isDark
                        ? '#94A3B8'
                        : '#64748B',
                      fontWeight: isCurrent ? '700' : '600',
                    },
                  ]}
                >
                  {step.label}
                </Text>
                <Text
                  style={[
                    styles.stepDetail,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {step.detail}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 16,
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  stepsList: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  stepStatusIcon: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTextContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 13,
  },
  stepDetail: {
    fontSize: 11,
    marginTop: 2,
  },
});
