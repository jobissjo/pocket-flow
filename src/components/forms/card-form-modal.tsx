import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ModalSheet } from '../ui/modal-sheet';
import { CustomInput } from '../ui/custom-input';
import { creditCardService } from '@/services/creditCards';
import { CreditCardResponse } from '@/services/types';
import { useTheme } from '@/services/theme-context';
import { hapticNotificationSuccess } from '@/services/haptics';

interface CardFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cardToEdit?: CreditCardResponse | null;
}

export function CardFormModal({
  visible,
  onClose,
  onSuccess,
  cardToEdit,
}: CardFormModalProps) {
  const { isDark } = useTheme();
  const [cardName, setCardName] = useState('');
  const [provider, setProvider] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [outstanding, setOutstanding] = useState('');
  const [billingDate, setBillingDate] = useState('15');
  const [dueDate, setDueDate] = useState('5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cardToEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCardName(cardToEdit.card_name);
      setProvider(cardToEdit.provider);
      setLastFour(cardToEdit.last_four);
      setCreditLimit(String(cardToEdit.credit_limit));
      setOutstanding(String(cardToEdit.outstanding_amount));
      setBillingDate(String(cardToEdit.billing_date));
      setDueDate(String(cardToEdit.payment_due_date));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCardName('');
      setProvider('');
      setLastFour('');
      setCreditLimit('');
      setOutstanding('0');
      setBillingDate('15');
      setDueDate('5');
    }
    setError(null);
  }, [cardToEdit, visible]);

  const handleSubmit = async () => {
    if (!cardName.trim()) {
      setError('Card nickname is required');
      return;
    }
    if (!provider.trim()) {
      setError('Card issuer / provider is required');
      return;
    }
    if (!lastFour.trim() || lastFour.length !== 4) {
      setError('Last 4 digits must be exactly 4 numbers');
      return;
    }
    const limitNum = parseFloat(creditLimit);
    if (!limitNum || limitNum <= 0) {
      setError('Please enter a valid credit limit');
      return;
    }

    const bDate = parseInt(billingDate, 10);
    const dDate = parseInt(dueDate, 10);
    if (!bDate || bDate < 1 || bDate > 31) {
      setError('Billing day must be between 1 and 31');
      return;
    }
    if (!dDate || dDate < 1 || dDate > 31) {
      setError('Due day must be between 1 and 31');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const outNum = parseFloat(outstanding) || 0;

      if (cardToEdit) {
        await creditCardService.updateCreditCard(cardToEdit.id, {
          card_name: cardName.trim(),
          provider: provider.trim(),
          last_four: lastFour.trim(),
          credit_limit: limitNum,
          outstanding_amount: outNum,
          billing_date: bDate,
          payment_due_date: dDate,
        });
      } else {
        await creditCardService.createCreditCard({
          card_name: cardName.trim(),
          provider: provider.trim(),
          last_four: lastFour.trim(),
          credit_limit: limitNum,
          outstanding_amount: outNum,
          billing_date: bDate,
          payment_due_date: dDate,
        });
      }

      hapticNotificationSuccess();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save credit card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={cardToEdit ? 'Edit Credit Card' : 'Add Credit Card'}
      subtitle="Track limits, statements and outstanding balance"
    >
      <View style={styles.container}>
        <CustomInput
          label="Card Name"
          placeholder="e.g. Sapphire Preferred, Apple Card"
          value={cardName}
          onChangeText={(text) => {
            setCardName(text);
            setError(null);
          }}
          leftIcon="card-outline"
        />

        <CustomInput
          label="Card Issuer / Provider"
          placeholder="e.g. Chase, Amex, Citi, Visa, Mastercard"
          value={provider}
          onChangeText={(text) => {
            setProvider(text);
            setError(null);
          }}
          leftIcon="business-outline"
        />

        <View style={styles.row}>
          <CustomInput
            label="Last 4 Digits"
            placeholder="e.g. 4321"
            value={lastFour}
            onChangeText={(text) => {
              setLastFour(text.replace(/[^0-9]/g, '').slice(0, 4));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={4}
            containerStyle={{ flex: 1, marginRight: 8 }}
            leftIcon="keypad-outline"
          />

          <CustomInput
            label="Credit Limit"
            placeholder="5000"
            value={creditLimit}
            onChangeText={(text) => {
              setCreditLimit(text);
              setError(null);
            }}
            keyboardType="decimal-pad"
            containerStyle={{ flex: 1, marginLeft: 8 }}
            leftIcon="shield-outline"
          />
        </View>

        <CustomInput
          label="Current Outstanding Amount"
          placeholder="0.00"
          value={outstanding}
          onChangeText={(text) => {
            setOutstanding(text);
            setError(null);
          }}
          keyboardType="decimal-pad"
          leftIcon="cash-outline"
        />

        <View style={styles.row}>
          <CustomInput
            label="Statement Day (1-31)"
            placeholder="15"
            value={billingDate}
            onChangeText={(text) => {
              setBillingDate(text.replace(/[^0-9]/g, '').slice(0, 2));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={2}
            containerStyle={{ flex: 1, marginRight: 8 }}
            leftIcon="calendar-outline"
          />

          <CustomInput
            label="Payment Due Day (1-31)"
            placeholder="5"
            value={dueDate}
            onChangeText={(text) => {
              setDueDate(text.replace(/[^0-9]/g, '').slice(0, 2));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={2}
            containerStyle={{ flex: 1, marginLeft: 8 }}
            leftIcon="time-outline"
          />
        </View>

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
              {cardToEdit ? 'Save Changes' : 'Add Credit Card'}
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
