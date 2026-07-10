/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useTheme as useThemeContext } from '@/services/theme-context';

export function useTheme() {
  const { isDark } = useThemeContext();
  return Colors[isDark ? 'dark' : 'light'];
}
