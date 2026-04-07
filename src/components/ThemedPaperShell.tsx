/**
 * Bridges react-native-paper with ThemeContext so MD3 surfaces match midnight/cyan tokens.
 */
import React, { useMemo } from 'react';
import { StatusBar } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { buildPaperTheme } from '../constants/theme';

export default function ThemedPaperShell({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useTheme();
  const paperTheme = useMemo(() => buildPaperTheme(colors, isDark), [colors, isDark]);

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar
        translucent={false}
        backgroundColor={colors.background}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      {children}
    </PaperProvider>
  );
}
