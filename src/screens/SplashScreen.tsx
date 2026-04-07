/**
 * Premium splash — mesh gradient (SVG), real icon pulse, staggered typography.
 * Visual only; no navigation/auth logic.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import AppIconCircle from '../components/AppIconCircle';
import Constants from 'expo-constants';

const { width: W, height: H } = Dimensions.get('window');

export default function SplashScreen() {
  const { colors } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.72)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.25)).current;
  const dot2 = useRef(new Animated.Value(0.25)).current;
  const dot3 = useRef(new Animated.Value(0.25)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 88, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(taglineFade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();

    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.25, duration: 360, useNativeDriver: true }),
        ])
      ).start();

    pulse(dot1, 0);
    pulse(dot2, 160);
    pulse(dot3, 320);
  }, []);

  const g0 = colors.gradientBackdrop[0];
  const g1 = colors.gradientBackdrop[1] ?? g0;
  const g2 = colors.gradientBackdrop[2] ?? g1;
  const version = Constants.expoConfig?.version ?? '3.0';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="splashMesh" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={g0} stopOpacity="1" />
            <Stop offset="48%" stopColor={g1} stopOpacity="1" />
            <Stop offset="100%" stopColor={g2} stopOpacity="1" />
          </SvgGradient>
        </Defs>
        <Rect width={W} height={H} fill="url(#splashMesh)" />
      </Svg>

      {/* Soft glow bloom behind icon */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bloom,
          {
            backgroundColor: colors.primary,
            opacity: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.14] }),
          },
        ]}
      />

      <Animated.View
        style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
      >
        <AppIconCircle size={92} ringColor={colors.primary} glowColor={colors.primary} />

        <Text style={[styles.brand, { color: colors.text }]}>EPEXFIT</Text>
        <Animated.Text style={[styles.tagline, { opacity: taglineFade, color: colors.textSecondary }]}>
          Precision training. Real momentum.
        </Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.dotsWrap, { opacity: taglineFade }]}>
        <Animated.View style={[styles.dot, { backgroundColor: colors.primary, opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { backgroundColor: colors.neonGlow, opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { backgroundColor: colors.primary, opacity: dot3 }]} />
      </Animated.View>

      <Animated.Text style={[styles.version, { opacity: taglineFade, color: colors.textDisabled }]}>
        v{version}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bloom: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: '50%',
    left: '50%',
    marginTop: -190,
    marginLeft: -150,
  },
  content: { alignItems: 'center', gap: 20 },
  brand: { fontSize: 30, fontWeight: '900', letterSpacing: 10, marginTop: 8 },
  tagline: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
  dotsWrap: { position: 'absolute', bottom: 88, flexDirection: 'row', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  version: { position: 'absolute', bottom: 48, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
});
