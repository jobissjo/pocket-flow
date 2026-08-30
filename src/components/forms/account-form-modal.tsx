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
import { accountService } from '@/services/accounts';
import { AccountResponse, AccountType } from '@/services/types';
import { useTheme } from '@/services/theme-context';
import { hapticNotificationSuccess, hapticLight } from '@/services/haptics';

interface AccountFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accountToEdit?: AccountResponse | null;
}

const ACCOUNT_TYPES: Array<{ label: string; value: AccountType }> = [
  { label: 'Savings', value: 'savings' },
  { label: 'Current', value: 'current' },
  { label: 'Salary', value: 'salary' },
  { label: 'Cash', value: 'cash' },
  { label: 'Other', value: 'other' },
];

export function AccountFormModal({
  visible,
  onClose,
  onSuccess,
  accountToEdit,
}: AccountFormModalProps) {
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('savings');
  const [accountNumber, setAccountNumber] = useState('');
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accountToEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(accountToEdit.name);
      setBankName(accountToEdit.bank_name);
      setAccountType(accountToEdit.account_type);
      setAccountNumber(accountToEdit.last_four || '0000');
      setBalance(String(accountToEdit.balance));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName('');
      setBankName('');
      setAccountType('savings');
      setAccountNumber('');
      setBalance('0');
    }
    setError(null);
  }, [accountToEdit, visible]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Account name is required');
      return;
    }
    if (!bankName.trim()) {
      setError('Bank/Provider name is required');
      return;
    }
    if (!accountToEdit && (!accountNumber.trim() || accountNumber.length < 4)) {
      setError('Account number must be at least 4 digits');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const parsedBalance = parseFloat(balance) || 0;

      if (accountToEdit) {
        await accountService.updateAccount(accountToEdit.id, {
          name: name.trim(),
          bank_name: bankName.trim(),
          account_type: accountType,
          balance: parsedBalance,
        });
      } else {
        await accountService.createAccount({
          name: name.trim(),
          bank_name: bankName.trim(),
          account_type: accountType,
          account_number: accountNumber.trim(),
          balance: parsedBalance,
        });
      }

      hapticNotificationSuccess();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={accountToEdit ? 'Edit Account' : 'Add Bank Account'}
      subtitle="Track your bank balances and cash accounts"
    >
      <View style={styles.container}>
        <CustomInput
          label="Account Nickname"
          placeholder="e.g. Primary Savings, Main Checking"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          leftIcon="wallet-outline"
        />

        <CustomInput
          label="Bank / Provider Name"
          placeholder="e.g. Chase, Wells Fargo, HDFC, Revolut"
          value={bankName}
          onChangeText={(text) => {
            setBankName(text);
            setError(null);
          }}
          leftIcon="business-outline"
        />

        <Text
          style={[
            styles.label,
            { color: isDark ? '#94A3B8' : '#475569' },
          ]}
        >
          Account Type
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeScroll}
          contentContainerStyle={styles.typeContainer}
        >
          {ACCOUNT_TYPES.map((type) => {
            const isSelected = accountType === type.value;
            return (
              <TouchableOpacity
                key={type.value}
                onPress={() => {
                  hapticLight();
                  setAccountType(type.value);
                }}
                style={[
                  styles.typeChip,
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
                    styles.typeText,
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
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {!accountToEdit ? (
          <CustomInput
            label="Account Number (or last 4 digits)"
            placeholder="e.g. 1234567890"
            value={accountNumber}
            onChangeText={(text) => {
              setAccountNumber(text);
              setError(null);
            }}
            keyboardType="number-pad"
            leftIcon="key-outline"
          />
        ) : null}

        <CustomInput
          label="Current Balance"
          placeholder="0.00"
          value={balance}
          onChangeText={(text) => {
            setBalance(text);
            setError(null);
          }}
          keyboardType="decimal-pad"
          leftIcon="cash-outline"
          error={error || undefined}
        />

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
              {accountToEdit ? 'Save Changes' : 'Create Account'}
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  typeScroll: {
    marginBottom: 16,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 13,
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
