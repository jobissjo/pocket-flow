import React from 'react';
import { StyleSheet, Platform, type TouchableOpacityProps, TouchableOpacity, type GestureResponderEvent, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { useTheme } from '@/services/theme-context';
import { hapticLight } from '@/services/haptics';

export type GlassCardProps = TouchableOpacityProps & {
  children?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  activeOpacity?: number;
};

export function GlassCard({ children, style, onPress, activeOpacity, accessibilityRole, ...props }: GlassCardProps) {
  const { isDark } = useTheme();

  const cardStyle = [
    styles.card,
    isDark ? styles.cardDark : styles.cardLight,
    style,
  ];

  const handlePress = (e: GestureResponderEvent) => {
    hapticLight();
    if (onPress) onPress(e);
  };

  if (Platform.OS === 'ios') {
    if (onPress) {
      return (
        <TouchableOpacity 
          onPress={handlePress} 
          activeOpacity={activeOpacity ?? 0.85} 
          style={cardStyle} 
          accessibilityRole={accessibilityRole || 'button'}
          {...props}
        >
          <GlassView
            glassEffectStyle="clear"
            colorScheme={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {children}
        </TouchableOpacity>
      );
    }

    return (
      <GlassView
        glassEffectStyle="clear"
        colorScheme={isDark ? 'dark' : 'light'}
        style={cardStyle}
        accessibilityRole={accessibilityRole || 'summary'}
        {...props}
      >
        {children}
      </GlassView>
    );
  }

  // Android & Web Fallback (uses standard View/TouchableOpacity)
  if (onPress) {
    return (
      <TouchableOpacity 
        onPress={handlePress} 
        activeOpacity={activeOpacity ?? 0.85} 
        style={cardStyle} 
        accessibilityRole={accessibilityRole || 'button'}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={cardStyle}
      accessibilityRole={accessibilityRole || 'summary'}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
  },
  cardDark: {
    ...Platform.select({
      ios: {
        backgroundColor: 'rgba(28, 28, 30, 0.45)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      web: {
        backgroundColor: 'rgba(28, 28, 30, 0.45)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      },
      android: {
        backgroundColor: '#1C1C1E',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        elevation: 4,
      },
      default: {
        backgroundColor: '#1C1C1E',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }
    }),
  },
  cardLight: {
    ...Platform.select({
      ios: {
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        borderColor: 'rgba(255, 255, 255, 0.9)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      web: {
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        borderColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.6)',
      },
      android: {
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        borderColor: 'rgba(255, 255, 255, 0.95)',
        borderWidth: 1,
        elevation: 3,
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      default: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.9)',
      }
    }),
  },
});
