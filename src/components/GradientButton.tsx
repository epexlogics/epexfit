/**
 * GradientButton — Premium button with gradient background and inner shadow
 * 
 * Features:
 * - Gradient background (cyan to teal)
 * - 40px corner radius (fully pill-shaped)
 * - Inner shadow for depth
 * - No sharp edges
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, shadows } from '../constants/theme';

interface GradientButtonProps {
  /** Button text */
  label: string;
  /** On press handler */
  onPress: () => void;
  /** Custom gradient colors (defaults to theme gradientPrimary) */
  gradientColors?: string[];
  /** Button style */
  style?: ViewStyle;
  /** Text style */
  textStyle?: TextStyle;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
}

export default function GradientButton({
  label,
  onPress,
  gradientColors,
  style,
  textStyle,
  disabled = false,
  size = 'medium',
}: GradientButtonProps) {
  const { colors } = useTheme();
  
  const gradient = (gradientColors ?? colors.gradientPrimary) as [string, string, ...string[]];

  
  const sizeStyles = {
    small: { paddingHorizontal: 20, paddingVertical: 10, fontSize: 13 },
    medium: { paddingHorizontal: 32, paddingVertical: 14, fontSize: 14 },
    large: { paddingHorizontal: 40, paddingVertical: 18, fontSize: 16 },
  };
  
  const currentSize = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.container,
        { opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          {
            paddingHorizontal: currentSize.paddingHorizontal,
            paddingVertical: currentSize.paddingVertical,
            ...shadows.glow,
          }
        ]}
      >
        {/* Inner shadow effect (simulated with overlay) */}
        <Text style={[
          styles.text,
          {
            color: colors.onPrimary,
            fontSize: currentSize.fontSize,
          },
          textStyle,
        ]}>
          {label}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.3,
    fontFamily: 'Inter_800ExtraBold',
  },
});
