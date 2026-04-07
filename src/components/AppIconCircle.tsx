/**
 * AppIconCircle — circular splash icon with a glowing ring and the Epex logo mark.
 * Used exclusively by SplashScreen.
 *
 * Props:
 *   size       — diameter of the outer circle (default 92)
 *   ringColor  — color of the thin border ring
 *   glowColor  — shadow/glow color behind the circle
 */
import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import EpexLogoMark from './EpexLogoMark';
import { useTheme } from '../context/ThemeContext';

interface AppIconCircleProps {
  size?: number;
  ringColor?: string;
  glowColor?: string;
  style?: StyleProp<ViewStyle>;
}

export default function AppIconCircle({
  size = 92,
  ringColor,
  glowColor,
  style,
}: AppIconCircleProps) {
  const { colors } = useTheme();

  const ring = ringColor ?? colors.primary;
  const glow = glowColor ?? colors.primary;
  const logoSize = size * 0.55;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: ring,
          backgroundColor: colors.surface ?? colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          // Glow effect (iOS shadow + Android elevation)
          shadowColor: glow,
          shadowOpacity: 0.55,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        },
        style,
      ]}
    >
      <EpexLogoMark
        size={logoSize}
        primary={colors.primary}
        inset={colors.surface ?? colors.background}
      />
    </View>
  );
}
