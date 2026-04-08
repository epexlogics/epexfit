/**
 * ImportScreen — Import activities from Strava, Garmin (TCX), Apple Health
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import AppIcon from '../../components/AppIcon';
import { importFromStrava, parseTcxActivity, importFromHealthPlatform } from '../../services/importService';
import { borderRadius, spacing } from '../../constants/theme';
import { openAuthSessionAsync } from 'expo-web-browser';

const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';
const STRAVA_CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET ?? '';
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/mobile/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

function ImportCard({
  icon,
  title,
  description,
  color,
  buttonLabel,
  onPress,
  loading,
  connected,
}: {
  icon: string;
  title: string;
  description: string;
  color: string;
  buttonLabel: string;
  onPress: () => void;
  loading?: boolean;
  connected?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[iC.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={[iC.iconWrap, { backgroundColor: color + '18' }]}>
        <AppIcon name={icon} size={28} color={color} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[iC.title, { color: colors.text }]}>{title}</Text>
          {connected && (
            <View style={[iC.badge, { backgroundColor: '#22C55E22' }]}>
              <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>✓ Connected</Text>
            </View>
          )}
        </View>
        <Text style={[iC.desc, { color: colors.textSecondary }]}>{description}</Text>
      </View>
      <TouchableOpacity
        style={[iC.btn, { backgroundColor: color + '20', borderColor: color + '50' }]}
        onPress={onPress}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{buttonLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const iC = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontSize: 16, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 18 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    flexShrink: 0,
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ImportScreen() {
  const { colors, accent } = useTheme();
  const { show } = useToast();
  const navigation = useNavigation<any>();

  const [stravaLoading, setStravaLoading] = useState(false);
  const [garminLoading, setGarminLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);

  // ── Strava ─────────────────────────────────────────────────────────────
  const handleStravaConnect = useCallback(async () => {
    if (!STRAVA_CLIENT_ID) {
      show({ message: 'Add EXPO_PUBLIC_STRAVA_CLIENT_ID to .env to enable Strava import.', variant: 'error', duration: 5000 });
      return;
    }
    setStravaLoading(true);
    try {
      const redirectUri = makeRedirectUri({ scheme: 'epexfit', path: 'strava' });
      const authUrl =
        `${STRAVA_AUTH_URL}?client_id=${STRAVA_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=activity:read_all` +
        `&approval_prompt=auto`;

const result = await openAuthSessionAsync(authUrl, redirectUri);

  if (result.type === 'success' && result.url) {
    const code = new URL(result.url).searchParams.get('code');
    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
      }),
    });
        if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
        const tokenJson = await tokenRes.json() as { access_token: string };
        const summary = await importFromStrava(tokenJson.access_token);
        show({
          message: `Imported ${summary.imported} activit${summary.imported !== 1 ? 'ies' : 'y'}${summary.skipped > 0 ? ` (${summary.skipped} skipped)` : ''}`,
          variant: 'success',
        });
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // User cancelled — do nothing
      } else {
        throw new Error('Strava authorisation failed');
      }
    } catch (e: any) {
      show({ message: e?.message ?? 'Strava import failed', variant: 'error' });
    } finally {
      setStravaLoading(false);
    }
  }, [show]);

  // ── Garmin (TCX file) ──────────────────────────────────────────────────
  const handleGarminImport = useCallback(async () => {
    setGarminLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/xml', 'text/xml', '*/*'],
        multiple: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      let imported = 0, errors = 0;

      for (const asset of result.assets) {
        try {
          const xml = await FileSystem.readAsStringAsync(asset.uri);
          const activity = parseTcxActivity(xml, asset.name);
          if (activity) {
            const summary = await importFromHealthPlatform([activity]);
            imported += summary.imported;
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
      }

      show({
        message: `Imported ${imported} activity${imported !== 1 ? 'ies' : 'y'}${errors > 0 ? ` (${errors} failed)` : ''}`,
        variant: imported > 0 ? 'success' : 'error',
      });
    } catch {
      show({ message: 'File picker error', variant: 'error' });
    } finally {
      setGarminLoading(false);
    }
  }, [show]);

  // ── Apple Health / Google Fit ──────────────────────────────────────────
  const handleHealthImport = useCallback(async () => {
    setHealthLoading(true);
    try {
      if (Platform.OS === 'android') {
        // Android: expo-health-connect
        const HealthConnect = await import('react-native-health-connect').catch(() => null);
        if (!HealthConnect) {
          show({ message: 'Health Connect not available. Install it from the Play Store.', variant: 'error' });
          return;
        }
        const isInit = await HealthConnect.initialize();
        if (!isInit) {
          show({ message: 'Health Connect could not be initialised on this device.', variant: 'error' });
          return;
        }
        await HealthConnect.requestPermission([
          { accessType: 'read', recordType: 'Steps' },
          { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
          { accessType: 'read', recordType: 'ExerciseSession' },
        ]);
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const records = await HealthConnect.readRecords('ExerciseSession', {
          timeRangeFilter: {
            operator: 'between',
            startTime: monthAgo.toISOString(),
            endTime: now.toISOString(),
          },
        });
        const mapped = (records?.records ?? []).map((r: any, i: number) => ({
          externalId: `health_connect_${r.metadata?.id ?? i}`,
          source: 'google_fit' as const,
          type: 'other',
          distanceKm: (r.totalDistance?.inMeters ?? 0) / 1000,
          durationSec: r.endTime && r.startTime
            ? Math.round((new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 1000)
            : 0,
          calories: r.totalActiveCalories?.inCalories ?? 0,
          startedAt: r.startTime ?? new Date().toISOString(),
        }));
        const summary = await importFromHealthPlatform(mapped);
        show({
          message: `Imported ${summary.imported} activit${summary.imported !== 1 ? 'ies' : 'y'}${summary.skipped > 0 ? ` (${summary.skipped} skipped)` : ''}`,
          variant: summary.imported > 0 ? 'success' : 'info',
        });
      } else {
        // iOS: react-native-health (HealthKit)
        show({
          message: 'iOS HealthKit sync — wire react-native-health in your Expo dev build. See DEPLOYMENT_GUIDE.md.',
          variant: 'info',
          duration: 5000,
        });
      }
    } catch (e: any) {
      show({ message: e?.message ?? 'Health import failed', variant: 'error' });
    } finally {
      setHealthLoading(false);
    }
  }, [show]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[iS.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <AppIcon name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[iS.title, { color: colors.text }]}>Import Activities</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={iS.content} showsVerticalScrollIndicator={false}>
        <Text style={[iS.intro, { color: colors.textSecondary }]}>
          Import your existing workouts from other platforms. Duplicates are automatically skipped.
        </Text>

        <ImportCard
          icon="strava"
          title="Strava"
          description="Import runs, rides, swims, and more. Includes heart rate and route data."
          color="#FC5200"
          buttonLabel="Connect"
          onPress={handleStravaConnect}
          loading={stravaLoading}
        />

        <ImportCard
          icon="garmin"
          title="Garmin"
          description="Upload .TCX or .FIT files exported from Garmin Connect."
          color="#00A0D6"
          buttonLabel="Upload File"
          onPress={handleGarminImport}
          loading={garminLoading}
        />

        <ImportCard
          icon="heart-pulse"
          title="Apple Health / Google Fit"
          description="Sync workouts, steps, and heart rate from your phone's health platform."
          color="#FF3B30"
          buttonLabel="Sync"
          onPress={handleHealthImport}
          loading={healthLoading}
        />

        <View style={[iS.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="information" size={16} color={colors.textSecondary} />
          <Text style={[iS.noteText, { color: colors.textSecondary }]}>
            Imported activities are saved to your EpexFit history. Your original account on other platforms is not affected.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const iS = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: spacing.md, paddingBottom: 60 },
  intro: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
