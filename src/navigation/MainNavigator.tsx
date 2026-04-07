import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { borderRadius } from '../constants/theme';

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
import UserSearchScreen from '../screens/main/UserSearchScreen';
import SocialFeedScreen from '../screens/main/SocialFeedScreen';
import UserProfileScreen from '../screens/main/UserProfileScreen';
import FollowersListScreen from '../screens/main/FollowersListScreen';
import CommentsScreen from '../screens/main/CommentsScreen';

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

function SocialIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3" fill={focused ? color : 'none'} fillOpacity={focused ? 0.25 : 0} stroke={color} strokeWidth={focused ? 2 : 1.6} />
      <Circle cx="17" cy="9" r="2" stroke={color} strokeWidth={focused ? 2 : 1.6} />
      <Path d="M2 20C2 17 5.13 15 9 15C12.87 15 16 17 16 20" stroke={color} strokeWidth={focused ? 2 : 1.6} strokeLinecap="round" />
      <Path d="M17 14C19.5 14 22 15.5 22 18" stroke={color} strokeWidth={focused ? 2 : 1.6} strokeLinecap="round" />
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
  const inactiveColor = isDark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.55)';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const props = { color, focused };
          if (route.name === 'Home')     return <HomeIcon {...props} />;
          if (route.name === 'Activity') return <ActivityIcon {...props} />;
          if (route.name === 'Progress') return <ProgressIcon {...props} />;
          if (route.name === 'Workouts') return <WorkoutsIcon {...props} />;
          if (route.name === 'Social')   return <SocialIcon {...props} />;
          if (route.name === 'Profile')  return <ProfileIcon {...props} />;
          return null;
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 0,
          marginHorizontal: 16,
          marginBottom: Platform.OS === 'ios' ? 28 : 16,
          borderRadius: borderRadius.xl,
          height: 66,
          paddingBottom: 0,
          paddingTop: 0,
          position: 'absolute',
          shadowColor: isDark ? '#22D3EE' : '#0F172A',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDark ? 0.25 : 0.12,
          shadowRadius: 28,
          elevation: 18,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(34,211,238,0.12)' : 'rgba(15,23,42,0.06)',
        },
        tabBarItemStyle: { paddingTop: 10, paddingBottom: 6 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.35, marginTop: -2 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Workouts" component={WorkoutsListScreen} />
      <Tab.Screen name="Social"   component={SocialFeedScreen} />
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
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
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
      <Stack.Screen name="SocialFeed"         component={SocialFeedScreen}         options={{ title: 'Community' }} />
      <Stack.Screen name="UserSearch"         component={UserSearchScreen}         options={{ headerShown: false }} />
      <Stack.Screen name="UserProfile"        component={UserProfileScreen}        options={{ headerShown: false }} />
      <Stack.Screen name="FollowersList"      component={FollowersListScreen}      options={{ headerShown: false }} />
      <Stack.Screen name="Comments"           component={CommentsScreen}           options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
