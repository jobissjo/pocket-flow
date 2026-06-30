import { useState, useEffect } from 'react';
import { useIsFocused } from 'expo-router';
import { getSetting } from './db';

export function getCurrencySymbol(code: string): string {
  switch (code) {
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'INR': return '₹';
    default: return '$';
  }
}

export function useCurrency() {
  const isFocused = useIsFocused();
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const loadCurrency = async () => {
    const code = await getSetting('currency', 'USD');
    setCurrencyCode(code);
    setCurrencySymbol(getCurrencySymbol(code));
  };

  useEffect(() => {
    loadCurrency();
  }, [isFocused]);

  const formatAmount = (amount: number, digits: number = 2) => {
    const formatted = Math.abs(amount).toLocaleString(undefined, { 
      minimumFractionDigits: digits, 
      maximumFractionDigits: digits 
    });
    return `${amount < 0 ? '-' : ''}${currencySymbol}${formatted}`;
  };

  return { currencyCode, currencySymbol, formatAmount, reloadCurrency: loadCurrency };
}
