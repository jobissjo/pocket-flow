import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../ui/modal-sheet';
import { CustomInput } from '../ui/custom-input';
import { SegmentedControl } from '../ui/segmented-control';
import { CategoryFormModal } from './category-form-modal';
import { transactionService } from '@/services/transactions';
import { accountService } from '@/services/accounts';
import { creditCardService } from '@/services/creditCards';
import { categoryService } from '@/services/categories';
import {
  TransactionResponse,
  TransactionType,
  CategoryResponse,
  AccountResponse,
  CreditCardResponse,
} from '@/services/types';
import { useTheme } from '@/services/theme-context';
import { hapticNotificationSuccess, hapticLight } from '@/services/haptics';

interface TransactionFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transactionToEdit?: TransactionResponse | null;
  defaultType?: TransactionType;
  onOpenAIImport?: () => void;
}

export function TransactionFormModal({
  visible,
  onClose,
  onSuccess,
  transactionToEdit,
  defaultType = 'expense',
  onOpenAIImport,
}: TransactionFormModalProps) {
  const { isDark } = useTheme();
  const [type, setType] = useState<TransactionType>(defaultType);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentSource, setPaymentSource] = useState<'none' | 'account' | 'card'>('none');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (catType: TransactionType) => {
    try {
      const [cats, accs, ccList] = await Promise.all([
        categoryService.listCategories(catType),
        accountService.listAccounts(),
        creditCardService.listCreditCards(),
      ]);
      setCategories(cats);
      setAccounts(accs);
      setCards(ccList);

      if (!transactionToEdit && cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData(type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, type]);

  useEffect(() => {
    if (transactionToEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(transactionToEdit.title);
      setAmount(String(transactionToEdit.amount));
      setType(transactionToEdit.type);
      setCategoryId(transactionToEdit.category_id);
      setNotes(transactionToEdit.notes || '');

      if (transactionToEdit.credit_card_id) {
        setPaymentSource('card');
        setSelectedCardId(transactionToEdit.credit_card_id);
        setSelectedAccountId(null);
      } else if (transactionToEdit.account_id) {
        setPaymentSource('account');
        setSelectedAccountId(transactionToEdit.account_id);
        setSelectedCardId(null);
      } else {
        setPaymentSource('none');
        setSelectedAccountId(null);
        setSelectedCardId(null);
      }
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle('');
      setAmount('');
      setType(defaultType);
      setCategoryId('');
      setPaymentSource('none');
      setSelectedAccountId(null);
      setSelectedCardId(null);
      setNotes('');
    }
    setError(null);
  }, [transactionToEdit, visible, defaultType]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title / Description is required');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }
    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        title: title.trim(),
        amount: numAmount,
        type,
        category_id: categoryId,
        account_id: paymentSource === 'account' ? selectedAccountId : null,
        credit_card_id: paymentSource === 'card' ? selectedCardId : null,
        notes: notes.trim() || undefined,
        date: new Date().toISOString(),
      };

      if (transactionToEdit) {
        await transactionService.updateTransaction(transactionToEdit.id, payload);
      } else {
        await transactionService.createTransaction(payload);
      }

      hapticNotificationSuccess();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ModalSheet
        visible={visible}
        onClose={onClose}
        title={transactionToEdit ? 'Edit Transaction' : 'Add Transaction'}
        subtitle="Record your income or expense"
      >
        <View style={styles.container}>
          {!transactionToEdit && onOpenAIImport && (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                onClose();
                onOpenAIImport();
              }}
              style={[
                styles.aiBanner,
                {
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
                  borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#C7D2FE',
                },
              ]}
            >
              <View style={styles.aiBannerLeft}>
                <Ionicons name="sparkles" size={18} color="#6366F1" />
                <View>
                  <Text style={[styles.aiBannerTitle, { color: isDark ? '#FFFFFF' : '#1E1B4B' }]}>
                    Have a receipt or bill?
                  </Text>
                  <Text style={[styles.aiBannerSub, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                    Scan and auto-fill details with AI ✨
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDark ? '#A5B4FC' : '#6366F1'} />
            </TouchableOpacity>
          )}

          <SegmentedControl
            options={[
              { label: 'Expense', value: 'expense' },
              { label: 'Income', value: 'income' },
            ]}
            value={type}
            onChange={(val) => {
              setType(val as TransactionType);
              setCategoryId('');
            }}
            style={{ marginBottom: 16 }}
          />

          <CustomInput
            label="Amount"
            placeholder="0.00"
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              setError(null);
            }}
            keyboardType="decimal-pad"
            leftIcon="cash-outline"
            style={styles.amountInput}
          />

          <CustomInput
            label="Title / Merchant"
            placeholder="e.g. Grocery Store, Salary, Netflix"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setError(null);
            }}
            leftIcon="create-outline"
          />

          {/* Category Picker */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#475569' }]}>
              Category
            </Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setShowNewCatModal(true);
              }}
            >
              <Text style={[styles.addCatText, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
                + New Category
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContainer}
          >
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    hapticLight();
                    setCategoryId(cat.id);
                    setError(null);
                  }}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: isSelected
                        ? '#2563EB'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#F1F5F9',
                      borderColor: isSelected
                        ? '#60A5FA'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : '#E2E8F0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : isDark
                          ? '#E2E8F0'
                          : '#475569',
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Payment Account / Card Linking */}
          <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#475569', marginTop: 8 }]}>
            Payment Source
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContainer}
          >
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setPaymentSource('none');
                setSelectedAccountId(null);
                setSelectedCardId(null);
              }}
              style={[
                styles.catChip,
                {
                  backgroundColor:
                    paymentSource === 'none'
                      ? '#2563EB'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#F1F5F9',
                  borderColor:
                    paymentSource === 'none'
                      ? '#60A5FA'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : '#E2E8F0',
                },
              ]}
            >
              <Text
                style={[
                  styles.catChipText,
                  {
                    color:
                      paymentSource === 'none'
                        ? '#FFFFFF'
                        : isDark
                        ? '#E2E8F0'
                        : '#475569',
                    fontWeight: paymentSource === 'none' ? '700' : '500',
                  },
                ]}
              >
                Cash / Unlinked
              </Text>
            </TouchableOpacity>

            {accounts.map((acc) => {
              const isSelected = paymentSource === 'account' && selectedAccountId === acc.id;
              return (
                <TouchableOpacity
                  key={acc.id}
                  onPress={() => {
                    hapticLight();
                    setPaymentSource('account');
                    setSelectedAccountId(acc.id);
                    setSelectedCardId(null);
                  }}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: isSelected
                        ? '#2563EB'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#F1F5F9',
                      borderColor: isSelected
                        ? '#60A5FA'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : '#E2E8F0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : isDark
                          ? '#E2E8F0'
                          : '#475569',
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    🏦 {acc.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {type === 'expense' &&
              cards.map((card) => {
                const isSelected = paymentSource === 'card' && selectedCardId === card.id;
                return (
                  <TouchableOpacity
                    key={card.id}
                    onPress={() => {
                      hapticLight();
                      setPaymentSource('card');
                      setSelectedCardId(card.id);
                      setSelectedAccountId(null);
                    }}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: isSelected
                          ? '#2563EB'
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : '#F1F5F9',
                        borderColor: isSelected
                          ? '#60A5FA'
                          : isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : '#E2E8F0',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        {
                          color: isSelected
                            ? '#FFFFFF'
                            : isDark
                            ? '#E2E8F0'
                            : '#475569',
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      💳 {card.card_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>

          <CustomInput
            label="Notes (Optional)"
            placeholder="Add any extra details..."
            value={notes}
            onChangeText={setNotes}
            leftIcon="document-text-outline"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={[
              styles.submitButton,
              {
                backgroundColor: loading
                  ? isDark
                    ? '#1E293B'
                    : '#CBD5E1'
                  : type === 'expense'
                  ? '#EF4444'
                  : '#10B981',
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>
                {transactionToEdit
                  ? 'Save Changes'
                  : type === 'expense'
                  ? 'Add Expense'
                  : 'Add Income'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ModalSheet>

      <CategoryFormModal
        visible={showNewCatModal}
        onClose={() => setShowNewCatModal(false)}
        defaultType={type}
        onSuccess={(newCat) => {
          loadData(type);
          if (newCat) setCategoryId(newCat.id);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  amountInput: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  addCatText: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: 13,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  aiBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  aiBannerSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
});
