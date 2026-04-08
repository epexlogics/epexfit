/**
 * AppNavigator — Root navigation guard
 *
 * FIXES APPLIED:
 * 1. onboarding_complete now read from Supabase profiles table directly
 *    (previously relying on user object that never had this field, and
 *    AsyncStorage which gets wiped on signOut — causing onboarding every login)
 * 2. Onboarding screen has gestureEnabled: false + Android hardware back disabled
 * 3. Added Settings screen to root stack (accessible from ProfileScreen)
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

    // Query Supabase profiles directly — this is the source of truth.
    // The user object from AuthContext does NOT include onboarding_complete
    // (getCurrentUser() doesn't select it), and AsyncStorage gets wiped on
    // signOut(), so neither can be trusted without this direct DB check.
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
          // Fallback: check AsyncStorage for users who completed onboarding
          // before the DB column was added (backwards compatibility)
          AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING).then((val) => {
            if (val === 'complete') {
              // Back-fill the DB so future logins skip this fallback
              void supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id);

              setOnboardingDone(true);
            } else {
              setOnboardingDone(false);
            }
          });
        }
      })
      .catch(() => {
        // DB unreachable — fall back to AsyncStorage
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING).then((val) => {
          setOnboardingDone(val === 'complete');
        });
      });
  }, [user]);

  if (isLoading || (user && onboardingDone === null)) return <SplashScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
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
        </>
      )}
    </Stack.Navigator>
  );
}
