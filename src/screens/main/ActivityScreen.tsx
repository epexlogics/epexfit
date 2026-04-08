/**
 * ActivityScreen — v3 Fixed
 * - Removed PROVIDER_DEFAULT / Google Maps dependency (uses OSM/Apple Maps free)
 * - Fixed status bar overlap with useSafeAreaInsets
 * - Removed unused SVG + LocationPoint imports
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Animated,
} from 'react-native';
import { healthService, HealthSyncResult } from '../../services/healthService';

import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { supabase } from '../../services/supabase';
import dayjs from 'dayjs';
import { formatPace, calculateSplits } from '../../utils/paceUtils';
import { useUnitSystem, type UnitSystem } from '../../utils/units';
import { TAB_BAR_HEIGHT } from '../../constants/layout';

const { width } = Dimensions.get('window');

/* Activity chip colors — cyan / neon / soft-rose system */
const ACTIVITY_TYPES = [
  { key: 'walking',  icon: 'walk',       label: 'Walk',     color: '#4ADE80' },
  { key: 'running',  icon: 'run',        label: 'Run',      color: '#FB7185' },
  { key: 'cycling',  icon: 'bike',       label: 'Cycle',    color: '#38BDF8' },
  { key: 'swimming', icon: 'swim',       label: 'Swim',     color: '#22D3EE' },
  { key: 'strength', icon: 'weight',     label: 'Strength', color: '#A78BFA' },
  { key: 'hiit',     icon: 'fire',       label: 'HIIT',     color: '#F472B6' },
  { key: 'yoga',     icon: 'meditation', label: 'Yoga',     color: '#C084FC' },
  { key: 'football', icon: 'soccer',     label: 'Football', color: '#4ADE80' },
  { key: 'other',    icon: 'timer',      label: 'Other',    color: '#94A3B8' },
] as const;
type ActivityKey = (typeof ACTIVITY_TYPES)[number]['key'];

const HR_ZONES = [
  { zone: 1, name: 'Rest',      pctMin: 0,  pctMax: 50,  color: '#94A3B8', desc: 'Recovery' },
  { zone: 2, name: 'Easy',      pctMin: 50, pctMax: 60,  color: '#4ADE80', desc: 'Fat burn' },
  { zone: 3, name: 'Aerobic',   pctMin: 60, pctMax: 70,  color: '#38BDF8', desc: 'Endurance' },
  { zone: 4, name: 'Tempo',     pctMin: 70, pctMax: 80,  color: '#FBBF24', desc: 'Performance' },
  { zone: 5, name: 'Threshold', pctMin: 80, pctMax: 90,  color: '#FB7185', desc: 'Hard' },
  { zone: 6, name: 'Max',       pctMin: 90, pctMax: 100, color: '#C084FC', desc: 'Redline' },
];
const PACE_ZONES = [
  { name: 'Easy',      minS: 360, maxS: 9999, color: '#4ADE80' },
  { name: 'Aerobic',   minS: 300, maxS: 360,  color: '#38BDF8' },
  { name: 'Tempo',     minS: 240, maxS: 300,  color: '#FBBF24' },
  { name: 'Threshold', minS: 210, maxS: 240,  color: '#FB7185' },
  { name: 'Max',       minS: 0,   maxS: 210,  color: '#C084FC' },
];
function getHRZone(bpm: number, max: number) {
  const p = (bpm / max) * 100;
  return HR_ZONES.find(z => p >= z.pctMin && p < z.pctMax) ?? HR_ZONES[0];
}
function getPaceZone(dist: number, dur: number) {
  if (!dist) return PACE_ZONES[0];
  const s = dur / dist;
  return PACE_ZONES.find(z => s >= z.minS && s < z.maxS) ?? PACE_ZONES[0];
}
function formatDur(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function HealthSyncWidget({ colors, accent, onStepsSynced }: { colors: any; accent: string; onStepsSynced?: (steps: number) => void }) {
  const [syncResult, setSyncResult] = useState<HealthSyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const platformName = Platform.OS === 'ios' ? 'Apple Health' : 'Google Fit';

  const doSync = useCallback(async () => {
    setSyncing(true);
    const result = await healthService.getTodaySteps();
    setSyncResult(result);
    setSyncing(false);
    setLastSyncedAt(new Date());
    if (result.steps > 0) onStepsSynced?.(result.steps);
  }, [onStepsSynced]);

  useEffect(() => { doSync(); }, []);

  if (dismissed) return null;

  const isConnected = syncResult?.available === true;
  const statusColor = isConnected ? colors.success : colors.warning;
  const statusEmoji = isConnected ? '✅' : '⌚';
  const sourceLabel = syncResult?.source === 'healthkit' ? 'HealthKit' :
                      syncResult?.source === 'googlefit' ? 'Google Fit' :
                      syncResult?.source === 'cached'    ? 'Cached'    : platformName;

  return (
    <View style={[bS.wrap, { backgroundColor: statusColor + '10', borderColor: statusColor + '30' }]}>
      <Text style={{ fontSize: 20 }}>{statusEmoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[bS.title, { color: colors.text }]}>
          {isConnected ? `${sourceLabel} Connected` : `Connect ${platformName}`}
        </Text>
        {syncResult && syncResult.steps > 0 ? (
          <Text style={[bS.sub, { color: colors.textSecondary }]}>
            Today: <Text style={{ fontWeight: '800', color: statusColor }}>{syncResult.steps.toLocaleString()}</Text> steps
            {lastSyncedAt ? <Text style={{ color: colors.textDisabled }}> · synced {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text> : null}
          </Text>
        ) : (
          <Text style={[bS.sub, { color: colors.textSecondary }]}>
            {syncing ? 'Syncing…' : isConnected
              ? 'Tap SYNC to fetch today\'s steps'
              : 'Grant motion permissions to auto-sync steps'}
          </Text>
        )}
      </View>
      {syncing ? (
        <ActivityIndicator size="small" color={statusColor} />
      ) : (
        <TouchableOpacity onPress={doSync} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          style={[bS.syncBtn, { backgroundColor: statusColor + '20' }]}>
          <Text style={{ color: statusColor, fontSize: 11, fontWeight: '800' }}>SYNC</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
        <Text style={{ color: colors.textDisabled, fontSize: 18 }}>×</Text>
      </TouchableOpacity>
      </View>
  );
}
const bS = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  title: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 2 },
  syncBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});

function StatCard({ icon, value, label, color, colors, onPress }: any) {
  const C = onPress ? TouchableOpacity : View;
  return (
    <C style={[sC.card, { backgroundColor: colors.surfaceElevated }]} onPress={onPress} activeOpacity={0.8}>
      <AppIcon name={icon} size={22} color={color} />
      <Text style={[sC.val, { color: onPress ? colors.textDisabled : colors.text, fontSize: onPress ? 12 : 18 }]}>{value}</Text>
      <Text style={[sC.lbl, { color: colors.textSecondary }]}>{label}</Text>
    </C>
  );
}
const sC = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', padding: 12, borderRadius: borderRadius.md, gap: 5 },
  val: { fontWeight: '800', letterSpacing: -0.5 },
  lbl: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
});

function SplitsTable({ splits, color, colors, unitSystem }: { splits: any[]; color: string; colors: any; unitSystem: UnitSystem }) {
  if (!splits.length) return null;
  const fastest = Math.min(...splits.map((s: any) => s.seconds));
  return (
    <View style={[spS.wrap, { backgroundColor: colors.surfaceElevated }]}>
      <Text style={[spS.title, { color: colors.textSecondary }]}>KM SPLITS</Text>
      {splits.map((s: any) => (
        <View key={s.km} style={[spS.row, { borderBottomColor: colors.divider }]}>
          <Text style={[spS.km, { color: colors.textSecondary }]}>{unitSystem === 'imperial' ? 'MI' : 'KM'} {s.km}</Text>
          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <View style={[spS.bar, { backgroundColor: colors.border }]}>
              <View style={[spS.fill, { backgroundColor: color, width: `${Math.min((fastest / s.seconds) * 100, 100)}%` }]} />
            </View>
          </View>
          <Text style={[spS.pace, { color: s.seconds === fastest ? color : colors.text }]}>{s.paceStr}</Text>
          {s.seconds === fastest && <Text style={{ fontSize: 10, marginLeft: 4 }}>⚡</Text>}
        </View>
      ))}
    </View>
  );
}
const spS = StyleSheet.create({
  wrap: { borderRadius: borderRadius.lg, padding: 14, marginBottom: 12 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5 },
  km: { fontSize: 12, fontWeight: '700', width: 44 },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  pace: { fontSize: 13, fontWeight: '800', minWidth: 52, textAlign: 'right' },
});

export default function ActivityScreen() {
  const { isTracking, steps, distance, calories, duration, locationPoints, startTracking, stopTracking, currentActivity } = useTracking();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const unitSystem = useUnitSystem();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [actType, setActType] = useState<ActivityKey>('walking');
  const [loading, setLoading] = useState(false);
  const [hrBpm, setHrBpm] = useState('');
  const [showHrModal, setShowHrModal] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(0);
  const MAX_HR = 190;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isTracking) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.8, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isTracking]);

  const color = ACTIVITY_TYPES.find(t => t.key === (isTracking ? currentActivity?.type ?? actType : actType))?.color ?? colors.primary;
  const livePace = distance > 0 && duration > 0 ? formatPace(distance, duration) : '--:-';
  const splits = calculateSplits(locationPoints);
  const hrZone = currentBpm > 0 ? getHRZone(currentBpm, MAX_HR) : null;
  const paceZone = (actType === 'running' || actType === 'cycling') && distance > 0 ? getPaceZone(distance, duration) : null;


  const doStart = async () => {
    try { setLoading(true); await startTracking(actType as any); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };
  const doStop = () => Alert.alert('Complete', 'Save this activity?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Save', onPress: async () => { setLoading(true); const a = await stopTracking({ avgHr: currentBpm > 0 ? currentBpm : undefined }); setLoading(false); if (a) nav.navigate('PhotoLog', { activity: a }); } },
    { text: 'Discard', style: 'destructive', onPress: async () => { setLoading(true); await stopTracking(); setLoading(false); } },
  ]);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {loading && <View style={s.overlay}><ActivityIndicator size="large" color={color} /></View>}

      <Modal visible={showHrModal} transparent animationType="fade">
        <View style={s.modalBg}>
          <View style={[s.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Heart Rate</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center' }}>No wearable detected — enter manually</Text>
            <TextInput style={[s.hrInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
              value={hrBpm} onChangeText={setHrBpm} keyboardType="number-pad" placeholder="145" placeholderTextColor={colors.textDisabled} maxLength={3} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.border }]} onPress={() => setShowHrModal(false)}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: color }]} onPress={() => {
                const b = parseInt(hrBpm); if (!isNaN(b) && b > 30 && b < 250) setCurrentBpm(b); setShowHrModal(false);
              }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: TAB_BAR_HEIGHT + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.title, { color: colors.text }]}>Activity</Text>

        {!isTracking && (
          <HealthSyncWidget
            colors={colors}
            accent={color}
            onStepsSynced={async (steps) => {
              if (!user) return;
              const today = dayjs().format('YYYY-MM-DD');
              await supabase
                .from('daily_logs')
                .upsert({ user_id: user.id, date: today, steps }, { onConflict: 'user_id,date' });
            }}
          />
        )}

        {!isTracking && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {ACTIVITY_TYPES.map(t => {
                const sel = actType === t.key;
                return (
                  <TouchableOpacity key={t.key} style={[s.chip, { backgroundColor: sel ? t.color + '20' : colors.surfaceElevated, borderColor: sel ? t.color : colors.border }]}
                    onPress={() => setActType(t.key)} activeOpacity={0.75}>
                    <AppIcon name={t.icon} size={16} color={sel ? t.color : colors.textSecondary} />
                    <Text style={[s.chipLabel, { color: sel ? t.color : colors.textSecondary }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        <View style={[s.mapWrap, { borderColor: colors.border, overflow: 'hidden' }]}>
          {locationPoints.length > 0 ? (
            <>
              <WebView
                style={s.map}
                originWhitelist={['*']}
                javaScriptEnabled
                scrollEnabled={false}
                startInLoadingState
                renderLoading={() => (
                  <View style={[s.map, { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }]}>
                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>Loading map…</Text>
                  </View>
                )}
                renderError={() => (
                  <View style={[s.map, { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', gap: 6 }]}>
                    <Text style={{ fontSize: 28 }}>🗺</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>Map unavailable offline</Text>
                    <Text style={{ color: '#475569', fontSize: 11 }}>{locationPoints.length} GPS pts recorded</Text>
                  </View>
                )}
                source={{ html: `<!DOCTYPE html><html><head>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
                  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                  <style>
                    html,body,#map{margin:0;padding:0;width:100%;height:100%;}
                    #loader{position:fixed;top:0;left:0;right:0;bottom:0;background:#0f172a;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#94a3b8;font-size:13px;}
                  </style>
                </head><body>
                  <div id="loader">Loading map…</div>
                  <div id="map"></div>
                  <script>
                    var pts = ${JSON.stringify(locationPoints.map(p => [p.latitude, p.longitude]))};
                    function initMap() {
                      var loader = document.getElementById('loader');
                      if (loader) loader.style.display = 'none';
                      var map = L.map('map', { zoomControl: false, attributionControl: false });
                      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
                      }).addTo(map);
                      if (pts.length > 0) {
                        var poly = L.polyline(pts, { color: '${color}', weight: 4 }).addTo(map);
                        L.circleMarker(pts[0], { radius: 7, color: '#4ADE80', fillColor: '#4ADE80', fillOpacity: 1 }).addTo(map);
                        L.circleMarker(pts[pts.length-1], { radius: 7, color: '${color}', fillColor: '${color}', fillOpacity: 1 }).addTo(map);
                        map.fitBounds(poly.getBounds(), { padding: [20, 20] });
                      } else {
                        map.setView([0, 0], 2);
                      }
                    }
                    if (typeof L !== 'undefined') { initMap(); }
                    else { window.addEventListener('load', initMap); }
                  </script>
                </body></html>` }}
              />
              {isTracking && (
                <View style={s.liveDotWrap}>
                  <Animated.View style={[s.liveDotRing, { backgroundColor: color + '50', transform: [{ scale: pulse }] }]} />
                  <View style={[s.liveDot, { backgroundColor: color }]} />
                </View>
              )}
              <Text style={[s.gpsCnt, { color: colors.textSecondary }]}>{locationPoints.length} GPS pts</Text>
            </>
          ) : (
            <View style={[s.mapPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={{ fontSize: 36 }}>🗺</Text>
              <Text style={[s.phText, { color: colors.textSecondary }]}>Your route appears here</Text>
              <Text style={[s.phSub, { color: colors.textDisabled }]}>Enable location permissions to start tracking</Text>
            </View>
          )}
        </View>

        {isTracking && (
          <>
            <View style={s.statsRow}>
              <StatCard icon="shoe-print" value={steps.toLocaleString()} label="Steps" color={color} colors={colors} />
              <StatCard icon="map-marker-distance" value={unitSystem === 'imperial' ? `${(distance * 0.621371).toFixed(2)} mi` : `${distance.toFixed(2)} km`} label="Distance" color={colors.metricDistance} colors={colors} />
              <StatCard icon="timer" value={formatDur(duration)} label="Time" color={colors.success} colors={colors} />
            </View>
            <View style={s.statsRow}>
              <StatCard icon="fire" value={`${calories}`} label="Kcal" color={colors.metricBurn} colors={colors} />
              <StatCard icon="run" value={livePace} label={unitSystem === 'imperial' ? 'Pace/mi' : 'Pace/km'} color={color} colors={colors} />
              <StatCard icon="heart" value={currentBpm > 0 ? `${currentBpm} bpm` : 'Tap to add'}
                label={hrZone?.name ?? 'Heart Rate'} color={hrZone?.color ?? colors.textDisabled}
                colors={colors} onPress={currentBpm === 0 ? () => setShowHrModal(true) : undefined} />
            </View>
            {hrZone && (
              <View style={[s.zonePill, { backgroundColor: hrZone.color + '15', borderColor: hrZone.color + '40' }]}>
                <View style={[s.zoneDot, { backgroundColor: hrZone.color }]} />
                <Text style={[s.zoneName, { color: hrZone.color }]}>Zone {hrZone.zone} — {hrZone.name}</Text>
                <Text style={[s.zoneDesc, { color: colors.textSecondary }]}>{hrZone.desc}</Text>
              </View>
            )}
            {paceZone && (
              <View style={[s.zonePill, { backgroundColor: paceZone.color + '15', borderColor: paceZone.color + '40' }]}>
                <View style={[s.zoneDot, { backgroundColor: paceZone.color }]} />
                <Text style={[s.zoneName, { color: paceZone.color }]}>{paceZone.name} Pace</Text>
                <Text style={[s.zoneDesc, { color: colors.textSecondary }]}>{livePace} / {unitSystem === 'imperial' ? 'mi' : 'km'}</Text>
              </View>
            )}
            <SplitsTable splits={splits} color={color} colors={colors} unitSystem={unitSystem} />
          </>
        )}

        <TouchableOpacity style={[s.mainBtn, { backgroundColor: isTracking ? colors.errorSoft : color }]}
          onPress={isTracking ? doStop : doStart} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={s.mainBtnText}>{isTracking ? 'STOP & SAVE' : 'START ACTIVITY'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  chipLabel: { fontSize: 12, fontWeight: '700' },
  mapWrap: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, marginBottom: 12, height: 230 },
  map: { width: '100%', height: '100%' },
  mapPlaceholder: { height: 230, justifyContent: 'center', alignItems: 'center', gap: 8 },
  phText: { fontSize: 13, fontWeight: '600' },
  phSub: { fontSize: 11, textAlign: 'center', paddingHorizontal: 24 },
  liveDotWrap: { position: 'absolute', bottom: 14, right: 14, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  liveDotRing: { position: 'absolute', width: 26, height: 26, borderRadius: 13 },
  liveDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: '#fff' },
  startDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  gpsCnt: { position: 'absolute', bottom: 8, left: 10, fontSize: 10, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  zonePill: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneName: { fontSize: 13, fontWeight: '800' },
  zoneDesc: { fontSize: 12 },
  mainBtn: { borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 16 },
  mainBtnText: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { width: 280, borderRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  hrInput: { borderWidth: 1, borderRadius: 12, height: 52, textAlign: 'center', fontSize: 28, fontWeight: '900' },
  modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
