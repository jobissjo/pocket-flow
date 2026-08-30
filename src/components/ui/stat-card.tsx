import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { GlassCard } from './glass-card';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/services/theme-context';

interface StatCardProps {
  title: string;
  amount: string;
  subtitle?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  badgeText?: string;
  badgeColor?: string;
  badgeBg?: string;
  trend?: 'up' | 'down' | 'neutral';
  style?: ViewStyle;
  onPress?: () => void;
}

export function StatCard({
  title,
  amount,
  subtitle,
  iconName,
  iconColor = '#3B82F6',
  iconBg = 'rgba(59, 130, 246, 0.15)',
  badgeText,
  badgeColor = '#10B981',
  badgeBg = 'rgba(16, 185, 129, 0.15)',
  style,
  onPress,
}: StatCardProps) {
  const { isDark } = useTheme();

  return (
    <GlassCard style={[styles.card, style]} onPress={onPress}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>
        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.title, { color: isDark ? '#94A3B8' : '#64748B' }]}>{title}</Text>
      <Text style={[styles.amount, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: isDark ? '#64748B' : '#94A3B8' }]}>{subtitle}</Text>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 4,
  },
});
