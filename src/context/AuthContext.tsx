import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { authService } from '../services/auth';
import { clearAuthUserCache } from '../services/database';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error: any; requiresConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error: any }>;
  signInWithGoogle: () => Promise<{ success: boolean; error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error: any }>;
  deleteAccount: () => Promise<{ success: boolean; error: any }>;
  resendConfirmationEmail: (email: string) => Promise<{ success: boolean; error: any }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listenerFiredRef = useRef(false);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      listenerFiredRef.current = true;

      if (session?.user) {
        // FIX: Resolve user BEFORE clearing isLoading to prevent a flash of
        // the unauthenticated state (screens checking !user would briefly
        // redirect to auth while getCurrentUser() was still in-flight).
        authService.getCurrentUser().then((currentUser) => {
          setUser(currentUser);
          setIsLoading(false);
        }).catch(() => {
          setUser(null);
          setIsLoading(false);
        });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    });

    const fallbackTimer = setTimeout(async () => {
      if (!listenerFiredRef.current) {
        try {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        } catch {
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      }
    }, 400);

    const hardTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 8000);

    return () => {
      subscription?.subscription.unsubscribe();
      clearTimeout(fallbackTimer);
      clearTimeout(hardTimeout);
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    setError(null);
    try {
      const { user: newUser, error: signUpError, requiresConfirmation } = await authService.signUp(email, password, fullName);
      if (signUpError) throw signUpError;
      if (newUser) setUser(newUser);
      return { success: true, error: null, requiresConfirmation: requiresConfirmation ?? false };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err, requiresConfirmation: false };
    }
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const { user: signedInUser, error: signInError } = await authService.signIn(email, password);
      if (signInError) throw signInError;
      if (signedInUser) setUser(signedInUser);
      return { success: true, error: null };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err };
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const { user: googleUser, error: googleError } = await authService.signInWithGoogle();
      if (googleError) throw googleError;
      if (googleUser) setUser(googleUser);
      return { success: true, error: null };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err };
    }
  };

  const signOut = async () => {
    try {
      await authService.signOut();
      clearAuthUserCache(); // Immediately invalidate DB-layer auth cache
      // FIX: also clear streaks auth cache
      try {
        const { clearStreakAuthCache } = await import('../services/streaks');
        clearStreakAuthCache();
      } catch {}
      // Clear all cached data so next account gets fresh data
      try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k =>
          k.startsWith('@epexfit_cache') ||
          k.startsWith('@epexfit_social') ||
          k === '@epexfit_avatar_url' ||
          k === '@epexfit_streak_cache'
        );
        if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
      } catch {}
      setUser(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const { success, error: updateError } = await authService.updateProfile(data);
      if (updateError) throw updateError;
      if (success && user) setUser({ ...user, ...data });
      return { success, error: null };
    } catch (err: any) {
      return { success: false, error: err };
    }
  };

  const deleteAccount = async () => {
    try {
      const { success, error: deleteError } = await authService.deleteAccount();
      if (deleteError) throw deleteError;
      setUser(null);
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err };
    }
  };

  const resetPassword = async (email: string) => {
  try {
    const { success, error: resetError } = await authService.resetPassword(email);
    if (resetError) throw resetError;
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
};

  const resendConfirmationEmail = async (email: string) => {
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) throw resendError;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err };
    }
  };

  return (
    <AuthContext.Provider
     value={{ user, isLoading, error, signUp, signIn, signInWithGoogle, signOut, updateProfile, deleteAccount, resendConfirmationEmail, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
