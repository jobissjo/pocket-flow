import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomInput } from '../ui/custom-input';
import { SegmentedControl } from '../ui/segmented-control';
import { useTheme } from '@/services/theme-context';
import { useCurrency } from '@/services/currency';
import { hapticImpactMedium, hapticLight } from '@/services/haptics';
import { accountService } from '@/services/accounts';
import { creditCardService } from '@/services/creditCards';
import { categoryService } from '@/services/categories';
import type {
  TransactionImportDraft,
  ConfirmImportPayload,
  ExtractedLineItem,
} from '@/services/transactionImportsTypes';
import type {
  AccountResponse,
  CreditCardResponse,
  CategoryResponse,
  TransactionType,
} from '@/services/types';

interface ImportReviewFormProps {
  draft: TransactionImportDraft;
  onConfirm: (payload: ConfirmImportPayload) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'debit_card', label: 'Debit Card' },
  { id: 'net_banking', label: 'Net Banking' },
  { id: 'cash', label: 'Cash' },
  { id: 'other', label: 'Other' },
];

export function ImportReviewForm({
  draft,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: ImportReviewFormProps) {
  const { isDark } = useTheme();
  const { formatAmount, currencySymbol } = useCurrency();

  // Form Fields
  const [type, setType] = useState<TransactionType>(draft.transactionType);
  const [title, setTitle] = useState(draft.merchant.name || '');
  const [amount, setAmount] = useState(draft.amount ? String(draft.amount) : '');
  const [date, setDate] = useState(draft.date || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState(draft.paymentMethod?.toLowerCase() || 'upi');
  const [referenceId, setReferenceId] = useState(draft.referenceId || '');
  const [notes, setNotes] = useState(draft.notes || '');

  // Ledger matching
  const [paymentSource, setPaymentSource] = useState<'none' | 'account' | 'card'>('none');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Line items & UI expanders
  const [lineItems] = useState<ExtractedLineItem[]>(draft.lineItems || []);
  const [showLineItems, setShowLineItems] = useState(Boolean(draft.lineItems && draft.lineItems.length > 0));
  const [showFullImage, setShowFullImage] = useState(false);
  const [ignoreDuplicate, setIgnoreDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entities loaded from backend
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  // Load user's accounts, cards & categories
  useEffect(() => {
    async function loadEntities() {
      try {
        const [accs, ccList, cats] = await Promise.all([
          accountService.listAccounts().catch(() => []),
          creditCardService.listCreditCards().catch(() => []),
          categoryService.listCategories().catch(() => []),
        ]);
        setAccounts(accs);
        setCards(ccList);
        setCategories(cats);

        // 1. Account / Card resolution
        let resolvedSource: 'none' | 'account' | 'card' = 'none';
        let resolvedAccountId: string | null = null;
        let resolvedCardId: string | null = null;

        if (draft.accountMatch.creditCardId) {
          const match = ccList.find((c) => c.id === draft.accountMatch.creditCardId);
          if (match) {
            resolvedSource = 'card';
            resolvedCardId = match.id;
          }
        }

        if (!resolvedCardId && draft.accountMatch.accountId) {
          const match = accs.find((a) => a.id === draft.accountMatch.accountId);
          if (match) {
            resolvedSource = 'account';
            resolvedAccountId = match.id;
          }
        }

        if (!resolvedAccountId && !resolvedCardId && draft.accountMatch.last4Digits) {
          const cardMatch = ccList.find((c) => c.last_four === draft.accountMatch.last4Digits);
          if (cardMatch) {
            resolvedSource = 'card';
            resolvedCardId = cardMatch.id;
          } else {
            const accMatch = accs.find((a) =>
              (a as any).account_number?.endsWith(draft.accountMatch.last4Digits || '') ||
              (a as any).last_four === draft.accountMatch.last4Digits
            );
            if (accMatch) {
              resolvedSource = 'account';
              resolvedAccountId = accMatch.id;
            }
          }
        }

        // Fallback to first available account if none matched
        if (!resolvedAccountId && !resolvedCardId) {
          if (accs.length > 0) {
            resolvedSource = 'account';
            resolvedAccountId = accs[0].id;
          }
        }

        setPaymentSource(resolvedSource);
        setSelectedAccountId(resolvedAccountId);
        setSelectedCardId(resolvedCardId);

        // 2. Category resolution
        let resolvedCatId = '';
        if (draft.categoryMatch.categoryId) {
          const match = cats.find((c) => c.id === draft.categoryMatch.categoryId);
          if (match) resolvedCatId = match.id;
        }

        if (!resolvedCatId && (draft.categoryMatch.suggestedName || draft.categoryMatch.matchedName)) {
          const query = (draft.categoryMatch.suggestedName || draft.categoryMatch.matchedName || '').toLowerCase();
          const match = cats.find(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              query.includes(c.name.toLowerCase())
          );
          if (match) resolvedCatId = match.id;
        }

        if (!resolvedCatId && cats.length > 0) {
          const typeFiltered = cats.filter((c) => c.type === type);
          resolvedCatId = typeFiltered.length > 0 ? typeFiltered[0].id : cats[0].id;
        }

        setSelectedCategoryId(resolvedCatId);
      } catch (err) {
        console.error('Error loading entities for review:', err);
      }
    }

    loadEntities();
  }, [draft, type]);

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('Title / Merchant is required');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }
    if (!selectedCategoryId) {
      setError('Please select a category');
      return;
    }

    if (draft.duplicateWarning?.isDuplicate && !ignoreDuplicate) {
      setError('Please acknowledge the duplicate warning before saving.');
      return;
    }

    hapticImpactMedium();
    onConfirm({
      title: title.trim(),
      amount: numAmount,
      currency: draft.currency || 'INR',
      transaction_type: type,
      category_id: selectedCategoryId,
      account_id: paymentSource === 'account' ? selectedAccountId : null,
      credit_card_id: paymentSource === 'card' ? selectedCardId : null,
      date: date,
      payment_method: paymentMethod,
      reference_id: referenceId.trim() || undefined,
      notes: notes.trim() || undefined,
      line_items: lineItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
      })),
    });
  };

  const confidencePercent = draft.confidenceScore
    ? Math.round(draft.confidenceScore * 100)
    : 95;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Top AI Confidence & Receipt Preview Bar */}
      <View
        style={[
          styles.topBanner,
          {
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
            borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#BFDBFE',
          },
        ]}
      >
        <View style={styles.confidenceRow}>
          <View style={styles.sparkleBadge}>
            <Ionicons name="sparkles" size={14} color="#3B82F6" />
            <Text style={styles.sparkleText}>AI Extracted • {confidencePercent}% Confidence</Text>
          </View>

          {draft.imageUrl ? (
            <TouchableOpacity
              onPress={() => setShowFullImage(true)}
              style={styles.thumbnailBtn}
            >
              <Image source={{ uri: draft.imageUrl }} style={styles.thumbnail} />
              <View style={styles.zoomOverlay}>
                <Ionicons name="scan-outline" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {draft.warnings && draft.warnings.length > 0 ? (
          <View style={styles.warningBox}>
            {draft.warnings.map((w, idx) => (
              <Text key={idx} style={[styles.warningText, { color: isDark ? '#FCD34D' : '#D97706' }]}>
                ⚠️ {w}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {/* Duplicate Warning Card */}
      {draft.duplicateWarning?.isDuplicate && (
        <View
          style={[
            styles.duplicateCard,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
            },
          ]}
        >
          <View style={styles.duplicateHeader}>
            <Ionicons name="alert-circle" size={18} color="#F59E0B" />
            <Text style={[styles.duplicateTitle, { color: isDark ? '#FDE68A' : '#B45309' }]}>
              Possible Duplicate Transaction
            </Text>
          </View>
          <Text style={[styles.duplicateDesc, { color: isDark ? '#FDE68A' : '#92400E' }]}>
            {draft.duplicateWarning.message ||
              'A transaction with a similar amount and date was found in your records.'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setIgnoreDuplicate(!ignoreDuplicate);
            }}
            style={styles.ignoreCheckboxRow}
          >
            <Ionicons
              name={ignoreDuplicate ? 'checkbox' : 'square-outline'}
              size={18}
              color={ignoreDuplicate ? '#F59E0B' : '#94A3B8'}
            />
            <Text style={[styles.ignoreText, { color: isDark ? '#E2E8F0' : '#475569' }]}>
              This is a separate transaction (save anyway)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Transaction Type Segmented Control */}
      <SegmentedControl
        options={[
          { label: 'Expense', value: 'expense' },
          { label: 'Income', value: 'income' },
        ]}
        value={type}
        onChange={(val) => {
          setType(val as TransactionType);
          const typeFiltered = categories.filter((c) => c.type === val);
          if (typeFiltered.length > 0) {
            setSelectedCategoryId(typeFiltered[0].id);
          }
        }}
        style={{ marginBottom: 14 }}
      />

      {/* Amount & Currency */}
      <CustomInput
        label={`Amount (${currencySymbol})`}
        placeholder="0.00"
        value={amount}
        onChangeText={(txt) => {
          setAmount(txt);
          setError(null);
        }}
        keyboardType="decimal-pad"
        leftIcon="cash-outline"
        style={styles.amountInput}
      />

      {/* Title / Merchant */}
      <CustomInput
        label="Merchant / Title"
        placeholder="e.g. Swiggy, Amazon, Metro Mart"
        value={title}
        onChangeText={(txt) => {
          setTitle(txt);
          setError(null);
        }}
        leftIcon="cart-outline"
      />

      {/* Date */}
      <CustomInput
        label="Transaction Date (YYYY-MM-DD)"
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
        leftIcon="calendar-outline"
      />

      {/* Payment Source Picker */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#475569' }]}>
          Payment Account / Source
        </Text>
        {draft.accountMatch.status === 'matched' ? (
          <View style={styles.matchBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
            <Text style={styles.matchBadgeText}>AI Auto-matched</Text>
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            setPaymentSource('none');
            setSelectedAccountId(null);
            setSelectedCardId(null);
          }}
          style={[
            styles.chip,
            {
              backgroundColor:
                paymentSource === 'none'
                  ? '#2563EB'
                  : isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : '#F1F5F9',
              borderColor: paymentSource === 'none' ? '#60A5FA' : isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.chipText, { color: paymentSource === 'none' ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569' }]}>
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
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? '#2563EB'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#F1F5F9',
                  borderColor: isSelected ? '#60A5FA' : isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                },
              ]}
            >
              <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569' }]}>
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
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? '#2563EB'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#F1F5F9',
                    borderColor: isSelected ? '#60A5FA' : isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569' }]}>
                  💳 {card.card_name}
                </Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* Category Picker */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#475569' }]}>
          Category
        </Text>
        {draft.categoryMatch.status === 'matched' ? (
          <View style={styles.matchBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
            <Text style={styles.matchBadgeText}>AI Auto-matched</Text>
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {categories
          .filter((c) => c.type === type)
          .map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  hapticLight();
                  setSelectedCategoryId(cat.id);
                  setError(null);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? '#2563EB'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#F1F5F9',
                    borderColor: isSelected ? '#60A5FA' : isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569',
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

      {/* Payment Method */}
      <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#475569', marginTop: 4 }]}>
        Payment Method
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {PAYMENT_METHODS.map((pm) => {
          const isSelected = paymentMethod === pm.id;
          return (
            <TouchableOpacity
              key={pm.id}
              onPress={() => {
                hapticLight();
                setPaymentMethod(pm.id);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? '#2563EB'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#F1F5F9',
                  borderColor: isSelected ? '#60A5FA' : isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569',
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {pm.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Reference ID (UTR / Transaction ID) */}
      <CustomInput
        label="Reference / UTR / Order ID (Optional)"
        placeholder="e.g. UPI/4928104829, TXN10398"
        value={referenceId}
        onChangeText={setReferenceId}
        leftIcon="barcode-outline"
      />

      {/* Itemized Line Items (if extracted) */}
      {lineItems.length > 0 ? (
        <View
          style={[
            styles.lineItemsContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setShowLineItems(!showLineItems);
            }}
            style={styles.lineItemsHeader}
          >
            <View style={styles.lineItemsTitleRow}>
              <Ionicons name="receipt-outline" size={16} color="#3B82F6" />
              <Text style={[styles.lineItemsTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Extracted Line Items ({lineItems.length})
              </Text>
            </View>
            <Ionicons
              name={showLineItems ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={isDark ? '#94A3B8' : '#64748B'}
            />
          </TouchableOpacity>

          {showLineItems ? (
            <View style={styles.lineItemsList}>
              {lineItems.map((item, idx) => (
                <View key={item.id || idx} style={styles.lineItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lineItemName, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                      {item.name}
                    </Text>
                    {item.quantity > 1 ? (
                      <Text style={[styles.lineItemQty, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                        Qty: {item.quantity} {item.unitPrice ? `@ ${formatAmount(item.unitPrice)}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.lineItemPrice, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {formatAmount(item.totalPrice)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Notes */}
      <CustomInput
        label="Notes / Remarks (Optional)"
        placeholder="Add any extra details or tags..."
        value={notes}
        onChangeText={setNotes}
        leftIcon="document-text-outline"
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={onCancel}
          disabled={isSubmitting}
          style={[
            styles.cancelBtn,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1',
            },
          ]}
        >
          <Text style={[styles.cancelBtnText, { color: isDark ? '#E2E8F0' : '#475569' }]}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={[
            styles.confirmBtn,
            { opacity: isSubmitting ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="checkmark-done" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.confirmBtnText}>
            {isSubmitting ? 'Saving...' : 'Confirm & Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full image viewer modal */}
      {draft.imageUrl ? (
        <Modal
          visible={showFullImage}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFullImage(false)}
        >
          <View style={styles.fullImageBackdrop}>
            <TouchableOpacity
              onPress={() => setShowFullImage(false)}
              style={styles.closeFullImageBtn}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: draft.imageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  topBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparkleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sparkleText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
  },
  thumbnailBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  zoomOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 2,
  },
  warningBox: {
    gap: 4,
  },
  warningText: {
    fontSize: 11,
    lineHeight: 16,
  },
  duplicateCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  duplicateTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  duplicateDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  ignoreCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  ignoreText: {
    fontSize: 12,
    fontWeight: '500',
  },
  amountInput: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  matchBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  lineItemsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginVertical: 10,
  },
  lineItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineItemsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineItemsTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  lineItemsList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
    gap: 8,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineItemName: {
    fontSize: 12,
    fontWeight: '500',
  },
  lineItemQty: {
    fontSize: 11,
    marginTop: 2,
  },
  lineItemPrice: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  fullImageBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFullImageBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '90%',
    height: '80%',
  },
});
