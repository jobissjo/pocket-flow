import React from 'react';
import { StyleSheet, Platform, type ViewProps, TouchableOpacity, type GestureResponderEvent, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { useTheme } from '@/services/theme-context';

export type GlassCardProps = ViewProps & {
  children?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  activeOpacity?: number;
};

export function GlassCard({ children, style, onPress, activeOpacity, ...props }: GlassCardProps) {
  const { isDark } = useTheme();

  const cardStyle = [
    styles.card,
    isDark ? styles.cardDark : styles.cardLight,
    style,
  ];

  if (Platform.OS === 'ios') {
    if (onPress) {
      return (
        <TouchableOpacity 
          onPress={onPress} 
          activeOpacity={activeOpacity ?? 0.85} 
          style={cardStyle} 
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
        onPress={onPress} 
        activeOpacity={activeOpacity ?? 0.85} 
        style={cardStyle} 
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={cardStyle}
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
        backgroundColor: 'rgba(255, 255, 255, 0.55)',
        borderColor: 'rgba(255, 255, 255, 0.35)',
      },
      web: {
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        borderColor: 'rgba(255, 255, 255, 0.35)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      },
      android: {
        backgroundColor: '#ffffff',
        borderColor: 'rgba(0, 0, 0, 0.06)',
        elevation: 3,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      default: {
        backgroundColor: '#ffffff',
        borderColor: 'rgba(0, 0, 0, 0.06)',
      }
    }),
  },
});
