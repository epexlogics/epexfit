/**
 * CreatePostScreen — Manual post creation
 * Supports: text post + optional image
 * On success: navigates back and triggers feed refresh via route param callback
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { socialService } from '../../services/socialService';
import { storageService } from '../../services/storage';
import { borderRadius, spacing } from '../../constants/theme';

export default function CreatePostScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const onPostCreated = route.params?.onPostCreated;
  const prefillActivityId = route.params?.prefillActivityId;

  const accent = colors.primary;
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // If an activity ID is pre-filled, use shareActivity instead of createPost
  const isActivityShare = !!prefillActivityId;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const removeImage = () => setImageUri(null);

  const handlePost = async () => {
    const trimmed = content.trim();
    if (!trimmed && !imageUri) {
      Alert.alert('Empty post', 'Write something or attach an image.');
      return;
    }
    setPosting(true);
    try {
      let uploadedImageUrl: string | undefined;

      if (imageUri && user) {
        setUploadingImage(true);
        try {
          const { url, error: uploadError } = await storageService.uploadPostImage(
            user.id,
            imageUri,
          );
          if (!uploadError && url) uploadedImageUrl = url;
        } catch {}
        setUploadingImage(false);
      }

      let error: any;
      if (isActivityShare && prefillActivityId) {
        ({ error } = await socialService.shareActivity(prefillActivityId, trimmed, uploadedImageUrl));
      } else {
        ({ error } = await socialService.createPost(trimmed, uploadedImageUrl));
      }
      if (error) throw error;

      if (onPostCreated) onPostCreated();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not create post. Please try again.');
    } finally {
      setPosting(false);
      setUploadingImage(false);
    }
  };

  const canPost = (content.trim().length > 0 || imageUri !== null) && !posting;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.cancelBtn}>
            <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.text }]}>{isActivityShare ? 'Share Activity' : 'New Post'}</Text>
          <TouchableOpacity
            style={[s.postBtn, { backgroundColor: canPost ? accent : colors.border }]}
            onPress={handlePost}
            disabled={!canPost}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={[s.postBtnText, { color: canPost ? '#000' : colors.textDisabled }]}>
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* User row */}
          <View style={s.userRow}>
            <View style={[s.avatarFallback, { backgroundColor: accent + '20' }]}>
              <Text style={[s.avatarLetter, { color: accent }]}>
                {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
              </Text>
            </View>
            <Text style={[s.userName, { color: colors.text }]}>{user?.fullName ?? 'You'}</Text>
          </View>

          {/* Text input */}
          <TextInput
            style={[s.input, { color: colors.text }]}
            placeholder="What's on your mind? Share a workout, goal, or update…"
            placeholderTextColor={colors.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
            autoFocus
          />

          {/* Character count */}
          <Text style={[s.charCount, { color: content.length > 450 ? colors.error : colors.textDisabled }]}>
            {content.length}/500
          </Text>

          {/* Image preview */}
          {imageUri && (
            <View style={s.imageWrap}>
              <Image source={{ uri: imageUri }} style={s.imagePreview} resizeMode="cover" />
              <TouchableOpacity style={s.removeImageBtn} onPress={removeImage}>
                <Text style={s.removeImageText}>✕</Text>
              </TouchableOpacity>
              {uploadingImage && (
                <View style={s.imageOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={{ color: '#fff', marginTop: 8, fontWeight: '700' }}>Uploading…</Text>
                </View>
              )}
            </View>
          )}

          {/* Toolbar */}
          <View style={[s.toolbar, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[s.toolBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={pickImage}
              disabled={posting}
            >
              <Text style={{ fontSize: 18 }}>🖼️</Text>
              <Text style={[s.toolBtnText, { color: colors.textSecondary }]}>Photo</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: 12, borderBottomWidth: 1,
  },
  cancelBtn: { paddingVertical: 4, paddingRight: 8 },
  cancelText: { fontSize: 16 },
  title: { fontSize: 17, fontWeight: '900' },
  postBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, minWidth: 64, alignItems: 'center',
  },
  postBtnText: { fontSize: 14, fontWeight: '800' },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarFallback: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 16, fontWeight: '800' },
  userName: { fontSize: 15, fontWeight: '800' },

  input: {
    fontSize: 17, lineHeight: 26, minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, textAlign: 'right' },

  imageWrap: { borderRadius: borderRadius.xl, overflow: 'hidden', position: 'relative' },
  imagePreview: { width: '100%', height: 220, borderRadius: borderRadius.xl },
  removeImageBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  removeImageText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: borderRadius.xl,
  },

  toolbar: {
    flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1,
  },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  toolBtnText: { fontSize: 13, fontWeight: '700' },
});
