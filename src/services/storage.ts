import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const BUCKET_NAME = 'activity-photos';

export class StorageService {
  async uploadActivityPhoto(
    userId: string,
    activityId: string,
    photoUri: string
  ): Promise<{ url: string | null; error: any }> {
    try {
      const ext = photoUri.split('.').pop() || 'jpg';
      const fileName = `${userId}/${activityId}_${Date.now()}.${ext}`;

      let fileData: string | Blob;
      if (Platform.OS === 'web') {
        const response = await fetch(photoUri);
        fileData = await response.blob();
      } else {
        fileData = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, fileData, {
          contentType: `image/${ext}`,
          upsert: false,
        });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      return { url: publicUrl.publicUrl, error: null };
    } catch (error) {
      return { url: null, error };
    }
  }

  async uploadPhotoOverlay(
    userId: string,
    activityId: string,
    overlayUri: string
  ): Promise<{ url: string | null; error: any }> {
    try {
      const ext = overlayUri.split('.').pop() || 'jpg';
      const fileName = `${userId}/${activityId}_overlay_${Date.now()}.${ext}`;

      let fileData: string | Blob;
      if (Platform.OS === 'web') {
        const response = await fetch(overlayUri);
        fileData = await response.blob();
      } else {
        fileData = await FileSystem.readAsStringAsync(overlayUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, fileData, {
          contentType: `image/${ext}`,
          upsert: false,
        });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      return { url: publicUrl.publicUrl, error: null };
    } catch (error) {
      return { url: null, error };
    }
  }

  async deletePhoto(photoUrl: string): Promise<{ success: boolean; error: any }> {
    try {
      const bucketPrefix = `/${BUCKET_NAME}/`;
      const bucketIndex = photoUrl.indexOf(bucketPrefix);
      const path =
        bucketIndex !== -1
          ? photoUrl.substring(bucketIndex + bucketPrefix.length)
          : photoUrl.split('/').slice(-2).join('/');

      if (!path) throw new Error('Invalid photo URL');

      const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  async getUserPhotos(userId: string): Promise<{ urls: string[]; error: any }> {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(userId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;

      const urls = (data ?? []).map((file) => {
        const { data: publicUrl } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(`${userId}/${file.name}`);
        return publicUrl.publicUrl;
      });

      return { urls, error: null };
    } catch (error) {
      return { urls: [], error };
    }
  }

  // FIX: Avatar upload — was completely missing.
  // ProfileScreen.pickImage() only set local state and never persisted the photo.
  // Silent data loss: user saw their face, restarted app, photo gone.
  async uploadAvatar(userId: string, photoUri: string): Promise<{ url: string | null; error: any }> {
    try {
      const ext = (photoUri.split('.').pop() ?? 'jpg').toLowerCase().replace(/\?.*$/, '');
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const fileName = `avatars/${userId}/avatar.${safeExt}`;

      let fileData: string | Blob;
      if (Platform.OS === 'web') {
        const response = await fetch(photoUri);
        fileData = await response.blob();
      } else {
        fileData = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, fileData, {
          contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
          upsert: true, // overwrite existing avatar
        });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return { url: publicUrl.publicUrl, error: null };
    } catch (error) {
      return { url: null, error };
    }
  }
}

export const storageService = new StorageService();
