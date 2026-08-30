import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { CustomInput } from '@/components/ui/custom-input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TransactionFormModal } from '@/components/forms/transaction-form-modal';
import { transactionService } from '@/services/transactions';
import { categoryService } from '@/services/categories';
import {
  TransactionResponse,
  CategoryResponse,
  TransactionType,
} from '@/services/types';
import { useTheme } from '@/services/theme-context';
import { useCurrency } from '@/services/currency';
import { hapticImpactMedium, hapticNotificationSuccess, hapticLight } from '@/services/haptics';

export default function HistoryScreen() {
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();

  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<TransactionResponse | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      const typeParam = typeFilter === 'all' ? undefined : (typeFilter as TransactionType);
      const res = await transactionService.listTransactions({
        search: search.trim() || undefined,
        type: typeParam,
        category: selectedCategoryId || undefined,
        limit: 50,
      });
      setTransactions(res.items);
    } catch (err) {
      console.log('Error fetching transactions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, typeFilter, selectedCategoryId]);

  useEffect(() => {
    categoryService.listCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    hapticImpactMedium();
    loadTransactions();
  };

  const handleDeleteTransaction = (txn: TransactionResponse) => {
    hapticImpactMedium();
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete transaction "${txn.title}"?`)) {
        transactionService.deleteTransaction(txn.id).then(() => {
          hapticNotificationSuccess();
          loadTransactions();
        });
      }
    } else {
      Alert.alert(
        'Delete Transaction',
        `Are you sure you want to delete "${txn.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await transactionService.deleteTransaction(txn.id);
              hapticNotificationSuccess();
              loadTransactions();
            },
          },
        ]
      );
    }
  };

  const renderItem = ({ item }: { item: TransactionResponse }) => {
    const isIncome = item.type === 'income';
    return (
      <GlassCard
        style={styles.txnCard}
        onPress={() => {
          setSelectedTxn(item);
          setShowAddModal(true);
        }}
      >
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isIncome
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              },
            ]}
          >
            <Ionicons
              name={isIncome ? 'arrow-down' : 'arrow-up'}
              size={20}
              color={isIncome ? '#10B981' : '#EF4444'}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={[
                styles.itemTitle,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.itemCategory,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {item.category_name || 'General'}
              {item.account_name ? ` • 🏦 ${item.account_name}` : ''}
              {item.credit_card_name ? ` • 💳 ${item.credit_card_name}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text
            style={[
              styles.itemAmount,
              { color: isIncome ? '#10B981' : '#EF4444' },
            ]}
          >
            {isIncome ? '+' : '-'}
            {formatAmount(item.amount)}
          </Text>
          <Text
            style={[
              styles.itemDate,
              { color: isDark ? '#64748B' : '#94A3B8' },
            ]}
          >
            {new Date(item.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => handleDeleteTransaction(item)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </GlassCard>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#08080C' : '#F6F6F9' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Transactions
        </Text>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            setSelectedTxn(null);
            setShowAddModal(true);
          }}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <CustomInput
          placeholder="Search transactions..."
          value={search}
          onChangeText={setSearch}
          leftIcon="search-outline"
          containerStyle={{ marginBottom: 10 }}
        />

        <SegmentedControl
          options={[
            { label: 'All', value: 'all' },
            { label: 'Expenses', value: 'expense' },
            { label: 'Income', value: 'income' },
          ]}
          value={typeFilter}
          onChange={(val) => setTypeFilter(val as any)}
          style={{ marginBottom: 10 }}
        />

        {categories.length > 0 && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: 'all', name: 'All Categories' } as any, ...categories]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.categoryChips}
            renderItem={({ item }) => {
              const isSelected =
                (item.id === 'all' && selectedCategoryId === null) ||
                selectedCategoryId === item.id;
              return (
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setSelectedCategoryId(item.id === 'all' ? null : item.id);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected
                        ? '#2563EB'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#E2E8F0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : isDark
                          ? '#CBD5E1'
                          : '#475569',
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* Transactions List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? '#3B82F6' : '#2563EB'}
            />
          }
          ListEmptyComponent={
            <GlassCard style={styles.emptyCard}>
              <Ionicons
                name="search-outline"
                size={40}
                color={isDark ? '#64748B' : '#94A3B8'}
              />
              <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                No Transactions Found
              </Text>
              <Text style={[styles.emptySub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Try adjusting your search filters or add a new transaction.
              </Text>
            </GlassCard>
          }
        />
      )}

      {/* Transaction Modal */}
      <TransactionFormModal
        visible={showAddModal}
        transactionToEdit={selectedTxn}
        onClose={() => {
          setShowAddModal(false);
          setSelectedTxn(null);
        }}
        onSuccess={() => {
          loadTransactions();
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
    marginBottom: 12,
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
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  categoryChips: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  filterChipText: {
    fontSize: 12,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 8,
  },
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginHorizontal: 8,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  itemDate: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 8,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginTop: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
