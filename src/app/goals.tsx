import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { EMIFormModal } from '@/components/forms/emi-form-modal';
import { emiService } from '@/services/emi';
import { EMIResponse, EMIStatus } from '@/services/types';
import { useTheme } from '@/services/theme-context';
import { useCurrency } from '@/services/currency';
import { hapticImpactMedium, hapticNotificationSuccess, hapticLight } from '@/services/haptics';

export default function EMIScreen() {
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();

  const [statusFilter, setStatusFilter] = useState<EMIStatus | 'all'>('active');
  const [emis, setEmis] = useState<EMIResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showEMIModal, setShowEMIModal] = useState(false);
  const [selectedEMI, setSelectedEMI] = useState<EMIResponse | null>(null);

  const loadEMIs = useCallback(async () => {
    try {
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const res = await emiService.listEMIs(statusParam);
      setEmis(res);
    } catch (err) {
      console.log('Error loading EMIs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEMIs();
  }, [loadEMIs]);

  const onRefresh = () => {
    setRefreshing(true);
    hapticImpactMedium();
    loadEMIs();
  };

  const handleMarkPaid = async (emi: EMIResponse) => {
    try {
      hapticImpactMedium();
      await emiService.markPaid(emi.id);
      hapticNotificationSuccess();
      loadEMIs();
    } catch (err: any) {
      console.log('Error marking paid:', err);
      Alert.alert('Error', err.message || 'Could not record installment payment');
    }
  };

  const handleDeleteEMI = (emi: EMIResponse) => {
    hapticImpactMedium();
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete EMI tracker "${emi.name}"?`)) {
        emiService.deleteEMI(emi.id).then(() => {
          hapticNotificationSuccess();
          loadEMIs();
        });
      }
    } else {
      Alert.alert(
        'Delete EMI Tracker',
        `Are you sure you want to delete "${emi.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await emiService.deleteEMI(emi.id);
              hapticNotificationSuccess();
              loadEMIs();
            },
          },
        ]
      );
    }
  };

  const totalMonthlyCommitment = emis
    .filter((e) => e.status === 'active')
    .reduce((sum, e) => sum + (e.monthly_emi_amount || 0), 0);

  const totalRemainingBalance = emis
    .filter((e) => e.status === 'active')
    .reduce((sum, e) => sum + (e.monthly_emi_amount * e.remaining_installments), 0);

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#08080C' : '#F6F6F9' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          EMI & Loan Tracker
        </Text>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            setSelectedEMI(null);
            setShowEMIModal(true);
          }}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add EMI</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <SegmentedControl
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Completed', value: 'completed' },
            { label: 'All EMIs', value: 'all' },
          ]}
          value={statusFilter}
          onChange={(val) => setStatusFilter(val as any)}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#3B82F6' : '#2563EB'}
          />
        }
      >
        {/* Metric Summary */}
        <GlassCard style={styles.summaryCard}>
          <Text style={[styles.summaryLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            MONTHLY EMI OBLIGATION
          </Text>
          <Text style={[styles.summaryAmount, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {formatAmount(totalMonthlyCommitment)}
          </Text>
          <View style={styles.summaryFooter}>
            <Text style={[styles.subText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Total Outstanding Principal:
            </Text>
            <Text style={[styles.subValue, { color: '#EF4444' }]}>
              {formatAmount(totalRemainingBalance)}
            </Text>
          </View>
        </GlassCard>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : emis.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="layers-outline" size={44} color={isDark ? '#64748B' : '#94A3B8'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              No EMI Trackers Found
            </Text>
            <Text style={[styles.emptySub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Track loans, gadget installments, or auto financing schedules easily.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedEMI(null);
                setShowEMIModal(true);
              }}
              style={styles.emptyActionBtn}
            >
              <Text style={styles.emptyActionText}>+ Create First EMI Plan</Text>
            </TouchableOpacity>
          </GlassCard>
        ) : (
          emis.map((emi) => {
            const progress =
              emi.total_installments > 0
                ? (emi.paid_installments / emi.total_installments) * 100
                : 0;
            const isCompleted = emi.status === 'completed' || emi.remaining_installments === 0;

            return (
              <GlassCard
                key={emi.id}
                style={styles.emiCard}
                onPress={() => {
                  setSelectedEMI(emi);
                  setShowEMIModal(true);
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.headerLeft}>
                    <View
                      style={[
                        styles.iconBox,
                        {
                          backgroundColor: isCompleted
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(168, 85, 247, 0.15)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={isCompleted ? 'checkmark-circle' : 'layers'}
                        size={20}
                        color={isCompleted ? '#10B981' : '#A855F7'}
                      />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <Text
                        style={[styles.emiName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                      >
                        {emi.name}
                      </Text>
                      <Text
                        style={[styles.emiSubText, { color: isDark ? '#94A3B8' : '#64748B' }]}
                      >
                        Due on day {emi.due_day} each month
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteEMI(emi)}
                    style={styles.trashBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                {/* Amount Row */}
                <View style={styles.amountsRow}>
                  <View>
                    <Text style={[styles.amountLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Monthly EMI
                    </Text>
                    <Text style={[styles.monthlyVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {formatAmount(emi.monthly_emi_amount)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.amountLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Total Loan
                    </Text>
                    <Text style={[styles.totalVal, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      {formatAmount(emi.total_amount)}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={[styles.progressBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(progress, 100)}%`,
                        backgroundColor: isCompleted ? '#10B981' : '#2563EB',
                      },
                    ]}
                  />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={[styles.installmentText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                    {emi.paid_installments} of {emi.total_installments} installments paid ({progress.toFixed(0)}%)
                  </Text>

                  {!isCompleted && (
                    <TouchableOpacity
                      onPress={() => handleMarkPaid(emi)}
                      style={styles.markPaidBtn}
                    >
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.markPaidBtnText}>Mark Paid</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      {/* EMI Modal */}
      <EMIFormModal
        visible={showEMIModal}
        emiToEdit={selectedEMI}
        onClose={() => {
          setShowEMIModal(false);
          setSelectedEMI(null);
        }}
        onSuccess={() => {
          loadEMIs();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tabContainer: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 12,
  },
  loaderContainer: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  summaryCard: {
    padding: 20,
    borderRadius: 22,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  subText: {
    fontSize: 12,
    marginRight: 6,
  },
  subValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  emiCard: {
    padding: 16,
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emiName: {
    fontSize: 15,
    fontWeight: '700',
  },
  emiSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  trashBtn: {
    padding: 6,
    borderRadius: 8,
  },
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  monthlyVal: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  totalVal: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  installmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  markPaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markPaidBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  emptyActionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
