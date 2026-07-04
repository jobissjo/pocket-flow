import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { getDatabase, Account, Transaction } from '@/services/db';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';

const { width } = Dimensions.get('window');

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  initialType: 'income' | 'expense' | 'transfer';
  onSaveSuccess?: () => void;
  editingTransaction?: Transaction | null;
}

export default function AddTransactionModal({ visible, onClose, initialType, onSaveSuccess, editingTransaction }: AddTransactionModalProps) {
  const { formatAmount, currencySymbol } = useCurrency();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(initialType);
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [targetAccount, setTargetAccount] = useState<string>('');
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Categories list with corresponding icons
  const categories = [
    { name: 'Food', icon: 'local-cafe' },
    { name: 'Shopping', icon: 'shopping-bag' },
    { name: 'Transport', icon: 'directions-car' },
    { name: 'Grocery', icon: 'shopping-basket' },
    { name: 'Housing', icon: 'home' },
    { name: 'Salary', icon: 'payments' },
    { name: 'Digital', icon: 'apps' },
    { name: 'Other', icon: 'more-horiz' }
  ];

  const loadData = async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<Account>('SELECT * FROM accounts');
      setAccounts(rows);
      if (!editingTransaction && rows.length > 0) {
        setSelectedAccount(rows[0].id);
        if (rows.length > 1) {
          setTargetAccount(rows[1].id);
        } else {
          setTargetAccount(rows[0].id);
        }
      }

      if (editingTransaction && editingTransaction.type === 'transfer') {
        const linkedId = editingTransaction.id.endsWith('-out')
          ? editingTransaction.id.replace('-out', '-in')
          : editingTransaction.id.replace('-in', '-out');

        const linkedTx = await db.getFirstAsync<Transaction>(
          'SELECT * FROM transactions WHERE id = ?',
          [linkedId]
        );

        if (linkedTx) {
          if (editingTransaction.id.endsWith('-out')) {
            setSelectedAccount(editingTransaction.account_id);
            setTargetAccount(linkedTx.account_id);
          } else {
            setSelectedAccount(linkedTx.account_id);
            setTargetAccount(editingTransaction.account_id);
          }
        }
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      if (editingTransaction) {
        setType(editingTransaction.type);
        setAmount(Math.abs(editingTransaction.amount).toString());
        setNote(editingTransaction.note || '');
        setRecurring(editingTransaction.recurring === 1);
        setSelectedCategory(editingTransaction.category);
        setSelectedAccount(editingTransaction.account_id);
      } else {
        setType(initialType);
        setAmount('');
        setNote('');
        setRecurring(false);
        setSelectedCategory(initialType === 'transfer' ? 'Transfer' : 'Food');
      }
      loadData();
    }
  }, [visible, initialType, editingTransaction]);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    if (!selectedAccount) {
      Alert.alert('Error', 'Please select an account.');
      return;
    }
    if (type === 'transfer' && !targetAccount) {
      Alert.alert('Error', 'Please select a destination account.');
      return;
    }

    try {
      const db = await getDatabase();
      await db.runAsync('BEGIN TRANSACTION;');

      // 1. Revert and delete previous transaction(s) if editing
      if (editingTransaction) {
        if (editingTransaction.type === 'transfer') {
          const linkedId = editingTransaction.id.endsWith('-out')
            ? editingTransaction.id.replace('-out', '-in')
            : editingTransaction.id.replace('-in', '-out');

          const linkedTx = await db.getFirstAsync<Transaction>(
            'SELECT * FROM transactions WHERE id = ?',
            [linkedId]
          );

          // Revert source balance
          await db.runAsync(
            `UPDATE accounts SET balance = balance - ? WHERE id = ?;`,
            [editingTransaction.amount, editingTransaction.account_id]
          );

          // Revert target balance
          if (linkedTx) {
            await db.runAsync(
              `UPDATE accounts SET balance = balance - ? WHERE id = ?;`,
              [linkedTx.amount, linkedTx.account_id]
            );
            await db.runAsync(`DELETE FROM transactions WHERE id = ?;`, [linkedId]);
          }

          await db.runAsync(`DELETE FROM transactions WHERE id = ?;`, [editingTransaction.id]);
        } else {
          // Revert standard balance
          await db.runAsync(
            `UPDATE accounts SET balance = balance - ? WHERE id = ?;`,
            [editingTransaction.amount, editingTransaction.account_id]
          );
          await db.runAsync(`DELETE FROM transactions WHERE id = ?;`, [editingTransaction.id]);
        }
      }

      const dateStr = editingTransaction ? editingTransaction.date : new Date().toISOString();

      // 2. Perform fresh insertion based on selected type
      if (type === 'transfer') {
        if (selectedAccount === targetAccount) {
          Alert.alert('Error', 'Source and destination accounts must be different.');
          await db.runAsync('ROLLBACK;');
          return;
        }

        const txBaseId = 'tx-' + Date.now();
        const fromAccount = accounts.find(a => a.id === selectedAccount);
        const toAccount = accounts.find(a => a.id === targetAccount);
        const fromName = fromAccount ? fromAccount.name : 'Source';
        const toName = toAccount ? toAccount.name : 'Destination';

        const customNote = note.trim() ? ` • ${note}` : '';
        const noteOut = `Transfer to ${toName}${customNote}`;
        const noteIn = `Transfer from ${fromName}${customNote}`;

        // Insert outflow (-amount)
        await db.runAsync(
          `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [txBaseId + '-out', selectedAccount, -numAmount, 'Transfer', noteOut, 'transfer', dateStr, recurring ? 1 : 0]
        );
        await db.runAsync(
          `UPDATE accounts SET balance = balance - ? WHERE id = ?;`,
          [numAmount, selectedAccount]
        );

        // Insert inflow (+amount)
        await db.runAsync(
          `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [txBaseId + '-in', targetAccount, numAmount, 'Transfer', noteIn, 'transfer', dateStr, recurring ? 1 : 0]
        );
        await db.runAsync(
          `UPDATE accounts SET balance = balance + ? WHERE id = ?;`,
          [numAmount, targetAccount]
        );
      } else {
        const finalAmount = type === 'expense' ? -numAmount : numAmount;
        const txId = 'tx-' + Date.now();

        await db.runAsync(
          `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [txId, selectedAccount, finalAmount, selectedCategory, note, type, dateStr, recurring ? 1 : 0]
        );
        await db.runAsync(
          `UPDATE accounts SET balance = balance + ? WHERE id = ?;`,
          [finalAmount, selectedAccount]
        );
      }

      await db.runAsync('COMMIT;');

      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving transaction:', error);
      Alert.alert('Error', 'Failed to save transaction.');
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;

    const isTransfer = editingTransaction.type === 'transfer';
    const alertMessage = isTransfer
      ? 'Are you sure you want to delete this transfer? This will restore balances on both accounts.'
      : 'Are you sure you want to delete this transaction? This will restore the account balance.';

    Alert.alert(
      isTransfer ? 'Delete Transfer' : 'Delete Transaction',
      alertMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync('BEGIN TRANSACTION;');

              if (isTransfer) {
                const linkedId = editingTransaction.id.endsWith('-out')
                  ? editingTransaction.id.replace('-out', '-in')
                  : editingTransaction.id.replace('-in', '-out');

                const linkedTx = await db.getFirstAsync<Transaction>(
                  'SELECT * FROM transactions WHERE id = ?',
                  [linkedId]
                );

                // Revert source balance
                await db.runAsync(
                  `UPDATE accounts SET balance = balance - ? WHERE id = ?;`,
                  [editingTransaction.amount, editingTransaction.account_id]
                );

                // Revert target balance
                if (linkedTx) {
                  await db.runAsync(
                    `UPDATE accounts SET balance = balance - ? WHERE id = ?;`,
                    [linkedTx.amount, linkedTx.account_id]
                  );
                  await db.runAsync(`DELETE FROM transactions WHERE id = ?;`, [linkedId]);
                }

                await db.runAsync(`DELETE FROM transactions WHERE id = ?;`, [editingTransaction.id]);
              } else {
                // Revert standard balance
                await db.runAsync(
                  `UPDATE accounts SET balance = balance - ? WHERE id = ?;`,
                  [editingTransaction.amount, editingTransaction.account_id]
                );
                await db.runAsync(`DELETE FROM transactions WHERE id = ?;`, [editingTransaction.id]);
              }

              await db.runAsync('COMMIT;');

              if (onSaveSuccess) onSaveSuccess();
              onClose();
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', 'Failed to delete transaction.');
            }
          }
        }
      ]
    );
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
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose}>
                <MaterialIcons name="close" size={24} color={isDark ? "#ffffff" : "#0A0A0A"} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, !isDark && styles.textLight]}>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              
              {/* Amount Section */}
              <View style={styles.amountContainer}>
                <Text style={[styles.amountLabel, !isDark && styles.textSecondaryLight]}>Amount</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencySymbol}>{currencySymbol}</Text>
                  <TextInput
                    style={[styles.amountInput, !isDark && styles.textLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    autoFocus
                  />
                </View>
              </View>

              {/* Form Panel */}
              <View style={[styles.formPanel, !isDark && styles.formPanelLight]}>
                
                {/* Type Selector (Expense/Income/Transfer Segmented Toggle) */}
                <View style={[styles.toggleContainer, !isDark && styles.toggleContainerLight]}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn, 
                      type === 'expense' && styles.activeExpenseBtn,
                      type === 'expense' && !isDark && { backgroundColor: '#0A0A0A' }
                    ]}
                    onPress={() => setType('expense')}
                  >
                    <Text style={[
                      styles.toggleText, 
                      type === 'expense' && styles.activeToggleText,
                      type === 'expense' && !isDark && { color: '#ffffff' }
                    ]}>Expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn, 
                      type === 'income' && styles.activeIncomeBtn,
                      type === 'income' && !isDark && { backgroundColor: '#0A0A0A' }
                    ]}
                    onPress={() => setType('income')}
                  >
                    <Text style={[
                      styles.toggleText, 
                      type === 'income' && styles.activeToggleText,
                      type === 'income' && !isDark && { color: '#ffffff' }
                    ]}>Income</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn, 
                      type === 'transfer' && styles.activeIncomeBtn,
                      type === 'transfer' && !isDark && { backgroundColor: '#0A0A0A' }
                    ]}
                    onPress={() => {
                      setType('transfer');
                      setSelectedCategory('Transfer');
                    }}
                  >
                    <Text style={[
                      styles.toggleText, 
                      type === 'transfer' && styles.activeToggleText,
                      type === 'transfer' && !isDark && { color: '#ffffff' }
                    ]}>Transfer</Text>
                  </TouchableOpacity>
                </View>

                {/* Category Grid / Transfer Info */}
                {type === 'transfer' ? (
                  <View style={[styles.transferInfoBox, !isDark && styles.transferInfoBoxLight]}>
                    <MaterialIcons name="sync-alt" size={20} color={isDark ? '#a6c8ff' : '#208aef'} style={{ marginRight: 10 }} />
                    <Text style={[styles.transferInfoText, !isDark && styles.textLight]}>
                      Category will automatically be set to <Text style={{ fontWeight: 'bold' }}>Transfer</Text>
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight]}>Category</Text>
                    <View style={styles.categoryGrid}>
                      {categories.map(cat => {
                        const isSelected = selectedCategory === cat.name;
                        return (
                          <TouchableOpacity
                            key={cat.name}
                            style={[styles.categoryCard, isSelected && styles.activeCategoryCard]}
                            onPress={() => setSelectedCategory(cat.name)}
                          >
                            <View style={[
                              styles.categoryIconBg, 
                              isSelected 
                                ? (isDark ? styles.activeCategoryIconBg : [styles.activeCategoryIconBg, { backgroundColor: '#0A0A0A' }]) 
                                : (isDark ? styles.inactiveCategoryIconBg : [styles.inactiveCategoryIconBg, styles.inactiveCategoryIconBgLight])
                            ]}>
                              <MaterialIcons 
                                name={cat.icon as any} 
                                size={20} 
                                color={isSelected ? (isDark ? '#0A0A0A' : '#ffffff') : (isDark ? '#ffffff' : '#0A0A0A')} 
                              />
                            </View>
                            <Text style={[
                              styles.categoryCardText, 
                              !isDark && styles.textSecondaryLight, 
                              isSelected && styles.activeCategoryCardText,
                              isSelected && !isDark && styles.textLight
                            ]}>
                              {cat.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* Account Selector */}
                <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight]}>
                  {type === 'transfer' ? 'From Account / Wallet' : 'Account / Wallet'}
                </Text>
                {loading ? (
                  <ActivityIndicator size="small" color={isDark ? "#ffffff" : "#0A0A0A"} style={{ marginBottom: 20 }} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsScroll}>
                    {accounts.map(acc => {
                      const isSelected = selectedAccount === acc.id;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={[
                            styles.accountOption, 
                            !isDark && styles.accountOptionLight,
                            isSelected && styles.activeAccountOption,
                            isSelected && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                          ]}
                          onPress={() => {
                            setSelectedAccount(acc.id);
                            if (type === 'transfer' && targetAccount === acc.id) {
                              const other = accounts.find(a => a.id !== acc.id);
                              if (other) setTargetAccount(other.id);
                            }
                          }}
                        >
                          <MaterialIcons 
                            name={acc.type === 'crypto' ? 'currency-bitcoin' : 'account-balance'} 
                            size={16} 
                            color={isSelected ? (isDark ? '#0A0A0A' : '#ffffff') : '#8e9192'}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={[
                            styles.accountOptionText, 
                            !isDark && styles.textSecondaryLight,
                            isSelected && styles.activeAccountOptionText,
                            isSelected && !isDark && { color: '#ffffff' }
                          ]}>
                            {acc.name} ({formatAmount(acc.balance, 0)})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* Destination Account Selector (Transfer only) */}
                {type === 'transfer' && (
                  <>
                    <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight]}>To Account / Wallet</Text>
                    {loading ? (
                      <ActivityIndicator size="small" color={isDark ? "#ffffff" : "#0A0A0A"} style={{ marginBottom: 20 }} />
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsScroll}>
                        {accounts.map(acc => {
                          const isSelected = targetAccount === acc.id;
                          return (
                            <TouchableOpacity
                              key={acc.id}
                              style={[
                                styles.accountOption, 
                                !isDark && styles.accountOptionLight,
                                isSelected && styles.activeAccountOption,
                                isSelected && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                              ]}
                              onPress={() => {
                                setTargetAccount(acc.id);
                                if (selectedAccount === acc.id) {
                                  const other = accounts.find(a => a.id !== acc.id);
                                  if (other) setSelectedAccount(other.id);
                                }
                              }}
                            >
                              <MaterialIcons 
                                name={acc.type === 'crypto' ? 'currency-bitcoin' : 'account-balance'} 
                                size={16} 
                                color={isSelected ? (isDark ? '#0A0A0A' : '#ffffff') : '#8e9192'}
                                style={{ marginRight: 6 }}
                              />
                              <Text style={[
                                styles.accountOptionText, 
                                !isDark && styles.textSecondaryLight,
                                isSelected && styles.activeAccountOptionText,
                                isSelected && !isDark && { color: '#ffffff' }
                              ]}>
                                {acc.name} ({formatAmount(acc.balance, 0)})
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </>
                )}

                {/* Recurring Toggle */}
                <View style={styles.switchRow}>
                  <View style={styles.switchLeft}>
                    <MaterialIcons name="repeat" size={20} color="#8e9192" style={{ marginRight: 12 }} />
                    <Text style={[styles.switchLabel, !isDark && styles.textLight]}>Set as recurring</Text>
                  </View>
                  <Switch
                    value={recurring}
                    onValueChange={setRecurring}
                    trackColor={{ false: '#3a3a3c', true: '#a6c8ff' }}
                    thumbColor={recurring ? '#ffffff' : '#8e9192'}
                  />
                </View>

                {/* Notes Field */}
                <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight]}>Note</Text>
                <TextInput
                  style={[styles.noteInput, !isDark && styles.inputLight]}
                  placeholder="Add description..."
                  placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.25)"}
                  value={note}
                  onChangeText={setNote}
                />

                {/* Save Button */}
                <TouchableOpacity style={[styles.saveBtn, !isDark && styles.saveBtnLight]} onPress={handleSave}>
                  <Text style={[styles.saveBtnText, !isDark && styles.saveBtnTextLight]}>
                    {editingTransaction ? 'Update Transaction' : 'Save Transaction'}
                  </Text>
                </TouchableOpacity>

                {editingTransaction && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Text style={styles.deleteBtnText}>Delete Transaction</Text>
                  </TouchableOpacity>
                )}

              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
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
    height: '92%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalContentLight: {
    backgroundColor: '#F2F2F7',
    borderColor: 'rgba(0, 0, 0, 0.05)',
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
  formPanelLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  inputLight: {
    backgroundColor: '#F2F2F7',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    color: '#0A0A0A',
  },
  toggleContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  inactiveCategoryIconBgLight: {
    backgroundColor: '#F2F2F7',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  accountOptionLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  saveBtnLight: {
    backgroundColor: '#0A0A0A',
  },
  saveBtnTextLight: {
    color: '#ffffff',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  amountContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  amountLabel: {
    fontSize: 11,
    color: '#8e9192',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '700',
    color: '#8e9192',
    marginRight: 4,
    opacity: 0.5,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    width: 200,
  },
  formPanel: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.4)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    paddingBottom: 60,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeExpenseBtn: {
    backgroundColor: '#ffffff',
  },
  activeIncomeBtn: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: '#8e9192',
    fontSize: 13,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0A0A0A',
  },
  fieldLabel: {
    fontSize: 11,
    color: '#8e9192',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryCard: {
    width: (width - 72) / 4,
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeCategoryIconBg: {
    backgroundColor: '#ffffff',
  },
  inactiveCategoryIconBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryCardText: {
    fontSize: 10,
    color: '#8e9192',
    fontWeight: '500',
  },
  activeCategoryCardText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  activeCategoryCard: {},
  accountsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 24,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeAccountOption: {
    backgroundColor: '#a6c8ff',
    borderColor: '#a6c8ff',
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 20,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  noteInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 24,
  },
  saveBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  saveBtnText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: 'rgba(255, 180, 171, 0.1)',
    borderColor: '#ffb4ab',
    borderWidth: 1,
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  deleteBtnText: {
    color: '#ffb4ab',
    fontSize: 15,
    fontWeight: '700',
  },
  transferInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(166, 200, 255, 0.05)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(166, 200, 255, 0.1)',
  },
  transferInfoBoxLight: {
    backgroundColor: 'rgba(32, 138, 239, 0.05)',
    borderColor: 'rgba(32, 138, 239, 0.1)',
  },
  transferInfoText: {
    color: '#8e9192',
    fontSize: 13,
    flex: 1,
  }
});
