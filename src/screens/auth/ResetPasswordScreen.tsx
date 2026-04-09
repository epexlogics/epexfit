/**
 * ResetPasswordScreen — Handles epexfit://reset-password deep link
 *
 * When a user taps the password-reset email link, Supabase redirects to
 * epexfit://reset-password?token=...  (or with a code= param in PKCE flow).
 * App.tsx exchanges the code/token for a session, then this screen lets
 * the user choose their new password.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase';
import { borderRadius } from '../../constants/theme';

export default function ResetPasswordScreen({ navigation }: any) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { colors, isDark } = useTheme();
  const accent = colors.primary;

  const handleSubmit = async () => {
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter a new password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Too Short', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update password. Please request a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    // Navigate back to the auth stack root (Login)
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Set New Password</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {done
                ? 'Your password has been updated successfully.'
                : 'Enter your new password below.'}
            </Text>
          </View>

          {done ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: accent }]}
              onPress={handleGoToLogin}
            >
              <Text style={styles.btnText}>Go to Login</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.form}>
              <View style={[
                styles.inputWrap,
                { borderColor: focusedField === 'password' ? accent : colors.border, backgroundColor: colors.surface }
              ]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="New password (min 8 characters)"
                  placeholderTextColor={colors.textDisabled}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[
                styles.inputWrap,
                { borderColor: focusedField === 'confirm' ? accent : colors.border, backgroundColor: colors.surface }
              ]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textDisabled}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: accent, opacity: loading ? 0.7 : 1 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Update Password</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Auth' }] })}
              >
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, paddingTop: 48 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  form: { gap: 14 },
  inputWrap: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: { fontSize: 15 },
  btn: {
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 14 },
});
