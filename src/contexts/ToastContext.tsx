/**
 * ToastContext — Global toast/snackbar system
 * - Animated slide-up + fade
 * - Auto-dismiss (configurable duration)
 * - Supports: success | error | warning | info variants
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  /** ms — default 3500 */
  duration?: number;
  /** Optional action button label */
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  show: (opts: ToastOptions) => void;
  hide: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
  hide: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ── Variant config ────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: string }> = {
  success: { bg: '#166534', icon: '✓' },
  error:   { bg: '#7F1D1D', icon: '✕' },
  warning: { bg: '#78350F', icon: '⚠' },
  info:    { bg: '#1E3A5F', icon: 'ℹ' },
};

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [opts, setOpts] = useState<ToastOptions | null>(null);
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 100, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setOpts(null));
  }, [translateY, opacity]);

  const show = useCallback(
    (newOpts: ToastOptions) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setOpts(newOpts);
      translateY.setValue(80);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const duration = newOpts.duration ?? 3500;
      timerRef.current = setTimeout(hide, duration);
    },
    [translateY, opacity, hide],
  );

  const variant = opts?.variant ?? 'info';
  const vs = VARIANT_STYLES[variant];

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {opts && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.container,
            {
              bottom: insets.bottom + 80, // sit above tab bar
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.toast, { backgroundColor: vs.bg }]}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{vs.icon}</Text>
            </View>
            <Text style={styles.message} numberOfLines={3}>
              {opts.message}
            </Text>
            {opts.actionLabel ? (
              <TouchableOpacity
                onPress={() => {
                  opts.onAction?.();
                  hide();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.action}>{opts.actionLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'stretch',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    gap: 10,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: '#fff', fontSize: 13, fontWeight: '700' },
  message: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  action: { color: '#7DD3FC', fontWeight: '700', fontSize: 13, marginLeft: 4 },
});
