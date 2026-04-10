/**
 * AnimatedProgressRing — Hermes/APK safe progress ring.
 *
 * ROOT CAUSE OF APK CRASH:
 *   Animated.createAnimatedComponent(Circle) from react-native-svg +
 *   strokeDashoffset interpolation is broken in Hermes production builds.
 *   The Animated node cannot drive SVG props via the native driver in release.
 *
 * FIX:
 *   Drive progress via plain React state updated by a requestAnimationFrame
 *   loop. No Animated.createAnimatedComponent, no native driver for SVG.
 *   100% Hermes safe — same visual result.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface AnimatedProgressRingProps {
  progress: number;        // 0–1
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
  duration?: number;
}

export default function AnimatedProgressRing({
  progress,
  size = 200,
  strokeWidth = 6,
  color,
  trackColor = 'rgba(148, 163, 184, 0.15)',
  children,
  duration = 1200,
}: AnimatedProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const [currentProgress, setCurrentProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const target = Math.min(Math.max(progress, 0), 1);
    const from = fromRef.current;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      fromRef.current = value;
      setCurrentProgress(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = target;
        setCurrentProgress(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [progress, duration]);

  const strokeDashoffset = circumference * (1 - currentProgress);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.center}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
