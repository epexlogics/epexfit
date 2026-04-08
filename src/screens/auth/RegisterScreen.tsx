import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform,
  ScrollView, StyleSheet, Text, Image, TextInput, TouchableOpacity, View, StatusBar,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { borderRadius, type AppThemeColors } from '../../constants/theme';

// Official Google brand SVG — was plain "G" text, violates brand guidelines
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </Svg>
  );
}

// FIX: Client-side email validation regex (was missing — raw Supabase errors shown to users)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// FIX: Password strength meter (NIST 2024, min 8 chars)
function getPasswordStrength(pw: string, c: AppThemeColors): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: c.errorSoft };
  if (score <= 3) return { score, label: 'Fair', color: c.warning };
  return { score, label: 'Strong', color: c.success };
}

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // FIX: independent state per field — was a single shared boolean that cross-revealed fields
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resending, setResending] = useState(false);

  const { signUp, signInWithGoogle, resendConfirmationEmail } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = colors.primary;

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    // FIX: email format validation before API call
    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. you@example.com).');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Your passwords do not match.');
      return;
    }
    // FIX: raised from 6 to 8 characters (NIST 2024 guidelines)
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
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
      setAwaitingConfirmation(true);
    }
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

  const borderFor = (field: string) => focused === field ? accent : colors.border;
  const pwStrength = getPasswordStrength(password, colors);

  // ── "Check your email" screen ─────────────────────────────────────────────
  if (awaitingConfirmation) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <Text style={{ fontSize: 64, marginBottom: 24 }}>📬</Text>
        <Text style={[styles.confirmTitle, { color: colors.text }]}>Check your email</Text>
        <Text style={[styles.confirmSub, { color: colors.textSecondary }]}>
          We sent a confirmation link to{'\n'}
          <Text style={{ color: accent, fontWeight: '800' }}>{email}</Text>
          {'\n\n'}Tap the link in the email to activate your account, then come back and sign in.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: accent, marginTop: 32, width: '100%' }]}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>Go to Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border, marginTop: 12, width: '100%' }]}
          onPress={handleResend}
          disabled={resending}
          activeOpacity={0.75}
        >
          {resending
            ? <ActivityIndicator color={accent} />
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* FIX: dynamic StatusBar — was hardcoded light-content, invisible on light theme iOS */}
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={[styles.scroll, { }]} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={{ width: 76, height: 76, resizeMode: 'contain' }} />
          <Text style={[styles.brand, { color: colors.text }]}>EPEXFIT</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Your transformation starts now</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Create account</Text>

          {/* FIX: official Google SVG logo */}
          <TouchableOpacity
            style={[styles.googleBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handleGoogle} disabled={loading} activeOpacity={0.8}
          >
            <GoogleLogo size={18} />
            <Text style={[styles.googleBtnText, { color: colors.text }]}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.divLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.divText, { color: colors.textDisabled }]}>or with email</Text>
            <View style={[styles.divLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>FULL NAME</Text>
            <View style={[styles.inputWrap, { borderColor: borderFor('name'), backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="John Doe"
                placeholderTextColor={colors.textDisabled}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
            <View style={[styles.inputWrap, { borderColor: borderFor('email'), backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textDisabled}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </View>

          {/* Password — independent toggle + strength meter */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>PASSWORD</Text>
            <View style={[styles.inputWrap, { borderColor: borderFor('password'), backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                placeholder="Min. 8 characters"
                placeholderTextColor={colors.textDisabled}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                secureTextEntry={!showPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
              {/* FIX: independent toggle — only affects this field */}
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </TouchableOpacity>
            </View>
            {/* FIX: password strength indicator (was completely absent) */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[styles.strengthBar, { backgroundColor: i <= pwStrength.score ? pwStrength.color : colors.border }]}
                  />
                ))}
                <Text style={[styles.strengthLabel, { color: pwStrength.color }]}>{pwStrength.label}</Text>
              </View>
            )}
          </View>

          {/* Confirm Password — own independent toggle */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>CONFIRM PASSWORD</Text>
            <View style={[styles.inputWrap, { borderColor: borderFor('confirm'), backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                placeholder="Repeat password"
                placeholderTextColor={colors.textDisabled}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                // FIX: uses showConfirmPassword — NOT showPassword (was the bug)
                secureTextEntry={!showConfirmPassword}
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
              />
              {/* FIX: independent toggle — does NOT reveal password field */}
              <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={styles.eyeBtn}>
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                  {showConfirmPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={{ color: colors.errorSoft, fontSize: 11, fontWeight: '600', marginTop: 5 }}>
                Passwords do not match
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }, loading && { opacity: 0.7 }]}
            onPress={handleRegister} disabled={loading} activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={colors.onPrimary} />
              : <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>Create Account</Text>
            }
          </TouchableOpacity>

          {/* FIX: Privacy Policy + ToS links — mandatory for GDPR/CCPA/App Store */}
          <Text style={[styles.legalText, { color: colors.textDisabled }]}>
            By creating an account you agree to our{' '}
            <Text style={{ color: accent }} onPress={() => Linking.openURL('https://epexfit.com/privacy')}>
              Privacy Policy
            </Text>
            {' '}and{' '}
            <Text style={{ color: accent }} onPress={() => Linking.openURL('https://epexfit.com/terms')}>
              Terms of Service
            </Text>
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.footerLink, { color: accent }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView> 
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
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, width: 42, textAlign: 'right' },
  primaryBtn: { height: 54, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryBtnText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
  secondaryBtn: { height: 50, borderRadius: borderRadius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  legalText: { fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 14, fontWeight: '500' },
  footerLink: { fontSize: 14, fontWeight: '800' },
  confirmTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center', marginBottom: 16 },
  confirmSub: { fontSize: 15, textAlign: 'center', lineHeight: 24, fontWeight: '500' },
});