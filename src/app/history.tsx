import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput,
  TouchableOpacity, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { getDatabase, Transaction } from '@/services/db';
import AddTransactionModal from '@/components/add-transaction-modal';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';
import { GlassCard } from '@/components/ui/glass-card';

export default function HistoryScreen() {
  const isFocused = useIsFocused();
  const { formatAmount } = useCurrency();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  
  // Modal visibility state
  const [addTxVisible, setAddTxVisible] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // List of unique categories for filters
  const categories = ['Food', 'Transport', 'Shopping', 'Grocery', 'Housing', 'Salary', 'Transfer', 'Services', 'Electronics', 'Digital', 'Dining'];

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      let query = 'SELECT * FROM transactions WHERE 1=1';
      const params: any[] = [];

      if (searchQuery.trim()) {
        query += ' AND (category LIKE ? OR note LIKE ?)';
        const queryTerm = `%${searchQuery.trim()}%`;
        params.push(queryTerm, queryTerm);
      }

      if (activeFilter !== 'all') {
        query += ' AND type = ?';
        params.push(activeFilter);
      }

      if (selectedCategory) {
        query += ' AND category = ?';
        params.push(selectedCategory);
      }

      query += ' ORDER BY date DESC';

      const rows = await db.getAllAsync<Transaction>(query, params);
      setTransactions(rows);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, searchQuery, activeFilter, selectedCategory]);

  // Helper to group transactions by relative dates
  const getGroupedTransactions = () => {
    const groups: Record<string, Transaction[]> = {};
    const todayStr = new Date().toDateString();
    // eslint-disable-next-line react-hooks/purity
    const yesterdayStr = new Date(Date.now() - 86400000).toDateString();

    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const txDateStr = txDate.toDateString();
      let key = 'Older';

      if (txDateStr === todayStr) {
        key = 'Today';
      } else if (txDateStr === yesterdayStr) {
        key = 'Yesterday';
      } else {
        key = txDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(tx);
    });

    return groups;
  };

  const grouped = getGroupedTransactions();
  const groupKeys = Object.keys(grouped);

  // Calculate sum for group
  const getGroupTotal = (txs: Transaction[]) => {
    let sum = 0;
    txs.forEach(t => {
      if (t.type === 'expense') {
        sum += Math.abs(t.amount);
      }
    });
    return sum;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={[styles.searchHeader, !isDark && styles.searchHeaderLight]}>
        <View style={[styles.searchBar, !isDark && styles.searchBarLight]}>
          <MaterialIcons name="search" size={20} color="#8e9192" style={styles.searchIcon} />
          <TextInput
            placeholder="Search transactions..."
            placeholderTextColor="#8e9192"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, !isDark && styles.searchInputLight]}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter Chips Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity 
            style={[
              styles.filterChip, 
              !isDark && styles.filterChipLight, 
              activeFilter === 'all' && !selectedCategory && styles.activeChip,
              activeFilter === 'all' && !selectedCategory && !isDark && styles.activeChipLight
            ]}
            onPress={() => {
              setActiveFilter('all');
              setSelectedCategory(null);
            }}
          >
            <Text style={[
              styles.chipText, 
              !isDark && styles.chipTextLight, 
              activeFilter === 'all' && !selectedCategory && styles.activeChipText,
              activeFilter === 'all' && !selectedCategory && !isDark && styles.activeChipTextLight
            ]}>All</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.filterChip, 
              !isDark && styles.filterChipLight, 
              activeFilter === 'income' && styles.activeChip,
              activeFilter === 'income' && !isDark && styles.activeChipLight
            ]}
            onPress={() => {
              setActiveFilter('income');
              setSelectedCategory(null);
            }}
          >
            <Text style={[
              styles.chipText, 
              !isDark && styles.chipTextLight, 
              activeFilter === 'income' && styles.activeChipText,
              activeFilter === 'income' && !isDark && styles.activeChipTextLight
            ]}>Income</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.filterChip, 
              !isDark && styles.filterChipLight, 
              activeFilter === 'expense' && !selectedCategory && styles.activeChip,
              activeFilter === 'expense' && !selectedCategory && !isDark && styles.activeChipLight
            ]}
            onPress={() => {
              setActiveFilter('expense');
              setSelectedCategory(null);
            }}
          >
            <Text style={[
              styles.chipText, 
              !isDark && styles.chipTextLight, 
              activeFilter === 'expense' && !selectedCategory && styles.activeChipText,
              activeFilter === 'expense' && !selectedCategory && !isDark && styles.activeChipTextLight
            ]}>Expenses</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.filterChip, 
              !isDark && styles.filterChipLight, 
              selectedCategory !== null && styles.activeChip,
              selectedCategory !== null && !isDark && styles.activeChipLight
            ]}
            onPress={() => setShowCategories(!showCategories)}
          >
            <Text style={[
              styles.chipText, 
              !isDark && styles.chipTextLight, 
              selectedCategory !== null && styles.activeChipText,
              selectedCategory !== null && !isDark && styles.activeChipTextLight
            ]}>
              {selectedCategory ? `Cat: ${selectedCategory}` : 'Categories'}
            </Text>
            <MaterialIcons 
              name={showCategories ? 'expand-less' : 'expand-more'} 
              size={16} 
              color={selectedCategory || (activeFilter === 'all' && !selectedCategory && !isDark) ? '#0A0A0A' : '#8e9192'} 
            />
          </TouchableOpacity>
        </ScrollView>

        {/* Categories Selector list */}
        {showCategories && (
          <View style={styles.categoriesDropdown}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catGrid}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catOption, selectedCategory === cat && styles.activeCatOption]}
                  onPress={() => {
                    setSelectedCategory(selectedCategory === cat ? null : cat);
                    setShowCategories(false);
                  }}
                >
                  <Text style={[styles.catOptionText, selectedCategory === cat && styles.activeCatOptionText]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#ffffff" style={{ marginTop: 40 }} />
        ) : transactions.length === 0 ? (
          <Text style={styles.emptyText}>No transactions found.</Text>
        ) : (
          groupKeys.map(key => {
            const list = grouped[key];
            const groupExpenseTotal = getGroupTotal(list);
            
            return (
              <View key={key} style={styles.dateGroup}>
                <View style={styles.groupHeader}>
                  <Text style={[styles.groupTitle, !isDark && styles.textSecondaryLight]}>{key}</Text>
                  {groupExpenseTotal > 0 && (
                    <Text style={styles.groupTotal}>-{formatAmount(groupExpenseTotal).replace('-', '')}</Text>
                  )}
                </View>

                <GlassCard style={[styles.groupCard, { padding: 0 }]}>
                  {list.map((tx, idx) => {
                    const isExpense = tx.amount < 0;
                    const formattedAmt = (tx.amount > 0 ? '+' : '') + formatAmount(tx.amount);

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
                        style={[styles.txItem, idx > 0 && (isDark ? styles.txBorder : [styles.txBorder, styles.txBorderLight])]}
                        activeOpacity={0.8}
                        onPress={() => {
                          setEditingTx(tx);
                          setAddTxVisible(true);
                        }}
                      >
                        <View style={styles.txLeft}>
                          <View style={[styles.txIconContainer, !isDark && styles.txIconContainerLight]}>
                            <MaterialIcons name={iconName as any} size={20} color={isDark ? "#ffffff" : "#0A0A0A"} />
                          </View>
                          <View>
                            <Text style={[styles.txTitle, !isDark && styles.textLight]}>{tx.note || tx.category}</Text>
                            <Text style={[styles.txSubtitle, !isDark && styles.textSecondaryLight]}>
                              {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.txRight}>
                          <Text style={[styles.txAmount, isExpense ? (isDark ? styles.expenseText : styles.expenseTextLight) : (isDark ? styles.incomeText : styles.incomeTextLight)]}>
                            {formattedAmt}
                          </Text>
                          <View style={[
                            styles.catBadge, 
                            { backgroundColor: isExpense ? (isDark ? 'rgba(255, 180, 171, 0.1)' : 'rgba(186, 26, 26, 0.08)') : (isDark ? 'rgba(166, 200, 255, 0.1)' : 'rgba(32, 138, 239, 0.08)') }
                          ]}>
                            <Text style={[styles.catBadgeText, isExpense ? (isDark ? styles.expenseBadgeText : styles.expenseBadgeTextLight) : (isDark ? styles.incomeBadgeText : styles.incomeBadgeTextLight)]}>
                              {tx.category}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </GlassCard>
              </View>
            );
          })
        )}
        
        {/* Extra spacing bottom to clear the FAB and tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, !isDark && styles.fabLight]}
        onPress={() => {
          setEditingTx(null);
          setAddTxVisible(true);
        }}
      >
        <MaterialIcons name="add" size={28} color={isDark ? "#0A0A0A" : "#ffffff"} />
      </TouchableOpacity>

      <AddTransactionModal 
        visible={addTxVisible} 
        onClose={() => {
          setAddTxVisible(false);
          setEditingTx(null);
        }} 
        initialType="expense" 
        onSaveSuccess={loadTransactions} 
        editingTransaction={editingTx}
      />
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
  incomeTextLight: {
    color: '#208aef',
  },
  expenseTextLight: {
    color: '#ba1a1a',
  },
  incomeBadgeTextLight: {
    color: '#208aef',
  },
  expenseBadgeTextLight: {
    color: '#ba1a1a',
  },
  searchHeader: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.45)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      },
    }),
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 4,
  },
  activeChip: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  chipText: {
    color: '#8e9192',
    fontSize: 12,
    fontWeight: '600',
  },
  activeChipText: {
    color: '#0A0A0A',
  },
  categoriesDropdown: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  catGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  catOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeCatOption: {
    backgroundColor: '#a6c8ff',
  },
  catOptionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
  },
  activeCatOptionText: {
    color: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyText: {
    color: '#8e9192',
    textAlign: 'center',
    paddingVertical: 40,
  },
  dateGroup: {
    marginBottom: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupTitle: {
    fontSize: 11,
    color: '#8e9192',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  groupTotal: {
    fontSize: 12,
    color: '#8e9192',
  },
  groupCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'transparent',
  },
  txBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
    fontSize: 11,
    color: '#8e9192',
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  incomeText: {
    color: '#a6c8ff',
  },
  expenseText: {
    color: '#ffb4ab',
  },
  catBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expenseBadgeText: {
    color: '#ffb4ab',
  },
  incomeBadgeText: {
    color: '#a6c8ff',
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 100 : 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 100,
  },
  searchHeaderLight: {
    backgroundColor: 'transparent',
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  searchBarLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  searchInputLight: {
    color: '#0A0A0A',
  },
  filterChipLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  chipTextLight: {
    color: '#60646C',
  },
  activeChipLight: {
    backgroundColor: '#0A0A0A',
    borderColor: '#0A0A0A',
  },
  activeChipTextLight: {
    color: '#ffffff',
  },
  txBorderLight: {
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  txIconContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  fabLight: {
    backgroundColor: '#0A0A0A',
  },
});
