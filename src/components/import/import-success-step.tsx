import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/services/theme-context';
import { useCurrency } from '@/services/currency';
import { hapticImpactMedium, hapticLight } from '@/services/haptics';
import type { ConfirmImportPayload } from '@/services/transactionImportsTypes';

interface ImportSuccessStepProps {
  confirmedData: ConfirmImportPayload;
  onDone: () => void;
  onImportAnother: () => void;
}

export function ImportSuccessStep({
  confirmedData,
  onDone,
  onImportAnother,
}: ImportSuccessStepProps) {
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();
  const isExpense = confirmedData.transaction_type === 'expense';

  return (
    <View style={styles.container}>
      {/* Green Checkmark Badge */}
      <View
        style={[
          styles.badgeWrapper,
          {
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#ECFDF5',
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={54} color="#10B981" />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Transaction Added!
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          Your transaction has been securely saved and synced to your ledger.
        </Text>
      </View>

      {/* Summary Card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.summaryTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.txTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {confirmedData.title}
            </Text>
            <Text style={[styles.txDate, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {confirmedData.date}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={[
                styles.txAmount,
                { color: isExpense ? '#EF4444' : '#10B981' },
              ]}
            >
              {isExpense ? '-' : '+'}{formatAmount(confirmedData.amount)}
            </Text>
            <View
              style={[
                styles.typeTag,
                {
                  backgroundColor: isExpense
                    ? isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2'
                    : isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
                },
              ]}
            >
              <Text
                style={[
                  styles.typeTagText,
                  { color: isExpense ? '#EF4444' : '#10B981' },
                ]}
              >
                {isExpense ? 'Expense' : 'Income'}
              </Text>
            </View>
          </View>
        </View>

        {(confirmedData.payment_method || confirmedData.reference_id) && (
          <View
            style={[
              styles.metaRow,
              { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0' },
            ]}
          >
            {confirmedData.payment_method && (
              <View style={styles.metaItem}>
                <Ionicons name="card-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
                <Text style={[styles.metaText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {confirmedData.payment_method.toUpperCase()}
                </Text>
              </View>
            )}
            {confirmedData.reference_id && (
              <View style={styles.metaItem}>
                <Ionicons name="barcode-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
                <Text style={[styles.metaText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Ref: {confirmedData.reference_id}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            onImportAnother();
          }}
          style={[
            styles.secondaryBtn,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1',
            },
          ]}
        >
          <Ionicons name="camera-outline" size={16} color={isDark ? '#E2E8F0' : '#475569'} style={{ marginRight: 6 }} />
          <Text style={[styles.secondaryBtnText, { color: isDark ? '#E2E8F0' : '#475569' }]}>
            Scan Another
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            hapticImpactMedium();
            onDone();
          }}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>Done / View Ledger</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 16,
  },
  badgeWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  summaryCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  txDate: {
    fontSize: 12,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
