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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { StatCard } from '@/components/ui/stat-card';
import { TransactionFormModal } from '@/components/forms/transaction-form-modal';
import { AccountFormModal } from '@/components/forms/account-form-modal';
import { CardFormModal } from '@/components/forms/card-form-modal';
import { EMIFormModal } from '@/components/forms/emi-form-modal';
import { AITransactionImportModal } from '@/components/import/ai-transaction-import-modal';
import { dashboardService } from '@/services/dashboard';
import { accountService } from '@/services/accounts';
import { creditCardService } from '@/services/creditCards';
import { emiService } from '@/services/emi';
import {
  SummaryResponse,
  TransactionResponse,
  AccountResponse,
  CreditCardResponse,
  EMIResponse,
} from '@/services/types';
import { useAuth } from '@/services/auth-context';
import { useTheme } from '@/services/theme-context';
import { useCurrency } from '@/services/currency';
import { hapticImpactMedium, hapticNotificationSuccess, hapticLight } from '@/services/haptics';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [recentTxns, setRecentTxns] = useState<TransactionResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [upcomingEMIs, setUpcomingEMIs] = useState<EMIResponse[]>([]);

  // Modals state
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddEMI, setShowAddEMI] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<TransactionResponse | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const [sum, txns, accs, cc, emis] = await Promise.all([
        dashboardService.getSummary().catch(() => null),
        dashboardService.getRecentTransactions(8).catch(() => []),
        accountService.listAccounts().catch(() => []),
        creditCardService.listCreditCards().catch(() => []),
        dashboardService.getUpcomingEMI(5).catch(() => []),
      ]);

      if (sum) setSummary(sum);
      setRecentTxns(txns);
      setAccounts(accs);
      setCards(cc);
      setUpcomingEMIs(emis);
    } catch (err) {
      console.log('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    hapticImpactMedium();
    loadDashboardData();
  };

  const handleMarkEMIPaid = async (emiId: string) => {
    try {
      hapticImpactMedium();
      await emiService.markPaid(emiId);
      hapticNotificationSuccess();
      loadDashboardData();
    } catch (err: any) {
      console.log('Error marking EMI paid:', err);
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const totalBalance = summary?.total_balance ?? 0;
  const totalIncome = summary?.total_income ?? 0;
  const totalExpense = summary?.total_expenses ?? 0;
  const ccOutstanding = summary?.total_credit_card_outstanding ?? 0;
  const savingsRate = summary?.savings_percentage ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#08080C' : '#F6F6F9' }]}>
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
        {/* Header Bar */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {greeting()},
            </Text>
            <Text style={[styles.userName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {user?.full_name || 'User'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setShowAIImport(true);
              }}
              style={[
                styles.quickAddHeaderBtn,
                { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF' },
              ]}
            >
              <Ionicons name="sparkles" size={18} color={isDark ? '#A5B4FC' : '#4F46E5'} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setShowAddTxn(true);
              }}
              style={styles.quickAddHeaderBtn}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          <>
            {/* Primary Net Worth / Balance Hero Card */}
            <GlassCard style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <Text style={[styles.heroLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  TOTAL NET BALANCE
                </Text>
                <View style={styles.savingsBadge}>
                  <Ionicons name="trending-up" size={12} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.savingsText}>{savingsRate.toFixed(1)}% saved</Text>
                </View>
              </View>

              <Text
                style={[styles.heroAmount, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatAmount(totalBalance)}
              </Text>

              <View style={styles.heroFooter}>
                <View style={styles.heroMetric}>
                  <View style={[styles.metricDot, { backgroundColor: '#10B981' }]} />
                  <View>
                    <Text style={[styles.metricLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Income</Text>
                    <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {formatAmount(totalIncome)}
                    </Text>
                  </View>
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroMetric}>
                  <View style={[styles.metricDot, { backgroundColor: '#EF4444' }]} />
                  <View>
                    <Text style={[styles.metricLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Expenses</Text>
                    <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {formatAmount(totalExpense)}
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>

            {/* Quick Action Pills */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowAIImport(true);
                }}
                style={[
                  styles.quickActionItem,
                  { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF' },
                ]}
              >
                <Ionicons name="sparkles" size={20} color="#6366F1" />
                <Text style={[styles.quickActionText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                  AI Scan
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowAddTxn(true);
                }}
                style={[
                  styles.quickActionItem,
                  { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' },
                ]}
              >
                <Ionicons name="swap-horizontal" size={20} color="#3B82F6" />
                <Text style={[styles.quickActionText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
                  + Transaction
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowAddAccount(true);
                }}
                style={[
                  styles.quickActionItem,
                  { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' },
                ]}
              >
                <Ionicons name="wallet-outline" size={20} color="#10B981" />
                <Text style={[styles.quickActionText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                  + Bank Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowAddCard(true);
                }}
                style={[
                  styles.quickActionItem,
                  { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB' },
                ]}
              >
                <Ionicons name="card-outline" size={20} color="#F59E0B" />
                <Text style={[styles.quickActionText, { color: isDark ? '#FCD34D' : '#B45309' }]}>
                  + Credit Card
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowAddEMI(true);
                }}
                style={[
                  styles.quickActionItem,
                  { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : '#FAF5FF' },
                ]}
              >
                <Ionicons name="calendar-outline" size={20} color="#A855F7" />
                <Text style={[styles.quickActionText, { color: isDark ? '#D8B4FE' : '#6B21A8' }]}>
                  + EMI Plan
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stat Row */}
            <View style={styles.statsGrid}>
              <StatCard
                title="Credit Outstanding"
                amount={formatAmount(ccOutstanding)}
                subtitle="All active cards"
                iconName="card"
                iconColor="#F59E0B"
                iconBg="rgba(245, 158, 11, 0.15)"
                style={{ flex: 1, marginRight: 8 }}
                onPress={() => router.push('/accounts' as any)}
              />
              <StatCard
                title="Active Accounts"
                amount={String(accounts.length + cards.length)}
                subtitle="Banks & Cards"
                iconName="business"
                iconColor="#3B82F6"
                iconBg="rgba(59, 130, 246, 0.15)"
                style={{ flex: 1, marginLeft: 8 }}
                onPress={() => router.push('/accounts' as any)}
              />
            </View>

            {/* Accounts & Cards Preview Carousel */}
            {(accounts.length > 0 || cards.length > 0) && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    My Accounts & Cards
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/accounts' as any)}>
                    <Text style={[styles.seeAllText, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
                      View All
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardsScroll}
                >
                  {accounts.map((acc) => (
                    <GlassCard key={acc.id} style={styles.accountCard} onPress={() => router.push('/accounts' as any)}>
                      <View style={styles.accCardTop}>
                        <View style={styles.bankBadge}>
                          <Ionicons name="wallet" size={14} color="#3B82F6" />
                          <Text style={styles.bankName}>{acc.bank_name}</Text>
                        </View>
                        <Text style={[styles.accountLastFour, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          ••• {acc.last_four}
                        </Text>
                      </View>
                      <Text style={[styles.accountName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {acc.name}
                      </Text>
                      <Text style={[styles.accountBalance, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {formatAmount(acc.balance)}
                      </Text>
                    </GlassCard>
                  ))}

                  {cards.map((card) => (
                    <GlassCard key={card.id} style={styles.accountCard} onPress={() => router.push('/accounts' as any)}>
                      <View style={styles.accCardTop}>
                        <View style={[styles.bankBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                          <Ionicons name="card" size={14} color="#F59E0B" />
                          <Text style={[styles.bankName, { color: '#F59E0B' }]}>{card.provider}</Text>
                        </View>
                        <Text style={[styles.accountLastFour, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          ••• {card.last_four}
                        </Text>
                      </View>
                      <Text style={[styles.accountName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {card.card_name}
                      </Text>
                      <Text style={[styles.accountBalance, { color: '#EF4444' }]}>
                        {formatAmount(card.outstanding_amount)}
                      </Text>
                      <Text style={[styles.cardLimitText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                        Avail: {formatAmount(card.available_limit)}
                      </Text>
                    </GlassCard>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Upcoming EMIs */}
            {upcomingEMIs.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Upcoming EMIs & Loans
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/goals')}>
                    <Text style={[styles.seeAllText, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
                      Manage
                    </Text>
                  </TouchableOpacity>
                </View>

                {upcomingEMIs.map((emi) => (
                  <GlassCard key={emi.id} style={styles.emiCard}>
                    <View style={styles.emiLeft}>
                      <View style={styles.emiIconBox}>
                        <Ionicons name="layers-outline" size={20} color="#A855F7" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.emiTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {emi.name}
                        </Text>
                        <Text style={[styles.emiSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Due on day {emi.due_day} • {emi.paid_installments}/{emi.total_installments} Paid
                        </Text>
                      </View>
                    </View>

                    <View style={styles.emiRight}>
                      <Text style={[styles.emiAmount, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {formatAmount(emi.monthly_emi_amount)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleMarkEMIPaid(emi.id)}
                        style={styles.markPaidButton}
                      >
                        <Text style={styles.markPaidText}>Pay</Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                ))}
              </View>
            )}

            {/* Recent Transactions List */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Recent Activity
                </Text>
                <TouchableOpacity onPress={() => router.push('/history')}>
                  <Text style={[styles.seeAllText, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
                    View All
                  </Text>
                </TouchableOpacity>
              </View>

              {recentTxns.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <Ionicons
                    name="receipt-outline"
                    size={36}
                    color={isDark ? '#64748B' : '#94A3B8'}
                  />
                  <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    No transactions recorded yet
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setShowAddTxn(true);
                    }}
                    style={styles.emptyAddBtn}
                  >
                    <Text style={styles.emptyAddText}>+ Add First Transaction</Text>
                  </TouchableOpacity>
                </GlassCard>
              ) : (
                recentTxns.map((txn) => {
                  const isIncome = txn.type === 'income';
                  return (
                    <GlassCard
                      key={txn.id}
                      style={styles.txnItem}
                      onPress={() => {
                        setSelectedTxn(txn);
                        setShowAddTxn(true);
                      }}
                    >
                      <View style={styles.txnLeft}>
                        <View
                          style={[
                            styles.txnIconBox,
                            {
                              backgroundColor: isIncome
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            },
                          ]}
                        >
                          <Ionicons
                            name={isIncome ? 'arrow-down' : 'arrow-up'}
                            size={18}
                            color={isIncome ? '#10B981' : '#EF4444'}
                          />
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text
                            style={[
                              styles.txnTitle,
                              { color: isDark ? '#FFFFFF' : '#0F172A' },
                            ]}
                            numberOfLines={1}
                          >
                            {txn.title}
                          </Text>
                          <Text
                            style={[
                              styles.txnCategory,
                              { color: isDark ? '#94A3B8' : '#64748B' },
                            ]}
                          >
                            {txn.category_name || 'General'}
                            {txn.account_name ? ` • ${txn.account_name}` : ''}
                            {txn.credit_card_name ? ` • ${txn.credit_card_name}` : ''}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.txnRight}>
                        <Text
                          style={[
                            styles.txnAmount,
                            { color: isIncome ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          {isIncome ? '+' : '-'}
                          {formatAmount(txn.amount)}
                        </Text>
                        <Text
                          style={[
                            styles.txnDate,
                            { color: isDark ? '#64748B' : '#94A3B8' },
                          ]}
                        >
                          {new Date(txn.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    </GlassCard>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Modals */}
      <TransactionFormModal
        visible={showAddTxn}
        transactionToEdit={selectedTxn}
        onClose={() => {
          setShowAddTxn(false);
          setSelectedTxn(null);
        }}
        onSuccess={() => {
          loadDashboardData();
        }}
        onOpenAIImport={() => {
          setShowAIImport(true);
        }}
      />

      <AITransactionImportModal
        visible={showAIImport}
        onClose={() => setShowAIImport(false)}
        onSuccess={() => {
          loadDashboardData();
        }}
      />

      <AccountFormModal
        visible={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSuccess={() => {
          loadDashboardData();
        }}
      />

      <CardFormModal
        visible={showAddCard}
        onClose={() => setShowAddCard(false)}
        onSuccess={() => {
          loadDashboardData();
        }}
      />

      <EMIFormModal
        visible={showAddEMI}
        onClose={() => setShowAddEMI(false)}
        onSuccess={() => {
          loadDashboardData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  quickAddHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loaderContainer: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  heroCard: {
    padding: 22,
    borderRadius: 24,
    marginBottom: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  savingsText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    marginVertical: 4,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroMetric: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardsScroll: {
    flexDirection: 'row',
    gap: 12,
  },
  accountCard: {
    width: 180,
    padding: 16,
    borderRadius: 20,
  },
  accCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bankName: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  accountLastFour: {
    fontSize: 11,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardLimitText: {
    fontSize: 11,
    marginTop: 4,
  },
  emiCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 8,
  },
  emiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emiIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emiTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emiSub: {
    fontSize: 11,
    marginTop: 2,
  },
  emiRight: {
    alignItems: 'flex-end',
  },
  emiAmount: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  markPaidButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  markPaidText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  txnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 8,
  },
  txnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txnIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  txnCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  txnDate: {
    fontSize: 11,
    marginTop: 2,
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
    marginBottom: 16,
  },
  emptyAddBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  emptyAddText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
