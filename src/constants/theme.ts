/**
 * EpexFit design system — Midnight + Cyan + Neon
 * ---------------------------------------------------------------------------
 * Dark: deep midnight surfaces, cyan CTAs, electric neon for wins/APS highs.
 * Light: cool paper surfaces, deeper cyan for contrast, muted neon accents.
 * Errors: soft coral/rose — readable without harsh alarm red.
 */
import { MD3DarkTheme, MD3LightTheme, configureFonts } from 'react-native-paper';

/** Shared workout / list chips — tuned for both themes */
export const WORKOUT_TYPE_COLORS: Record<string, string> = {
  Cardio: '#FB7185',
  Strength: '#22D3EE',
  Yoga: '#C084FC',
  HIIT: '#F472B6',
  Stretching: '#4ADE80',
  Other: '#94A3B8',
};

export interface AppThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  /** Text/icons on primary buttons */
  onPrimary: string;
  secondary: string;
  secondaryDark: string;
  /** Achievements, elite APS, celebration accents */
  neonGlow: string;
  neonGlowMuted: string;

  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;

  error: string;
  errorSoft: string;
  errorSurface: string;

  text: string;
  textSecondary: string;
  textDisabled: string;
  success: string;
  warning: string;
  info: string;
  border: string;
  divider: string;

  gradientPrimary: string[];
  gradientCard: string[];
  /** Splash / hero mesh */
  gradientBackdrop: string[];

  tabBarBg: string;
  overlay: string;

  metricDistance: string;
  metricBurn: string;
  metricHydration: string;
  metricProtein: string;
  metricSleep: string;
  metricStreak: string;
  metricFood: string;
  metricStrength: string;

  apsElite: string;
  apsStrong: string;
  apsActive: string;
  apsBuilding: string;
  apsLow: string;
}

// ── Dark — midnight canvas, cyan actions, neon highlights ─────────────────
export const darkColors: AppThemeColors = {
  primary: '#22D3EE',
  primaryDark: '#06B6D4',
  primaryLight: '#67E8F9',
  onPrimary: '#031014',

  secondary: '#818CF8',
  secondaryDark: '#6366F1',

  neonGlow: '#4ADE80',
  neonGlowMuted: 'rgba(74, 222, 128, 0.22)',

  background: '#030712',
  surface: '#0A0F1A',
  surfaceElevated: '#0F172A',
  surfaceHighlight: '#162032',

  error: '#F87171',
  errorSoft: '#FCA5A5',
  errorSurface: 'rgba(248, 113, 113, 0.12)',

  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textDisabled: '#475569',

  success: '#4ADE80',
  warning: '#FBBF24',
  info: '#38BDF8',

  border: '#1E293B',
  divider: '#0F172A',

  gradientPrimary: ['#22D3EE', '#0891B2'],
  gradientCard: ['#0F172A', '#0A0F1A'],
  gradientBackdrop: ['#030712', '#0C1220', '#082F49'],

  tabBarBg: '#0B1120',
  overlay: 'rgba(2, 6, 23, 0.92)',

  metricDistance: '#38BDF8',
  metricBurn: '#FB7185',
  metricHydration: '#22D3EE',
  metricProtein: '#C084FC',
  metricSleep: '#4ADE80',
  metricStreak: '#FBBF24',
  metricFood: '#FB923C',
  metricStrength: '#A78BFA',

  apsElite: '#4ADE80',
  apsStrong: '#22D3EE',
  apsActive: '#38BDF8',
  apsBuilding: '#C084FC',
  apsLow: '#FB7185',
};

// ── Light — airy cool white, deeper cyan, restrained neon ─────────────────
export const lightColors: AppThemeColors = {
  primary: '#0891B2',
  primaryDark: '#0E7490',
  primaryLight: '#22D3EE',
  onPrimary: '#FFFFFF',

  secondary: '#4F46E5',
  secondaryDark: '#4338CA',

  neonGlow: '#059669',
  neonGlowMuted: 'rgba(5, 150, 105, 0.15)',

  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#E2E8F0',

  error: '#E11D48',
  errorSoft: '#FB7185',
  errorSurface: 'rgba(225, 29, 72, 0.08)',

  text: '#0F172A',
  textSecondary: '#64748B',
  textDisabled: '#CBD5E1',

  success: '#059669',
  warning: '#D97706',
  info: '#0284C7',

  border: '#E2E8F0',
  divider: '#F1F5F9',

  gradientPrimary: ['#0891B2', '#06B6D4'],
  gradientCard: ['#FFFFFF', '#F8FAFC'],
  gradientBackdrop: ['#F8FAFC', '#E0F2FE', '#F0F9FF'],

  tabBarBg: '#FFFFFF',
  overlay: 'rgba(15, 23, 42, 0.45)',

  metricDistance: '#0284C7',
  metricBurn: '#E11D48',
  metricHydration: '#0891B2',
  metricProtein: '#7C3AED',
  metricSleep: '#059669',
  metricStreak: '#D97706',
  metricFood: '#EA580C',
  metricStrength: '#6366F1',

  apsElite: '#059669',
  apsStrong: '#0891B2',
  apsActive: '#0284C7',
  apsBuilding: '#7C3AED',
  apsLow: '#E11D48',
};

/** Default export for legacy imports — aliases dark */
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  // Display numbers (APS, metrics) — 48-64px
  displayLarge: { fontSize: 64, fontWeight: '900' as const, lineHeight: 68, letterSpacing: -2.5, fontFamily: 'Inter_900Black' },
  displayMedium: { fontSize: 48, fontWeight: '900' as const, lineHeight: 52, letterSpacing: -1.8, fontFamily: 'Inter_900Black' },
  // Headings
  h1: { fontSize: 36, fontWeight: '900' as const, lineHeight: 40, letterSpacing: -1.2, fontFamily: 'Inter_800ExtraBold' },
  h2: { fontSize: 26, fontWeight: '800' as const, lineHeight: 32, letterSpacing: -0.6, fontFamily: 'Inter_700Bold' },
  h3: { fontSize: 24, fontWeight: '600' as const, lineHeight: 30, letterSpacing: -0.5, fontFamily: 'Inter_600SemiBold' },
  h4: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24, letterSpacing: -0.2, fontFamily: 'Inter_700Bold' },
  // Body
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  bodyBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 21, fontFamily: 'Inter_600SemiBold' },
  // Labels (uppercase tracking)
  label: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.66, textTransform: 'uppercase' as const, fontFamily: 'Inter_600SemiBold' },
  labelBold: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.66, textTransform: 'uppercase' as const, fontFamily: 'Inter_700Bold' },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16, fontFamily: 'Inter_500Medium' },
} as const;

export const borderRadius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  full: 999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  /** Cyan lift for primary FABs / key CTAs */
  glow: {
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  neon: {
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
};

const fontConfig = {
  default: {
    regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const },
    medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const },
    bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' as const },
    heavy: { fontFamily: 'Inter_900Black', fontWeight: '900' as const },
  },
};

export function buildPaperTheme(c: AppThemeColors, isDark: boolean) {
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: isDark ? '#164E63' : '#CFFAFE',
      secondary: c.secondary,
      background: c.background,
      surface: c.surface,
      surfaceVariant: c.surfaceElevated,
      error: c.error,
      onBackground: c.text,
      onSurface: c.text,
      outline: c.border,
    },
    roundness: borderRadius.md,
    fonts: configureFonts({ config: fontConfig }),
  };
}

/** Default Paper theme (dark) — used as initial bridge before dynamic theme mounts */
export const theme = buildPaperTheme(darkColors, true);
