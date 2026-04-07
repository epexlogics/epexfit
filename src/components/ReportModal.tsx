/**
 * ReportModal — Report + Block flow
 *
 * Usage (in SocialFeedScreen ⋮ menu):
 *   <ReportModal
 *     visible={showReport}
 *     onClose={() => setShowReport(false)}
 *     reportedUserId={item.actorId}
 *     postId={item.id}
 *   />
 */
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { submitReport, blockUser, ReportReason } from '../services/moderationService';
import { borderRadius, spacing } from '../constants/theme';

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  postId?: string;
  reportedUserName?: string;
}

const REASONS: { key: ReportReason; label: string; emoji: string }[] = [
  { key: 'spam',          label: 'Spam',           emoji: '📢' },
  { key: 'harassment',    label: 'Harassment',     emoji: '🚫' },
  { key: 'offensive',     label: 'Offensive',      emoji: '⚠️' },
  { key: 'misinformation',label: 'Misinformation', emoji: '❌' },
  { key: 'other',         label: 'Other',          emoji: '⋯'  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function ReportModal({
  visible,
  onClose,
  reportedUserId,
  postId,
  reportedUserName,
}: Props) {
  const { colors, accent } = useTheme();
  const { show } = useToast();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [step, setStep] = useState<'reason' | 'confirm' | 'done'>('reason');
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setSelectedReason(null);
    setDetails('');
    setStep('reason');
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason) return;
    setLoading(true);
    try {
      await submitReport({ reportedUserId, postId, reason: selectedReason, details });
      setStep('done');
    } catch {
      show({ message: 'Failed to submit report. Please try again.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedReason, details, reportedUserId, postId, show]);

  const handleBlock = useCallback(async () => {
    setLoading(true);
    try {
      await blockUser(reportedUserId);
      show({
        message: `${reportedUserName ?? 'User'} has been blocked. Their posts will no longer appear in your feed.`,
        variant: 'success',
        duration: 4000,
      });
      handleClose();
    } catch {
      show({ message: 'Failed to block user. Please try again.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [reportedUserId, reportedUserName, show, handleClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={rM.overlay}>
        <View style={[rM.sheet, { backgroundColor: colors.surfaceElevated }]}>
          {/* Handle */}
          <View style={[rM.handle, { backgroundColor: colors.border }]} />

          {step === 'reason' && (
            <>
              <Text style={[rM.title, { color: colors.text }]}>Report Post</Text>
              <Text style={[rM.subtitle, { color: colors.textSecondary }]}>
                Why are you reporting this?
              </Text>
              {REASONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    rM.reasonRow,
                    {
                      backgroundColor: selectedReason === r.key ? accent + '18' : colors.surface,
                      borderColor: selectedReason === r.key ? accent : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedReason(r.key)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 18 }}>{r.emoji}</Text>
                  <Text style={[rM.reasonLabel, { color: colors.text }]}>{r.label}</Text>
                  {selectedReason === r.key && (
                    <Text style={{ color: accent, fontWeight: '700' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}

              {selectedReason === 'other' && (
                <TextInput
                  style={[
                    rM.input,
                    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="Add details (optional)"
                  placeholderTextColor={colors.textDisabled}
                  value={details}
                  onChangeText={setDetails}
                  multiline
                  maxLength={300}
                />
              )}

              <View style={rM.row}>
                <TouchableOpacity style={[rM.btn, { borderColor: colors.border }]} onPress={handleClose}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[rM.btn, { backgroundColor: accent, opacity: selectedReason ? 1 : 0.4 }]}
                  onPress={() => selectedReason && setStep('confirm')}
                  disabled={!selectedReason}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Text style={[rM.title, { color: colors.text }]}>Confirm Report</Text>
              <Text style={[rM.subtitle, { color: colors.textSecondary }]}>
                We'll review this report and take action if it violates our community guidelines.
              </Text>
              <View style={rM.row}>
                <TouchableOpacity
                  style={[rM.btn, { borderColor: colors.border }]}
                  onPress={() => setStep('reason')}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[rM.btn, { backgroundColor: colors.error }]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Submit Report</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[rM.blockBtn, { borderColor: colors.error + '50' }]}
                onPress={handleBlock}
                disabled={loading}
              >
                <Text style={{ color: colors.error, fontWeight: '600', fontSize: 14 }}>
                  Also block {reportedUserName ?? 'this user'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <>
              <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>✅</Text>
              <Text style={[rM.title, { color: colors.text }]}>Report Submitted</Text>
              <Text style={[rM.subtitle, { color: colors.textSecondary }]}>
                Thanks for helping keep EpexFit safe. We'll review this shortly.
              </Text>
              <TouchableOpacity
                style={[rM.btn, { backgroundColor: accent, alignSelf: 'center', paddingHorizontal: 32 }]}
                onPress={handleClose}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const rM = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: 40,
    gap: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  reasonLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  blockBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: 4,
  },
});
