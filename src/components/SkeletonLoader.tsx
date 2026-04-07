/**
 * SkeletonLoader — lightweight shimmer placeholders
 * Used across main screens to prevent blank-screen flash on slow connections
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

function SkeletonBlock({ height = 16, width: w = '100%', borderRadius = 8, style }: {
  height?: number;
  width?: number | string;
  borderRadius?: number;
  style?: any;
}) {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  /* Shimmer base: subtle cyan tint in dark mode for brand cohesion */
  const bg = isDark ? 'rgba(34,211,238,0.08)' : 'rgba(8,145,178,0.07)';

  return (
    <Animated.View
      style={[
        { height, borderRadius, backgroundColor: bg, width: w as any, opacity },
        style,
      ]}
    />
  );
}

export function HomeScreenSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[sk.container, { backgroundColor: colors.background }]}>
      {/* Hero card */}
      <SkeletonBlock height={160} borderRadius={20} style={{ marginBottom: 16 }} />
      {/* Stats row */}
      <View style={sk.row}>
        <SkeletonBlock height={80} width="31%" borderRadius={14} />
        <SkeletonBlock height={80} width="31%" borderRadius={14} />
        <SkeletonBlock height={80} width="31%" borderRadius={14} />
      </View>
      {/* Section label */}
      <SkeletonBlock height={12} width="40%" borderRadius={6} style={{ marginTop: 20, marginBottom: 10 }} />
      {/* Cards */}
      <SkeletonBlock height={72} borderRadius={14} style={{ marginBottom: 10 }} />
      <SkeletonBlock height={72} borderRadius={14} style={{ marginBottom: 10 }} />
      <SkeletonBlock height={72} borderRadius={14} />
    </View>
  );
}

export function ListScreenSkeleton({ rows = 5 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[sk.container, { backgroundColor: colors.background }]}>
      <SkeletonBlock height={36} width="55%" borderRadius={10} style={{ marginBottom: 20 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[sk.listRow, { borderColor: colors.border }]}>
          <SkeletonBlock height={40} width={40} borderRadius={10} />
          <View style={sk.listText}>
            <SkeletonBlock height={14} width="65%" borderRadius={6} style={{ marginBottom: 6 }} />
            <SkeletonBlock height={11} width="40%" borderRadius={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ChartScreenSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[sk.container, { backgroundColor: colors.background }]}>
      <SkeletonBlock height={36} width="50%" borderRadius={10} style={{ marginBottom: 16 }} />
      <SkeletonBlock height={140} borderRadius={16} style={{ marginBottom: 16 }} />
      <View style={sk.row}>
        <SkeletonBlock height={70} width="48%" borderRadius={12} />
        <SkeletonBlock height={70} width="48%" borderRadius={12} />
      </View>
      <SkeletonBlock height={120} borderRadius={16} style={{ marginTop: 16 }} />
    </View>
  );
}

const sk = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 0.5,
  },
  listText: { flex: 1 },
});
