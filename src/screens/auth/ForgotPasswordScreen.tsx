import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { borderRadius } from '../../constants/theme';

const ACCENT = '#F5C842';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const { resetPassword } = useAuth();
  const { colors } = useTheme();

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    const { success, error } = await resetPassword(email.trim());
    setLoading(false);
    if (success) {
      setSent(true);
    } else {
      Alert.alert('Error', error?.message || 'Failed to send reset email.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: ACCENT }]}>← Back</Text>
        </TouchableOpacity>

        {sent ? (
          <View style={styles.sentWrap}>
            <Text style={{ fontSize: 60 }}>📬</Text>
            <Text style={[styles.sentTitle, { color: colors.text }]}>Check your inbox</Text>
            <Text style={[styles.sentSub, { color: colors.textSecondary }]}>
              We sent a password reset link to {email}
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.primaryBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={{ fontSize: 48 }}>🔐</Text>
              <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Enter your email and we'll send you a reset link
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
              <View style={[styles.inputWrap, { borderColor: focused ? ACCENT : colors.border, backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textDisabled}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: ACCENT }, loading && { opacity: 0.7 }]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>Send Reset Link</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: Platform.OS === 'ios' ? 70 : 52, paddingBottom: 40 },
  backBtn: { marginBottom: 32 },
  backText: { fontSize: 14, fontWeight: '700' },
  header: { alignItems: 'center', gap: 12, marginBottom: 32 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  card: { borderRadius: borderRadius.xxl, borderWidth: 1, padding: 24, gap: 16 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  inputWrap: { borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: 16, height: 52 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', height: '100%' },
  primaryBtn: { height: 54, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.4 },
  sentWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 16 },
  sentTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  sentSub: { fontSize: 14, textAlign: 'center', maxWidth: 260, lineHeight: 20, fontWeight: '500' },
});
