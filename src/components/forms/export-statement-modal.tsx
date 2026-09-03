import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../ui/modal-sheet';
import { CustomInput } from '../ui/custom-input';
import { SegmentedControl } from '../ui/segmented-control';
import { useTheme } from '@/services/theme-context';
import { useCurrency } from '@/services/currency';
import { useAuth } from '@/services/auth-context';
import { hapticImpactMedium, hapticNotificationSuccess, hapticLight } from '@/services/haptics';
import { transactionService } from '@/services/transactions';
import { exportStatementToPdf, exportStatementToCsv } from '@/services/export-service';
import type { TransactionResponse, TransactionType } from '@/services/types';

interface ExportStatementModalProps {
  visible: boolean;
  onClose: () => void;
}

type DurationPreset =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'this_year'
  | 'all_time'
  | 'custom';

type ExportFormat = 'pdf' | 'csv';

export function ExportStatementModal({
  visible,
  onClose,
}: ExportStatementModalProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { formatAmount, currencySymbol, currencyCode } = useCurrency();

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [duration, setDuration] = useState<DurationPreset>('this_month');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  // Custom Dates
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Preview data
  const [matchingTxns, setMatchingTxns] = useState<TransactionResponse[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateRangeLabel, setDateRangeLabel] = useState('');

  // Calculate Start and End Dates based on duration
  const getDateRange = useCallback((): { startDate?: string; endDate?: string; label: string } => {
    const now = new Date();

    if (duration === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const startStr = start.toISOString().split('T')[0];
      const endStr = now.toISOString().split('T')[0];
      const monthName = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return { startDate: startStr, endDate: endStr, label: `This Month (${monthName})` };
    }

    if (duration === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const monthName = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return { startDate: startStr, endDate: endStr, label: `Last Month (${monthName})` };
    }

    if (duration === 'last_3_months') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const startStr = start.toISOString().split('T')[0];
      const endStr = now.toISOString().split('T')[0];
      return { startDate: startStr, endDate: endStr, label: 'Last 3 Months' };
    }

    if (duration === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const startStr = start.toISOString().split('T')[0];
      const endStr = now.toISOString().split('T')[0];
      return { startDate: startStr, endDate: endStr, label: `Year ${now.getFullYear()}` };
    }

    if (duration === 'custom') {
      return {
        startDate: customStart.trim() || undefined,
        endDate: customEnd.trim() || undefined,
        label: `${customStart || 'Start'} to ${customEnd || 'End'}`,
      };
    }

    return { label: 'All Time Records' };
  }, [duration, customStart, customEnd]);

  // Load preview counts & totals
  const loadPreview = useCallback(async () => {
    try {
      setLoadingPreview(true);
      const { startDate, endDate, label } = getDateRange();
      setDateRangeLabel(label);

      const res = await transactionService.listTransactions({
        start_date: startDate,
        end_date: endDate,
        type: typeFilter === 'all' ? undefined : (typeFilter as TransactionType),
        limit: 1000,
      });

      setMatchingTxns(res.items);
    } catch (err) {
      console.error('Error fetching export preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  }, [getDateRange, typeFilter]);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadPreview();
    }
  }, [visible, loadPreview]);

  // Calculations for summary card
  let previewIncome = 0;
  let previewExpense = 0;
  matchingTxns.forEach((t) => {
    if (t.type === 'income') previewIncome += t.amount;
    else previewExpense += t.amount;
  });
  const previewNet = previewIncome - previewExpense;

  const handleExport = async () => {
    if (matchingTxns.length === 0) {
      Alert.alert('No Records', 'There are no transactions in the selected period to export.');
      return;
    }

    try {
      hapticImpactMedium();
      setExporting(true);

      const options = {
        transactions: matchingTxns,
        dateRangeLabel,
        currencySymbol,
        currencyCode,
        userName: user?.full_name,
        userEmail: user?.email,
      };

      if (format === 'pdf') {
        await exportStatementToPdf(options);
      } else {
        await exportStatementToCsv(options);
      }

      hapticNotificationSuccess();
      onClose();
    } catch (err: any) {
      console.error('Export error:', err);
      Alert.alert('Export Failed', err.message || 'Could not generate statement file.');
    } finally {
      setExporting(false);
    }
  };

  const DURATION_PRESETS: { id: DurationPreset; label: string }[] = [
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'last_3_months', label: 'Last 3 Months' },
    { id: 'this_year', label: 'This Year' },
    { id: 'all_time', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="Export Statement"
      subtitle="Download or share formatted transaction reports"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Format Selector */}
        <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#475569' }]}>
          STATEMENT FORMAT
        </Text>
        <View style={styles.formatRow}>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setFormat('pdf');
            }}
            style={[
              styles.formatCard,
              {
                backgroundColor:
                  format === 'pdf'
                    ? isDark
                      ? 'rgba(59, 130, 246, 0.2)'
                      : '#EFF6FF'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.04)'
                    : '#F8FAFC',
                borderColor: format === 'pdf' ? '#3B82F6' : isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              },
            ]}
          >
            <Ionicons
              name="document-text"
              size={24}
              color={format === 'pdf' ? '#3B82F6' : isDark ? '#94A3B8' : '#64748B'}
            />
            <Text
              style={[
                styles.formatTitle,
                { color: format === 'pdf' ? (isDark ? '#93C5FD' : '#1D4ED8') : isDark ? '#E2E8F0' : '#334155' },
              ]}
            >
              PDF Document
            </Text>
            <Text style={[styles.formatSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Official print-ready layout
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setFormat('csv');
            }}
            style={[
              styles.formatCard,
              {
                backgroundColor:
                  format === 'csv'
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.2)'
                      : '#ECFDF5'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.04)'
                    : '#F8FAFC',
                borderColor: format === 'csv' ? '#10B981' : isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              },
            ]}
          >
            <Ionicons
              name="grid"
              size={24}
              color={format === 'csv' ? '#10B981' : isDark ? '#94A3B8' : '#64748B'}
            />
            <Text
              style={[
                styles.formatTitle,
                { color: format === 'csv' ? (isDark ? '#6EE7B7' : '#047857') : isDark ? '#E2E8F0' : '#334155' },
              ]}
            >
              CSV Spreadsheet
            </Text>
            <Text style={[styles.formatSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Excel, Sheets & tax data
            </Text>
          </TouchableOpacity>
        </View>

        {/* Duration / Period Selection */}
        <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#475569', marginTop: 14 }]}>
          STATEMENT DURATION
        </Text>
        <View style={styles.presetsGrid}>
          {DURATION_PRESETS.map((p) => {
            const isSelected = duration === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => {
                  hapticLight();
                  setDuration(p.id);
                }}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: isSelected
                      ? '#2563EB'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : '#F1F5F9',
                    borderColor: isSelected
                      ? '#60A5FA'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : '#E2E8F0',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    {
                      color: isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569',
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Date Inputs if Custom selected */}
        {duration === 'custom' && (
          <View style={styles.customDateRow}>
            <View style={{ flex: 1 }}>
              <CustomInput
                label="Start Date"
                placeholder="YYYY-MM-DD"
                value={customStart}
                onChangeText={setCustomStart}
                leftIcon="calendar-outline"
              />
            </View>
            <View style={{ flex: 1 }}>
              <CustomInput
                label="End Date"
                placeholder="YYYY-MM-DD"
                value={customEnd}
                onChangeText={setCustomEnd}
                leftIcon="calendar-outline"
              />
            </View>
          </View>
        )}

        {/* Transaction Type Filter */}
        <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#475569', marginTop: 14 }]}>
          TRANSACTION TYPE
        </Text>
        <SegmentedControl
          options={[
            { label: 'All Types', value: 'all' },
            { label: 'Expenses Only', value: 'expense' },
            { label: 'Income Only', value: 'income' },
          ]}
          value={typeFilter}
          onChange={(val) => setTypeFilter(val as any)}
          style={{ marginBottom: 16 }}
        />

        {/* Summary Card for Chosen Period */}
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.previewHeader}>
            <Text style={[styles.previewTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Statement Summary Preview
            </Text>
            {loadingPreview ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <View style={styles.recordBadge}>
                <Text style={styles.recordBadgeText}>{matchingTxns.length} records</Text>
              </View>
            )}
          </View>

          <View style={styles.previewMetricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Inflow</Text>
              <Text style={[styles.metricVal, { color: '#10B981' }]}>+{formatAmount(previewIncome)}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Outflow</Text>
              <Text style={[styles.metricVal, { color: '#EF4444' }]}>-{formatAmount(previewExpense)}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Net</Text>
              <Text style={[styles.metricVal, { color: previewNet >= 0 ? '#3B82F6' : '#EF4444' }]}>
                {previewNet >= 0 ? '+' : ''}{formatAmount(previewNet)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleExport}
          disabled={exporting || loadingPreview}
          style={[
            styles.exportButton,
            { opacity: exporting || loadingPreview ? 0.7 : 1 },
          ]}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name={format === 'pdf' ? 'share-outline' : 'download-outline'}
                size={20}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.exportButtonText}>
                {format === 'pdf' ? 'Generate & Share PDF' : 'Download & Share CSV'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formatCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  formatTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  formatSub: {
    fontSize: 11,
    textAlign: 'center',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  recordBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recordBadgeText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '600',
  },
  previewMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  metricItem: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
