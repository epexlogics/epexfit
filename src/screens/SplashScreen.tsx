import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const ACCENT = '#F5C842';
const BG = '#0A0B10';

function EpexLogo({ size = 96, anim }: { size?: number; anim?: Animated.Value }) {
  const s = size;
  const rotate = anim
    ? anim.interpolate({ inputRange: [0, 1], outputRange: ['30deg', '45deg'] })
    : '45deg';

  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        width: s, height: s, borderRadius: s * 0.24,
        backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
        transform: [{ rotate }],
        shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 0 }, elevation: 16,
      }}>
        <View style={{
          width: s * 0.7, height: s * 0.7, borderRadius: s * 0.16,
          backgroundColor: BG, alignItems: 'center', justifyContent: 'center',
        }}>
          <Animated.View style={{ transform: [{ rotate: anim ? anim.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '-45deg'] }) : '-45deg' }], alignItems: 'center' }}>
            <View style={{ width: s * 0.17, height: s * 0.3, backgroundColor: ACCENT, borderRadius: 2, marginBottom: -s * 0.04 }} />
            <View style={{ width: s * 0.28, height: s * 0.04, backgroundColor: ACCENT, borderRadius: 2 }} />
            <View style={{ width: s * 0.17, height: s * 0.24, backgroundColor: ACCENT, borderRadius: 2, marginTop: -s * 0.04 }} />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

export default function SplashScreen() {
  const { colors } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.2)).current;
  const dot2 = useRef(new Animated.Value(0.2)).current;
  const dot3 = useRef(new Animated.Value(0.2)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(logoRotate, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(taglineFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();
    });

    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration: 380, useNativeDriver: true }),
        ])
      ).start();

    pulse(dot1, 0);
    pulse(dot2, 180);
    pulse(dot3, 360);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Glow background */}
      <Animated.View style={[styles.glow, { opacity: glowAnim }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <EpexLogo size={96} anim={logoRotate} />
        <Text style={styles.brand}>EPEXFIT</Text>
        <Animated.Text style={[styles.tagline, { opacity: taglineFade, color: 'rgba(255,255,255,0.45)' }]}>
          Train smarter. Live stronger.
        </Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.dotsWrap, { opacity: taglineFade }]}>
        <Animated.View style={[styles.dot, { backgroundColor: ACCENT, opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { backgroundColor: ACCENT, opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { backgroundColor: ACCENT, opacity: dot3 }]} />
      </Animated.View>

      <Animated.Text style={[styles.version, { opacity: taglineFade }]}>v1.0</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: ACCENT,
    opacity: 0.06,
    top: '50%', left: '50%',
    marginTop: -200, marginLeft: -140,
  },
  content: { alignItems: 'center', gap: 18 },
  brand: { fontSize: 32, fontWeight: '900', letterSpacing: 9, color: '#F8F9FA', marginTop: 6 },
  tagline: { fontSize: 13, fontWeight: '500', letterSpacing: 0.5 },
  dotsWrap: { position: 'absolute', bottom: 80, flexDirection: 'row', gap: 9 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  version: { position: 'absolute', bottom: 44, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.2)', letterSpacing: 0.5 },
});
