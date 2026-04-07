/**
 * Brand mark — cyan diamond + inner “E” strokes; colors come from theme for light/dark parity.
 */
import React from 'react';
import { View, Animated, StyleProp, ViewStyle } from 'react-native';

type Props = {
  size?: number;
  primary: string;
  inset: string;
  /** Optional native-driver rotation 0→1 maps to subtle diamond tilt */
  rotateProgress?: Animated.Value;
  style?: StyleProp<ViewStyle>;
};

export default function EpexLogoMark({ size = 72, primary, inset, rotateProgress, style }: Props) {
  const s = size;
  const rotate = rotateProgress
    ? rotateProgress.interpolate({ inputRange: [0, 1], outputRange: ['28deg', '42deg'] })
    : '36deg';
  const innerRotate = rotateProgress
    ? rotateProgress.interpolate({ inputRange: [0, 1], outputRange: ['-28deg', '-42deg'] })
    : '-36deg';

  return (
    <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        style={{
          width: s,
          height: s,
          borderRadius: s * 0.26,
          backgroundColor: primary,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate }],
          shadowColor: primary,
          shadowOpacity: 0.45,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
          elevation: 14,
        }}
      >
        <View
          style={{
            width: s * 0.7,
            height: s * 0.7,
            borderRadius: s * 0.16,
            backgroundColor: inset,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View style={{ transform: [{ rotate: innerRotate }], alignItems: 'center' }}>
            <View
              style={{
                width: s * 0.17,
                height: s * 0.3,
                backgroundColor: primary,
                borderRadius: 3,
                marginBottom: -s * 0.04,
              }}
            />
            <View
              style={{
                width: s * 0.28,
                height: s * 0.045,
                backgroundColor: primary,
                borderRadius: 3,
              }}
            />
            <View
              style={{
                width: s * 0.17,
                height: s * 0.24,
                backgroundColor: primary,
                borderRadius: 3,
                marginTop: -s * 0.04,
              }}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}
