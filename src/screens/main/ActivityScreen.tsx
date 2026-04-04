import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useTracking } from '../../context/TrackingContext';
import { LocationPoint } from '../../types';
import { formatPace, calculateSplits } from '../../utils/paceUtils';

const { width } = Dimensions.get('window');
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 100 : 88;

// UPGRADED: 9 activity types (was 3)
const ACTIVITY_TYPES = [
  { key: 'walking',  icon: 'walk',        label: 'Walk',     color: '#00C853' },
  { key: 'running',  icon: 'run',         label: 'Run',      color: '#FF5B5B' },
  { key: 'cycling',  icon: 'bike',        label: 'Cycle',    color: '#448AFF' },
  { key: 'swimming', icon: 'swim',        label: 'Swim',     color: '#00BCD4' },
  { key: 'strength', icon: 'weight',      label: 'Strength', color: '#FF9500' },
  { key: 'hiit',     icon: 'fire',        label: 'HIIT',     color: '#FF3D00' },
  { key: 'yoga',     icon: 'meditation',  label: 'Yoga',     color: '#C084FC' },
  { key: 'football', icon: 'soccer',      label: 'Football', color: '#4CAF50' },
  { key: 'other',    icon: 'timer',       label: 'Other',    color: '#9E9E9E' },
] as const;

type ActivityKey = (typeof ACTIVITY_TYPES)[number]['key'];

function RouteMap({ locationPoints, color, colors }: { locationPoints: LocationPoint[]; color: string; colors: any }) {
  if (locationPoints.length < 2) {
    return (
      <View style={[routeStyles.placeholder, { backgroundColor: colors.surfaceElevated }]}>
        <AppIcon name="map-marker-path" size={40} color={colors.textDisabled} />
        <Text style={[routeStyles.placeholderText, { color: colors.textSecondary }]}>Route will appear here</Text>
      </View>
    );
  }
  const mapW = width - 32;
  const mapH = 200;
  const pad = 24;
  const lats = locationPoints.map((p) => p.latitude);
  const lngs = locationPoints.map((p) => p.longitude);
  const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;
  const toX = (lng: number) => pad + ((lng - minLng) / lngRange) * (mapW - pad * 2);
  const toY = (lat: number) => mapH - pad - ((lat - minLat) / latRange) * (mapH - pad * 2);
  const points = locationPoints.map((p) => `${toX(p.longitude).toFixed(1)},${toY(p.latitude).toFixed(1)}`).join(' ');
  const startX = toX(locationPoints[0].longitude);
  const startY = toY(locationPoints[0].latitude);
  const endX = toX(locationPoints[locationPoints.length - 1].longitude);
  const endY = toY(locationPoints[locationPoints.length - 1].latitude);
  return (
    <View style={[routeStyles.svgWrap, { width: mapW, height: mapH, backgroundColor: colors.surfaceElevated }]}>
      <Svg width={mapW} height={mapH}>
        <Polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={startX} cy={startY} r={7} fill="#00C853" stroke={colors.surface} strokeWidth={2} />
        <SvgText x={startX + 10} y={startY + 4} fontSize="11" fill="#00C853" fontWeight="bold">Start</SvgText>
        <Circle cx={endX} cy={endY} r={7} fill={color} stroke={colors.surface} strokeWidth={2} />
        <SvgText x={endX + 10} y={endY + 4} fontSize="11" fill={color} fontWeight="bold">Now</SvgText>
      </Svg>
      <Text style={[routeStyles.pointCount, { color: colors.textSecondary }]}>{locationPoints.length} GPS points</Text>
    </View>
  );
}

const routeStyles = StyleSheet.create({
  svgWrap: { borderRadius: borderRadius.lg, overflow: 'hidden' },
  placeholder: { height: 160, justifyContent: 'center', alignItems: 'center', borderRadius: borderRadius.lg, gap: 10 },
  placeholderText: { fontSize: 13 },
  pointCount: { position: 'absolute', bottom: 8, right: 12, fontSize: 11 },
});

function StatCard({ icon, value, label, color, colors }: { icon: string; value: string; label: string; color: string; colors: any }) {
  return (
    <View style={[statStyles.card, { backgroundColor: colors.surfaceElevated }]}>
      <AppIcon name={icon} size={24} color={color} />
      <Text style={[statStyles.val, { color: colors.text }]}>{value}</Text>
      <Text style={[statStyles.lbl, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', padding: 14, borderRadius: borderRadius.md, gap: 6 },
  val: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  lbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
});

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function ActivityScreen() {
  const { isTracking, steps, distance, calories, duration, locationPoints, startTracking, stopTracking, currentActivity } = useTracking();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [activityType, setActivityType] = useState<ActivityKey>('walking');
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    try {
      setIsLoading(true);
      await startTracking(activityType as any);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start tracking');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    Alert.alert('Complete Activity', 'Would you like to save this activity?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save & Continue',
        onPress: async () => {
          setIsLoading(true);
          const activity = await stopTracking();
          setIsLoading(false);
          if (activity) navigation.navigate('PhotoLog', { activity });
        },
      },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => { setIsLoading(true); await stopTracking(); setIsLoading(false); },
      },
    ]);
  };

  const currentColor = ACTIVITY_TYPES.find((t) => t.key === (isTracking ? currentActivity?.type ?? activityType : activityType))?.color ?? colors.primary;
  
  // UPGRADED: Live pace calculation
  const livePace = distance > 0 && duration > 0 ? formatPace(distance, duration) : '--:--';
  const isRunOrCycle = activityType === 'running' || activityType === 'cycling';
  
  // Km splits
  const splits = calculateSplits(locationPoints);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Please wait...</Text>
          </View>
        </View>
      )}

      {!isTracking ? (
        <ScrollView contentContainerStyle={[styles.startScroll, { paddingBottom: TAB_BAR_HEIGHT }]}>
          <View style={styles.startHeader}>
            <View style={[styles.startIconWrap, { backgroundColor: currentColor + '20' }]}>
              <AppIcon name={ACTIVITY_TYPES.find((t) => t.key === activityType)?.icon ?? 'run'} size={52} color={currentColor} />
            </View>
            <Text style={[styles.startTitle, { color: colors.text }]}>Ready to move?</Text>
            <Text style={[styles.startSub, { color: colors.textSecondary }]}>
              Choose your activity and start tracking your progress in real time.
            </Text>
          </View>

          {/* UPGRADED: 9 activity types in a grid */}
          <View style={[styles.typeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.typeSectionLabel, { color: colors.textSecondary }]}>ACTIVITY TYPE</Text>
            <View style={styles.typeGrid}>
              {ACTIVITY_TYPES.map((type) => {
                const selected = activityType === type.key;
                return (
                  <TouchableOpacity key={type.key} onPress={() => setActivityType(type.key)} activeOpacity={0.8}
                    style={[styles.typeBtn, {
                      backgroundColor: selected ? type.color + '25' : colors.surfaceElevated,
                      borderWidth: selected ? 1.5 : 0,
                      borderColor: selected ? type.color : 'transparent',
                    }]}>
                    <AppIcon name={type.icon} size={24} color={selected ? type.color : colors.textSecondary} />
                    <Text style={[styles.typeBtnLabel, { color: selected ? type.color : colors.textSecondary }]}>{type.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={[styles.startBtn, { backgroundColor: currentColor }]} onPress={handleStart} activeOpacity={0.85}>
            <AppIcon name="play" size={24} color="#FFFFFF" />
            <Text style={styles.startBtnText}>Start Tracking</Text>
          </TouchableOpacity>

          <View style={[styles.tipsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.tipsTitle, { color: colors.text }]}>Tips</Text>
            {[
              { icon: 'map-marker-path', text: 'Keep GPS enabled for accurate route tracking', color: colors.info },
              { icon: 'shoe-print', text: 'Pedometer tracks steps even without GPS signal', color: colors.success },
              { icon: 'bell-ring', text: 'Audio cues announce each completed kilometer', color: '#A855F7' },
            ].map((tip, i) => (
              <View key={i} style={[styles.tipRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                <View style={[styles.tipIconWrap, { backgroundColor: tip.color + '20' }]}>
                  <AppIcon name={tip.icon} size={18} color={tip.color} />
                </View>
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.trackingScroll, { paddingBottom: TAB_BAR_HEIGHT }]}>
          <View style={[styles.statsPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.durationWrap}>
              <AppIcon name="timer" size={22} color={currentColor} />
              <Text style={[styles.durationText, { color: colors.text }]}>{formatDuration(duration)}</Text>
            </View>

            {/* UPGRADED: Show pace prominently for runs/cycles */}
            {(isRunOrCycle || currentActivity?.type === 'running' || currentActivity?.type === 'cycling') && (
              <View style={styles.paceWrap}>
                <Text style={[styles.paceVal, { color: currentColor }]}>{livePace}</Text>
                <Text style={[styles.paceLbl, { color: colors.textSecondary }]}>min/km</Text>
              </View>
            )}

            <View style={styles.statRow}>
              <StatCard icon="shoe-print" value={steps.toLocaleString()} label="Steps" color={currentColor} colors={colors} />
              <StatCard icon="map-marker-distance" value={`${distance.toFixed(2)} km`} label="Distance" color={currentColor} colors={colors} />
              <StatCard icon="fire" value={String(calories)} label="Calories" color={currentColor} colors={colors} />
            </View>
          </View>

          <View style={styles.mapWrap}>
            <RouteMap locationPoints={locationPoints} color={currentColor} colors={colors} />
          </View>

          {/* UPGRADED: Live km splits */}
          {splits.length > 0 && (
            <View style={[styles.splitsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.splitsTitle, { color: colors.text }]}>Km Splits</Text>
              {splits.map((s) => (
                <View key={s.km} style={[styles.splitRow, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.splitKm, { color: colors.textSecondary }]}>Km {s.km}</Text>
                  <Text style={[styles.splitPace, {
                    color: s.isBest ? '#00C853' : s.isWorst ? colors.error : colors.text,
                    fontWeight: (s.isBest || s.isWorst) ? '800' : '600',
                  }]}>
                    {s.paceStr} /km {s.isBest ? '🏆' : s.isWorst ? '' : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={[styles.stopBtn, { backgroundColor: colors.error }]} onPress={handleStop} activeOpacity={0.85}>
            <AppIcon name="stop" size={24} color="#FFFFFF" />
            <Text style={styles.stopBtnText}>Stop Activity</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  loadingBox: { padding: 28, borderRadius: borderRadius.xl, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  startScroll: { padding: spacing.md, paddingTop: Platform.OS === 'ios' ? 20 : 16, gap: spacing.md },
  startHeader: { alignItems: 'center', paddingVertical: spacing.lg, gap: 12 },
  startIconWrap: { width: 104, height: 104, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  startTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  startSub: { fontSize: 14, textAlign: 'center', maxWidth: 260 },
  typeCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  typeSectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  // UPGRADED: Grid layout for 9 types
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { width: '30%', alignItems: 'center', paddingVertical: 14, borderRadius: borderRadius.lg, gap: 6 },
  typeBtnLabel: { fontSize: 11, fontWeight: '700' },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: borderRadius.full, gap: 12 },
  startBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  tipsCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md },
  tipsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  tipIconWrap: { width: 32, height: 32, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  // Tracking mode
  trackingScroll: { padding: spacing.md, paddingTop: Platform.OS === 'ios' ? 20 : 16, gap: spacing.md },
  statsPanel: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, gap: spacing.md },
  durationWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  durationText: { fontSize: 44, fontWeight: '900', letterSpacing: -2 },
  // UPGRADED: Pace display
  paceWrap: { alignItems: 'center', paddingVertical: 4 },
  paceVal: { fontSize: 34, fontWeight: '900', letterSpacing: -1.5 },
  paceLbl: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  mapWrap: { minHeight: 160 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: borderRadius.full, gap: 12 },
  stopBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  // UPGRADED: Splits card
  splitsCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md },
  splitsTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  splitKm: { fontSize: 13, fontWeight: '600' },
  splitPace: { fontSize: 14, letterSpacing: -0.3 },
});
