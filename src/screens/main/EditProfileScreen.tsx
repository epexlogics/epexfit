/**
 * EditProfileScreen — Full profile editing
 *
 * ✅ Fields: full_name, username, bio, location, website
 * ✅ Real Supabase update to profiles table
 * ✅ Username uniqueness check before save
 * ✅ Avatar change from this screen too
 * ✅ AuthContext user updated on save
 * ✅ Zero mock data
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase';
import { storageService } from '../../services/storage';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';

interface ProfileForm {
  full_name: string;
  username: string;
  bio: string;
  location: string;
  website: string;
}

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, updateProfile } = useAuth();
  const { colors } = useTheme();
  const accent = colors.primary;

  const [form, setForm] = useState<ProfileForm>({
    full_name: '',
    username: '',
    bio: '',
    location: '',
    website: '',
  });
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load current profile data
  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, username, bio, location, website, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setForm({
            full_name: data.full_name ?? user.fullName ?? '',
            username:  data.username  ?? '',
            bio:       data.bio       ?? '',
            location:  data.location  ?? '',
            website:   data.website   ?? '',
          });
          if (data.avatar_url) setAvatarUri(data.avatar_url);
        } else {
          setForm(p => ({ ...p, full_name: user.fullName ?? '' }));
          const cached = await AsyncStorage.getItem('@epexfit_avatar_url');
          if (cached) setAvatarUri(cached);
        }
      } catch {
        setForm(p => ({ ...p, full_name: user.fullName ?? '' }));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  // Change avatar
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && user) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      setUploading(true);
      try {
        const { url, error } = await storageService.uploadAvatar(user.id, uri);
        if (error || !url) throw error ?? new Error('Upload returned no URL');
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
        await AsyncStorage.setItem('@epexfit_avatar_url', url);
        setAvatarUri(url);
      } catch (e: any) {
        Alert.alert('Upload Failed', e?.message ?? 'Could not save photo.');
        setAvatarUri(null);
      } finally {
        setUploading(false);
      }
    }
  };

  // Validate username format
  const isValidUsername = (u: string) => /^[a-zA-Z0-9_]{3,30}$/.test(u);

  // Save profile
  const handleSave = async () => {
    if (!user) return;

    const trimmed = {
      full_name: form.full_name.trim(),
      username:  form.username.trim().toLowerCase(),
      bio:       form.bio.trim(),
      location:  form.location.trim(),
      website:   form.website.trim(),
    };

    if (!trimmed.full_name) {
      Alert.alert('Required', 'Full name cannot be empty.');
      return;
    }

    if (trimmed.username && !isValidUsername(trimmed.username)) {
      Alert.alert('Invalid username', 'Username must be 3-30 characters: letters, numbers, underscores only.');
      return;
    }

    setSaving(true);
    try {
      // Check username uniqueness (if changed)
      if (trimmed.username) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', trimmed.username)
          .neq('id', user.id)
          .maybeSingle();
        if (existing) {
          Alert.alert('Username taken', `@${trimmed.username} is already in use.`);
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: trimmed.full_name,
          username:  trimmed.username || null,
          bio:       trimmed.bio      || null,
          location:  trimmed.location || null,
          website:   trimmed.website  || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update AuthContext user
      await updateProfile({ fullName: trimmed.full_name });

      Alert.alert('Saved ✓', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  const fields: Array<{ key: keyof ProfileForm; label: string; placeholder: string; icon: string; multiline?: boolean; keyboard?: string; prefix?: string }> = [
    { key: 'full_name', label: 'Full Name',  placeholder: 'Your display name', icon: 'account' },
    { key: 'username',  label: 'Username',   placeholder: 'e.g. john_doe',     icon: 'at',    prefix: '@' },
    { key: 'bio',       label: 'Bio',        placeholder: 'Tell your story...', icon: 'card-text', multiline: true },
    { key: 'location',  label: 'Location',   placeholder: 'City, Country',     icon: 'map-marker' },
    { key: 'website',   label: 'Website',    placeholder: 'https://yoursite.com', icon: 'web', keyboard: 'url' },
  ];

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <AppIcon name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          <TouchableOpacity
            style={[s.saveHeaderBtn, { backgroundColor: accent }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={{ color: '#000', fontWeight: '800', fontSize: 14 }}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.md, gap: 16, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar section */}
          <View style={s.avatarSection}>
            <TouchableOpacity onPress={pickImage} disabled={uploading} style={s.avatarTouch}>
              <View style={[s.avatarWrap, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={s.avatarImg} />
                ) : (
                  <Text style={[s.avatarLetter, { color: accent }]}>
                    {form.full_name.charAt(0).toUpperCase() || 'U'}
                  </Text>
                )}
                <View style={[s.cameraOverlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                  {uploading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <AppIcon name="camera" size={14} color="#fff" />
                  }
                </View>
              </View>
            </TouchableOpacity>
            <Text style={[s.avatarHint, { color: colors.textSecondary }]}>
              Tap to change profile photo
            </Text>
          </View>

          {/* Form fields */}
          {fields.map((field) => (
            <View key={field.key} style={s.fieldGroup}>
              <View style={s.fieldLabelRow}>
                <AppIcon name={field.icon} size={14} color={colors.textSecondary} />
                <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{field.label}</Text>
              </View>
              <View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {field.prefix && (
                  <Text style={[s.prefix, { color: colors.textSecondary }]}>{field.prefix}</Text>
                )}
                <TextInput
                  style={[s.input, { color: colors.text }, field.multiline && { height: 80, textAlignVertical: 'top' }]}
                  value={form[field.key]}
                  onChangeText={(v) => setForm(p => ({ ...p, [field.key]: v }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textDisabled}
                  keyboardType={(field.keyboard as any) ?? 'default'}
                  multiline={field.multiline}
                  autoCapitalize={field.key === 'username' ? 'none' : 'sentences'}
                  autoCorrect={field.key !== 'username' && field.key !== 'website'}
                  maxLength={field.key === 'bio' ? 160 : field.key === 'username' ? 30 : 100}
                />
              </View>
              {field.key === 'username' && (
                <Text style={[s.fieldHint, { color: colors.textDisabled }]}>
                  3-30 characters, letters, numbers and _ only
                </Text>
              )}
              {field.key === 'bio' && (
                <Text style={[s.fieldHint, { color: colors.textDisabled }]}>
                  {form.bio.length}/160 characters
                </Text>
              )}
            </View>
          ))}

          {/* Save button */}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>Save Changes</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1,
  },
  headerBtn:   { width: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  saveHeaderBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', minWidth: 64,
  },

  avatarSection: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  avatarTouch:   {},
  avatarWrap: {
    width: 90, height: 90, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, position: 'relative',
  },
  avatarImg:    { width: 90, height: 90, borderRadius: 28 },
  avatarLetter: { fontSize: 36, fontWeight: '900' },
  cameraOverlay: {
    position: 'absolute', bottom: -4, right: -4,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarHint: { fontSize: 13, fontWeight: '500' },

  fieldGroup: { gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel:    { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  fieldHint:     { fontSize: 11, marginLeft: 4 },

  inputWrap: {
    borderRadius: borderRadius.lg, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14,
  },
  prefix: { fontSize: 16, fontWeight: '600', paddingTop: 13, marginRight: 2 },
  input:  { flex: 1, fontSize: 16, fontWeight: '500', paddingVertical: 13 },

  saveBtn: {
    height: 54, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
});
