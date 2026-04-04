import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { borderRadius } from '../../constants/theme';

const ACCENT = '#F5C842';

function EpexLogo({ size = 56 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size * 0.24,
        backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
        transform: [{ rotate: '45deg' }],
      }}>
        <View style={{
          width: size * 0.7, height: size * 0.7, borderRadius: size * 0.15,
          backgroundColor: '#0A0B10', alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{ transform: [{ rotate: '-45deg' }], alignItems: 'center' }}>
            <View style={{ width: size * 0.17, height: size * 0.3, backgroundColor: ACCENT, borderRadius: 2, marginBottom: -size * 0.04 }} />
            <View style={{ width: size * 0.28, height: size * 0.04, backgroundColor: ACCENT, borderRadius: 2 }} />
            <View style={{ width: size * 0.17, height: size * 0.24, backgroundColor: ACCENT, borderRadius: 2, marginTop: -size * 0.04 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  // After signup, show "check your email" screen instead of navigating away
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resending, setResending] = useState(false);

  const { signUp, signInWithGoogle, resendConfirmationEmail } = useAuth();
  const { colors } = useTheme();

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Your passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { success, error, requiresConfirmation } = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (!success) {
      Alert.alert('Registration Failed', error?.message || 'Something went wrong. Please try again.');
      return;
    }
    if (requiresConfirmation) {
      // Supabase "Confirm email" is ON — show the check-your-email screen
      setAwaitingConfirmation(true);
    }
    // If requiresConfirmation is false, AuthContext already set the user
    // and AppNavigator will handle routing to Onboarding automatically.
  };

  const handleResend = async () => {
    setResending(true);
    const { success, error } = await resendConfirmationEmail(email.trim());
    setResending(false);
    if (success) {
      Alert.alert('Sent!', 'Confirmation email resent. Check your inbox (and spam folder).');
    } else {
      Alert.alert('Error', error?.message || 'Could not resend. Please try again.');
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { success, error } = await signInWithGoogle();
    setLoading(false);
    if (!success) Alert.alert('Google Sign Up Failed', error?.message || 'Please try again.');
  };

  const borderFor = (field: string) => focused === field ? ACCENT : colors.border;

  const fields = [
    { key: 'name', label: 'FULL NAME', value: fullName, setter: setFullName, placeholder: 'John Doe', keyboard: 'default', secure: false },
    { key: 'email', label: 'EMAIL ADDRESS', value: email, setter: setEmail, placeholder: 'you@example.com', keyboard: 'email-address', secure: false },
    { key: 'password', label: 'PASSWORD', value: password, setter: setPassword, placeholder: 'Min. 6 characters', keyboard: 'default', secure: true },
    { key: 'confirm', label: 'CONFIRM PASSWORD', value: confirmPassword, setter: setConfirmPassword, placeholder: 'Repeat password', keyboard: 'default', secure: true },
  ];

  // ── "Check your email" screen ─────────────────────────────────────────────
  if (awaitingConfirmation) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <Text style={{ fontSize: 64, marginBottom: 24 }}>📬</Text>
        <Text style={[styles.confirmTitle, { color: colors.text }]}>Check your email</Text>
        <Text style={[styles.confirmSub, { color: colors.textSecondary }]}>
          We sent a confirmation link to{'\n'}
          <Text style={{ color: ACCENT, fontWeight: '800' }}>{email}</Text>
          {'\n\n'}Tap the link in the email to activate your account, then come back and sign in.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: ACCENT, marginTop: 32, width: '100%' }]}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Go to Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border, marginTop: 12, width: '100%' }]}
          onPress={handleResend}
          disabled={resending}
          activeOpacity={0.75}
        >
          {resending
            ? <ActivityIndicator color={ACCENT} />
            : <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Resend confirmation email</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setAwaitingConfirmation(false)} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.textDisabled, fontSize: 13, fontWeight: '600' }}>← Back to registration</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <EpexLogo size={56} />
          <Text style={[styles.brand, { color: colors.text }]}>EPEXFIT</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Your transformation starts now</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Create account</Text>

          <TouchableOpacity
            style={[styles.googleBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handleGoogle} disabled={loading} activeOpacity={0.8}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#4285F4' }}>G</Text>
            <Text style={[styles.googleBtnText, { color: colors.text }]}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.divLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.divText, { color: colors.textDisabled }]}>or with email</Text>
            <View style={[styles.divLine, { backgroundColor: colors.border }]} />
          </View>

          {fields.map((field) => (
            <View key={field.key} style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{field.label}</Text>
              <View style={[styles.inputWrap, { borderColor: borderFor(field.key), backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.input, { color: colors.text, flex: 1 }]}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textDisabled}
                  value={field.value}
                  onChangeText={field.setter}
                  autoCapitalize={field.key === 'email' ? 'none' : field.key === 'name' ? 'words' : 'none'}
                  keyboardType={field.keyboard as any}
                  secureTextEntry={field.secure && !showPassword}
                  onFocus={() => setFocused(field.key)}
                  onBlur={() => setFocused(null)}
                />
                {field.secure && (
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: ACCENT }, loading && { opacity: 0.7 }]}
            onPress={handleRegister} disabled={loading} activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.primaryBtnText}>Create Account</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.footerLink, { color: ACCENT }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: Platform.OS === 'ios' ? 70 : 52, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 36, gap: 10 },
  brand: { fontSize: 26, fontWeight: '900', letterSpacing: 5 },
  tagline: { fontSize: 13, fontWeight: '500' },
  card: { borderRadius: borderRadius.xxl, borderWidth: 1, padding: 24 },
  cardTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6, marginBottom: 20 },
  googleBtn: { height: 52, borderRadius: borderRadius.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleBtnText: { fontSize: 14, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  divLine: { flex: 1, height: 1 },
  divText: { marginHorizontal: 12, fontSize: 11, fontWeight: '600' },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: 16, height: 50 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  eyeBtn: { paddingLeft: 12, paddingVertical: 4 },
  primaryBtn: { height: 54, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryBtnText: { fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.4 },
  secondaryBtn: { height: 50, borderRadius: borderRadius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 14, fontWeight: '500' },
  footerLink: { fontSize: 14, fontWeight: '800' },
  confirmTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center', marginBottom: 16 },
  confirmSub: { fontSize: 15, textAlign: 'center', lineHeight: 24, fontWeight: '500' },
});
