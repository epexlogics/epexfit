/**
 * Shared layout constants
 * FIX: TAB_BAR_HEIGHT was copy-pasted into 4+ screens (Activity, WorkoutsList, Profile, FoodLog).
 * Extract here and import everywhere.
 */
import { Platform } from 'react-native';

export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 100 : 88;
