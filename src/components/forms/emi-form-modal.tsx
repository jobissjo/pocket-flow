import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { ModalSheet } from '../ui/modal-sheet';
import { CustomInput } from '../ui/custom-input';
import { emiService } from '@/services/emi';
import { accountService } from '@/services/accounts';
import { creditCardService } from '@/services/creditCards';
import {
  EMIResponse,
  AccountResponse,
  CreditCardResponse,
} from '@/services/types';
import { useTheme } from '@/services/theme-context';
import { hapticNotificationSuccess, hapticLight } from '@/services/haptics';

interface EMIFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  emiToEdit?: EMIResponse | null;
}

export function EMIFormModal({
  visible,
  onClose,
  onSuccess,
  emiToEdit,
}: EMIFormModalProps) {
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [paidInstallments, setPaidInstallments] = useState('0');
  const [dueDay, setDueDay] = useState('1');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      accountService.listAccounts().then(setAccounts).catch(() => {});
      creditCardService.listCreditCards().then(setCards).catch(() => {});
    }
  }, [visible]);

  useEffect(() => {
    if (emiToEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(emiToEdit.name);
      setTotalAmount(String(emiToEdit.total_amount));
      setMonthlyAmount(String(emiToEdit.monthly_emi_amount));
      setTotalInstallments(String(emiToEdit.total_installments));
      setPaidInstallments(String(emiToEdit.paid_installments));
      setDueDay(String(emiToEdit.due_day));
      setSelectedAccountId(emiToEdit.account_id || null);
      setSelectedCardId(emiToEdit.credit_card_id || null);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName('');
      setTotalAmount('');
      setMonthlyAmount('');
      setTotalInstallments('');
      setPaidInstallments('0');
      setDueDay('1');
      setSelectedAccountId(null);
      setSelectedCardId(null);
    }
    setError(null);
  }, [emiToEdit, visible]);

  // Auto-calculate monthly amount if total and installments entered
  const handleInstallmentsChange = (text: string) => {
    setTotalInstallments(text);
    const count = parseInt(text, 10);
    const total = parseFloat(totalAmount);
    if (count > 0 && total > 0 && !monthlyAmount) {
      setMonthlyAmount((total / count).toFixed(2));
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Loan/Item name is required');
      return;
    }
    const totNum = parseFloat(totalAmount);
    if (!totNum || totNum <= 0) {
      setError('Please enter a valid total amount');
      return;
    }
    const monthNum = parseFloat(monthlyAmount);
    if (!monthNum || monthNum <= 0) {
      setError('Please enter monthly installment amount');
      return;
    }
    const totInst = parseInt(totalInstallments, 10);
    if (!totInst || totInst <= 0) {
      setError('Please enter total number of installments');
      return;
    }
    const dDay = parseInt(dueDay, 10);
    if (!dDay || dDay < 1 || dDay > 31) {
      setError('Due day must be between 1 and 31');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const paidInst = parseInt(paidInstallments, 10) || 0;

      if (emiToEdit) {
        await emiService.updateEMI(emiToEdit.id, {
          name: name.trim(),
          total_amount: totNum,
          monthly_emi_amount: monthNum,
          total_installments: totInst,
          paid_installments: paidInst,
          due_day: dDay,
          account_id: selectedAccountId,
          credit_card_id: selectedCardId,
        });
      } else {
        await emiService.createEMI({
          name: name.trim(),
          total_amount: totNum,
          monthly_emi_amount: monthNum,
          total_installments: totInst,
          paid_installments: paidInst,
          due_day: dDay,
          account_id: selectedAccountId,
          credit_card_id: selectedCardId,
        });
      }

      hapticNotificationSuccess();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save EMI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={emiToEdit ? 'Edit EMI Tracker' : 'New EMI / Loan'}
      subtitle="Track monthly installments and auto-pay progress"
    >
      <View style={styles.container}>
        <CustomInput
          label="Loan / Purchase Name"
          placeholder="e.g. MacBook Pro, Home Loan, iPhone 16"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          leftIcon="cube-outline"
        />

        <View style={styles.row}>
          <CustomInput
            label="Total Loan Amount"
            placeholder="1200"
            value={totalAmount}
            onChangeText={(text) => {
              setTotalAmount(text);
              setError(null);
            }}
            keyboardType="decimal-pad"
            containerStyle={{ flex: 1, marginRight: 8 }}
            leftIcon="cash-outline"
          />

          <CustomInput
            label="Monthly EMI"
            placeholder="100"
            value={monthlyAmount}
            onChangeText={(text) => {
              setMonthlyAmount(text);
              setError(null);
            }}
            keyboardType="decimal-pad"
            containerStyle={{ flex: 1, marginLeft: 8 }}
            leftIcon="calendar-outline"
          />
        </View>

        <View style={styles.row}>
          <CustomInput
            label="Total Months / Tenor"
            placeholder="12"
            value={totalInstallments}
            onChangeText={handleInstallmentsChange}
            keyboardType="number-pad"
            containerStyle={{ flex: 1, marginRight: 8 }}
            leftIcon="layers-outline"
          />

          <CustomInput
            label="Already Paid Months"
            placeholder="0"
            value={paidInstallments}
            onChangeText={(text) => {
              setPaidInstallments(text);
              setError(null);
            }}
            keyboardType="number-pad"
            containerStyle={{ flex: 1, marginLeft: 8 }}
            leftIcon="checkmark-circle-outline"
          />
        </View>

        <CustomInput
          label="Monthly Due Day of Month (1 - 31)"
          placeholder="1"
          value={dueDay}
          onChangeText={(text) => {
            setDueDay(text.replace(/[^0-9]/g, '').slice(0, 2));
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={2}
          leftIcon="today-outline"
        />

        {/* Optional Account linking */}
        {accounts.length > 0 ? (
          <View style={styles.linkSection}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#94A3B8' : '#475569' }]}>
              Linked Payment Account (Optional)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
              {accounts.map((acc) => {
                const isSelected = selectedAccountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => {
                      hapticLight();
                      setSelectedAccountId(isSelected ? null : acc.id);
                      if (!isSelected) setSelectedCardId(null);
                    }}
                    style={[
                      styles.chip,
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
                        styles.chipText,
                        { color: isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569' },
                      ]}
                    >
                      {acc.name} (••• {acc.last_four})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

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
                : '#2563EB',
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>
              {emiToEdit ? 'Save EMI' : 'Create EMI Tracker'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
  },
  linkSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  scrollRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  submitButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
