import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  Alert,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { getDatabase, SavingsGoal, DebtLoan, Account } from '@/services/db';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';

const { width } = Dimensions.get('window');

// Circular Progress Component
function CircularProgress({ percent, size = 60, strokeWidth = 5, color = '#ffffff' }: { percent: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  const { isDark } = useTheme();

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={styles.svgRotate}>
        {/* Track circle */}
        <Circle
          stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Fill circle */}
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={[styles.progressText, { color }]}>{percent}%</Text>
    </View>
  );
}

export default function GoalsScreen() {
  const isFocused = useIsFocused();
  const { formatAmount, currencySymbol } = useCurrency();
  const { isDark } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'goals' | 'debts'>('goals');
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<DebtLoan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Modals Visibility
  const [modalVisible, setModalVisible] = useState(false);
  const [debtModalVisible, setDebtModalVisible] = useState(false);
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  
  // New Goal Form State
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalCurrent, setNewGoalCurrent] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState('Savings');
  const [newGoalContribution, setNewGoalContribution] = useState('');

  // New Debt Form State
  const [dlType, setDlType] = useState<'lent' | 'borrowed'>('lent');
  const [dlName, setDlName] = useState('');
  const [dlAmount, setDlAmount] = useState('');
  const [dlDesc, setDlDesc] = useState('');
  const [dlDueDate, setDlDueDate] = useState('');
  const [dlApplyAccount, setDlApplyAccount] = useState<boolean>(false);
  const [dlSelectedAccount, setDlSelectedAccount] = useState<string>('');

  // Settling state
  const [settlingDl, setSettlingDl] = useState<DebtLoan | null>(null);
  const [settleAccount, setSettleAccount] = useState<string>('none');

  const loadAllData = async () => {
    try {
      const db = await getDatabase();
      
      // Load goals
      const goalRows = await db.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals');
      setGoals(goalRows);

      // Load debts/loans
      const dlRows = await db.getAllAsync<DebtLoan>('SELECT * FROM debts_loans ORDER BY created_at DESC');
      setDebts(dlRows);

      // Load accounts
      const accRows = await db.getAllAsync<Account>('SELECT * FROM accounts');
      setAccounts(accRows);
      if (accRows.length > 0 && !dlSelectedAccount) {
        setDlSelectedAccount(accRows[0].id);
      }
    } catch (error) {
      console.error('Error loading goals and debts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const handleAddGoal = async () => {
    if (!newGoalName.trim() || !newGoalTarget.trim()) return;

    try {
      const db = await getDatabase();
      const id = 'goal-' + Date.now();
      const target = parseFloat(newGoalTarget);
      const current = parseFloat(newGoalCurrent || '0');
      const contrib = parseFloat(newGoalContribution || '0');

      await db.runAsync(
        `INSERT INTO savings_goals (id, name, target_amount, current_amount, category, monthly_contribution)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [id, newGoalName, target, current, newGoalCategory, contrib]
      );

      // Reset form
      setNewGoalName('');
      setNewGoalTarget('');
      setNewGoalCurrent('');
      setNewGoalCategory('Savings');
      setNewGoalContribution('');
      setModalVisible(false);
      
      loadAllData();
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  const handleAddDebt = async () => {
    if (!dlName.trim() || !dlAmount.trim()) return;

    try {
      const db = await getDatabase();
      const amt = parseFloat(dlAmount);
      const finalAmount = dlType === 'lent' ? amt : -amt;

      await db.runAsync('BEGIN TRANSACTION;');

      const id = 'dl-' + Date.now();
      const createdAt = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO debts_loans (id, person_name, amount, description, due_date, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?);`,
        [id, dlName, finalAmount, dlDesc, dlDueDate, createdAt]
      );

      // If we need to modify the account balance immediately
      if (dlApplyAccount && dlSelectedAccount) {
        const txId = 'tx-' + Date.now();
        const txNote = dlType === 'lent'
          ? `Lent to ${dlName}: ${dlDesc || 'No note'}`
          : `Borrowed from ${dlName}: ${dlDesc || 'No note'}`;
        
        // Lent money: outflow (-amt)
        // Borrowed money: inflow (+amt)
        const txAmount = dlType === 'lent' ? -amt : amt;
        const txType = dlType === 'lent' ? 'expense' : 'income';

        await db.runAsync(
          `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
           VALUES (?, ?, ?, 'Transfer', ?, ?, ?, 0);`,
          [txId, dlSelectedAccount, txAmount, txNote, txType, createdAt]
        );

        await db.runAsync(
          `UPDATE accounts SET balance = balance + ? WHERE id = ?;`,
          [txAmount, dlSelectedAccount]
        );
      }

      await db.runAsync('COMMIT;');

      // Reset Form
      setDlName('');
      setDlAmount('');
      setDlDesc('');
      setDlDueDate('');
      setDlApplyAccount(false);
      setDebtModalVisible(false);

      loadAllData();
    } catch (error) {
      console.error('Error adding debt:', error);
      Alert.alert('Error', 'Failed to save commitment.');
    }
  };

  const handleConfirmSettle = async () => {
    if (!settlingDl) return;

    try {
      const db = await getDatabase();
      await db.runAsync('BEGIN TRANSACTION;');

      // 1. Settle in debts table
      await db.runAsync("UPDATE debts_loans SET status = 'settled' WHERE id = ?;", [settlingDl.id]);

      // 2. Add transaction if account selected
      if (settleAccount !== 'none') {
        const txId = 'tx-' + Date.now();
        const dateStr = new Date().toISOString();
        const absAmt = Math.abs(settlingDl.amount);

        // Repayment from Lent: inflow (+absAmt, income)
        // Repayment to Borrowed: outflow (-absAmt, expense)
        const txAmount = settlingDl.amount > 0 ? absAmt : -absAmt;
        const txType = settlingDl.amount > 0 ? 'income' : 'expense';
        const txNote = settlingDl.amount > 0
          ? `Repayment from ${settlingDl.person_name} (${settlingDl.description || 'Settle Lent'})`
          : `Repayment to ${settlingDl.person_name} (${settlingDl.description || 'Settle Borrowed'})`;

        await db.runAsync(
          `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
           VALUES (?, ?, ?, 'Transfer', ?, ?, ?, 0);`,
          [txId, settleAccount, txAmount, txNote, txType, dateStr]
        );

        await db.runAsync(
          `UPDATE accounts SET balance = balance + ? WHERE id = ?;`,
          [txAmount, settleAccount]
        );
      }

      await db.runAsync('COMMIT;');
      setSettleModalVisible(false);
      setSettlingDl(null);
      loadAllData();
    } catch (error) {
      console.error('Error settling commitment:', error);
      Alert.alert('Error', 'Failed to settle debt/loan.');
    }
  };

  const handleDeleteDebt = async (id: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this commitment? This won\'t revert past account modifications.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync('DELETE FROM debts_loans WHERE id = ?;', [id]);
              loadAllData();
            } catch (error) {
              console.error('Error deleting debt:', error);
            }
          }
        }
      ]
    );
  };

  // Savings Goals calculations
  const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
  const totalCurrent = goals.reduce((sum, g) => sum + g.current_amount, 0);
  const aggregatePercent = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;
  const totalContribution = goals.reduce((sum, g) => sum + (g.monthly_contribution || 0), 0);

  // Debts & Loans calculations
  const activeDebts = debts.filter(d => d.status === 'pending');
  const lentTotal = activeDebts.filter(d => d.amount > 0).reduce((sum, d) => sum + d.amount, 0);
  const borrowedTotal = activeDebts.filter(d => d.amount < 0).reduce((sum, d) => sum + Math.abs(d.amount), 0);
  const netDebt = lentTotal - borrowedTotal;

  return (
    <SafeAreaView style={[styles.container, !isDark && styles.containerLight]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Welcome Section */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, !isDark && styles.textLight]}>Your Commitments</Text>
          <Text style={[styles.headerSubtitle, !isDark && styles.textSecondaryLight]}>
            {activeTab === 'goals'
              ? (goals.length > 0 
                ? `You are on track to reach ${goals.filter(g => (g.current_amount/g.target_amount) > 0.5).length} of your ${goals.length} goals early.`
                : 'Add financial milestones to track your progress.')
              : `You have ${activeDebts.length} active lending or borrowing commitments.`}
          </Text>
        </View>

        {/* Tab Toggle Segmented Control */}
        <View style={[styles.tabToggleContainer, !isDark && styles.tabToggleContainerLight]}>
          <TouchableOpacity
            style={[
              styles.tabToggleBtn,
              activeTab === 'goals' && styles.activeTabToggleBtn,
              activeTab === 'goals' && !isDark && { backgroundColor: '#0A0A0A' }
            ]}
            onPress={() => setActiveTab('goals')}
          >
            <MaterialIcons
              name="track-changes"
              size={16}
              color={activeTab === 'goals' ? (isDark ? '#0A0A0A' : '#ffffff') : '#8e9192'}
              style={{ marginRight: 6 }}
            />
            <Text style={[
              styles.tabToggleText,
              activeTab === 'goals' && styles.activeTabToggleText,
              activeTab === 'goals' && !isDark && { color: '#ffffff' }
            ]}>Savings Goals</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabToggleBtn,
              activeTab === 'debts' && styles.activeTabToggleBtn,
              activeTab === 'debts' && !isDark && { backgroundColor: '#0A0A0A' }
            ]}
            onPress={() => setActiveTab('debts')}
          >
            <MaterialIcons
              name="people-outline"
              size={16}
              color={activeTab === 'debts' ? (isDark ? '#0A0A0A' : '#ffffff') : '#8e9192'}
              style={{ marginRight: 6 }}
            />
            <Text style={[
              styles.tabToggleText,
              activeTab === 'debts' && styles.activeTabToggleText,
              activeTab === 'debts' && !isDark && { color: '#ffffff' }
            ]}>Debts & Loans</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#0A0A0A"} style={{ marginVertical: 40 }} />
        ) : activeTab === 'goals' ? (
          /* SAVINGS GOALS TAB CONTENT */
          <>
            {/* AI Recommendation Card */}
            {goals.length > 0 && (
              <View style={[styles.aiGlowCard, !isDark && styles.aiGlowCardLight]}>
                <View style={[styles.aiTag, !isDark && styles.aiTagLight]}>
                  <MaterialIcons name="auto-awesome" size={14} color={isDark ? "#a6c8ff" : "#208aef"} />
                  <Text style={[styles.aiTagText, !isDark && styles.aiTagTextLight]}>AI Recommendation</Text>
                </View>
                <View style={styles.aiCardBody}>
                  <View style={styles.aiTextContainer}>
                    <Text style={[styles.aiTitle, !isDark && styles.aiTitleLight]}>Optimize Your Journey</Text>
                    <Text style={[styles.aiDesc, !isDark && styles.aiDescLight]}>
                      Increase contributions by {currencySymbol}50 to hit your &apos;New Car&apos; goal 1 month early.
                    </Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <View style={[styles.aiMediaPlaceholder, !isDark && styles.aiMediaPlaceholderLight]}>
                      <MaterialIcons name="directions-car" size={32} color={isDark ? "#a6c8ff" : "#208aef"} />
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity style={[styles.aiActionBtn, !isDark && styles.aiActionBtnLight]}>
                  <Text style={[styles.aiActionBtnText, !isDark && styles.aiActionBtnTextLight]}>Apply Adjustment</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Goals Bento Grid */}
            <View style={styles.goalsGrid}>
              {goals.map((g, idx) => {
                const percent = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
                const colors = [isDark ? '#ffffff' : '#0A0A0A', '#a6c8ff', '#9e77ed', '#ffb4ab'];
                const color = colors[idx % colors.length];

                let iconName = 'stars';
                if (g.name.toLowerCase().includes('car')) {
                  iconName = 'directions-car';
                } else if (g.name.toLowerCase().includes('emergency') || g.name.toLowerCase().includes('fund')) {
                  iconName = 'verified-user';
                } else if (g.name.toLowerCase().includes('vacation') || g.name.toLowerCase().includes('travel')) {
                  iconName = 'flight';
                } else if (g.name.toLowerCase().includes('home') || g.name.toLowerCase().includes('house')) {
                  iconName = 'home';
                }

                return (
                  <View key={g.id} style={[styles.goalCard, !isDark && styles.glassCardLight]}>
                    <View style={styles.goalCardHeader}>
                      <View style={[styles.goalIconContainer, !isDark && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
                        <MaterialIcons name={iconName as any} size={24} color={color} />
                      </View>
                      <CircularProgress percent={percent} size={64} color={color} />
                    </View>

                    <View style={styles.goalCardFooter}>
                      <Text style={[styles.goalName, !isDark && styles.textLight]} numberOfLines={1}>{g.name}</Text>
                      <View style={styles.goalProgressRow}>
                        <View>
                          <Text style={[styles.goalSubLabel, !isDark && styles.textSecondaryLight]}>Current Balance</Text>
                          <Text style={[styles.goalValue, !isDark && styles.textLight]}>{formatAmount(g.current_amount, 0)}</Text>
                        </View>
                        <Text style={[styles.goalTarget, !isDark && styles.textSecondaryLight]}>Target: {formatAmount(g.target_amount, 0)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity 
                style={[
                  styles.addGoalCard, 
                  !isDark && styles.glassCardLight,
                  !isDark && { borderColor: 'rgba(0, 0, 0, 0.12)' }
                ]}
                onPress={() => setModalVisible(true)}
              >
                <View style={[styles.addGoalIconBg, !isDark && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
                  <MaterialIcons name="add" size={28} color="#8e9192" />
                </View>
                <Text style={[styles.addGoalTitle, !isDark && styles.textLight]}>Add New Goal</Text>
                <Text style={[styles.addGoalSub, !isDark && styles.textSecondaryLight]}>Define a new financial milestone</Text>
              </TouchableOpacity>
            </View>

            {/* Aggregate Performance Stats */}
            {goals.length > 0 && (
              <View style={[styles.aggregateCard, !isDark && styles.glassCardLight]}>
                <Text style={[styles.aggTitle, !isDark && styles.textLight]}>Aggregate Performance</Text>
                <View style={styles.aggProgressRow}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${aggregatePercent}%` }]} />
                  </View>
                  <View style={styles.aggLabels}>
                    <Text style={[styles.aggPercent, !isDark && styles.textSecondaryLight]}>Total Progress: {aggregatePercent}%</Text>
                    <Text style={[styles.aggRatio, !isDark && styles.textLight]}>
                      {formatAmount(totalCurrent, 0)} / {formatAmount(totalTarget, 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.aggDetailsRow}>
                  <View style={styles.aggDetailCol}>
                    <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight]}>Monthly Contribution</Text>
                    <Text style={[styles.aggDetailValue, !isDark && styles.textLight]}>{formatAmount(totalContribution, 0)}</Text>
                  </View>
                  <View style={[
                    styles.aggDetailCol, 
                    { borderLeftWidth: 1, borderLeftColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', paddingLeft: 20 }
                  ]}>
                    <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight]}>Projected Completion</Text>
                    <Text style={[styles.aggDetailValue, !isDark && styles.textLight]}>Dec 2026</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        ) : (
          /* DEBTS & LOANS TAB CONTENT */
          <>
            {/* Debts Summary Card */}
            <View style={[styles.aggregateCard, !isDark && styles.glassCardLight, { marginTop: 0, marginBottom: 24 }]}>
              <Text style={[styles.aggTitle, !isDark && styles.textLight]}>Commitments Standing</Text>
              
              <View style={styles.aggDetailsRow}>
                <View style={styles.aggDetailCol}>
                  <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight]}>People Owe You (Lent)</Text>
                  <Text style={[styles.aggDetailValue, { color: '#2ecc71' }]}>+{formatAmount(lentTotal, 0)}</Text>
                </View>
                <View style={[
                  styles.aggDetailCol, 
                  { borderLeftWidth: 1, borderLeftColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', paddingLeft: 20 }
                ]}>
                  <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight]}>You Owe People (Borrowed)</Text>
                  <Text style={[styles.aggDetailValue, { color: '#ff4d4d' }]}>-{formatAmount(borrowedTotal, 0)}</Text>
                </View>
              </View>

              <View style={[
                styles.aggDetailsRow, 
                { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', marginTop: 16, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
              ]}>
                <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight, { marginBottom: 0 }]}>Net Standing</Text>
                <Text style={[styles.aggDetailValue, { fontSize: 18, color: netDebt >= 0 ? '#2ecc71' : '#ff4d4d' }]}>
                  {netDebt >= 0 ? '+' : '-'}{formatAmount(Math.abs(netDebt), 0)}
                </Text>
              </View>
            </View>

            {/* Debts List */}
            <View style={styles.debtList}>
              {debts.length === 0 ? (
                <View style={[styles.emptyStateCard, !isDark && styles.glassCardLight]}>
                  <MaterialIcons name="assignment-late" size={40} color="#8e9192" style={{ marginBottom: 12 }} />
                  <Text style={[styles.emptyStateTitle, !isDark && styles.textLight]}>No Commitments Yet</Text>
                  <Text style={[styles.emptyStateSub, !isDark && styles.textSecondaryLight]}>Log borrowings and lendings to track them here.</Text>
                </View>
              ) : (
                debts.map((item) => {
                  const isLent = item.amount > 0;
                  const absAmt = Math.abs(item.amount);
                  const isPending = item.status === 'pending';

                  let isOverdue = false;
                  if (isPending && item.due_date) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const due = new Date(item.due_date);
                    if (due < today) {
                      isOverdue = true;
                    }
                  }

                  const formattedDueDate = item.due_date
                    ? new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : null;

                  return (
                    <View key={item.id} style={[styles.debtCard, !isDark && styles.glassCardLight]}>
                      <View style={styles.debtCardLeft}>
                        <View style={[
                          styles.debtIconBg,
                          { backgroundColor: isLent ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 77, 77, 0.1)' }
                        ]}>
                          <MaterialIcons
                            name={isLent ? "arrow-upward" : "arrow-downward"}
                            size={20}
                            color={isLent ? "#2ecc71" : "#ff4d4d"}
                          />
                        </View>
                        <View style={styles.debtInfo}>
                          <Text style={[styles.debtPerson, !isDark && styles.textLight]}>{item.person_name}</Text>
                          <Text style={[styles.debtDesc, !isDark && styles.textSecondaryLight]} numberOfLines={1}>
                            {item.description || (isLent ? 'Lent money' : 'Borrowed money')}
                          </Text>
                          {formattedDueDate && (
                            <Text style={[
                              styles.debtDue,
                              isOverdue ? { color: '#ff4d4d', fontWeight: '600' } : (!isDark && styles.textSecondaryLight)
                            ]}>
                              {isOverdue ? 'Overdue: ' : 'Due: '}{formattedDueDate}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.debtCardRight}>
                        <Text style={[
                          styles.debtAmount,
                          { color: isLent ? '#2ecc71' : '#ff4d4d' }
                        ]}>
                          {isLent ? '+' : '-'}{formatAmount(absAmt)}
                        </Text>

                        <View style={styles.debtActions}>
                          {isPending ? (
                            <TouchableOpacity
                              style={[styles.settleBadgeBtn, !isDark && styles.settleBadgeBtnLight]}
                              onPress={() => {
                                setSettlingDl(item);
                                setSettleAccount(accounts.length > 0 ? accounts[0].id : 'none');
                                setSettleModalVisible(true);
                              }}
                            >
                              <Text style={[styles.settleBadgeText, !isDark && styles.settleBadgeTextLight]}>Settle</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.settledBadge}>
                              <MaterialIcons name="check" size={12} color="#8e9192" style={{ marginRight: 2 }} />
                              <Text style={styles.settledBadgeText}>Settled</Text>
                            </View>
                          )}

                          <TouchableOpacity
                            style={styles.debtTrashBtn}
                            onPress={() => handleDeleteDebt(item.id)}
                          >
                            <MaterialIcons name="delete-outline" size={18} color="#8e9192" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}

              {/* Add New Debt commitment row card */}
              <TouchableOpacity
                style={[styles.addDebtRowBtn, !isDark && styles.glassCardLight]}
                onPress={() => setDebtModalVisible(true)}
              >
                <MaterialIcons name="add" size={24} color="#8e9192" style={{ marginRight: 8 }} />
                <Text style={[styles.addDebtRowText, !isDark && styles.textLight]}>Add Commitment</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
              <Text style={[styles.modalTitle, !isDark && styles.textLight]}>New Savings Goal</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? "#ffffff" : "#0A0A0A"} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Goal Name</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="e.g. New Macbook, House Deposit"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                  value={newGoalName}
                  onChangeText={setNewGoalName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Target Amount ({currencySymbol})</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                  keyboardType="numeric"
                  value={newGoalTarget}
                  onChangeText={setNewGoalTarget}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Initial Balance ({currencySymbol})</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                  keyboardType="numeric"
                  value={newGoalCurrent}
                  onChangeText={setNewGoalCurrent}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Monthly Contribution ({currencySymbol})</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                  keyboardType="numeric"
                  value={newGoalContribution}
                  onChangeText={setNewGoalContribution}
                />
              </View>

              <TouchableOpacity style={[styles.submitBtn, !isDark && styles.submitBtnLight]} onPress={handleAddGoal}>
                <Text style={[styles.submitBtnText, !isDark && styles.submitBtnTextLight]}>Create Goal</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Debt & Loan Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={debtModalVisible}
        onRequestClose={() => setDebtModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
              <Text style={[styles.modalTitle, !isDark && styles.textLight]}>New Commitment</Text>
              <TouchableOpacity onPress={() => setDebtModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? "#ffffff" : "#0A0A0A"} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              
              {/* Type toggle selector */}
              <View style={[styles.formatToggle, !isDark && styles.formatToggleLight]}>
                <TouchableOpacity
                  style={[
                    styles.formatBtn,
                    dlType === 'lent' && styles.activeFormatBtn,
                    dlType === 'lent' && !isDark && { backgroundColor: '#0A0A0A' }
                  ]}
                  onPress={() => setDlType('lent')}
                >
                  <Text style={[
                    styles.formatBtnText,
                    dlType === 'lent' && styles.activeFormatBtnText,
                    dlType === 'lent' && !isDark && { color: '#ffffff' }
                  ]}>Lent (They owe me)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.formatBtn,
                    dlType === 'borrowed' && styles.activeFormatBtn,
                    dlType === 'borrowed' && !isDark && { backgroundColor: '#0A0A0A' }
                  ]}
                  onPress={() => setDlType('borrowed')}
                >
                  <Text style={[
                    styles.formatBtnText,
                    dlType === 'borrowed' && styles.activeFormatBtnText,
                    dlType === 'borrowed' && !isDark && { color: '#ffffff' }
                  ]}>Borrowed (I owe them)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Person&apos;s Name</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="e.g. John Doe, Sarah Smith"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                  value={dlName}
                  onChangeText={setDlName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Amount ({currencySymbol})</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                  keyboardType="numeric"
                  value={dlAmount}
                  onChangeText={setDlAmount}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Description / Note</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="e.g. Dinner share, Car rental"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                  value={dlDesc}
                  onChangeText={setDlDesc}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Due Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="e.g. 2026-07-20"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                  value={dlDueDate}
                  onChangeText={setDlDueDate}
                />
              </View>

              {/* Apply to Account switch */}
              {accounts.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight, { marginBottom: 0 }]}>Apply to Account Balance?</Text>
                    <Switch
                      value={dlApplyAccount}
                      onValueChange={setDlApplyAccount}
                      trackColor={{ false: '#767577', true: '#2ecc71' }}
                      thumbColor={Platform.OS === 'ios' ? '#ffffff' : (dlApplyAccount ? '#ffffff' : '#f4f3f4')}
                    />
                  </View>
                  
                  {dlApplyAccount && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {accounts.map((acc) => {
                        const isSelected = dlSelectedAccount === acc.id;
                        return (
                          <TouchableOpacity
                            key={acc.id}
                            style={[
                              styles.accountOption,
                              !isDark && styles.accountOptionLight,
                              isSelected && styles.activeAccountOption,
                              isSelected && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                            ]}
                            onPress={() => setDlSelectedAccount(acc.id)}
                          >
                            <Text style={[
                              styles.accountOptionText,
                              !isDark && styles.textSecondaryLight,
                              isSelected && styles.activeAccountOptionText,
                              isSelected && !isDark && { color: '#ffffff' }
                            ]}>
                              {acc.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}

              <TouchableOpacity style={[styles.submitBtn, !isDark && styles.submitBtnLight]} onPress={handleAddDebt}>
                <Text style={[styles.submitBtnText, !isDark && styles.submitBtnTextLight]}>Save Commitment</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settle Debt Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settleModalVisible}
        onRequestClose={() => {
          setSettleModalVisible(false);
          setSettlingDl(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
              <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Settle Commitment</Text>
              <TouchableOpacity onPress={() => {
                setSettleModalVisible(false);
                setSettlingDl(null);
              }}>
                <MaterialIcons name="close" size={24} color={isDark ? "#ffffff" : "#0A0A0A"} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={[styles.settleIntroText, !isDark && styles.textLight]}>
                You are settling the commitment with <Text style={{ fontWeight: 'bold' }}>{settlingDl?.person_name}</Text> of{' '}
                <Text style={{ fontWeight: 'bold', color: settlingDl && settlingDl.amount > 0 ? '#2ecc71' : '#ff4d4d' }}>
                  {settlingDl ? formatAmount(Math.abs(settlingDl.amount)) : ''}
                </Text>.
              </Text>

              <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight, { marginTop: 12 }]}>
                Record repayment transaction in:
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>
                <TouchableOpacity
                  style={[
                    styles.accountOption,
                    !isDark && styles.accountOptionLight,
                    settleAccount === 'none' && styles.activeAccountOption,
                    settleAccount === 'none' && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                  ]}
                  onPress={() => setSettleAccount('none')}
                >
                  <Text style={[
                    styles.accountOptionText,
                    !isDark && styles.textSecondaryLight,
                    settleAccount === 'none' && styles.activeAccountOptionText,
                    settleAccount === 'none' && !isDark && { color: '#ffffff' }
                  ]}>
                    None (Mark Settled Only)
                  </Text>
                </TouchableOpacity>

                {accounts.map((acc) => {
                  const isSelected = settleAccount === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        styles.accountOption,
                        !isDark && styles.accountOptionLight,
                        isSelected && styles.activeAccountOption,
                        isSelected && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                      ]}
                      onPress={() => setSettleAccount(acc.id)}
                    >
                      <Text style={[
                        styles.accountOptionText,
                        !isDark && styles.textSecondaryLight,
                        isSelected && styles.activeAccountOptionText,
                        isSelected && !isDark && { color: '#ffffff' }
                      ]}>
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity style={[styles.submitBtn, !isDark && styles.submitBtnLight]} onPress={handleConfirmSettle}>
                <Text style={[styles.submitBtnText, !isDark && styles.submitBtnTextLight]}>Confirm Settlement</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    marginTop: 4,
    lineHeight: 18,
  },
  tabToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 24,
  },
  tabToggleContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  tabToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  activeTabToggleBtn: {
    backgroundColor: '#ffffff',
  },
  tabToggleText: {
    color: '#8e9192',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabToggleText: {
    color: '#0A0A0A',
  },
  aiGlowCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(166, 200, 255, 0.15)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  aiGlowCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(32, 138, 239, 0.15)',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(166, 200, 255, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
    marginBottom: 12,
  },
  aiTagLight: {
    backgroundColor: 'rgba(32, 138, 239, 0.08)',
  },
  aiTagText: {
    fontSize: 10,
    color: '#a6c8ff',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiTagTextLight: {
    color: '#208aef',
  },
  aiCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6,
  },
  aiTitleLight: {
    color: '#0A0A0A',
  },
  aiDesc: {
    fontSize: 13,
    color: '#8e9192',
    lineHeight: 18,
  },
  aiDescLight: {
    color: '#60646C',
  },
  aiMediaPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiMediaPlaceholderLight: {
    backgroundColor: 'rgba(32, 138, 239, 0.05)',
  },
  aiActionBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  aiActionBtnLight: {
    backgroundColor: '#208aef',
  },
  aiActionBtnText: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '700',
  },
  aiActionBtnTextLight: {
    color: '#ffffff',
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  goalCard: {
    width: (width - 52) / 2,
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'space-between',
    minHeight: 190,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  goalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svgRotate: {
    transform: [{ rotate: '-90deg' }],
  },
  progressText: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '700',
  },
  goalCardFooter: {
    marginTop: 14,
  },
  goalName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6,
  },
  goalProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  goalSubLabel: {
    fontSize: 10,
    color: '#8e9192',
    marginBottom: 2,
  },
  goalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  goalTarget: {
    fontSize: 10,
    color: '#8e9192',
    marginBottom: 2,
  },
  addGoalCard: {
    width: (width - 52) / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 6,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 190,
  },
  addGoalIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  addGoalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  addGoalSub: {
    fontSize: 11,
    color: '#8e9192',
    textAlign: 'center',
  },
  aggregateCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 12,
  },
  aggTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#8e9192',
    marginBottom: 14,
  },
  aggProgressRow: {
    marginBottom: 20,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },
  aggLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aggPercent: {
    fontSize: 12,
    color: '#8e9192',
    fontWeight: '500',
  },
  aggRatio: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  aggDetailsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
  },
  aggDetailCol: {
    flex: 1,
  },
  aggDetailLabel: {
    fontSize: 11,
    color: '#8e9192',
    marginBottom: 4,
  },
  aggDetailValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  debtList: {
    gap: 12,
  },
  emptyStateCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#8e9192',
    textAlign: 'center',
  },
  debtCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  debtCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  debtIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  debtInfo: {
    flex: 1,
  },
  debtPerson: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  debtDesc: {
    fontSize: 12,
    color: '#8e9192',
    marginBottom: 2,
  },
  debtDue: {
    fontSize: 10,
    color: '#ffb4ab',
  },
  debtCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  debtAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  debtActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settleBadgeBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  settleBadgeBtnLight: {
    backgroundColor: '#0a0a0a',
  },
  settleBadgeText: {
    color: '#0A0A0A',
    fontSize: 10,
    fontWeight: '700',
  },
  settleBadgeTextLight: {
    color: '#ffffff',
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  settledBadgeText: {
    color: '#8e9192',
    fontSize: 10,
    fontWeight: '500',
  },
  debtTrashBtn: {
    padding: 4,
  },
  addDebtRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.3)',
    borderRadius: 16,
    height: 52,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  addDebtRowText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#131315',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  formContainer: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: '#8e9192',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  textInputLight: {
    backgroundColor: '#F2F2F7',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    color: '#0A0A0A',
  },
  submitBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  submitBtnLight: {
    backgroundColor: '#0A0A0A',
    shadowColor: '#000000',
  },
  submitBtnText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtnTextLight: {
    color: '#ffffff',
  },
  fieldLabel: {
    fontSize: 11,
    color: '#8e9192',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  accountOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  accountOptionLight: {
    backgroundColor: '#f2f2f7',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  activeAccountOption: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  accountOptionText: {
    color: '#8e9192',
    fontSize: 12,
    fontWeight: '500',
  },
  activeAccountOptionText: {
    color: '#0A0A0A',
    fontWeight: '600',
  },
  formatToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  formatToggleLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  formatBtn: {
    flex: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  activeFormatBtn: {
    backgroundColor: '#ffffff',
  },
  formatBtnText: {
    color: '#8e9192',
    fontSize: 12,
    fontWeight: '600',
  },
  activeFormatBtnText: {
    color: '#0A0A0A',
  },
  settleIntroText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
    marginBottom: 16,
  }
});
