/**
 * AnimatedCounter — Smooth count-up animation for numbers
 * 
 * Usage:
 *   <AnimatedCounter value={85} duration={1000} style={styles.text} />
 */
import React, { useEffect, useRef } from 'react';
import { Text, Animated, TextStyle } from 'react-native';

interface AnimatedCounterProps {
  /** Target number to count to */
  value: number;
  /** Animation duration in ms */
  duration?: number;
  /** Text style */
  style?: TextStyle | TextStyle[];
  /** Number of decimal places (default 0) */
  decimals?: number;
  /** Prefix (e.g., "$") */
  prefix?: string;
  /** Suffix (e.g., "km") */
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
  const textRef = useRef<Text>(null);

  useEffect(() => {
    animatedValue.setValue(0);
    
    const listener = animatedValue.addListener(({ value: v }) => {
      const formatted = v.toFixed(decimals);
      const display = `${prefix}${formatted}${suffix}`;
      
      if (textRef.current) {
        textRef.current.setNativeProps({ text: display });
      }
    });

    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      useNativeDriver: false, // Can't use native driver for text
    }).start();

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value, duration, decimals, prefix, suffix]);

  return (
    <Text ref={textRef} style={style}>
      {prefix}0{suffix}
    </Text>
  );
}
