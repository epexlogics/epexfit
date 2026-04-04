import { DefaultTheme } from 'react-native-paper';

// ── DARK THEME: Deep Midnight + Molten Gold ───────────────────────────────────
export const colors = {
  primary: '#F5C842',         // Molten gold — rich, premium, warm
  primaryDark: '#D4A820',     // Deep amber
  primaryLight: '#FFD96A',    // Soft gold highlight

  secondary: '#6C8EFF',       // Electric periwinkle — cool accent
  secondaryDark: '#4A6FE8',

  background: '#0A0B10',      // Deepest midnight — near black with blue tint
  surface: '#10121A',         // Midnight navy surface
  surfaceElevated: '#181C28', // Lifted card — deep navy
  surfaceHighlight: '#212638',// Pressed/hover — subtle blue lift

  error: '#FF5370',
  text: '#EEF0F8',            // Soft cool white — easy on eyes
  textSecondary: '#7A83A6',   // Muted lavender-grey
  textDisabled: '#343852',
  success: '#34D399',         // Emerald green
  warning: '#FBBF24',         // Warm amber
  info: '#60A5FA',            // Sky blue
  border: '#1E2438',          // Subtle navy border
  divider: '#151826',         // Near-invisible divider

  gradientPrimary: ['#F5C842', '#D4A820'] as string[],
  gradientCard: ['#181C28', '#10121A'] as string[],
};

export const darkColors = { ...colors };

// ── LIGHT THEME: Warm Pearl + Deep Gold ──────────────────────────────────────
export const lightColors = {
  ...colors,
  primary: '#C49A0A',         // Deep gold — refined, not garish
  primaryDark: '#A07E06',     // Dark amber
  primaryLight: '#E8B820',    // Warm gold accent

  secondary: '#3D5FD9',       // Rich indigo blue
  secondaryDark: '#2A47C2',

  background: '#F5F4F0',      // Warm off-white — like premium paper
  surface: '#FFFFFF',         // Pure white cards
  surfaceElevated: '#FEFEFE', // Elevated white
  surfaceHighlight: '#F0EDE6',// Warm cream hover

  text: '#0E0D14',            // Almost-black with depth
  textSecondary: '#5C5870',   // Warm slate
  textDisabled: '#B0AACC',

  border: '#E4DFD5',          // Warm sand border
  divider: '#EDE9E0',         // Cream divider

  success: '#059669',
  warning: '#B45309',
  info: '#1D4ED8',
  error: '#DC2626',

  gradientPrimary: ['#C49A0A', '#E8B820'] as string[],
  gradientCard: ['#FFFFFF', '#F8F6F1'] as string[],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  h1: { fontSize: 38, fontWeight: '900' as const, lineHeight: 42, letterSpacing: -1.5 },
  h2: { fontSize: 28, fontWeight: '800' as const, lineHeight: 34, letterSpacing: -0.8 },
  h3: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26, letterSpacing: -0.3 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  captionBold: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14 },
  label: { fontSize: 10, fontWeight: '700' as const, lineHeight: 12, letterSpacing: 1.5 },
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  glow: {
    shadowColor: '#F5C842',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    accent: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    error: colors.error,
    text: colors.text,
    disabled: colors.textDisabled,
    placeholder: colors.textSecondary,
    backdrop: 'rgba(0, 0, 0, 0.85)',
  },
  roundness: 12,
};
