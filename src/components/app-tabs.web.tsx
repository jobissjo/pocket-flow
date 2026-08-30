import React from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, Text, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/services/theme-context';
import { Colors, MaxContentWidth } from '@/constants/theme';

export default function AppTabs() {
  const { isDark } = useTheme();
  const colors = Colors[isDark ? 'dark' : 'light'];

  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <CustomTabList isDark={isDark}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="dashboard" label="Home" isDark={isDark} colors={colors} />
          </TabTrigger>

          <TabTrigger name="history" href="/history" asChild>
            <TabButton icon="receipt-long" label="Txns" isDark={isDark} colors={colors} />
          </TabTrigger>

          <TabTrigger name="accounts" href={'/accounts' as any} asChild>
            <TabButton icon="account-balance-wallet" label="Vault" isDark={isDark} colors={colors} />
          </TabTrigger>

          <TabTrigger name="goals" href="/goals" asChild>
            <TabButton icon="credit-score" label="EMI" isDark={isDark} colors={colors} />
          </TabTrigger>

          <TabTrigger name="analytics" href="/analytics" asChild>
            <TabButton icon="pie-chart" label="Stats" isDark={isDark} colors={colors} />
          </TabTrigger>

          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton icon="person" label="Profile" isDark={isDark} colors={colors} />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

interface TabButtonProps extends TabTriggerSlotProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  isDark: boolean;
  colors: any;
}

export function TabButton({ icon, label, isFocused, isDark, colors, ...props }: TabButtonProps) {
  const activeColor = colors.tint || '#3b82f6';
  const inactiveColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <Pressable
      {...props}
      android_ripple={{
        color: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
        borderless: true,
        radius: 30,
      }}
      style={({ pressed }) => [
        styles.tabButton,
        isFocused && {
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(59, 130, 246, 0.14)',
        },
        pressed && styles.pressed,
      ]}
    >
      <MaterialIcons
        name={icon}
        size={20}
        color={isFocused ? activeColor : inactiveColor}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused ? activeColor : inactiveColor },
          isFocused && styles.tabLabelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CustomTabList({ children, isDark, ...props }: TabListProps & { isDark: boolean }) {
  return (
    <View {...props} style={styles.tabListContainer} pointerEvents="box-none">
      <View
        pointerEvents="auto"
        style={[
          styles.innerContainer,
          {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
          },
        ]}
      >
        <View style={styles.tabsRow}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: MaxContentWidth,
    borderRadius: 32,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  tabsRow: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 9999,
    overflow: 'hidden',
    marginHorizontal: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
    borderRadius: 9999,
  },
});
