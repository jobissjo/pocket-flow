import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getDatabase, Account, Subscription, getSubscriptions, addSubscription, deleteSubscription, pauseSubscription } from '@/services/db';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';
import { GlassCard } from '@/components/ui/glass-card';

interface SubscriptionsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SubscriptionsModal({ visible, onClose }: SubscriptionsModalProps) {
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Form State
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subCategory, setSubCategory] = useState('Entertainment');
  const [subCycle, setSubCycle] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [subNextDate, setSubNextDate] = useState('');
  const [subAccount, setSubAccount] = useState('');

  const categories = ['Entertainment', 'Utilities', 'Rent', 'Gym', 'Insurance', 'Other'];

  const loadData = async () => {
    try {
      setLoading(true);
      const subList = await getSubscriptions();
      setSubs(subList);

      const db = await getDatabase();
      const accList = await db.getAllAsync<Account>('SELECT * FROM accounts');
      setAccounts(accList);
      if (accList.length > 0) {
        setSubAccount(accList[0].id);
      }
    } catch (e) {
      console.error('Failed to load subscriptions data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [visible]);

  const handleSaveSubscription = async () => {
    if (!subName.trim() || !subAmount.trim() || !subNextDate.trim()) {
      Alert.alert('Required Fields', 'Please fill in the Name, Amount, and Next Billing Date fields.');
      return;
    }

    // Basic date format validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(subNextDate)) {
      Alert.alert('Invalid Date', 'Date must be in YYYY-MM-DD format.');
      return;
    }

    try {
      const amt = parseFloat(subAmount);
      await addSubscription(subName, amt, subCategory, subCycle, subNextDate, subAccount);

      // Reset form
      setSubName('');
      setSubAmount('');
      setSubCategory('Entertainment');
      setSubCycle('monthly');
      setSubNextDate('');
      setAddModalVisible(false);

      loadData();
    } catch (error) {
      console.error('Error saving subscription:', error);
      Alert.alert('Error', 'Failed to save subscription details.');
    }
  };

  const handleToggleStatus = async (item: Subscription, val: boolean) => {
    try {
      const newStatus = val ? 'active' : 'paused';
      await pauseSubscription(item.id, newStatus);
      loadData();
    } catch (error) {
      console.error('Error toggling subscription status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Remove Subscription',
      'Are you sure you want to stop tracking this subscription? Paid history remains in transactions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSubscription(id);
              loadData();
            } catch (error) {
              console.error('Error deleting sub:', error);
            }
          }
        }
      ]
    );
  };

  // Compute stats
  const activeSubs = subs.filter((s) => s.status === 'active');
  const monthlyCost = activeSubs.reduce((sum, s) => {
    let monthlyEquivalent = s.amount;
    if (s.billing_cycle === 'weekly') {
      monthlyEquivalent = s.amount * 4.33; // 52 weeks / 12 months
    } else if (s.billing_cycle === 'yearly') {
      monthlyEquivalent = s.amount / 12;
    }
    return sum + monthlyEquivalent;
  }, 0);

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'entertainment':
        return 'tv';
      case 'utilities':
        return 'power';
      case 'rent':
        return 'home';
      case 'gym':
        return 'fitness-center';
      case 'insurance':
        return 'shield';
      default:
        return 'card-membership';
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
            <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Recurring Bills</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={isDark ? '#ffffff' : '#0A0A0A'} style={{ marginVertical: 60 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              
              {/* Aggregated Cost Card */}
              <GlassCard style={[styles.aggregateCard, { marginTop: 0, marginBottom: 24 }]}>
                <Text style={[styles.aggTitle, !isDark && styles.textLight]}>Recurring Expenses Summary</Text>
                <View style={styles.aggDetailsRow}>
                  <View style={styles.aggDetailCol}>
                    <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight]}>Monthly Cost</Text>
                    <Text style={[styles.aggDetailValue, !isDark && styles.textLight]}>{formatAmount(monthlyCost, 0)}<Text style={{ fontSize: 13, fontWeight: 'normal', color: '#8e9192' }}>/mo</Text></Text>
                  </View>
                  <View style={[
                    styles.aggDetailCol,
                    { borderLeftWidth: 1, borderLeftColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', paddingLeft: 20 }
                  ]}>
                    <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight]}>Yearly Cost</Text>
                    <Text style={[styles.aggDetailValue, !isDark && styles.textLight]}>{formatAmount(monthlyCost * 12, 0)}<Text style={{ fontSize: 13, fontWeight: 'normal', color: '#8e9192' }}>/yr</Text></Text>
                  </View>
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', marginTop: 16, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight, { marginBottom: 0 }]}>Active Bills</Text>
                  <Text style={[styles.aggDetailValue, { fontSize: 16, color: '#a6c8ff' }]}>
                    {activeSubs.length} Active
                  </Text>
                </View>
              </GlassCard>

              {/* Subscriptions List */}
              <View style={styles.subList}>
                {subs.length === 0 ? (
                  <GlassCard style={styles.emptyStateCard}>
                    <MaterialIcons name="card-membership" size={40} color="#8e9192" style={{ marginBottom: 12 }} />
                    <Text style={[styles.emptyStateTitle, !isDark && styles.textLight]}>No Recurring Bills</Text>
                    <Text style={[styles.emptyStateSub, !isDark && styles.textSecondaryLight]}>Add bills or subscriptions to track upcoming expenses.</Text>
                  </GlassCard>
                ) : (
                  subs.map((item) => {
                    const cycleLabel = item.billing_cycle.charAt(0).toUpperCase() + item.billing_cycle.slice(1);
                    const isPaused = item.status === 'paused';
                    const matchedAcc = accounts.find((a) => a.id === item.account_id);
                    const accName = matchedAcc ? matchedAcc.name : 'Wallet';

                    const formattedNextDate = new Date(item.next_billing_date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });

                    return (
                      <GlassCard
                        key={item.id}
                        style={[
                          styles.subCard,
                          isPaused && { opacity: 0.6 }
                        ]}
                      >
                        <View style={styles.subCardLeft}>
                          <View style={[
                            styles.subIconBg,
                            !isDark && { backgroundColor: 'rgba(0,0,0,0.04)' }
                          ]}>
                            <MaterialIcons
                              name={getCategoryIcon(item.category)}
                              size={20}
                              color={isDark ? '#a6c8ff' : '#208aef'}
                            />
                          </View>
                          <View style={styles.subInfo}>
                            <Text style={[styles.subNameText, !isDark && styles.textLight]}>{item.name}</Text>
                            <Text style={[styles.subDescText, !isDark && styles.textSecondaryLight]}>
                              {cycleLabel} &bull; {accName}
                            </Text>
                            <Text style={[styles.subDateText, !isDark && styles.textSecondaryLight]}>
                              Next: {formattedNextDate}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.subCardRight}>
                          <Text style={[styles.subAmountText, !isDark && styles.textLight]}>
                            {formatAmount(item.amount)}
                            <Text style={{ fontSize: 10, color: '#8e9192', fontWeight: 'normal' }}>
                              /{item.billing_cycle === 'weekly' ? 'wk' : item.billing_cycle === 'yearly' ? 'yr' : 'mo'}
                            </Text>
                          </Text>

                          <View style={styles.subActions}>
                            <Switch
                              value={item.status === 'active'}
                              onValueChange={(val) => handleToggleStatus(item, val)}
                              trackColor={{ false: '#767577', true: '#2ecc71' }}
                              thumbColor={Platform.OS === 'ios' ? '#ffffff' : (item.status === 'active' ? '#ffffff' : '#f4f3f4')}
                            />
                            <TouchableOpacity style={styles.subDeleteBtn} onPress={() => handleDelete(item.id)}>
                              <MaterialIcons name="delete-outline" size={18} color="#8e9192" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </GlassCard>
                    );
                  })
                )}

                {/* Add New Subscription trigger card */}
                <GlassCard
                  style={styles.addSubBtnCard}
                  onPress={() => setAddModalVisible(true)}
                >
                  <MaterialIcons name="add" size={24} color="#8e9192" style={{ marginRight: 8 }} />
                  <Text style={[styles.addSubBtnText, !isDark && styles.textLight]}>Add Subscription</Text>
                </GlassCard>
              </View>

            </ScrollView>
          )}
        </View>
      </View>

      {/* Add Subscription Form Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
              <Text style={[styles.modalTitle, !isDark && styles.textLight]}>New Subscription</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Subscription Name</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="e.g. Netflix, Rent, Electricity"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                  value={subName}
                  onChangeText={setSubName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Amount</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                  keyboardType="numeric"
                  value={subAmount}
                  onChangeText={setSubAmount}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Billing Cycle</Text>
                <View style={[styles.formatToggle, !isDark && styles.formatToggleLight]}>
                  {(['weekly', 'monthly', 'yearly'] as const).map((cycle) => {
                    const isSel = subCycle === cycle;
                    return (
                      <TouchableOpacity
                        key={cycle}
                        style={[
                          styles.formatBtn,
                          isSel && styles.activeFormatBtn,
                          isSel && !isDark && { backgroundColor: '#0A0A0A' }
                        ]}
                        onPress={() => setSubCycle(cycle)}
                      >
                        <Text style={[
                          styles.formatBtnText,
                          isSel && styles.activeFormatBtnText,
                          isSel && !isDark && { color: '#ffffff' }
                        ]}>
                          {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Next Billing Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.textInput, !isDark && styles.textInputLight]}
                  placeholder="e.g. 2026-07-15"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                  value={subNextDate}
                  onChangeText={setSubNextDate}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {categories.map((cat) => {
                    const isSel = subCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.accountOption,
                          !isDark && styles.accountOptionLight,
                          isSel && styles.activeAccountOption,
                          isSel && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                        ]}
                        onPress={() => setSubCategory(cat)}
                      >
                        <Text style={[
                          styles.accountOptionText,
                          !isDark && styles.textSecondaryLight,
                          isSel && styles.activeAccountOptionText,
                          isSel && !isDark && { color: '#ffffff' }
                        ]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {accounts.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Pay From Account</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {accounts.map((acc) => {
                      const isSel = subAccount === acc.id;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={[
                            styles.accountOption,
                            !isDark && styles.accountOptionLight,
                            isSel && styles.activeAccountOption,
                            isSel && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                          ]}
                          onPress={() => setSubAccount(acc.id)}
                        >
                          <Text style={[
                            styles.accountOptionText,
                            !isDark && styles.textSecondaryLight,
                            isSel && styles.activeAccountOptionText,
                            isSel && !isDark && { color: '#ffffff' }
                          ]}>
                            {acc.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity style={[styles.submitBtn, !isDark && styles.submitBtnLight]} onPress={handleSaveSubscription}>
                <Text style={[styles.submitBtnText, !isDark && styles.submitBtnTextLight]}>Start Tracking</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.05)',
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
  textLight: {
    color: '#0A0A0A',
  },
  textSecondaryLight: {
    color: '#60646C',
  },
  scrollContent: {
    padding: 24,
  },
  aggregateCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  aggTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#8e9192',
    marginBottom: 14,
  },
  aggDetailsRow: {
    flexDirection: 'row',
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
  glassCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  subList: {
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
  subCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  subCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subInfo: {
    flex: 1,
  },
  subNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  subDescText: {
    fontSize: 12,
    color: '#8e9192',
    marginBottom: 2,
  },
  subDateText: {
    fontSize: 10,
    color: '#8e9192',
  },
  subCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  subAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  subActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subDeleteBtn: {
    padding: 4,
  },
  addSubBtnCard: {
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
  addSubBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
    borderColor: 'rgba(0,0,0,0.05)',
    color: '#0A0A0A',
  },
  formatToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
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
  }
});
