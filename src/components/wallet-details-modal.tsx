import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
  Platform,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { getDatabase, Account, Transaction } from '@/services/db';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

interface WalletDetailsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function WalletDetailsModal({ visible, onClose }: WalletDetailsModalProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const { formatAmount, currencySymbol } = useCurrency();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cardLocked, setCardLocked] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<Account>('SELECT * FROM accounts');
      setAccounts(rows);

      if (rows.length > 0) {
        const firstAccId = rows[0].id;
        const txs = await db.getAllAsync<Transaction>(
          'SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC',
          [firstAccId]
        );
        setTransactions(txs);
      }
    } catch (error) {
      console.error('Error loading wallet details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveIndex(0);
      loadData();
    }
  }, [visible]);

  const handleScroll = async (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / CARD_WIDTH);
    
    if (index !== activeIndex && index >= 0 && index < accounts.length) {
      setActiveIndex(index);
      setLoading(true);
      try {
        const db = await getDatabase();
        const accId = accounts[index].id;
        const txs = await db.getAllAsync<Transaction>(
          'SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC',
          [accId]
        );
        setTransactions(txs);
      } catch (error) {
        console.error('Error loading account transactions:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const activeAccount = accounts[activeIndex];

  const handleTransfer = () => {
    if (!activeAccount) return;
    Alert.prompt(
      'Transfer Money',
      `Enter amount to transfer from ${activeAccount.name}:`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send', 
          onPress: (amt?: string) => {
            if (amt) {
              Alert.alert('Transfer Initiated', `Successfully transferred ${currencySymbol}${amt} from ${activeAccount.name}!`);
            }
          } 
        }
      ],
      'plain-text',
      '',
      'numeric'
    );
  };

  const handlePayBill = () => {
    Alert.alert('Pay Bill', 'Select a biller to pay instantly using card token routing.');
  };

  const handleToggleLock = () => {
    if (!activeAccount) return;
    const isLocked = !cardLocked[activeAccount.id];
    setCardLocked(prev => ({ ...prev, [activeAccount.id]: isLocked }));
    Alert.alert(
      isLocked ? 'Card Locked' : 'Card Unlocked',
      isLocked 
        ? `Transactions on ${activeAccount.name} will be declined until unlocked.` 
        : `Card ${activeAccount.name} is now active.`
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, !isDark && styles.containerLight]}>
        {/* Top Header */}
        <View style={[styles.header, !isDark && styles.headerLight]}>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color={isDark ? "#ffffff" : "#0A0A0A"} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, !isDark && styles.textLight]}>Wallets & Accounts</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading && accounts.length === 0 ? (
            <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#0A0A0A"} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Total balance for selected card */}
              {activeAccount && (
                <View style={styles.balanceInfo}>
                  <Text style={[styles.balanceLabel, !isDark && styles.textSecondaryLight]}>{activeAccount.name}</Text>
                  <Text style={[styles.balanceAmount, !isDark && styles.textLight]}>
                    {formatAmount(activeAccount.balance)}
                  </Text>
                </View>
              )}

              {/* Horizontal Swipeable Card Carousel */}
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH}
                decelerationRate="fast"
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={styles.carouselContainer}
              >
                {accounts.map((acc) => {
                  const colors = acc.color.split(',');
                  const primaryColor = colors[0];
                  
                  return (
                    <View key={acc.id} style={[styles.cardWrapper, { width: CARD_WIDTH }]}>
                      <View style={[
                        styles.creditCard, 
                        { backgroundColor: primaryColor },
                        cardLocked[acc.id] && styles.lockedCardOverlay
                      ]}>
                        <View style={styles.cardHeader}>
                          <View>
                            <Text style={styles.cardTypeLabel}>{acc.type.toUpperCase()}</Text>
                            <Text style={styles.cardName}>{acc.name}</Text>
                          </View>
                          <MaterialIcons 
                            name={acc.type === 'crypto' ? 'currency-bitcoin' : 'contactless'} 
                            size={24} 
                            color="rgba(255, 255, 255, 0.6)" 
                          />
                        </View>

                        <View style={styles.cardBody}>
                          <Text style={styles.cardNumber}>{acc.details}</Text>
                          <View style={styles.cardFooter}>
                            <Text style={styles.cardBalance}>
                              {formatAmount(acc.balance)}
                            </Text>
                            <Text style={styles.cardLogo}>WealthFlow</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Main Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.primaryActionBtn, !isDark && styles.primaryActionBtnLight]} onPress={handleTransfer}>
                  <MaterialIcons name="send" size={18} color={isDark ? "#0A0A0A" : "#ffffff"} style={{ marginRight: 6 }} />
                  <Text style={[styles.primaryActionText, !isDark && styles.primaryActionTextLight]}>Transfer Money</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryActionBtn, !isDark && styles.secondaryActionBtnLight]} onPress={handlePayBill}>
                  <MaterialIcons name="receipt" size={18} color={isDark ? "#ffffff" : "#0A0A0A"} style={{ marginRight: 6 }} />
                  <Text style={[styles.secondaryActionText, !isDark && styles.textLight]}>Pay Bills</Text>
                </TouchableOpacity>
              </View>

              {/* Account Insights Section */}
              <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>Account Insights</Text>
              
              <View style={styles.insightsGrid}>
                <View style={[styles.insightBox, styles.glassCard, !isDark && styles.glassCardLight, { flex: 2 }]}>
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightLabel}>Spending Velocity</Text>
                    <Text style={styles.insightGrowth}>+12%</Text>
                  </View>
                  <Text style={[styles.insightValue, !isDark && styles.textLight]}>{formatAmount(2440)}</Text>
                  <Text style={styles.insightDesc}>Spent this week</Text>
                </View>
                
                <TouchableOpacity 
                  style={[
                    styles.insightBox, 
                    styles.glassCard, 
                    !isDark && styles.glassCardLight,
                    { flex: 1, alignItems: 'center', justifyContent: 'center' },
                    activeAccount && cardLocked[activeAccount.id] && styles.activeLockCard
                  ]}
                  onPress={handleToggleLock}
                >
                  <MaterialIcons 
                    name={activeAccount && cardLocked[activeAccount.id] ? 'lock' : 'lock-open'} 
                    size={28} 
                    color={activeAccount && cardLocked[activeAccount.id] ? '#ffb4ab' : '#8e9192'} 
                  />
                  <Text style={[
                    styles.lockText,
                    activeAccount && cardLocked[activeAccount.id] && { color: '#ffb4ab' }
                  ]}>
                    {activeAccount && cardLocked[activeAccount.id] ? 'Card Locked' : 'Lock Card'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* APY savings vaults alert */}
              <View style={[styles.glassCard, !isDark && styles.glassCardLight, styles.apyBanner]}>
                <View style={styles.apyLeft}>
                  <View style={styles.apyIconBg}>
                    <MaterialIcons name="auto-graph" size={20} color="#ffffff" />
                  </View>
                  <View style={styles.apyTextContainer}>
                    <Text style={styles.apyTitle}>Optimized Savings</Text>
                    <Text style={[styles.apyDesc, !isDark && styles.textSecondaryLight]}>Move {currencySymbol}420 to vault for 4.5% APY</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.apyBtn}>
                  <Text style={styles.apyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>

              {/* Wallet transactions */}
              <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>Transactions</Text>
              
              <View style={[styles.glassCard, !isDark && styles.glassCardLight, { paddingBottom: 8 }]}>
                {loading ? (
                  <ActivityIndicator size="small" color={isDark ? "#ffffff" : "#0A0A0A"} style={{ marginVertical: 20 }} />
                ) : transactions.length === 0 ? (
                  <Text style={styles.emptyText}>No transactions for this account.</Text>
                ) : (
                  transactions.map(tx => {
                    const isExpense = tx.amount < 0;
                    const formattedAmt = (tx.amount > 0 ? '+' : '') + formatAmount(tx.amount);
                    
                    return (
                      <View key={tx.id} style={styles.txRow}>
                        <View style={styles.txLeft}>
                          <View style={styles.txIconContainer}>
                            <MaterialIcons 
                              name={isExpense ? 'arrow-downward' : 'arrow-upward'} 
                              size={16} 
                              color="#ffffff" 
                            />
                          </View>
                          <View>
                            <Text style={[styles.txTitle, !isDark && styles.textLight]}>{tx.note || tx.category}</Text>
                            <Text style={styles.txSubtitle}>
                              {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.txAmount, isExpense ? styles.expenseText : styles.incomeText]}>
                          {formattedAmt}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  headerLight: {
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  primaryActionBtnLight: {
    backgroundColor: '#0A0A0A',
  },
  primaryActionTextLight: {
    color: '#ffffff',
  },
  secondaryActionBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  scrollContent: {
    paddingTop: 10,
  },
  balanceInfo: {
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#8e9192',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 4,
    fontFamily: Platform.OS === 'web' ? 'var(--font-display)' : 'normal',
  },
  carouselContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  cardWrapper: {
    paddingRight: 15,
  },
  creditCard: {
    borderRadius: 24,
    height: 190,
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  lockedCardOverlay: {
    opacity: 0.4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTypeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
  },
  cardBody: {},
  cardNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 2,
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBalance: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardLogo: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  primaryActionText: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  insightsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  insightBox: {
    padding: 16,
    minHeight: 120,
  },
  glassCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 20,
    padding: 20,
    marginBottom: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightLabel: {
    fontSize: 11,
    color: '#8e9192',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  insightGrowth: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffb4ab',
  },
  insightValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
  },
  insightDesc: {
    fontSize: 11,
    color: '#8e9192',
    marginTop: 4,
  },
  lockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8e9192',
    marginTop: 8,
  },
  activeLockCard: {
    borderColor: 'rgba(255, 180, 171, 0.25)',
  },
  apyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  apyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apyIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  apyTextContainer: {},
  apyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  apyDesc: {
    fontSize: 11,
    color: '#8e9192',
    marginTop: 2,
  },
  apyBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  apyBtnText: {
    color: '#0A0A0A',
    fontSize: 11,
    fontWeight: '700',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
  },
  txSubtitle: {
    fontSize: 11,
    color: '#8e9192',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  incomeText: {
    color: '#a6c8ff',
  },
  expenseText: {
    color: '#ffb4ab',
  },
  emptyText: {
    color: '#8e9192',
    textAlign: 'center',
    paddingVertical: 20,
  }
});
