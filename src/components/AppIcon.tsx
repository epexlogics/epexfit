/**
 * AppIcon — unified icon component
 *
 * FIX (CRITICAL): 8 icons were missing from ICON_MAP, causing AppIcon to render
 * orange fallback squares across 7 screens. This broke core navigation (back buttons
 * showed as orange squares) and several feature icons.
 *
 * Missing icons: chevron-left, chevron-right, close, delete, food-apple,
 *                run-fast, search, trash-can
 *
 * Resolution: Added a VECTOR_FALLBACK_MAP that routes missing PNG names to their
 * equivalents in @expo/vector-icons (Ionicons + MaterialCommunityIcons).
 * Existing PNG icons continue to render via the Image path unchanged.
 *
 * NOTE on icon system inconsistency (audit polish item):
 * The app uses two icon systems — PNG assets (AppIcon) and inline SVG paths (tab bar).
 * Long-term, migrate fully to one system. For now this hybrid approach is the
 * least-risky fix that unblocks the broken screens without a full refactor.
 */
import React from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ── PNG asset map (existing, unchanged) ──────────────────────────────────────
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

// ── Vector fallbacks for the 8 missing icons ─────────────────────────────────
// These were causing orange fallback squares across 7 screens:
//   BodyMeasurementsScreen (chevron-left), ActiveWorkoutScreen (chevron-left),
//   WorkoutDetailScreen (chevron-left), ProfileScreen (chevron-right),
//   HistoryScreen (chevron-right + run-fast), WorkoutsListScreen (close + delete),
//   FoodLogScreen (food-apple), GoalsScreen (trash-can)
type VectorEntry =
  | { lib: 'Ionicons'; name: keyof typeof Ionicons.glyphMap }
  | { lib: 'MCI'; name: keyof typeof MaterialCommunityIcons.glyphMap };

const VECTOR_FALLBACK_MAP: Record<string, VectorEntry> = {
  'chevron-left':  { lib: 'Ionicons', name: 'chevron-back' },
  'chevron-right': { lib: 'Ionicons', name: 'chevron-forward' },
  'close':         { lib: 'Ionicons', name: 'close' },
  'delete':        { lib: 'MCI',      name: 'delete' },
  'food-apple':    { lib: 'MCI',      name: 'food-apple' },
  'run-fast':      { lib: 'MCI',      name: 'run-fast' },
  'search':        { lib: 'Ionicons', name: 'search' },
  'trash-can':     { lib: 'MCI',      name: 'trash-can' },
  // Activity type icons used in ActivityScreen / HistoryScreen
  'swim':          { lib: 'MCI',      name: 'swim' },
  'meditation':    { lib: 'MCI',      name: 'meditation' },
  'soccer':        { lib: 'MCI',      name: 'soccer' },
  'heart':         { lib: 'Ionicons', name: 'heart' },
};

interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: object;
}

export default function AppIcon({ name, size = 24, color, style }: AppIconProps) {
  // 1. Try PNG map first (existing behaviour — unchanged)
  const source = ICON_MAP[name];
  if (source) {
    return (
      <Image
        source={source}
        style={[{ width: size, height: size, tintColor: color, resizeMode: 'contain' }, style]}
      />
    );
  }

  // 2. Try vector fallback for the 8 previously missing icons
  const vector = VECTOR_FALLBACK_MAP[name];
  if (vector) {
    if (vector.lib === 'Ionicons') {
      return <Ionicons name={vector.name} size={size} color={color} style={style as any} />;
    }
    return <MaterialCommunityIcons name={vector.name} size={size} color={color} style={style as any} />;
  }

  // 3. Last resort: transparent placeholder (never orange — that was confusing)
  // If you see this, add the icon to ICON_MAP or VECTOR_FALLBACK_MAP above.
  if (__DEV__) console.warn(`[AppIcon] Unknown icon: "${name}" — add it to AppIcon.tsx`);
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size * 0.2 },
        style,
      ]}
    />
  );
}
