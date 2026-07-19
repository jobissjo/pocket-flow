import { Colors } from '@/constants/theme';
import { useTheme } from '@/services/theme-context';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function AppTabs() {
  const { isDark } = useTheme();
  const colors = Colors[isDark ? 'dark' : 'light'];

  return (
    <NativeTabs
      tintColor={colors.tint}
      accentColor={colors.tint}
      selectedIconColor={colors.tint}
      iconColor={colors.textSecondary}
      backgroundColor={isDark ? '#08080C' : 'rgba(255, 255, 255, 0.92)'}
      indicatorColor={colors.backgroundElement}
      rippleColor={isDark ? 'rgba(96, 165, 250, 0.25)' : 'rgba(37, 99, 235, 0.18)'}
      labelStyle={{
        selected: { color: colors.tint, fontWeight: '700' },
        default: { color: colors.textSecondary }
      }}
      selectedLabelStyle={{
        color: colors.tint,
        fontWeight: '700'
      }}>
      
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="house.fill"
          md="home"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="clock.fill"
          md="history"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analytics">
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="chart.bar.fill"
          md="analytics"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Label>Goals</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="flag.fill"
          md="flag"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="person.fill"
          md="person"
        />
      </NativeTabs.Trigger>

    </NativeTabs>
  );
}
