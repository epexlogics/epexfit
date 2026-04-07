/**
 * AppNavigator — Root navigation guard
 *
 * Changes from original:
 * 1. Onboarding screen has gestureEnabled: false + Android hardware back disabled
 * 2. Added Settings screen to root stack (accessible from ProfileScreen)
 * 3. Guard still checks AsyncStorage ONBOARDING key, unchanged behaviour
 */
import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { STORAGE_KEYS } from '../constants/config';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();

// ── Back-button blocker for Onboarding ─────────────────────────────────────
// Prevents user pressing the Android hardware back button while on onboarding
// to return to the Login screen.
function OnboardingBackGuard() {
  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true); // consume = block
      return () => sub.remove();
    }, []),
  );
  return null;
}

// Wrap OnboardingScreen so we can inject the guard without modifying the screen itself.
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
    if (user) {
      AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING).then((val) => {
        setOnboardingDone(val === 'complete');
      });
    } else {
      setOnboardingDone(null);
    }
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
            // Prevent swipe-back gesture on iOS
            gestureEnabled: false,
            // Prevent back navigation via Android back button (handled in GuardedOnboarding)
            animation: 'fade',
          }}
        />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainNavigator} />
          {/* Settings is at root level so it can slide over the tab navigator */}
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
