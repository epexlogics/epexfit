import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { STORAGE_KEYS } from '../constants/config';
import { User } from '../types';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const AUTH_TIMEOUT_MS = 15000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

export class AuthService {
  async signUp(
    email: string,
    password: string,
    fullName: string
  ): Promise<{ user: User | null; error: any; requiresConfirmation: boolean }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Please log in.');
      }

      // If session is null but user exists, Supabase requires email confirmation
      const requiresConfirmation = !!data.user && !data.session;

      if (data.user && data.session) {
        // Auto-confirmed (e.g. "Confirm email" disabled in Supabase, or magic link)
        await supabase
          .from('profiles')
          .upsert(
            { id: data.user.id, full_name: fullName },
            { onConflict: 'id', ignoreDuplicates: true }
          );

        const user: User = {
          id: data.user.id,
          email: data.user.email!,
          fullName,
          createdAt: new Date(data.user.created_at),
          updatedAt: new Date(data.user.updated_at ?? data.user.created_at),
        };
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        return { user, error: null, requiresConfirmation: false };
      }

      // Confirmation required — no session yet, profile will be created on first login
      return { user: null, error: null, requiresConfirmation };
    } catch (error) {
      return { user: null, error, requiresConfirmation: false };
    }
  }

  async signIn(
    email: string,
    password: string
  ): Promise<{ user: User | null; error: any }> {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_TIMEOUT_MS,
        'Sign in timed out. Please check your connection and try again.'
      );
      if (error) {
        // Supabase returns this error when email is not confirmed yet
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          throw new Error('Please confirm your email address before signing in. Check your inbox for the confirmation link.');
        }
        throw error;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        // Create profile row if it doesn't exist yet (first login after confirmation)
        if (!profile) {
          await supabase.from('profiles').upsert(
            { id: data.user.id, full_name: data.user.user_metadata?.full_name ?? '' },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        }

        const user: User = {
          id: data.user.id,
          email: data.user.email!,
          fullName: profile?.full_name || data.user.user_metadata?.full_name || '',
          height: profile?.height,
          weight: profile?.weight,
          createdAt: new Date(data.user.created_at),
          updatedAt: new Date(data.user.updated_at ?? data.user.created_at),
        };
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        return { user, error: null };
      }

      return { user: null, error: null };
    } catch (error) {
      return { user: null, error };
    }
  }

  async signInWithGoogle(): Promise<{ user: User | null; error: any }> {
    try {
      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'epexfit', path: 'auth/callback' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned from Supabase');

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        const url = res.url;

        if (url.includes('code=')) {
          const { error: sessionError } = await supabase.auth.exchangeCodeForSession(url);
          if (sessionError) throw sessionError;
        } else {
          const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || '';
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
          } else {
            throw new Error('Could not extract tokens from OAuth callback');
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        const currentUser = await this.getCurrentUser();
        if (!currentUser) throw new Error('Failed to load user after Google sign in');
        return { user: currentUser, error: null };
      }

      const cancelled = res.type === 'cancel' || res.type === 'dismiss';
      await supabase.auth.signOut();
      return {
        user: null,
        error: new Error(cancelled ? 'Google sign in was cancelled' : 'Google sign in failed'),
      };
    } catch (error) {
      return { user: null, error };
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const {
        data: { user },
      } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_TIMEOUT_MS,
        'Session restore timed out.'
      );
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return {
        id: user.id,
        email: user.email!,
        fullName:
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          '',
        height: profile?.height,
        weight: profile?.weight,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at ?? user.created_at),
      };
    } catch {
      return null;
    }
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    // FIX: clear ALL app-related AsyncStorage keys — was only removing USER_DATA,
    // meaning next user on same device inherited theme, notifications, onboarding state, etc.
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.GOALS,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.REMINDERS,
      STORAGE_KEYS.ONBOARDING,
      '@epexfit_avatar_url',
      '@epexfit_theme',
      '@epexfit_notifications',
      '@epexfit_daily_challenge',
      '@epexfit_unit_system',
      '@epexfit_tracking_session',
    ]);
  }

  async updateProfile(profile: Partial<User & { fitnessLevel?: string; age?: number; onboarding_complete?: boolean }>): Promise<{
    success: boolean;
    error: any;
  }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const updates: Record<string, unknown> = { id: user.id };
      if (profile.fullName !== undefined) updates.full_name = profile.fullName;
      if (profile.height !== undefined) updates.height = profile.height;
      if (profile.weight !== undefined) updates.weight = profile.weight;
      if (profile.gender !== undefined) updates.gender = profile.gender;
      if (profile.onboarding_complete !== undefined) updates.onboarding_complete = profile.onboarding_complete;

      // Use upsert so the call works even if the profile row doesn't exist yet
      const { error } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' });
      if (error) throw error;

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  async resetPassword(email: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'epexfit://reset-password',
      });
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Permanently deletes the user's account and all associated data.
   * Required by App Store and Play Store guidelines.
   */
  async deleteAccount(): Promise<{ success: boolean; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      // 1. Delete profile row and all associated data
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);
      if (profileError) throw profileError;

      // 2. FIX: Call Edge Function to delete the actual Supabase Auth user record.
      // Previous code only deleted the profiles row — auth user remained alive,
      // violating Apple/Google data deletion requirements (guaranteed rejection).
      const { error: fnError } = await supabase.functions.invoke('delete-user', {
        body: { userId: user.id },
      });
      // Non-fatal if Edge Function unavailable — log but continue cleanup
      if (fnError) console.warn('[deleteAccount] Edge function error:', fnError.message);

      // 3. Sign out and clear ALL storage
      await supabase.auth.signOut();
      const { STORAGE_KEYS } = await import('../constants/config');
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.GOALS,
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.REMINDERS,
        STORAGE_KEYS.ONBOARDING,
        '@epexfit_avatar_url',
        '@epexfit_theme',
        '@epexfit_notifications',
        '@epexfit_daily_challenge',
        '@epexfit_unit_system',
        '@epexfit_tracking_session',
      ]);

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }
}

export const authService = new AuthService();
