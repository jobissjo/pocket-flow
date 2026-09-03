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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { dashboardService } from '@/services/dashboard';
import { AnalyticsResponse, SummaryResponse } from '@/services/types';
import { useTheme } from '@/services/theme-context';
import { useCurrency } from '@/services/currency';
import { hapticImpactMedium, hapticLight } from '@/services/haptics';
import { AIChatModal } from '@/components/ai/ai-chat-modal';

export default function AnalyticsScreen() {
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();

  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'last_month'>('all');
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);

  const getDateRange = (range: 'all' | 'month' | 'last_month') => {
    const now = new Date();
    if (range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start_date: start.toISOString(), end_date: now.toISOString() };
    }
    if (range === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start_date: start.toISOString(), end_date: end.toISOString() };
    }
    return {};
  };

  const loadAnalytics = useCallback(async () => {
    try {
      const { start_date, end_date } = getDateRange(timeRange);
      const [analyticsData, summaryData] = await Promise.all([
        dashboardService.getAnalytics(start_date, end_date),
        dashboardService.getSummary(start_date, end_date),
      ]);
      setAnalytics(analyticsData);
      setSummary(summaryData);
    } catch (err) {
      console.log('Error loading analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    hapticImpactMedium();
    loadAnalytics();
  };

  const totalIncome = summary?.total_income ?? 0;
  const totalExpense = summary?.total_expenses ?? 0;
  const netSavings = summary?.net_savings ?? 0;
  const savingsPct = summary?.savings_percentage ?? 0;

  const currentBreakdown =
    breakdownType === 'expense'
      ? analytics?.expense_breakdown || []
      : analytics?.income_breakdown || [];

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#08080C' : '#F6F6F9' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Financial Analytics
        </Text>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            setShowAIChat(true);
          }}
          style={[
            styles.aiHeaderBtn,
            {
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : '#C7D2FE',
            },
          ]}
        >
          <Ionicons name="sparkles" size={15} color={isDark ? '#A5B4FC' : '#4F46E5'} />
          <Text style={[styles.aiHeaderBtnText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
            AI Insights
          </Text>
        </TouchableOpacity>
      </View>

      {/* Time Range Selector */}
      <View style={styles.tabContainer}>
        <SegmentedControl
          options={[
            { label: 'All Time', value: 'all' },
            { label: 'This Month', value: 'month' },
            { label: 'Last Month', value: 'last_month' },
          ]}
          value={timeRange}
          onChange={(val) => setTimeRange(val as any)}
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
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          <>
            {/* Overview Summary Card */}
            <GlassCard style={styles.overviewCard}>
              <View style={styles.overviewHeader}>
                <Text style={[styles.overviewLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  NET CASH FLOW
                </Text>
                <View
                  style={[
                    styles.savingsBadge,
                    {
                      backgroundColor:
                        netSavings >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.savingsBadgeText,
                      { color: netSavings >= 0 ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {savingsPct.toFixed(1)}% Saved
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.overviewAmount,
                  { color: netSavings >= 0 ? '#10B981' : '#EF4444' },
                ]}
              >
                {formatAmount(netSavings)}
              </Text>

              {/* Income vs Expense Bar */}
              <View style={styles.comparisonSection}>
                <View style={styles.compHeader}>
                  <Text style={[styles.compText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Income: <Text style={{ color: '#10B981', fontWeight: '700' }}>{formatAmount(totalIncome)}</Text>
                  </Text>
                  <Text style={[styles.compText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Expense: <Text style={{ color: '#EF4444', fontWeight: '700' }}>{formatAmount(totalExpense)}</Text>
                  </Text>
                </View>

                {totalIncome + totalExpense > 0 && (
                  <View style={styles.multiBarBg}>
                    <View
                      style={[
                        styles.incomeBarFill,
                        {
                          flex: Math.max(totalIncome, 1),
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.expenseBarFill,
                        {
                          flex: Math.max(totalExpense, 1),
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            </GlassCard>

            {/* Monthly Trend Time Series (if available) */}
            {analytics?.income_vs_expense && analytics.income_vs_expense.length > 0 && (
              <GlassCard style={styles.trendCard}>
                <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 12 }]}>
                  Monthly Performance
                </Text>
                {analytics.income_vs_expense.map((point) => (
                  <View key={point.period} style={styles.trendRow}>
                    <Text style={[styles.periodText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      {point.period}
                    </Text>
                    <View style={styles.trendAmounts}>
                      <Text style={[styles.trendIncome, { color: '#10B981' }]}>
                        +{formatAmount(point.income, 0)}
                      </Text>
                      <Text style={[styles.trendExpense, { color: '#EF4444' }]}>
                        -{formatAmount(point.expense, 0)}
                      </Text>
                    </View>
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Category Breakdown Switcher */}
            <View style={styles.breakdownHeaderRow}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Category Breakdown
              </Text>
              <View style={styles.typeSwitcher}>
                <TouchableOpacity
                  onPress={() => setBreakdownType('expense')}
                  style={[
                    styles.typeBtn,
                    breakdownType === 'expense' && {
                      backgroundColor: '#EF4444',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      {
                        color:
                          breakdownType === 'expense'
                            ? '#FFFFFF'
                            : isDark
                            ? '#94A3B8'
                            : '#64748B',
                      },
                    ]}
                  >
                    Expenses
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setBreakdownType('income')}
                  style={[
                    styles.typeBtn,
                    breakdownType === 'income' && {
                      backgroundColor: '#10B981',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      {
                        color:
                          breakdownType === 'income'
                            ? '#FFFFFF'
                            : isDark
                            ? '#94A3B8'
                            : '#64748B',
                      },
                    ]}
                  >
                    Income
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Categories List */}
            {currentBreakdown.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Ionicons
                  name="pie-chart-outline"
                  size={36}
                  color={isDark ? '#64748B' : '#94A3B8'}
                />
                <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  No {breakdownType} records for this period
                </Text>
              </GlassCard>
            ) : (
              currentBreakdown.map((item) => (
                <GlassCard key={item.category_id} style={styles.categoryCard}>
                  <View style={styles.catHeader}>
                    <View style={styles.catNameRow}>
                      <View
                        style={[
                          styles.catIconBox,
                          {
                            backgroundColor:
                              breakdownType === 'expense'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                          },
                        ]}
                      >
                        <Ionicons
                          name="pricetag"
                          size={16}
                          color={breakdownType === 'expense' ? '#EF4444' : '#10B981'}
                        />
                      </View>
                      <Text style={[styles.catName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {item.category_name}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.catAmount,
                          { color: breakdownType === 'expense' ? '#EF4444' : '#10B981' },
                        ]}
                      >
                        {formatAmount(item.amount)}
                      </Text>
                      <Text style={[styles.catPct, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                        {item.percentage.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.barBg,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' },
                    ]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(item.percentage, 100)}%`,
                          backgroundColor:
                            breakdownType === 'expense' ? '#EF4444' : '#10B981',
                        },
                      ]}
                    />
                  </View>
                </GlassCard>
              ))
            )}
          </>
        )}
      </ScrollView>

      <AIChatModal
        visible={showAIChat}
        onClose={() => setShowAIChat(false)}
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
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
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
  overviewCard: {
    padding: 20,
    borderRadius: 22,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  savingsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  overviewAmount: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginVertical: 6,
  },
  comparisonSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  compText: {
    fontSize: 12,
  },
  multiBarBg: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
  },
  incomeBarFill: {
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  expenseBarFill: {
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  trendCard: {
    padding: 18,
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
  },
  trendAmounts: {
    flexDirection: 'row',
    gap: 12,
  },
  trendIncome: {
    fontSize: 13,
    fontWeight: '700',
  },
  trendExpense: {
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 2,
  },
  typeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryCard: {
    padding: 14,
    borderRadius: 16,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
  },
  catAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  catPct: {
    fontSize: 11,
    marginTop: 1,
  },
  barBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  aiHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  aiHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
});
