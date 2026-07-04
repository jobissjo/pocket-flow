import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { getDatabase, Transaction, getSetting, autoApplySubscriptions, getSubscriptions, Subscription, autoApplySIPs, getInvestments } from '@/services/db';
import AddTransactionModal from '@/components/add-transaction-modal';
import AIAssistantModal from '@/components/ai-assistant-modal';
import WalletDetailsModal from '@/components/wallet-details-modal';
import SubscriptionsModal from '@/components/subscriptions-modal';
import InvestmentsModal from '@/components/investments-modal';

import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';

const { width } = Dimensions.get('window');

export default function HomeDashboard() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const { formatAmount } = useCurrency();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [incomeSum, setIncomeSum] = useState(0);
  const [expenseSum, setExpenseSum] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<{ category: string; spent: number; limit: number }[]>([]);
  const [username, setUsername] = useState('Alex');
  const [portfolioVal, setPortfolioVal] = useState(0);

  // Modal Visibility States
  const [addTxVisible, setAddTxVisible] = useState(false);
  const [addTxType, setAddTxType] = useState<'income' | 'expense'>('expense');
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [walletDetailsVisible, setWalletDetailsVisible] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [subsVisible, setSubsVisible] = useState(false);
  const [upcomingBills, setUpcomingBills] = useState<Subscription[]>([]);
  const [investmentsVisible, setInvestmentsVisible] = useState(false);

  const loadData = async () => {
    try {
      // First auto-apply past-due recurring bills & SIPs
      await autoApplySubscriptions();
      await autoApplySIPs();

      const db = await getDatabase();

      // Load username setting
      const name = await getSetting('username', 'Alex');
      setUsername(name);

      // 1. Fetch total balance
      const balanceRow = await db.getFirstAsync<{ total: number }>('SELECT SUM(balance) as total FROM accounts');
      setTotalBalance(balanceRow?.total || 0);

      // 2. Fetch income and expense sums
      const incomeRow = await db.getFirstAsync<{ total: number }>(
        "SELECT SUM(amount) as total FROM transactions WHERE type='income'"
      );
      const expenseRow = await db.getFirstAsync<{ total: number }>(
        "SELECT ABS(SUM(amount)) as total FROM transactions WHERE type='expense'"
      );
      setIncomeSum(incomeRow?.total || 0);
      setExpenseSum(expenseRow?.total || 0);

      // 3. Fetch recent transactions
      const txs = await db.getAllAsync<Transaction>(
        'SELECT * FROM transactions ORDER BY date DESC LIMIT 3'
      );
      setRecentTransactions(txs);

      // 4. Compute budget utilization
      const budgetRows = await db.getAllAsync<{ category: string; spent: number }>(
        `SELECT category, ABS(SUM(amount)) as spent 
         FROM transactions 
         WHERE type = 'expense' 
         AND category IN ('Food', 'Transport', 'Shopping')
         GROUP BY category`
      );

      const limits: Record<string, number> = {
        Food: 600,
        Transport: 200,
        Shopping: 300
      };

      const budgetList = ['Food', 'Transport', 'Shopping'].map(cat => {
        const row = budgetRows.find(r => r.category.toLowerCase() === cat.toLowerCase());
        return {
          category: cat,
          spent: row ? row.spent : 0,
          limit: limits[cat]
        };
      });
      setBudgets(budgetList);

      // 5. Fetch upcoming bills (next 30 days)
      const allSubs = await getSubscriptions();
      const todayStr = new Date().toISOString().split('T')[0];
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);
      const maxDateStr = maxDate.toISOString().split('T')[0];

      const upcoming = allSubs.filter(s => 
        s.status === 'active' && 
        s.next_billing_date >= todayStr && 
        s.next_billing_date <= maxDateStr
      );
      setUpcomingBills(upcoming);

      // Load investment portfolio valuation
      const invs = await getInvestments();
      const val = invs.reduce((sum, inv) => sum + (inv.shares * inv.current_price), 0);
      setPortfolioVal(val);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [isFocused]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, !isDark && styles.containerLight]}>
        <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#0A0A0A"} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, !isDark && styles.containerLight]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header bar */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, !isDark && styles.textSecondaryLight]}>Good morning, {username}</Text>
            <Text style={[styles.headerTitle, !isDark && styles.textLight]}>Your financial summary</Text>
          </View>
          <TouchableOpacity 
            style={styles.notificationBtn} 
            onPress={() => setAssistantVisible(true)}
          >
            <MaterialIcons name="auto-awesome" size={24} color="#a6c8ff" />
          </TouchableOpacity>
        </View>

        {/* Investment Portfolio Summary Card */}
        <TouchableOpacity 
          style={[styles.investmentCard, !isDark && styles.investmentCardLight]}
          onPress={() => setInvestmentsVisible(true)}
        >
          <View style={styles.investmentHeader}>
            <View style={styles.investmentIconContainer}>
              <MaterialIcons name="donut-large" size={20} color={isDark ? "#a6c8ff" : "#208aef"} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.investmentLabel}>Investment Portfolio</Text>
              <Text style={[styles.investmentVal, !isDark && styles.textLight]}>
                {formatAmount(portfolioVal)}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8e9192" />
          </View>
        </TouchableOpacity>

        {/* Balance Card */}
        <View style={[styles.glassCard, !isDark && styles.glassCardLight]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <MaterialIcons name="info-outline" size={18} color="#8e9192" />
          </View>
          <Text style={[styles.balanceAmount, !isDark && styles.textLight]}>
            {formatAmount(totalBalance)}
          </Text>
          
          <View style={styles.balanceTrend}>
            <View style={styles.trendPill}>
              <MaterialIcons name="arrow-upward" size={14} color="#a6c8ff" />
              <Text style={styles.trendText}>2.4%</Text>
            </View>
            <Text style={styles.trendLabel}>from last month</Text>
          </View>

          <View style={styles.balanceDivider} />

          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Income</Text>
              <Text style={[styles.statValue, styles.incomeText]}>
                {formatAmount(incomeSum, 0)}
              </Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Expenses</Text>
              <Text style={[styles.statValue, styles.expenseText]}>
                {formatAmount(expenseSum, 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* AI Quick Insight Banner */}
        <TouchableOpacity 
          style={styles.aiBanner}
          onPress={() => setAssistantVisible(true)}
        >
          <View style={styles.aiIconContainer}>
            <MaterialIcons name="auto-awesome" size={18} color="#a6c8ff" />
          </View>
          <Text style={styles.aiText} numberOfLines={2}>
            You spent 15% less on dining this week compared to last month. Ask me for recommendations!
          </Text>
        </TouchableOpacity>

        {/* Bento Grid Action Cards */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>Quick Actions</Text>
        </View>
        
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => { setAddTxType('expense'); setAddTxVisible(true); }}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(255, 180, 171, 0.1)' }]}>
              <MaterialIcons name="remove-circle-outline" size={24} color="#ffb4ab" />
            </View>
             <Text style={[styles.actionText, !isDark && styles.textLight]}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => { setAddTxType('income'); setAddTxVisible(true); }}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(166, 200, 255, 0.1)' }]}>
              <MaterialIcons name="add-circle-outline" size={24} color="#a6c8ff" />
            </View>
            <Text style={[styles.actionText, !isDark && styles.textLight]}>Add Income</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => setWalletDetailsVisible(true)}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(158, 119, 237, 0.1)' }]}>
              <MaterialIcons name="account-balance-wallet" size={24} color="#9e77ed" />
            </View>
            <Text style={[styles.actionText, !isDark && styles.textLight]}>Accounts</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => setAssistantVisible(true)}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
              <MaterialIcons name="forum" size={24} color={isDark ? "#ffffff" : "#0A0A0A"} />
            </View>
            <Text style={[styles.actionText, !isDark && styles.textLight]}>WealthAI</Text>
          </TouchableOpacity>
        </View>

        {/* Budgets Progress */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>Budgets</Text>
          <TouchableOpacity onPress={() => router.push('/analytics')}>
            <Text style={styles.sectionLink}>View limits</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.glassCard, !isDark && styles.glassCardLight]}>
          {budgets.map((b, idx) => {
            const percent = Math.min(100, Math.round((b.spent / b.limit) * 100));
            // Choose color based on percentage
            const barColor = percent > 90 ? '#ffb4ab' : percent > 75 ? '#9e77ed' : '#a6c8ff';
            
            return (
              <View key={b.category} style={[styles.budgetRow, idx > 0 && styles.budgetRowSpacer]}>
                <View style={styles.budgetMeta}>
                  <Text style={[styles.budgetName, !isDark && styles.textLight]}>{b.category}</Text>
                  <Text style={[styles.budgetValue, !isDark && styles.textSecondaryLight]}>
                    {formatAmount(b.spent, 0)} / {formatAmount(b.limit, 0)}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: barColor }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/history')}>
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.glassCard, !isDark && styles.glassCardLight, { paddingBottom: 8 }]}>
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>No recent transactions.</Text>
          ) : (
            recentTransactions.map((tx, idx) => {
              const isExpense = tx.amount < 0;
              const formattedAmt = formatAmount(tx.amount);
              
              let iconName = 'receipt';
              if (tx.category.toLowerCase().includes('food') || tx.category.toLowerCase().includes('dining')) {
                iconName = 'local-cafe';
              } else if (tx.category.toLowerCase().includes('grocery')) {
                iconName = 'shopping-basket';
              } else if (tx.category.toLowerCase().includes('transport') || tx.category.toLowerCase().includes('travel')) {
                iconName = 'directions-car';
              } else if (tx.category.toLowerCase().includes('salary')) {
                iconName = 'payments';
              } else if (tx.category.toLowerCase().includes('transfer')) {
                iconName = 'sync-alt';
              } else if (tx.category.toLowerCase().includes('housing')) {
                iconName = 'home';
              }
 
              return (
                <TouchableOpacity 
                  key={tx.id} 
                  style={styles.txRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setEditingTx(tx);
                    setAddTxVisible(true);
                  }}
                >
                  <View style={styles.txLeft}>
                    <View style={styles.txIconContainer}>
                      <MaterialIcons name={iconName as any} size={20} color="#ffffff" />
                    </View>
                    <View>
                      <Text style={[styles.txTitle, !isDark && styles.textLight]}>{tx.note || tx.category}</Text>
                      <Text style={[styles.txSubtitle, !isDark && styles.textSecondaryLight]}>
                        {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, isExpense ? styles.expenseText : styles.incomeText]}>
                    {formattedAmt}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Upcoming Bills Widget */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>Upcoming Bills</Text>
          <TouchableOpacity onPress={() => setSubsVisible(true)}>
            <Text style={styles.sectionLink}>Manage</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.glassCard, !isDark && styles.glassCardLight, { paddingBottom: 8, marginBottom: 20 }]}>
          {upcomingBills.length === 0 ? (
            <Text style={[styles.emptyText, { paddingVertical: 12 }]}>No bills due in the next 30 days.</Text>
          ) : (
            upcomingBills.slice(0, 3).map((item) => {
              const formattedDate = new Date(item.next_billing_date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
              });
              
              let iconName = 'card-membership';
              if (item.category.toLowerCase().includes('entertainment')) iconName = 'tv';
              else if (item.category.toLowerCase().includes('utilities')) iconName = 'power';
              else if (item.category.toLowerCase().includes('rent') || item.category.toLowerCase().includes('home')) iconName = 'home';
              else if (item.category.toLowerCase().includes('gym')) iconName = 'fitness-center';
              else if (item.category.toLowerCase().includes('insurance')) iconName = 'shield';

              return (
                <View key={item.id} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txIconContainer, !isDark && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
                      <MaterialIcons name={iconName as any} size={20} color={isDark ? '#a6c8ff' : '#208aef'} />
                    </View>
                    <View>
                      <Text style={[styles.txTitle, !isDark && styles.textLight]}>{item.name}</Text>
                      <Text style={[styles.txSubtitle, !isDark && styles.textSecondaryLight]}>
                        Due: {formattedDate}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: '#ffb4ab', fontWeight: 'bold' }]}>
                    -{formatAmount(item.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Extra spacing bottom to clear the tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <AddTransactionModal 
        visible={addTxVisible} 
        onClose={() => {
          setAddTxVisible(false);
          setEditingTx(null);
        }} 
        initialType={addTxType} 
        onSaveSuccess={loadData} 
        editingTransaction={editingTx}
      />

      <SubscriptionsModal 
        visible={subsVisible} 
        onClose={() => {
          setSubsVisible(false);
          loadData();
        }} 
      />

      <AIAssistantModal 
        visible={assistantVisible} 
        onClose={() => setAssistantVisible(false)} 
      />

      <WalletDetailsModal 
        visible={walletDetailsVisible} 
        onClose={() => setWalletDetailsVisible(false)} 
      />

      <InvestmentsModal 
        visible={investmentsVisible} 
        onClose={() => {
          setInvestmentsVisible(false);
          loadData();
        }} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  containerLight: {
    backgroundColor: '#F2F2F7',
  },
  glassCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  textLight: {
    color: '#0A0A0A',
  },
  textSecondaryLight: {
    color: '#60646C',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#8e9192',
    fontFamily: Platform.OS === 'web' ? 'var(--font-display)' : 'normal',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
    fontFamily: Platform.OS === 'web' ? 'var(--font-display)' : 'normal',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(28, 28, 30, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  glassCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#8e9192',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
    fontFamily: Platform.OS === 'web' ? 'var(--font-display)' : 'normal',
  },
  balanceTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(166, 200, 255, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a6c8ff',
    marginLeft: 2,
  },
  trendLabel: {
    fontSize: 12,
    color: '#8e9192',
  },
  balanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#8e9192',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  incomeText: {
    color: '#a6c8ff',
  },
  expenseText: {
    color: '#ffb4ab',
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(166, 200, 255, 0.06)',
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(166, 200, 255, 0.12)',
  },
  aiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(166, 200, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  aiText: {
    flex: 1,
    fontSize: 13,
    color: '#a6c8ff',
    lineHeight: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  sectionLink: {
    fontSize: 13,
    color: '#a6c8ff',
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  actionCard: {
    width: (width - 52) / 2,
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  actionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  budgetRow: {
    width: '100%',
  },
  budgetRowSpacer: {
    marginTop: 16,
  },
  budgetMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  budgetName: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  budgetValue: {
    fontSize: 12,
    color: '#8e9192',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  txSubtitle: {
    fontSize: 12,
    color: '#8e9192',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    color: '#8e9192',
    textAlign: 'center',
    paddingVertical: 20,
  },
  investmentCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.4)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    marginBottom: 16,
  },
  investmentCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  investmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  investmentIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(166, 200, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  investmentLabel: {
    fontSize: 10,
    color: '#8e9192',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  investmentVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
  }
});
