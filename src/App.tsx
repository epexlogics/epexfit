import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { TrackingProvider } from './context/TrackingContext';
import AppNavigator from './navigation/AppNavigator';
import { theme } from './constants/theme';
import { supabase } from './services/supabase';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const prefix = Linking.createURL('/');

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync();

    const handleDeepLink = async ({ url }: { url: string }) => {
      if (!url) return;
      try {
        if (url.includes('code=') || url.includes('token=') || url.includes('type=')) {
          await supabase.auth.exchangeCodeForSession(url);
        }
      } catch (err) {
        console.warn('Deep link auth error:', err);
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });
    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, []);

  const linking = {
    prefixes: [prefix, 'epexfit://'],
    config: { screens: {} },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <ThemeProvider>
            <AuthProvider>
              <NotificationProvider>
                <TrackingProvider>
                  <NavigationContainer linking={linking}>
                    <StatusBar style="auto" />
                    <AppNavigator />
                  </NavigationContainer>
                </TrackingProvider>
              </NotificationProvider>
            </AuthProvider>
          </ThemeProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
