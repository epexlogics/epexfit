/**
 * PremiumCard — Inspiration-level card with inner glow, gradient, and depth
 * 
 * Features:
 * - Gradient background (surface to darker variant)
 * - Inner glow (inset shadow at top edge)
 * - 1px inner border on header
 * - 20-24px border radius
 * - Large diffuse shadow
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, shadows } from '../constants/theme';

interface PremiumCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Show inner border at top (for card headers) */
  hasHeader?: boolean;
  /** Custom gradient colors (defaults to theme gradientCard) */
  gradientColors?: string[];
  /** Border radius size: 'lg' (20px) or 'xl' (24px) */
  size?: 'lg' | 'xl';
}

export default function PremiumCard({ 
  children, 
  style, 
  hasHeader = false,
  gradientColors,
  size = 'xl'
}: PremiumCardProps) {
  const { colors, isDark } = useTheme();
  
  const gradient = gradientColors ?? colors.gradientCard;
  const radius = size === 'xl' ? borderRadius.xl : borderRadius.lg;
  
  // Inner glow color (white at 10-15% opacity on top edge)
  const innerGlowColor = isDark 
    ? 'rgba(255, 255, 255, 0.08)' 
    : 'rgba(255, 255, 255, 0.6)';

  return (
    <View style={[
      styles.container,
      {
        borderRadius: radius,
        borderColor: colors.border,
        ...shadows.md,
      },
      style
    ]}>
      {/* Gradient background */}
      <LinearGradient
        colors={gradient}
        style={[styles.gradient, { borderRadius: radius }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Inner glow at top */}
        <View style={[
          styles.innerGlow,
          {
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            backgroundColor: innerGlowColor,
          }
        ]} />
        
        {/* Header border (if hasHeader) */}
        {hasHeader && (
          <View style={[
            styles.headerBorder,
            {
              borderBottomColor: isDark 
                ? 'rgba(34, 211, 238, 0.15)' 
                : 'rgba(8, 145, 178, 0.15)',
            }
          ]} />
        )}
        
        {/* Content */}
        <View style={styles.content}>
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
  },
  innerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.5,
  },
  headerBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderBottomWidth: 1,
  },
  content: {
    padding: 20,
  },
});
