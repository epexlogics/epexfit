/**
 * AnimatedProgressRing — Premium progress ring with animations
 * 
 * Features:
 * - Animated arc progress (clockwise from top)
 * - Count-up number animation
 * - Rounded line caps
 * - 6px stroke width
 * - Customizable size and colors
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AnimatedProgressRingProps {
  /** Progress value 0-1 */
  progress: number;
  /** Ring diameter */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Active progress color */
  color: string;
  /** Track color (background ring) */
  trackColor?: string;
  /** Center content */
  children?: React.ReactNode;
  /** Animation duration in ms */
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
  const animatedProgress = useRef(new Animated.Value(0)).current;
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    // Reset and animate
    animatedProgress.setValue(0);
    Animated.timing(animatedProgress, {
      toValue: Math.min(Math.max(progress, 0), 1),
      duration,
      useNativeDriver: true,
    }).start();
  }, [progress, duration]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Animated progress arc */}
        <AnimatedCircle
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
      
      {/* Center content */}
      <View style={styles.center}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
