import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

const ICON_MAP: Record<string, ReturnType<typeof require>> = {
  'shoe-print': require('../assets/icons/shoe-print.png'),
  'run': require('../assets/icons/run.png'),
  'walk': require('../assets/icons/walk.png'),
  'bike': require('../assets/icons/bike.png'),
  'fire': require('../assets/icons/fire.png'),
  'water': require('../assets/icons/water.png'),
  'target': require('../assets/icons/target.png'),
  'dumbbell': require('../assets/icons/dumbbell.png'),
  'home': require('../assets/icons/home.png'),
  'home-outline': require('../assets/icons/home-outline.png'),
  'account': require('../assets/icons/account.png'),
  'account-outline': require('../assets/icons/account-outline.png'),
  'account-circle': require('../assets/icons/account-circle.png'),
  'calendar': require('../assets/icons/calendar.png'),
  'timer': require('../assets/icons/timer.png'),
  'scale-bathroom': require('../assets/icons/scale-bathroom.png'),
  'food-steak': require('../assets/icons/food-steak.png'),
  'leaf': require('../assets/icons/leaf.png'),
  'sleep': require('../assets/icons/sleep.png'),
  'lightbulb': require('../assets/icons/lightbulb.png'),
  'map-marker-distance': require('../assets/icons/map-marker-distance.png'),
  'map-marker-path': require('../assets/icons/map-marker-path.png'),
  'note-text': require('../assets/icons/note-text.png'),
  'clipboard-text': require('../assets/icons/clipboard-text.png'),
  'pencil': require('../assets/icons/pencil.png'),
  'check': require('../assets/icons/check.png'),
  'check-circle': require('../assets/icons/check-circle.png'),
  'plus': require('../assets/icons/plus.png'),
  'play': require('../assets/icons/play.png'),
  'stop': require('../assets/icons/stop.png'),
  'camera-flip': require('../assets/icons/camera-flip.png'),
  'camera-off': require('../assets/icons/camera-off.png'),
  'camera-retake': require('../assets/icons/camera-retake.png'),
  'alert-circle': require('../assets/icons/alert-circle.png'),
  'theme-light-dark': require('../assets/icons/theme-light-dark.png'),
  'fitness': require('../assets/icons/fitness.png'),
  'human-male-height': require('../assets/icons/human-male-height.png'),
  'weight': require('../assets/icons/weight.png'),
  'bell-ring': require('../assets/icons/bell-ring.png'),
  'calculator': require('../assets/icons/calculator.png'),
  'emoticon': require('../assets/icons/emoticon.png'),
  'emoticon-happy': require('../assets/icons/emoticon-happy.png'),
  'emoticon-excited': require('../assets/icons/emoticon-excited.png'),
  'emoticon-neutral': require('../assets/icons/emoticon-neutral.png'),
  'emoticon-sad': require('../assets/icons/emoticon-sad.png'),
  'emoticon-dead': require('../assets/icons/emoticon-dead.png'),
};

interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: object;
}

export default function AppIcon({ name, size = 24, color, style }: AppIconProps) {
  const source = ICON_MAP[name];

  if (!source) {
    // Graceful fallback — visible colored square so nothing is invisible
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: size * 0.2, backgroundColor: color ?? '#FC4C02' },
          style,
        ]}
      />
    );
  }

  return (
    <Image
      source={source}
      style={[{ width: size, height: size, tintColor: color, resizeMode: 'contain' }, style]}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { opacity: 0.4 },
});
