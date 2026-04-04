import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { borderRadius } from '../../constants/theme';

function EpexLogo({ size = 72 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size * 0.24,
        backgroundColor: '#F5C842', alignItems: 'center', justifyContent: 'center',
        transform: [{ rotate: '45deg' }],
      }}>
        <View style={{
          width: size * 0.7, height: size * 0.7, borderRadius: size * 0.15,
          backgroundColor: '#0A0B10', alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{ transform: [{ rotate: '-45deg' }], alignItems: 'center' }}>
            <View style={{ width: size * 0.17, height: size * 0.3, backgroundColor: '#F5C842', borderRadius: 2, marginBottom: -size * 0.04 }} />
            <View style={{ width: size * 0.28, height: size * 0.04, backgroundColor: '#F5C842', borderRadius: 2 }} />
            <View style={{ width: size * 0.17, height: size * 0.24, backgroundColor: '#F5C842', borderRadius: 2, marginTop: -size * 0.04 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const { signIn, signInWithGoogle } = useAuth();
  const { colors, isDark } = useTheme();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
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
    if (!success) {
      Alert.alert('Google Sign In Failed', error?.message || 'Please try again.');
    }
  };

  const accent = colors.primary;
  const focusColor = (field: string) => focused === field ? accent : colors.border;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Logo area */}
        <View style={styles.logoArea}>
          <EpexLogo size={72} />
          <Text style={[styles.brand, { color: colors.text }]}>EPEXFIT</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Train smarter. Live stronger.</Text>
        </View>

        {/* Form card */}
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

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotBtn}
          >
            <Text style={[styles.forgotText, { color: accent }]}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign in */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textDisabled }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={[styles.googleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleGoogle}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 17 }}>G</Text>
            <Text style={[styles.googleBtnText, { color: colors.text }]}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        {/* Register link */}
        <View style={styles.registerRow}>
          <Text style={[styles.registerText, { color: colors.textSecondary }]}>New to EpexFit? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.registerLink, { color: accent }]}>Create account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: Platform.OS === 'ios' ? 80 : 60, paddingBottom: 40 },

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
  primaryBtnText: { fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.4 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '600' },

  googleBtn: { height: 52, borderRadius: borderRadius.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleBtnText: { fontSize: 14, fontWeight: '700' },

  registerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  registerText: { fontSize: 14, fontWeight: '500' },
  registerLink: { fontSize: 14, fontWeight: '800' },
});
