import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { borderRadius } from '../../constants/theme';
import AppIconCircle from '../../components/AppIconCircle';

// Official Google brand SVG (unchanged colors — brand requirement) (was plain letter "G" — violates Google brand guidelines)
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

// FIX: Email validation regex (client-side — was missing entirely)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const { signIn, signInWithGoogle } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    // FIX: validate email format before hitting the API
    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. you@example.com).');
      return;
    }
    setLoading(true);
    const { success, error } = await signIn(email.trim(), password);
    setLoading(false);
    if (!success) {
      Alert.alert('Login Failed', error?.message || 'Invalid email or password.');
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { success, error } = await signInWithGoogle();
    setLoading(false);
    if (!success && error?.message && !error.message.toLowerCase().includes('cancel')) {
      Alert.alert('Google Sign In Failed', error.message || 'Please try again.');
    }
  };

  const accent = colors.primary;
  const focusColor = (field: string) => focused === field ? accent : colors.border;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* FIX: dynamic StatusBar — was hardcoded light-content, invisible on light theme iOS */}
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={[styles.scroll, { }]} showsVerticalScrollIndicator={false}>

        <View style={styles.logoArea}>
          <AppIconCircle size={76} ringColor={colors.primary} glowColor={colors.primary} />
          <Text style={[styles.brand, { color: colors.text }]}>EPEXFIT</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Precision training. Real momentum.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Welcome back</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Sign in to continue your journey</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>EMAIL</Text>
            <View style={[styles.inputWrap, { borderColor: focusColor('email'), backgroundColor: colors.surface }]}>
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

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>PASSWORD</Text>
            <View style={[styles.inputWrap, { borderColor: focusColor('password'), backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textDisabled}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotBtn}>
            <Text style={[styles.forgotText, { color: accent }]}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textDisabled }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* FIX: official Google SVG logo */}
          <TouchableOpacity
            style={[styles.googleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleGoogle}
            disabled={loading}
            activeOpacity={0.8}
          >
            <GoogleLogo size={18} />
            <Text style={[styles.googleBtnText, { color: colors.text }]}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.registerRow}>
          <Text style={[styles.registerText, { color: colors.textSecondary }]}>New to EpexFit? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.registerLink, { color: accent }]}>Create account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView> 
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },

  logoArea: { alignItems: 'center', marginBottom: 40, gap: 12 },
  brand: { fontSize: 28, fontWeight: '900', letterSpacing: 5 },
  tagline: { fontSize: 13, fontWeight: '500', letterSpacing: 0.3 },

  card: { borderRadius: borderRadius.xxl, borderWidth: 1, padding: 24, gap: 0 },
  cardTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6, marginBottom: 4 },
  cardSub: { fontSize: 13, fontWeight: '500', marginBottom: 24 },

  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: 16, height: 52 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  eyeBtn: { paddingLeft: 12, paddingVertical: 4 },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 12, fontWeight: '700' },

  primaryBtn: { height: 54, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  primaryBtnText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '600' },

  googleBtn: { height: 52, borderRadius: borderRadius.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleBtnText: { fontSize: 14, fontWeight: '700' },

  registerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  registerText: { fontSize: 14, fontWeight: '500' },
  registerLink: { fontSize: 14, fontWeight: '800' },
});