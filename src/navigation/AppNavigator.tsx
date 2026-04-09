/**
 * AppNavigator — Root navigation guard
 *
 * FIXES APPLIED:
 * 1. onboarding_complete now read from Supabase profiles table directly
 * 2. Onboarding screen has gestureEnabled: false + Android hardware back disabled
 * 3. Added Settings screen to root stack (accessible from ProfileScreen)
 * 4. Added ResetPassword screen + deep-link route for epexfit://reset-password
 * 5. Populated linking.config.screens so named routes are actually deep-linkable
 */
import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { STORAGE_KEYS } from '../constants/config';
import { supabase } from '../services/supabase';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

// ── Back-button blocker for Onboarding ─────────────────────────────────────
function OnboardingBackGuard() {
  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );
  return null;
}

function GuardedOnboarding() {
  return (
    <>
      <OnboardingBackGuard />
      <OnboardingScreen />
    </>
  );
}

// ── Navigator ───────────────────────────────────────────────────────────────

export default function AppNavigator() {
  const { user, isLoading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setOnboardingDone(null);
      return;
    }

    Promise.resolve(
      supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single(),
    )
      .then(({ data }) => {
        if (data?.onboarding_complete === true) {
          setOnboardingDone(true);
        } else {
          AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING).then((val) => {
            if (val === 'complete') {
              void supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id);
              setOnboardingDone(true);
            } else {
              setOnboardingDone(false);
            }
          });
        }
      })
      .catch(() => {
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING).then((val) => {
          setOnboardingDone(val === 'complete');
        });
      });
  }, [user]);

  if (isLoading || (user && onboardingDone === null)) return <SplashScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Auth" component={AuthNavigator} />
          {/* ResetPassword is accessible even without a session — the user
              arrives here via the email deep-link before the session is set */}
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
          />
        </>
      ) : !onboardingDone ? (
        <Stack.Screen
          name="Onboarding"
          component={GuardedOnboarding}
          options={{
            gestureEnabled: false,
            animation: 'fade',
          }}
        />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainNavigator} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          {/* ResetPassword also accessible when logged in (password change) */}
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
