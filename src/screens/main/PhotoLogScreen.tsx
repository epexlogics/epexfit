import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { storageService } from '../../services/storage';
import { databaseService } from '../../services/database';
import { socialService } from '../../services/socialService';
import AppIcon from '../../components/AppIcon';
import { borderRadius } from '../../constants/theme';
import { captureRef } from 'react-native-view-shot';
import dayjs from '../../utils/dayjs';

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export default function PhotoLogScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { activity } = route.params ?? {};
  const { user } = useAuth();
  const { colors } = useTheme();

  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, setMediaPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');

  const cameraRef = useRef<CameraView>(null);
  const previewRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      if (!permission?.granted) await requestPermission();
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setMediaPermission(status === 'granted');
    })();
  }, []);

  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (pic) setPhoto(pic.uri);
    } catch {
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const savePhoto = async () => {
    if (!photo || !user || !activity) return;
    setSaving(true);
    try {
      const { url: photoUrl, error: uploadErr } = await storageService.uploadActivityPhoto(user.id, activity.id, photo);
      if (uploadErr) throw uploadErr;

      let overlayUri: string | null = null;
      if (previewRef.current) {
        try {
          overlayUri = await captureRef(previewRef, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
        } catch {}
      }

      if (overlayUri) {
        const { url: overlayUrl, error: overlayErr } = await storageService.uploadPhotoOverlay(user.id, activity.id, overlayUri);
        if (overlayErr) throw overlayErr;
        await databaseService.updateActivityPhotos(activity.id, { photoUrl: photoUrl ?? undefined, photoOverlayUrl: overlayUrl ?? undefined });
        if (mediaPermission) await MediaLibrary.saveToLibraryAsync(overlayUri);
      } else {
        await databaseService.updateActivityPhotos(activity.id, { photoUrl: photoUrl ?? undefined });
        if (mediaPermission) await MediaLibrary.saveToLibraryAsync(photo);
      }

      Alert.alert('Saved!', 'Photo saved successfully!', [
        { text: 'Share to Feed', onPress: () => navigation.navigate('CreatePost', {
          prefillActivityId: activity.id,
          onPostCreated: () => navigation.navigate('Social'),
        }) },
        { text: 'Done', onPress: () => navigation.navigate('Home') },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save photo');
    } finally {
      setSaving(false);
    }
  };

  // Loading permissions
  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No camera permission
  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <AppIcon name="camera-off" size={64} color={colors.textDisabled} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>No Camera Access</Text>
        <Text style={[styles.errorSub, { color: colors.textSecondary }]}>Please grant camera permission to take photos</Text>
      </View>
    );
  }

  // No activity data
  if (!activity) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <AppIcon name="alert-circle" size={64} color={colors.textDisabled} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>No Activity Data</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={() => navigation.navigate('Activity')}>
          <Text style={styles.btnText}>Start Activity</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Photo preview
  if (photo) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View ref={previewRef} collapsable={false} style={{ flex: 1 }}>
          <Image source={{ uri: photo }} style={styles.previewImg} />
          <View style={[styles.statsOverlay, { backgroundColor: 'rgba(0,0,0,0.82)' }]}>
            <Text style={styles.statsTitle}>Activity Summary</Text>
            {[
              { icon: 'shoe-print', text: `${activity.steps.toLocaleString()} steps` },
              { icon: 'map-marker-distance', text: `${activity.distance.toFixed(2)} km` },
              { icon: 'fire', text: `${activity.calories} calories` },
              { icon: 'timer', text: formatDuration(activity.duration) },
              { icon: 'calendar', text: dayjs(activity.startTime).format('MMM DD, YYYY') },
            ].map((item) => (
              <View key={item.text} style={styles.overlayRow}>
                <AppIcon name={item.icon} size={20} color={colors.primary} />
                <Text style={styles.overlayText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actionBtns}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F44336' }]} onPress={() => setPhoto(null)}>
            <AppIcon name="camera-retake" size={22} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={savePhoto} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <><AppIcon name="check" size={22} color="#FFFFFF" /><Text style={styles.actionBtnText}>Save</Text></>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Camera view
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} onCameraReady={() => setCameraReady(true)}>
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing((f) => f === 'back' ? 'front' : 'back')}
          >
            <AppIcon name="camera-flip" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureBtn, !cameraReady && { opacity: 0.5 }]}
            onPress={takePicture}
            disabled={!cameraReady}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>
          <View style={{ width: 50 }} />
        </View>
      </CameraView>

      <View style={[styles.infoPanel, { backgroundColor: colors.surface }]}>
        <Text style={[styles.infoPanelTitle, { color: colors.text }]}>Capture Your Achievement!</Text>
        <Text style={[styles.infoPanelSub, { color: colors.textSecondary }]}>
          Take a photo to remember this moment. Activity stats will be overlaid automatically.
        </Text>
        <View style={[styles.statsPreview, { borderTopColor: colors.border }]}>
          {[
            { icon: 'shoe-print', val: activity.steps.toLocaleString() },
            { icon: 'map-marker-distance', val: `${activity.distance.toFixed(1)} km` },
            { icon: 'fire', val: String(activity.calories) },
          ].map((s) => (
            <View key={s.val} style={{ alignItems: 'center', gap: 4 }}>
              <AppIcon name={s.icon} size={20} color={colors.primary} />
              <Text style={[styles.previewVal, { color: colors.text }]}>{s.val}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700' },
  errorSub: { fontSize: 14, textAlign: 'center', maxWidth: 260 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: borderRadius.md },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  camera: { flex: 1 },
  cameraControls: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 30, backgroundColor: 'transparent' },
  flipBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  captureBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
  infoPanel: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  infoPanelTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  infoPanelSub: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  statsPreview: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 14, borderTopWidth: 1 },
  previewVal: { fontSize: 15, fontWeight: '700' },
  previewImg: { flex: 1, resizeMode: 'cover' },
  statsOverlay: { position: 'absolute', bottom: 100, left: 16, right: 16, padding: 16, borderRadius: borderRadius.lg, gap: 8 },
  statsTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  overlayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  overlayText: { color: '#FFFFFF', fontSize: 13 },
  actionBtns: { position: 'absolute', bottom: 30, left: 16, right: 16, flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: borderRadius.lg, gap: 8 },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
