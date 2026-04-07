/**
 * BadgeUnlockModal
 * Full-screen celebration when a new badge is unlocked.
 * Shows badge icon, name, description with pulsing animation.
 * Call via the useBadgeCelebration hook.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Vibration,
} from 'react-native';
import { BadgeDefinition } from '../constants/badges';
import { useTheme } from '../context/ThemeContext';

interface Props {
  badge: BadgeDefinition | null;
  onDismiss: () => void;
}

export default function BadgeUnlockModal({ badge, onDismiss }: Props) {
  const { colors } = useTheme();
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!badge) return;

    // Haptic burst
    Vibration.vibrate([0, 60, 80, 120]);

    // Entry animation
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Continuous glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    ).start();

    // Auto-dismiss after 4s
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [badge]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim,   { toValue: 0.8, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  if (!badge) return null;

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [badge.color + '20', badge.color + '50'],
  });

  return (
    <Modal transparent animationType="none" visible={!!badge} onRequestClose={handleDismiss}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim, backgroundColor: colors.overlay }]}>
        <Animated.View style={[
          styles.card,
          { transform: [{ scale: scaleAnim }], backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}>
          {/* Glow background */}
          <Animated.View style={[styles.glow, { backgroundColor: glowColor }]} />

          <Text style={[styles.newBadgeLabel, { color: colors.textSecondary }]}>🏆 NEW BADGE UNLOCKED</Text>

          {/* Badge icon with pulse */}
          <Animated.View style={[styles.iconWrap, {
            backgroundColor: badge.color + '20',
            borderColor: badge.color + '60',
            transform: [{ scale: pulseAnim }],
          }]}>
            <Text style={styles.iconText}>{badge.icon}</Text>
          </Animated.View>

          <Text style={[styles.badgeName, { color: badge.color }]}>{badge.label}</Text>
          <Text style={[styles.badgeDesc, { color: colors.textSecondary }]}>{badge.description}</Text>

          {/* Category chip */}
          <View style={[styles.categoryChip, { backgroundColor: badge.color + '15', borderColor: badge.color + '40' }]}>
            <Text style={[styles.categoryText, { color: badge.color }]}>
              {badge.category.charAt(0).toUpperCase() + badge.category.slice(1)}
            </Text>
          </View>

          <TouchableOpacity style={[styles.dismissBtn, { backgroundColor: badge.color }]} onPress={handleDismiss}>
            <Text style={styles.dismissText}>Awesome! 🎉</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -60, left: -60, right: -60, bottom: -60,
    borderRadius: 100,
  },
  newBadgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginVertical: 4,
  },
  iconText: { fontSize: 52 },
  badgeName: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  badgeDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  dismissBtn: {
    marginTop: 8,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 999,
  },
  dismissText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});
