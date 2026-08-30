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
import { AccountFormModal } from '@/components/forms/account-form-modal';
import { CardFormModal } from '@/components/forms/card-form-modal';
import { accountService } from '@/services/accounts';
import { creditCardService } from '@/services/creditCards';
import { AccountResponse, CreditCardResponse } from '@/services/types';
import { useTheme } from '@/services/theme-context';
import { useCurrency } from '@/services/currency';
import { hapticImpactMedium, hapticNotificationSuccess, hapticLight } from '@/services/haptics';

export default function AccountsScreen() {
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();

  const [activeTab, setActiveTab] = useState<'accounts' | 'cards'>('accounts');
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountResponse | null>(null);
  const [selectedCard, setSelectedCard] = useState<CreditCardResponse | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [accs, cc] = await Promise.all([
        accountService.listAccounts(),
        creditCardService.listCreditCards(),
      ]);
      setAccounts(accs);
      setCards(cc);
    } catch (err) {
      console.log('Error loading accounts/cards:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    hapticImpactMedium();
    loadData();
  };

  const handleDeleteAccount = (acc: AccountResponse) => {
    hapticImpactMedium();
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete account "${acc.name}"?`)) {
        accountService.deleteAccount(acc.id).then(() => {
          hapticNotificationSuccess();
          loadData();
        });
      }
    } else {
      Alert.alert(
        'Delete Account',
        `Are you sure you want to delete "${acc.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await accountService.deleteAccount(acc.id);
              hapticNotificationSuccess();
              loadData();
            },
          },
        ]
      );
    }
  };

  const handleDeleteCard = (card: CreditCardResponse) => {
    hapticImpactMedium();
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete card "${card.card_name}"?`)) {
        creditCardService.deleteCreditCard(card.id).then(() => {
          hapticNotificationSuccess();
          loadData();
        });
      }
    } else {
      Alert.alert(
        'Delete Credit Card',
        `Are you sure you want to delete "${card.card_name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await creditCardService.deleteCreditCard(card.id);
              hapticNotificationSuccess();
              loadData();
            },
          },
        ]
      );
    }
  };

  const totalBankBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalCreditLimit = cards.reduce((sum, c) => sum + (c.credit_limit || 0), 0);
  const totalOutstanding = cards.reduce((sum, c) => sum + (c.outstanding_amount || 0), 0);
  const totalAvailableLimit = cards.reduce((sum, c) => sum + (c.available_limit || 0), 0);
  const utilizationRate = totalCreditLimit > 0 ? (totalOutstanding / totalCreditLimit) * 100 : 0;

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#08080C' : '#F6F6F9' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Vault & Banking
        </Text>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            if (activeTab === 'accounts') {
              setSelectedAccount(null);
              setShowAccountModal(true);
            } else {
              setSelectedCard(null);
              setShowCardModal(true);
            }
          }}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.addBtnText}>
            {activeTab === 'accounts' ? 'Add Bank' : 'Add Card'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <SegmentedControl
          options={[
            { label: `Bank Accounts (${accounts.length})`, value: 'accounts' },
            { label: `Credit Cards (${cards.length})`, value: 'cards' },
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as any)}
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
        ) : activeTab === 'accounts' ? (
          <>
            {/* Accounts Summary Card */}
            <GlassCard style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                TOTAL BANK & CASH LIQUIDITY
              </Text>
              <Text style={[styles.summaryAmount, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {formatAmount(totalBankBalance)}
              </Text>
              <Text style={[styles.summaryCount, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
                {accounts.length} linked account{accounts.length === 1 ? '' : 's'}
              </Text>
            </GlassCard>

            {/* Accounts List */}
            {accounts.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Ionicons name="wallet-outline" size={44} color={isDark ? '#64748B' : '#94A3B8'} />
                <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  No Bank Accounts Yet
                </Text>
                <Text style={[styles.emptySub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Add checking, savings, salary, or cash wallets to track balances.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedAccount(null);
                    setShowAccountModal(true);
                  }}
                  style={styles.emptyActionBtn}
                >
                  <Text style={styles.emptyActionText}>+ Add First Bank Account</Text>
                </TouchableOpacity>
              </GlassCard>
            ) : (
              accounts.map((acc) => (
                <GlassCard
                  key={acc.id}
                  style={styles.itemCard}
                  onPress={() => {
                    setSelectedAccount(acc);
                    setShowAccountModal(true);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.badgeRow}>
                      <View style={styles.iconBox}>
                        <Ionicons name="business" size={18} color="#3B82F6" />
                      </View>
                      <View style={{ marginLeft: 10 }}>
                        <Text style={[styles.itemName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {acc.name}
                        </Text>
                        <Text style={[styles.itemSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          {acc.bank_name} • {acc.account_type.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteAccount(acc)}
                      style={styles.trashBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={[styles.lastFourText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      •••• {acc.last_four}
                    </Text>
                    <Text style={[styles.itemBalance, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {formatAmount(acc.balance)}
                    </Text>
                  </View>
                </GlassCard>
              ))
            )}
          </>
        ) : (
          <>
            {/* Credit Cards Summary Card */}
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  TOTAL CREDIT OUTSTANDING
                </Text>
                <View
                  style={[
                    styles.utilizationBadge,
                    {
                      backgroundColor:
                        utilizationRate > 30 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.utilizationText,
                      { color: utilizationRate > 30 ? '#EF4444' : '#10B981' },
                    ]}
                  >
                    {utilizationRate.toFixed(1)}% Used
                  </Text>
                </View>
              </View>

              <Text style={[styles.summaryAmount, { color: '#EF4444' }]}>
                {formatAmount(totalOutstanding)}
              </Text>

              <View style={styles.cardMetricsRow}>
                <View>
                  <Text style={[styles.metricLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Available Limit
                  </Text>
                  <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {formatAmount(totalAvailableLimit)}
                  </Text>
                </View>

                <View>
                  <Text style={[styles.metricLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Total Limit
                  </Text>
                  <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {formatAmount(totalCreditLimit)}
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Cards List */}
            {cards.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Ionicons name="card-outline" size={44} color={isDark ? '#64748B' : '#94A3B8'} />
                <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  No Credit Cards Added
                </Text>
                <Text style={[styles.emptySub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Add credit cards to monitor statement due dates and limit utilization.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCard(null);
                    setShowCardModal(true);
                  }}
                  style={styles.emptyActionBtn}
                >
                  <Text style={styles.emptyActionText}>+ Add First Credit Card</Text>
                </TouchableOpacity>
              </GlassCard>
            ) : (
              cards.map((card) => {
                const cardUtil =
                  card.credit_limit > 0 ? (card.outstanding_amount / card.credit_limit) * 100 : 0;
                return (
                  <GlassCard
                    key={card.id}
                    style={styles.itemCard}
                    onPress={() => {
                      setSelectedCard(card);
                      setShowCardModal(true);
                    }}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.badgeRow}>
                        <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                          <Ionicons name="card" size={18} color="#F59E0B" />
                        </View>
                        <View style={{ marginLeft: 10 }}>
                          <Text style={[styles.itemName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                            {card.card_name}
                          </Text>
                          <Text style={[styles.itemSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                            {card.provider} •••• {card.last_four}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleDeleteCard(card)}
                        style={styles.trashBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.ccAmountsRow}>
                      <View>
                        <Text style={[styles.ccAmountLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Outstanding
                        </Text>
                        <Text style={[styles.ccAmountVal, { color: '#EF4444' }]}>
                          {formatAmount(card.outstanding_amount)}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.ccAmountLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Limit ({cardUtil.toFixed(0)}%)
                        </Text>
                        <Text style={[styles.ccAmountVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {formatAmount(card.credit_limit)}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={[styles.progressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(cardUtil, 100)}%`,
                            backgroundColor: cardUtil > 30 ? '#EF4444' : '#10B981',
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.datesRow}>
                      <Text style={[styles.dateText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                        Statement: Day {card.billing_date}
                      </Text>
                      <Text style={[styles.dateText, { color: '#F59E0B', fontWeight: '700' }]}>
                        Payment Due: Day {card.payment_due_date}
                      </Text>
                    </View>
                  </GlassCard>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Modals */}
      <AccountFormModal
        visible={showAccountModal}
        accountToEdit={selectedAccount}
        onClose={() => {
          setShowAccountModal(false);
          setSelectedAccount(null);
        }}
        onSuccess={() => {
          loadData();
        }}
      />

      <CardFormModal
        visible={showCardModal}
        cardToEdit={selectedCard}
        onClose={() => {
          setShowCardModal(false);
          setSelectedCard(null);
        }}
        onSuccess={() => {
          loadData();
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
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  summaryCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  utilizationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  utilizationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  itemCard: {
    padding: 16,
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  trashBtn: {
    padding: 6,
    borderRadius: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastFourText: {
    fontSize: 13,
    fontWeight: '500',
  },
  itemBalance: {
    fontSize: 18,
    fontWeight: '800',
  },
  ccAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ccAmountLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  ccAmountVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
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
