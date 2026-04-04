import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

import HomeScreen from '../screens/main/HomeScreen';
import ActivityScreen from '../screens/main/ActivityScreen';
import GoalsScreen from '../screens/main/GoalsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import BMICalculatorScreen from '../screens/main/BMICalculatorScreen';
import PhotoLogScreen from '../screens/main/PhotoLogScreen';
import WorkoutDetailScreen from '../screens/main/WorkoutDetailScreen';
import WorkoutsListScreen from '../screens/main/WorkoutsListScreen';
import DailyLogScreen from '../screens/main/DailyLogScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
// NEW screens
import ActiveWorkoutScreen from '../screens/main/ActiveWorkoutScreen';
import ProgressScreen from '../screens/main/ProgressScreen';
import FoodLogScreen from '../screens/main/FoodLogScreen';
import BodyMeasurementsScreen from '../screens/main/BodyMeasurementsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
        fill={focused ? color : 'none'} fillOpacity={focused ? 0.2 : 0}
        stroke={color} strokeWidth={focused ? 2 : 1.6} strokeLinejoin="round" />
    </Svg>
  );
}

function ActivityIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="2,12 5,12 8,5 12,19 16,9 18,12 22,12"
        stroke={color} strokeWidth={focused ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProgressIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="12" width="4" height="9" rx="1" fill={focused ? color : 'none'} fillOpacity={focused ? 0.3 : 0} stroke={color} strokeWidth={focused ? 2 : 1.6} />
      <Rect x="10" y="6" width="4" height="15" rx="1" fill={focused ? color : 'none'} fillOpacity={focused ? 0.3 : 0} stroke={color} strokeWidth={focused ? 2 : 1.6} />
      <Rect x="17" y="3" width="4" height="18" rx="1" fill={focused ? color : 'none'} fillOpacity={focused ? 0.3 : 0} stroke={color} strokeWidth={focused ? 2 : 1.6} />
    </Svg>
  );
}

function WorkoutsIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 8H4C3.45 8 3 8.45 3 9V15C3 15.55 3.45 16 4 16H6" stroke={color} strokeWidth={focused ? 2 : 1.6} strokeLinecap="round" />
      <Path d="M18 8H20C20.55 8 21 8.45 21 9V15C21 15.55 20.55 16 20 16H18" stroke={color} strokeWidth={focused ? 2 : 1.6} strokeLinecap="round" />
      <Rect x="6" y="6" width="3" height="12" rx="1.5" fill={focused ? color : 'none'} fillOpacity={focused ? 0.2 : 0} stroke={color} strokeWidth={focused ? 2 : 1.6} />
      <Rect x="15" y="6" width="3" height="12" rx="1.5" fill={focused ? color : 'none'} fillOpacity={focused ? 0.2 : 0} stroke={color} strokeWidth={focused ? 2 : 1.6} />
      <Line x1="9" y1="12" x2="15" y2="12" stroke={color} strokeWidth={focused ? 2 : 1.6} strokeLinecap="round" />
    </Svg>
  );
}

function ProfileIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.5" fill={focused ? color : 'none'} fillOpacity={focused ? 0.25 : 0} stroke={color} strokeWidth={focused ? 2 : 1.6} />
      <Path d="M4 20C4 16.5 7.58 14 12 14C16.42 14 20 16.5 20 20" stroke={color} strokeWidth={focused ? 2 : 1.6} strokeLinecap="round" />
    </Svg>
  );
}

function MainTabs() {
  const { colors, isDark } = useTheme();
  const tabBg = isDark ? '#0F1012' : '#FFFFFF';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const props = { color, focused };
          if (route.name === 'Home')     return <HomeIcon {...props} />;
          if (route.name === 'Activity') return <ActivityIcon {...props} />;
          if (route.name === 'Progress') return <ProgressIcon {...props} />;
          if (route.name === 'Workouts') return <WorkoutsIcon {...props} />;
          if (route.name === 'Profile')  return <ProfileIcon {...props} />;
          return null;
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopWidth: 0,
          marginHorizontal: 14,
          marginBottom: Platform.OS === 'ios' ? 26 : 14,
          borderRadius: 22,
          height: 64,
          paddingBottom: 0, paddingTop: 0,
          position: 'absolute',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.7 : 0.18,
          shadowRadius: 24, elevation: 16,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
        },
        tabBarItemStyle: { paddingTop: 10, paddingBottom: 6 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, marginTop: -2 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Workouts" component={WorkoutsListScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 17, letterSpacing: -0.3 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="MainTabs"      component={MainTabs}           options={{ headerShown: false }} />
      <Stack.Screen name="BMICalculator" component={BMICalculatorScreen} options={{ title: 'BMI Calculator' }} />
      <Stack.Screen name="PhotoLog"      component={PhotoLogScreen}      options={{ title: 'Activity Photo' }} />
      <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ title: 'Workout Details' }} />
      <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DailyLog"      component={DailyLogScreen}      options={{ title: 'Daily Log' }} />
      <Stack.Screen name="History"       component={HistoryScreen}       options={{ title: 'History' }} />
      <Stack.Screen name="FoodLog"       component={FoodLogScreen}       options={{ title: 'Food Log' }} />
      <Stack.Screen name="Goals"              component={GoalsScreen}              options={{ title: 'Goals' }} />
      <Stack.Screen name="BodyMeasurements"   component={BodyMeasurementsScreen}   options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
