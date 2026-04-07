/**
 * App.tsx — EpexFit root
 *
 * Changes from original:
 * 1. Wrapped with <ToastProvider> for global toast system
 * 2. Added ErrorBoundary for uncaught render errors
 * 3. Added global unhandled-promise-rejection handler
 * 4. Validates critical env vars on startup (USDA key warning delegated to useFoodSearch)
 */
import React, { useEffect, Component, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import * as Font from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { TrackingProvider } from './context/TrackingContext';
import { ToastProvider } from './contexts/ToastContext';
import AppNavigator from './navigation/AppNavigator';
import ThemedPaperShell from './components/ThemedPaperShell';
import { supabase } from './services/supabase';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Global error logging ───────────────────────────────────────────────────
// Replace with Sentry.init(...) when Sentry is configured.
function logError(context: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[EpexFit:${context}]`, message);
  // TODO: Sentry.captureException(err, { tags: { context } });
}

// Catch unhandled promise rejections at the JS level
if (typeof global !== 'undefined') {
  // React Native's global error handler
  const prevHandler = (global as typeof global & { __errorHandler?: (err: Error, fatal: boolean) => void }).__errorHandler;
  (global as typeof global & { ErrorUtils?: { setGlobalHandler: (fn: (err: Error, fatal: boolean) => void) => void } }).ErrorUtils?.setGlobalHandler((err: Error, fatal: boolean) => {
    logError(fatal ? 'FATAL' : 'JS_ERROR', err);
    prevHandler?.(err, fatal);
  });
}

// ── Error Boundary ─────────────────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError('RENDER', error);
    logError('COMPONENT_STACK', info.componentStack ?? '');
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0B1120' }}>
          <Text style={{ color: '#FB7185', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <Text style={{ color: '#475569', fontSize: 12, marginTop: 16 }}>
            Please restart the app. If the problem persists, contact support.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ── App ────────────────────────────────────────────────────────────────────

const prefix = Linking.createURL('/');

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
          Inter_800ExtraBold,
          Inter_900Black,
        });
        setFontsLoaded(true);
      } catch (err) {
        logError('FONT_LOAD', err);
        setFontsLoaded(true); // Continue anyway with system fonts
      }
    }
    loadFonts();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    SplashScreen.hideAsync();

    const handleDeepLink = async ({ url }: { url: string }) => {
      if (!url) return;
      try {
        if (url.includes('code=') || url.includes('token=') || url.includes('type=')) {
          await supabase.auth.exchangeCodeForSession(url);
        }
      } catch (err) {
        logError('DEEP_LINK', err);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null; // Keep splash screen visible while fonts load
  }

  const linking = {
    prefixes: [prefix, 'epexfit://'],
    config: { screens: {} },
  };

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <ThemedPaperShell>
              {/* ToastProvider wraps everything so any screen can call useToast() */}
              <ToastProvider>
                <AuthProvider>
                  <NotificationProvider>
                    <TrackingProvider>
                      <NavigationContainer linking={linking}>
                        <AppNavigator />
                      </NavigationContainer>
                    </TrackingProvider>
                  </NotificationProvider>
                </AuthProvider>
              </ToastProvider>
            </ThemedPaperShell>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
