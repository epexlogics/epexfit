/**
 * EmptyState — Reusable empty state component
 *
 * Usage:
 *   <EmptyState
 *     icon="run"
 *     title="No activities yet"
 *     message="Start tracking your first workout to see it here."
 *     buttonText="Start Activity"
 *     onPress={() => navigation.navigate('Activity')}
 *   />
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AppIcon from './AppIcon';
import { borderRadius, spacing } from '../constants/theme';

export interface EmptyStateProps {
  /** AppIcon name */
  icon: string;
  title: string;
  message: string;
  /** Optional CTA button */
  buttonText?: string;
  onPress?: () => void;
  /** Override icon color */
  iconColor?: string;
}

export default function EmptyState({
  icon,
  title,
  message,
  buttonText,
  onPress,
  iconColor,
}: EmptyStateProps) {
  const { colors, accent } = useTheme();
  const color = iconColor ?? accent;

  return (
    <View style={eS.wrap}>
      <View style={[eS.iconCircle, { backgroundColor: color + '18' }]}>
        <AppIcon name={icon} size={36} color={color} />
      </View>

      <Text style={[eS.title, { color: colors.text }]}>{title}</Text>
      <Text style={[eS.message, { color: colors.textSecondary }]}>{message}</Text>

      {buttonText && onPress ? (
        <TouchableOpacity
          style={[eS.btn, { backgroundColor: color + '20', borderColor: color + '50' }]}
          onPress={onPress}
          activeOpacity={0.75}
        >
          <Text style={[eS.btnText, { color }]}>{buttonText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const eS = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  btn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
