import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { Activity } from '../../types';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import { formatPace } from '../../utils/paceUtils';
import { useUnitSystem } from '../../utils/units';
import dayjs from '../../utils/dayjs';

// Expanded to all activity types
const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  running:  { icon: 'run',       color: '#FF5B5B', label: 'Running'  },
  cycling:  { icon: 'bike',      color: '#448AFF', label: 'Cycling'  },
  walking:  { icon: 'walk',      color: '#00C853', label: 'Walking'  },
  swimming: { icon: 'swim',      color: '#00BCD4', label: 'Swimming' },
  strength: { icon: 'weight',    color: '#FF9500', label: 'Strength' },
  hiit:     { icon: 'fire',      color: '#FF3D00', label: 'HIIT'     },
  yoga:     { icon: 'meditation',color: '#C084FC', label: 'Yoga'     },
  football: { icon: 'soccer',    color: '#4CAF50', label: 'Football' },
  other:    { icon: 'timer',     color: '#9E9E9E', label: 'Other'    },
};

type FilterType = 'all' | 'running' | 'walking' | 'cycling' | 'strength' | 'other';

const FILTER_CHIPS: { key: FilterType; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'running',  label: '🏃 Run'   },
  { key: 'walking',  label: '🚶 Walk'  },
  { key: 'cycling',  label: '🚴 Cycle' },
  { key: 'strength', label: '💪 Lift'  },
  { key: 'other',    label: '⚡ More'  },
];

// Personal Records detected from activity list
interface PRs {
  fastestPace?: { value: number; actId: string };  // sec/km
  longestRun?: { value: number; actId: string };   // km
  mostSteps?: { value: number; actId: string };
}

function detectPRs(activities: Activity[]): PRs {
  const prs: PRs = {};
  for (const a of activities) {
    // Fastest pace (lower is better)
    if ((a.type === 'running' || a.type === 'cycling') && a.distance > 0.5) {
      const pace = a.duration / a.distance;
      if (!prs.fastestPace || pace < prs.fastestPace.value) {
        prs.fastestPace = { value: pace, actId: a.id };
      }
    }
    // Longest run
    if (a.type === 'running') {
      if (!prs.longestRun || a.distance > prs.longestRun.value) {
        prs.longestRun = { value: a.distance, actId: a.id };
      }
    }
    // Most steps
    if (!prs.mostSteps || a.steps > prs.mostSteps.value) {
      prs.mostSteps = { value: a.steps, actId: a.id };
    }
  }
  return prs;
}

export default function HistoryScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const unitSystem = useUnitSystem();
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await databaseService.getActivities(user.id);
    setActivities(data ?? []);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = useMemo(() => {
    if (filter === 'all') return activities;
    if (filter === 'other') return activities.filter(a => !['running','walking','cycling','strength'].includes(a.type));
    return activities.filter(a => a.type === filter);
  }, [activities, filter]);

  const prs = useMemo(() => detectPRs(activities), [activities]);

  const accentColor = colors.primary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
    >
      <View style={[styles.pageHeader, { }]}>
        <Text style={[styles.title, { color: colors.text }]}>Activity History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {activities.length} total · {filtered.length} shown
        </Text>
      </View>

      {/* Personal Records Banner */}
      {activities.length > 0 && (
        <View style={[styles.prBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.prTitle, { color: colors.text }]}>🏆 Personal Records</Text>
          <View style={styles.prRow}>
            {prs.fastestPace && (
              <View style={styles.prItem}>
                <Text style={[styles.prVal, { color: accentColor }]}>
                  {formatPace(1, prs.fastestPace.value)}
                </Text>
                <Text style={[styles.prLbl, { color: colors.textSecondary }]}>Best pace /{unitSystem === 'imperial' ? 'mi' : 'km'}</Text>
              </View>
            )}
            {prs.longestRun && (
              <View style={styles.prItem}>
                <Text style={[styles.prVal, { color: '#FF5B5B' }]}>
                  {unitSystem === 'imperial'
                    ? `${(prs.longestRun.value * 0.621371).toFixed(1)} mi`
                    : `${prs.longestRun.value.toFixed(1)} km`}
                </Text>
                <Text style={[styles.prLbl, { color: colors.textSecondary }]}>Longest run</Text>
              </View>
            )}
            {prs.mostSteps && (
              <View style={styles.prItem}>
                <Text style={[styles.prVal, { color: '#4D9FFF' }]}>{prs.mostSteps.value.toLocaleString()}</Text>
                <Text style={[styles.prLbl, { color: colors.textSecondary }]}>Most steps</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTER_CHIPS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, {
                backgroundColor: active ? accentColor : colors.surface,
                borderColor: active ? accentColor : colors.border,
              }]}
              onPress={() => setFilter(key)}
            >
              <Text style={{ color: active ? '#000' : colors.text, fontWeight: '700', fontSize: 12 }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 40 }}>🏃</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No activities for this filter yet.
            </Text>
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: accentColor }]}
              onPress={() => navigation.navigate('Activity')}
            >
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 14 }}>Start Activity</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map((activity) => {
            const meta = TYPE_META[activity.type] ?? TYPE_META.other;
            const mins = Math.floor(activity.duration / 60);
            const pace = activity.distance > 0.1 && activity.duration > 0
              ? formatPace(activity.distance, activity.duration)
              : null;
            const isPR =
              prs.fastestPace?.actId === activity.id ||
              prs.longestRun?.actId === activity.id ||
              prs.mostSteps?.actId === activity.id;

            return (
              <TouchableOpacity
                key={activity.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: isPR ? accentColor + '60' : colors.border }]}
                onPress={() => navigation.navigate('PhotoLog', { activity })}
                activeOpacity={0.85}
              >
                {isPR && (
                  <View style={[styles.prTag, { backgroundColor: accentColor + '20' }]}>
                    <Text style={[styles.prTagText, { color: accentColor }]}>🏆 Personal Record</Text>
                  </View>
                )}
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: meta.color + '20' }]}>
                    <AppIcon name={meta.icon} size={22} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actType, { color: colors.text }]}>{meta.label}</Text>
                    <Text style={[styles.actDate, { color: colors.textSecondary }]}>
                      {dayjs(activity.startTime).format('MMM DD, YYYY · h:mm A')}
                    </Text>
                  </View>
                  <AppIcon name="chevron-right" size={16} color={colors.textDisabled} />
                </View>
                <View style={[styles.statsRow, { borderTopColor: colors.divider }]}>
                  <View style={styles.statItem}>
                    <AppIcon name="shoe-print" size={13} color={meta.color} />
                    <Text style={[styles.statVal, { color: colors.text }]}>{activity.steps.toLocaleString()}</Text>
                    <Text style={[styles.statLbl, { color: colors.textSecondary }]}>steps</Text>
                  </View>
                  <View style={styles.statItem}>
                    <AppIcon name="map-marker-distance" size={13} color={meta.color} />
                    <Text style={[styles.statVal, { color: colors.text }]}>
                      {unitSystem === 'imperial'
                        ? `${(activity.distance * 0.621371).toFixed(2)} mi`
                        : `${activity.distance.toFixed(2)} km`}
                    </Text>
                    <Text style={[styles.statLbl, { color: colors.textSecondary }]}>distance</Text>
                  </View>
                  <View style={styles.statItem}>
                    <AppIcon name="fire" size={13} color={meta.color} />
                    <Text style={[styles.statVal, { color: colors.text }]}>{activity.calories}</Text>
                    <Text style={[styles.statLbl, { color: colors.textSecondary }]}>kcal</Text>
                  </View>
                  <View style={styles.statItem}>
                    <AppIcon name="timer" size={13} color={meta.color} />
                    <Text style={[styles.statVal, { color: colors.text }]}>{mins}m</Text>
                    <Text style={[styles.statLbl, { color: colors.textSecondary }]}>time</Text>
                  </View>
                  {pace && (
                    <View style={styles.statItem}>
                      <AppIcon name="run-fast" size={13} color={meta.color} />
                      <Text style={[styles.statVal, { color: colors.text }]}>{pace}</Text>
                      <Text style={[styles.statLbl, { color: colors.textSecondary }]}>/{unitSystem === 'imperial' ? 'mi' : 'km'}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
      <View style={{ height: 110 }} />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { marginTop: 2, fontSize: 13 },
  prBanner: { marginHorizontal: 16, marginBottom: 8, borderRadius: borderRadius.xl, borderWidth: 1, padding: 16 },
  prTitle: { fontSize: 14, fontWeight: '800', marginBottom: 12 },
  prRow: { flexDirection: 'row', gap: 8 },
  prItem: { flex: 1, alignItems: 'center' },
  prVal: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  prLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, textAlign: 'center' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  list: { padding: 16, gap: 10 },
  empty: { borderRadius: borderRadius.xl, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  startBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, marginTop: 4 },
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: 14, gap: 12 },
  prTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 2 },
  prTagText: { fontSize: 11, fontWeight: '700' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actType: { fontSize: 15, fontWeight: '700' },
  actDate: { fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 10, flexWrap: 'wrap', gap: 6 },
  statItem: { alignItems: 'center', gap: 3 },
  statVal: { fontSize: 13, fontWeight: '700' },
  statLbl: { fontSize: 10, fontWeight: '500' },
}
    
  );