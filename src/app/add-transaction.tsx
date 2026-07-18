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
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { getDatabase, Account } from '@/services/db';
import { useTheme } from '@/services/theme-context';
import DateTimePicker from '@expo/ui/community/datetime-picker';

const { width } = Dimensions.get('window');

export default function AddTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isDark } = useTheme();
  
  // Set default type from params (if passed)
  const initialType = params.type === 'income' ? 'income' : 'expense';

  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>(initialType);
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

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
      if (rows.length > 0) {
        setSelectedAccount(rows[0].id);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

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

    try {
      const db = await getDatabase();
      const txId = 'tx-' + Date.now();
      const finalAmount = type === 'expense' ? -numAmount : numAmount;
      const dateStr = date.toISOString();

      // Begin transaction to ensure consistency
      await db.runAsync('BEGIN TRANSACTION;');

      // 1. Insert transaction record
      await db.runAsync(
        `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [txId, selectedAccount, finalAmount, selectedCategory, note, type, dateStr, recurring ? 1 : 0]
      );

      // 2. Update account balance
      await db.runAsync(
        `UPDATE accounts SET balance = balance + ? WHERE id = ?;`,
        [finalAmount, selectedAccount]
      );

      await db.runAsync('COMMIT;');

      router.back();
    } catch (error) {
      console.error('Error saving transaction:', error);
      Alert.alert('Error', 'Failed to save transaction.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, !isDark && { backgroundColor: '#F2F2F7' }]}>
        <ActivityIndicator size="large" color={isDark ? '#ffffff' : '#0A0A0A'} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, !isDark && styles.textLight]}>Add Transaction</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Amount Section */}
          <View style={styles.amountContainer}>
            <Text style={[styles.amountLabel, !isDark && styles.textSecondaryLight]}>Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={[styles.currencySymbol, !isDark && styles.textLight]}>$</Text>
              <TextInput
                style={[styles.amountInput, !isDark && styles.textInputAmountLight]}
                placeholder="0.00"
                placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.25)'}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>
          </View>

          {/* Form Panel */}
          <View style={[styles.formPanel, !isDark && styles.formPanelLight]}>
            
            {/* Type Selector (Income/Expense Segmented Toggle) */}
            <View style={[styles.toggleContainer, !isDark && styles.toggleContainerLight]}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn, 
                  type === 'expense' && (isDark ? styles.activeExpenseBtn : styles.activeExpenseBtnLight)
                ]}
                onPress={() => setType('expense')}
              >
                <Text style={[
                  styles.toggleText, 
                  type === 'expense' && (isDark ? styles.activeToggleText : styles.activeToggleTextLight)
                ]}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn, 
                  type === 'income' && (isDark ? styles.activeIncomeBtn : styles.activeIncomeBtnLight)
                ]}
                onPress={() => setType('income')}
              >
                <Text style={[
                  styles.toggleText, 
                  type === 'income' && (isDark ? styles.activeToggleText : styles.activeToggleTextLight)
                ]}>Income</Text>
              </TouchableOpacity>
            </View>

            {/* Category Grid */}
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
                        ? (isDark ? styles.activeCategoryIconBg : styles.activeCategoryIconBgLight) 
                        : (isDark ? styles.inactiveCategoryIconBg : styles.inactiveCategoryIconBgLight)
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
                      isSelected && (isDark ? styles.activeCategoryCardText : styles.activeCategoryCardTextLight)
                    ]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Account Selector dropdown-style button */}
            <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight]}>Account / Wallet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsScroll}>
              {accounts.map(acc => {
                const isSelected = selectedAccount === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.accountOption, 
                      !isDark && styles.accountOptionLight,
                      isSelected && (isDark ? styles.activeAccountOption : styles.activeAccountOptionLight)
                    ]}
                    onPress={() => setSelectedAccount(acc.id)}
                  >
                    <MaterialIcons 
                      name={acc.type === 'crypto' ? 'currency-bitcoin' : 'account-balance'} 
                      size={16} 
                      color={isSelected ? (isDark ? '#0A0A0A' : '#ffffff') : (isDark ? '#8e9192' : '#60646C')}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[
                      styles.accountOptionText, 
                      !isDark && styles.textSecondaryLight,
                      isSelected && (isDark ? styles.activeAccountOptionText : styles.activeAccountOptionTextLight)
                    ]}>
                      {acc.name} (${acc.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Date Field */}
            <View style={[styles.switchRow, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
              <View style={styles.switchLeft}>
                <MaterialIcons name="event" size={20} color={isDark ? '#8e9192' : '#60646C'} style={{ marginRight: 12 }} />
                <Text style={[styles.switchLabel, !isDark && styles.textLight]}>Date</Text>
              </View>
              <TouchableOpacity 
                style={[styles.datePickerBtn, !isDark && styles.datePickerBtnLight]}
                onPress={() => {
                  if (Platform.OS === 'android') {
                    setShowDatePicker(true);
                  } else {
                    setShowDatePicker(!showDatePicker);
                  }
                }}
              >
                <Text style={[styles.datePickerText, !isDark && styles.datePickerTextLight]}>
                  {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            </View>

            {/* iOS/Web Inline Picker */}
            {showDatePicker && Platform.OS !== 'android' && (
              <View style={[styles.inlinePickerContainer, !isDark && styles.inlinePickerContainerLight]}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  onChange={handleDateChange}
                />
              </View>
            )}

            {/* Android Dialog Picker */}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={date}
                mode="date"
                presentation="dialog"
                onChange={handleDateChange}
              />
            )}

            {/* Recurring Toggle */}
            <View style={[styles.switchRow, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
              <View style={styles.switchLeft}>
                <MaterialIcons name="repeat" size={20} color={isDark ? '#8e9192' : '#60646C'} style={{ marginRight: 12 }} />
                <Text style={[styles.switchLabel, !isDark && styles.textLight]}>Set as recurring</Text>
              </View>
              <Switch
                value={recurring}
                onValueChange={setRecurring}
                trackColor={{ false: isDark ? '#3a3a3c' : '#e0e0e0', true: isDark ? '#a6c8ff' : '#208aef' }}
                thumbColor={recurring ? '#ffffff' : (isDark ? '#8e9192' : '#b0b4ba')}
              />
            </View>

            {/* Notes Field */}
            <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight]}>Note</Text>
            <TextInput
              style={[styles.noteInput, !isDark && styles.noteInputLight]}
              placeholder="Add description..."
              placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.4)'}
              value={note}
              onChangeText={setNote}
            />

            {/* Save Button */}
            <TouchableOpacity style={[styles.saveBtn, !isDark && styles.saveBtnLight]} onPress={handleSave}>
              <Text style={[styles.saveBtnText, !isDark && styles.saveBtnTextLight]}>Save Transaction</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  textInputAmountLight: {
    color: '#0A0A0A',
  },
  formPanelLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  toggleContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  activeExpenseBtnLight: {
    backgroundColor: '#0A0A0A',
  },
  activeIncomeBtnLight: {
    backgroundColor: '#0A0A0A',
  },
  activeToggleTextLight: {
    color: '#ffffff',
  },
  inactiveCategoryIconBgLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
  },
  activeCategoryIconBgLight: {
    backgroundColor: '#0A0A0A',
  },
  activeCategoryCardTextLight: {
    color: '#0A0A0A',
  },
  accountOptionLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  activeAccountOptionLight: {
    backgroundColor: '#208aef',
    borderColor: '#208aef',
  },
  activeAccountOptionTextLight: {
    color: '#ffffff',
  },
  noteInputLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    color: '#0A0A0A',
  },
  saveBtnLight: {
    backgroundColor: '#0A0A0A',
    shadowColor: '#000000',
  },
  saveBtnTextLight: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 30,
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
  datePickerBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  datePickerBtnLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  datePickerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerTextLight: {
    color: '#0A0A0A',
  },
  inlinePickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 14,
    padding: 8,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  inlinePickerContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    borderColor: 'rgba(0, 0, 0, 0.03)',
  }
});
