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
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getCategoryBudgetUtilization,
  upsertBudget,
  deleteBudget,
  getBudgets,
  Budget,
  useDatabaseSubscription,
} from '@/services/db';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';
import { GlassCard } from '@/components/ui/glass-card';

interface BudgetsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BudgetsModal({ visible, onClose }: BudgetsModalProps) {
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [budgetsData, setBudgetsData] = useState<{ category: string; spent: number; limit: number; id?: string }[]>([]);
  const [editingBudget, setEditingBudget] = useState<{ id?: string; category: string; limit: string } | null>(null);
  const [formModalVisible, setFormModalVisible] = useState(false);

  const predefinedCategories = [
    'Food',
    'Transport',
    'Shopping',
    'Utilities',
    'Entertainment',
    'Health',
    'Travel',
    'Bills',
    'Education',
    'Other',
  ];

  const loadData = async () => {
    try {
      setLoading(true);
      const utilization = await getCategoryBudgetUtilization();
      const rawBudgets = await getBudgets();

      const combined = utilization.map((item) => {
        const raw = rawBudgets.find((b) => b.category.toLowerCase() === item.category.toLowerCase());
        return {
          ...item,
          id: raw?.id,
        };
      });

      setBudgetsData(combined);
    } catch (err) {
      console.error('Failed to load budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  useDatabaseSubscription(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const handleOpenAdd = () => {
    setEditingBudget({ category: '', limit: '' });
    setFormModalVisible(true);
  };

  const handleOpenEdit = (item: { id?: string; category: string; limit: number }) => {
    setEditingBudget({
      id: item.id,
      category: item.category,
      limit: item.limit.toString(),
    });
    setFormModalVisible(true);
  };

  const handleSaveBudget = async () => {
    if (!editingBudget) return;

    const cat = editingBudget.category.trim();
    const limitNum = parseFloat(editingBudget.limit);

    if (!cat) {
      Alert.alert('Error', 'Please enter or select a category name.');
      return;
    }

    if (isNaN(limitNum) || limitNum <= 0) {
      Alert.alert('Error', 'Please enter a valid monthly limit amount.');
      return;
    }

    try {
      await upsertBudget(cat, limitNum);
      setFormModalVisible(false);
      setEditingBudget(null);
      await loadData();
    } catch (err) {
      console.error('Error saving budget:', err);
      Alert.alert('Error', 'Failed to save budget.');
    }
  };

  const handleDeleteBudget = (id?: string, category?: string) => {
    if (!id) return;
    Alert.alert('Delete Budget', `Are you sure you want to delete the budget for "${category}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBudget(id);
            await loadData();
          } catch (err) {
            console.error('Error deleting budget:', err);
          }
        },
      },
    ]);
  };

  // Compute overall budget summary
  const totalLimit = budgetsData.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = budgetsData.reduce((sum, b) => sum + b.spent, 0);
  const totalPercent = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('food') || name.includes('dining')) return 'restaurant';
    if (name.includes('transport') || name.includes('cab')) return 'directions-car';
    if (name.includes('shop')) return 'shopping-bag';
    if (name.includes('util') || name.includes('bill')) return 'receipt';
    if (name.includes('enter') || name.includes('movie')) return 'movie';
    if (name.includes('health') || name.includes('med')) return 'medical-services';
    if (name.includes('travel')) return 'flight';
    if (name.includes('edu')) return 'school';
    return 'pie-chart';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, !isDark && styles.containerLight]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#fff' : '#0f172a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, !isDark && styles.textLight]}>Category Budgets</Text>
          <TouchableOpacity onPress={handleOpenAdd} style={styles.addBtnHeader}>
            <MaterialIcons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Overview Summary Card */}
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>Total Monthly Budget</Text>
                  <Text style={styles.summaryAmount}>{formatAmount(totalLimit)}</Text>
                </View>
                <View style={styles.percentBadgeContainer}>
                  <Text
                    style={[
                      styles.percentBadgeText,
                      totalPercent > 95
                        ? styles.textRed
                        : totalPercent > 75
                        ? styles.textYellow
                        : styles.textGreen,
                    ]}
                  >
                    {totalPercent}% Used
                  </Text>
                </View>
              </View>

              <View style={styles.summaryDetailsRow}>
                <Text style={styles.summarySubtext}>
                  Spent: <Text style={{ color: '#ef4444', fontWeight: '700' }}>{formatAmount(totalSpent)}</Text>
                </Text>
                <Text style={styles.summarySubtext}>
                  Remaining:{' '}
                  <Text
                    style={{
                      color: totalLimit - totalSpent >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: '700',
                    }}
                  >
                    {formatAmount(totalLimit - totalSpent)}
                  </Text>
                </Text>
              </View>

              {/* Overall Progress Bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, totalPercent)}%`,
                      backgroundColor:
                        totalPercent > 95
                          ? '#ef4444'
                          : totalPercent > 75
                          ? '#f59e0b'
                          : '#10b981',
                    },
                  ]}
                />
              </View>
            </GlassCard>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>Active Budgets</Text>
              <TouchableOpacity onPress={handleOpenAdd}>
                <Text style={styles.addCategoryText}>+ Add Budget</Text>
              </TouchableOpacity>
            </View>

            {budgetsData.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="account-balance-wallet" size={48} color={isDark ? '#475569' : '#94a3b8'} />
                <Text style={[styles.emptyStateText, !isDark && styles.textSecondaryLight]}>
                  No category budgets set up yet.
                </Text>
                <TouchableOpacity style={styles.createBudgetBtn} onPress={handleOpenAdd}>
                  <Text style={styles.createBudgetBtnText}>Set First Budget</Text>
                </TouchableOpacity>
              </View>
            ) : (
              budgetsData.map((item) => {
                const percent = item.limit > 0 ? Math.round((item.spent / item.limit) * 100) : 0;
                const statusColor = percent > 95 ? '#ef4444' : percent > 75 ? '#f59e0b' : '#10b981';

                return (
                  <GlassCard key={item.category} style={styles.budgetItemCard}>
                    <View style={styles.budgetHeaderRow}>
                      <View style={styles.categoryTitleGroup}>
                        <View style={[styles.categoryIconBg, { backgroundColor: statusColor + '20' }]}>
                          <MaterialIcons name={getCategoryIcon(item.category) as any} size={20} color={statusColor} />
                        </View>
                        <View>
                          <Text style={[styles.budgetNameText, !isDark && styles.textLight]}>{item.category}</Text>
                          <Text style={styles.budgetSpentText}>
                            {formatAmount(item.spent)} of {formatAmount(item.limit)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.actionGroup}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => handleOpenEdit(item)}>
                          <MaterialIcons name="edit" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteBudget(item.id, item.category)}>
                          <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, percent)}%`,
                            backgroundColor: statusColor,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.budgetFooterRow}>
                      <Text style={[styles.percentLabelText, { color: statusColor }]}>
                        {percent}% {percent >= 100 ? 'Limit Exceeded!' : percent > 75 ? 'Near Limit' : 'On Track'}
                      </Text>
                      <Text style={styles.remainingText}>
                        {item.limit - item.spent >= 0
                          ? `${formatAmount(item.limit - item.spent)} left`
                          : `${formatAmount(Math.abs(item.limit - item.spent))} over`}
                      </Text>
                    </View>
                  </GlassCard>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Add/Edit Budget Form Modal */}
        <Modal visible={formModalVisible} animationType="fade" transparent onRequestClose={() => setFormModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.formContainer, !isDark && styles.formContainerLight]}>
              <View style={styles.formHeader}>
                <Text style={[styles.formTitle, !isDark && styles.textLight]}>
                  {editingBudget?.id ? 'Edit Budget' : 'Set Category Budget'}
                </Text>
                <TouchableOpacity onPress={() => setFormModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, !isDark && styles.textLight]}>Category Name</Text>
              <TextInput
                style={[styles.textInput, !isDark && styles.textInputLight]}
                value={editingBudget?.category || ''}
                onChangeText={(text) => setEditingBudget((prev) => (prev ? { ...prev, category: text } : null))}
                placeholder="e.g. Food, Transport, Rent"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                editable={!editingBudget?.id} // Don't edit existing category name key
              />

              {/* Category Quick Select Chips */}
              {!editingBudget?.id && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                  {predefinedCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.chip,
                        editingBudget?.category === cat && styles.chipActive,
                        !isDark && styles.chipLight,
                      ]}
                      onPress={() => setEditingBudget((prev) => (prev ? { ...prev, category: cat } : null))}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          editingBudget?.category === cat && styles.chipTextActive,
                          !isDark && styles.textLight,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={[styles.fieldLabel, !isDark && styles.textLight, { marginTop: 16 }]}>Monthly Limit ($)</Text>
              <TextInput
                style={[styles.textInput, !isDark && styles.textInputLight]}
                value={editingBudget?.limit || ''}
                onChangeText={(text) => setEditingBudget((prev) => (prev ? { ...prev, limit: text } : null))}
                placeholder="e.g. 500"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                keyboardType="numeric"
              />

              <View style={styles.formActionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setFormModalVisible(false)}>
                  <Text style={[styles.cancelBtnText, !isDark && styles.textLight]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBudget}>
                  <Text style={styles.saveBtnText}>Save Budget</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  containerLight: {
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeBtn: {
    padding: 6,
  },
  addBtnHeader: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    padding: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
  percentBadgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  percentBadgeText: {
    fontWeight: '700',
    fontSize: 14,
  },
  summaryDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  summarySubtext: {
    fontSize: 14,
    color: '#94a3b8',
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  addCategoryText: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 12,
  },
  createBudgetBtn: {
    marginTop: 16,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createBudgetBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  budgetItemCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  budgetSpentText: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  budgetFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  percentLabelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  remainingText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  formContainerLight: {
    backgroundColor: '#ffffff',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  textInputLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  chipContainer: {
    flexDirection: 'row',
    marginTop: 10,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  chipLight: {
    backgroundColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#3b82f6',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  formActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  textLight: {
    color: '#0f172a',
  },
  textSecondaryLight: {
    color: '#64748b',
  },
  textRed: {
    color: '#ef4444',
  },
  textYellow: {
    color: '#f59e0b',
  },
  textGreen: {
    color: '#10b981',
  },
});
