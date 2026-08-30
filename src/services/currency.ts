import { useState, useEffect, useCallback } from 'react';
import { useIsFocused } from 'expo-router';
import { getSecureItem, saveSecureItem } from './secure-storage';

export function getCurrencySymbol(code: string): string {
  switch (code) {
    case 'INR': return '₹';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'CAD': return 'CA$';
    case 'AUD': return 'AU$';
    default: return '₹';
  }
}

export function useCurrency() {
  const isFocused = useIsFocused();
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  const loadCurrency = useCallback(async () => {
    const code = (await getSecureItem('pocketflow_currency')) || 'INR';
    setCurrencyCode(code);
    setCurrencySymbol(getCurrencySymbol(code));
  }, []);

  const updateCurrency = async (code: string) => {
    await saveSecureItem('pocketflow_currency', code);
    setCurrencyCode(code);
    setCurrencySymbol(getCurrencySymbol(code));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCurrency();
  }, [isFocused, loadCurrency]);

  const formatAmount = (amount: number | undefined | null, digits: number = 2) => {
    const safeAmount = amount ?? 0;
    const locale = currencyCode === 'INR' ? 'en-IN' : undefined;
    const formatted = Math.abs(safeAmount).toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    return `${safeAmount < 0 ? '-' : ''}${currencySymbol}${formatted}`;
  };

  return { currencyCode, currencySymbol, formatAmount, updateCurrency, reloadCurrency: loadCurrency };
}
