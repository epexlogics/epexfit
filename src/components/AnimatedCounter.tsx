/**
 * AnimatedCounter — Hermes/APK safe count-up animation.
 *
 * ROOT CAUSE OF APK CRASH:
 *   setNativeProps({ text }) on a <Text> ref is broken in Hermes (production).
 *   It works in Expo Go (debug JSC) but throws or silently fails in release APK.
 *
 * FIX:
 *   Use Animated.Value + listener to drive a plain React state update.
 *   No setNativeProps, no native driver for text — pure JS state, Hermes safe.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated, TextStyle } from 'react-native';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  style?: TextStyle | TextStyle[];
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export default function AnimatedCounter({
  value,
  duration = 1000,
  style,
  decimals = 0,
  prefix = '',
  suffix = '',
}: AnimatedCounterProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);

  useEffect(() => {
    animatedValue.setValue(0);

    const listener = animatedValue.addListener(({ value: v }) => {
      setDisplay(`${prefix}${v.toFixed(decimals)}${suffix}`);
    });

    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start(() => {
      // Ensure final value is exact after animation ends
      setDisplay(`${prefix}${value.toFixed(decimals)}${suffix}`);
    });

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value, duration, decimals, prefix, suffix]);

  return <Text style={style}>{display}</Text>;
}
