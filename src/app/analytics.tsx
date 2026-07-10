import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';

import { getDatabase } from '@/services/db';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';
import { GlassCard } from '@/components/ui/glass-card';

interface CategorySpend {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export default function AnalyticsScreen() {
  const isFocused = useIsFocused();
  const { formatAmount } = useCurrency();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [categorySpend, setCategorySpend] = useState<CategorySpend[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [chartData, setChartData] = useState<{ label: string; expense: number; income: number }[]>([]);

  const loadAnalytics = async () => {
    try {
      const db = await getDatabase();
      
      // Determine date constraint based on period
      let dateConstraint = "date >= date('now', '-30 days')";
      if (period === 'quarterly') {
        dateConstraint = "date >= date('now', '-90 days')";
      } else if (period === 'yearly') {
        dateConstraint = "date >= date('now', '-365 days')";
      }

      // 1. Fetch total expenses & income for period
      const expenseRow = await db.getFirstAsync<{ total: number }>(
        `SELECT ABS(SUM(amount)) as total FROM transactions WHERE type='expense' AND ${dateConstraint}`
      );
      const incomeRow = await db.getFirstAsync<{ total: number }>(
        `SELECT SUM(amount) as total FROM transactions WHERE type='income' AND ${dateConstraint}`
      );
      
      const totalExp = expenseRow?.total || 0;
      setTotalExpenses(totalExp);
      setTotalIncome(incomeRow?.total || 0);

      // 2. Fetch category spend breakdown
      const catRows = await db.getAllAsync<{ category: string; total: number; count: number }>(
        `SELECT category, ABS(SUM(amount)) as total, COUNT(*) as count 
         FROM transactions 
         WHERE type='expense' AND ${dateConstraint}
         GROUP BY category 
         ORDER BY total DESC`
      );

      const formattedCategories: CategorySpend[] = catRows.map(row => ({
        category: row.category,
        total: row.total,
        percentage: totalExp > 0 ? Math.round((row.total / totalExp) * 100) : 0,
        count: row.count
      }));
      setCategorySpend(formattedCategories);

      // 3. Generate chart data (mocked time intervals based on database records)
      // We group expenses by day/month depending on period to show a real graph
      let groupFormat = '%m-%d'; // Group by day for monthly
      if (period === 'quarterly') {
        groupFormat = 'Wk %W'; // Group by week for quarterly
      } else if (period === 'yearly') {
        groupFormat = '%b'; // Group by month name for yearly
      }

      const rawChartRows = await db.getAllAsync<{ label: string; type: string; total: number }>(
        `SELECT 
           strftime('${groupFormat}', date) as label, 
           type, 
           ABS(SUM(amount)) as total 
         FROM transactions 
         WHERE ${dateConstraint}
         GROUP BY label, type
         ORDER BY date ASC`
      );

      // Map labels to unique list and merge income/expense
      const labelMap: Record<string, { label: string; expense: number; income: number }> = {};
      
      // Seed last 6 intervals if empty to make graph look consistent
      const intervals = period === 'monthly' ? ['06-25', '06-26', '06-27', '06-28', '06-29', '06-30'] 
                      : period === 'quarterly' ? ['Wk 22', 'Wk 23', 'Wk 24', 'Wk 25', 'Wk 26', 'Wk 27']
                      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

      intervals.forEach(i => {
        labelMap[i] = { label: i, expense: 0, income: 0 };
      });

      rawChartRows.forEach(row => {
        const label = row.label || 'Other';
        if (!labelMap[label]) {
          labelMap[label] = { label, expense: 0, income: 0 };
        }
        if (row.type === 'expense') {
          labelMap[label].expense = row.total;
        } else {
          labelMap[label].income = row.total;
        }
      });

      // Convert map to array and take last 6 items
      const sortedChart = Object.values(labelMap).slice(-6);
      setChartData(sortedChart);

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, period]);

  const maxChartValue = Math.max(...chartData.map(d => Math.max(d.expense, d.income)), 100);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header & Range Selector */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, !isDark && styles.textLight]}>Financial Analytics</Text>
            <Text style={[styles.headerSubtitle, !isDark && styles.textSecondaryLight]}>Detailed breakdown of your spending</Text>
          </View>
        </View>

        {/* Period Selector Tabs */}
        <View style={[styles.toggleContainer, !isDark && styles.toggleContainerLight]}>
          {(['monthly', 'quarterly', 'yearly'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.toggleBtn, 
                period === p && styles.activeToggleBtn,
                period === p && !isDark && styles.activeToggleBtnLight
              ]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[
                styles.toggleBtnText, 
                period === p && styles.activeToggleBtnText,
                period === p && !isDark && styles.activeToggleBtnTextLight
              ]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#0A0A0A"} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Spending Chart Card */}
            <GlassCard>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={[styles.chartTitle, !isDark && styles.textLight]}>Spending Trend</Text>
                  <View style={styles.chartTrendRow}>
                    <Text style={styles.trendPercent}>+12.4%</Text>
                    <Text style={styles.trendSubText}>vs last period</Text>
                  </View>
                </View>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: isDark ? '#ffb4ab' : '#ba1a1a' }]} />
                    <Text style={styles.legendText}>Expenses</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: isDark ? '#a6c8ff' : '#208aef' }]} />
                    <Text style={styles.legendText}>Income</Text>
                  </View>
                </View>
              </View>

              {/* Custom High-Performance Bar-Chart Visualization */}
              <View style={styles.chartContainer}>
                <View style={styles.barsContainer}>
                  {chartData.map((d, index) => {
                    const expenseHeight = (d.expense / maxChartValue) * 140;
                    const incomeHeight = (d.income / maxChartValue) * 140;
                    
                    return (
                      <View key={d.label + index} style={styles.barGroup}>
                        <View style={styles.barsRow}>
                          {/* Income Bar (Left/Blue) */}
                          <View style={[
                            styles.barFill, 
                            { 
                              height: Math.max(4, incomeHeight), 
                              backgroundColor: isDark ? '#a6c8ff' : '#208aef',
                              shadowColor: isDark ? '#a6c8ff' : '#208aef',
                              shadowOpacity: 0.2,
                              shadowRadius: 4,
                            }
                          ]} />
                          {/* Expense Bar (Right/Red) */}
                          <View style={[
                            styles.barFill, 
                            { 
                              height: Math.max(4, expenseHeight), 
                              backgroundColor: isDark ? '#ffb4ab' : '#ba1a1a',
                              shadowColor: isDark ? '#ffb4ab' : '#ba1a1a',
                              shadowOpacity: 0.2,
                              shadowRadius: 4,
                            }
                          ]} />
                        </View>
                        <Text style={styles.barLabel}>{d.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </GlassCard>

            {/* Income vs Expenses Summary */}
            <View style={styles.summaryRow}>
              <GlassCard style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Income</Text>
                <Text style={[styles.summaryValue, { color: isDark ? '#a6c8ff' : '#208aef' }]}>
                  {formatAmount(totalIncome)}
                </Text>
              </GlassCard>
              <GlassCard style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Expenses</Text>
                <Text style={[styles.summaryValue, { color: isDark ? '#ffb4ab' : '#ba1a1a' }]}>
                  {formatAmount(totalExpenses)}
                </Text>
              </GlassCard>
            </View>

            {/* Category Breakdown Section */}
            <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>Spending by Category</Text>
            
            <GlassCard>
              {categorySpend.length === 0 ? (
                <Text style={styles.emptyText}>No expenses recorded in this period.</Text>
              ) : (
                categorySpend.map((cat, index) => {
                  // Generate custom indicator colors
                  const colors = isDark 
                    ? ['#a6c8ff', '#9e77ed', '#ffb4ab', '#fdba74', '#cbd5e1']
                    : ['#208aef', '#7f56d9', '#ba1a1a', '#ea580c', '#64748b'];
                  const barColor = colors[index % colors.length];

                  return (
                    <View key={cat.category} style={[styles.catRow, index > 0 && (isDark ? styles.catBorder : [styles.catBorder, { borderTopColor: 'rgba(0,0,0,0.05)' }])]}>
                      <View style={styles.catMeta}>
                        <View style={styles.catLeft}>
                          <View style={[styles.catDot, { backgroundColor: barColor }]} />
                          <Text style={[styles.catName, !isDark && styles.textLight]}>{cat.category}</Text>
                          <Text style={styles.catCount}>({cat.count} txs)</Text>
                        </View>
                        <View style={styles.catRight}>
                          <Text style={[styles.catAmount, !isDark && styles.textLight]}>{formatAmount(cat.total)}</Text>
                          <Text style={styles.catPercentage}>{cat.percentage}%</Text>
                        </View>
                      </View>
                      <View style={[styles.catProgressBg, !isDark && { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
                        <View style={[styles.catProgressFill, { width: `${cat.percentage}%`, backgroundColor: barColor }]} />
                      </View>
                    </View>
                  );
                })
              )}
            </GlassCard>
          </>
        )}

        {/* Extra margin bottom to clear tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  textLight: {
    color: '#0A0A0A',
  },
  textSecondaryLight: {
    color: '#60646C',
  },
  toggleContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  activeToggleBtnLight: {
    backgroundColor: '#0A0A0A',
  },
  activeToggleBtnTextLight: {
    color: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerRow: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: Platform.OS === 'web' ? 'var(--font-display)' : 'normal',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8e9192',
    marginTop: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeToggleBtn: {
    backgroundColor: '#ffffff',
  },
  toggleBtnText: {
    color: '#8e9192',
    fontSize: 12,
    fontWeight: '600',
  },
  activeToggleBtnText: {
    color: '#0A0A0A',
  },
  glassCard: {
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  chartTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trendPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a6c8ff',
    marginRight: 6,
  },
  trendSubText: {
    fontSize: 12,
    color: '#8e9192',
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#8e9192',
    fontWeight: '500',
  },
  chartContainer: {
    height: 180,
    justifyContent: 'flex-end',
    paddingTop: 10,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
  },
  barGroup: {
    alignItems: 'center',
    flex: 1,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 8,
  },
  barFill: {
    width: 10,
    borderRadius: 5,
  },
  barLabel: {
    fontSize: 10,
    color: '#8e9192',
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    marginBottom: 0,
    padding: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8e9192',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 14,
  },
  catRow: {
    paddingVertical: 14,
  },
  catBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  catMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  catCount: {
    fontSize: 11,
    color: '#8e9192',
    marginLeft: 6,
  },
  catRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  catPercentage: {
    fontSize: 12,
    color: '#8e9192',
    fontWeight: '500',
    width: 32,
    textAlign: 'right',
  },
  catProgressBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyText: {
    color: '#8e9192',
    textAlign: 'center',
    paddingVertical: 20,
  }
});
