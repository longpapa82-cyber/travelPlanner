/**
 * CollaboratorSection - Collaborator list, invite button, and invite modal
 */

import React, { memo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiService from '../../services/api';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { useConfirm } from '../../components/feedback/ConfirmDialog';

// On web, use createPortal to escape parent stacking contexts (overflow, transform)
const createPortal =
  Platform.OS === 'web'
    ? require('react-dom').createPortal
    : undefined;

// ── Korean Dubeolsik → English key mapping ──────────────────────────────
// Maps individual Korean jamo (compatibility block U+3130-318F) to their
// corresponding physical keys on a standard Korean dubeolsik keyboard.
const JAMO_TO_KEY: Record<string, string> = {
  // Consonants (basic)
  'ㅂ': 'q', 'ㅈ': 'w', 'ㄷ': 'e', 'ㄱ': 'r', 'ㅅ': 't',
  'ㅁ': 'a', 'ㄴ': 's', 'ㅇ': 'd', 'ㄹ': 'f', 'ㅎ': 'g',
  'ㅋ': 'z', 'ㅌ': 'x', 'ㅊ': 'c', 'ㅍ': 'v',
  // Consonants (double / shift)
  'ㅃ': 'Q', 'ㅉ': 'W', 'ㄸ': 'E', 'ㄲ': 'R', 'ㅆ': 'T',
  // Vowels
  'ㅛ': 'y', 'ㅕ': 'u', 'ㅑ': 'i', 'ㅐ': 'o', 'ㅔ': 'p',
  'ㅗ': 'h', 'ㅓ': 'j', 'ㅏ': 'k', 'ㅣ': 'l',
  'ㅠ': 'b', 'ㅜ': 'n', 'ㅡ': 'm',
  'ㅒ': 'O', 'ㅖ': 'P',
  // Compound vowels (decompose to constituent key strokes)
  'ㅘ': 'hk', 'ㅙ': 'ho', 'ㅚ': 'hl', 'ㅝ': 'nj', 'ㅞ': 'np', 'ㅟ': 'nl', 'ㅢ': 'ml',
};

// Compound jongseong (종성) → two individual jamo
const COMPOUND_JONG: Record<string, string> = {
  'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ',
  'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ',
  'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ',
  'ㅄ': 'ㅂㅅ',
};

// Hangul syllable decomposition arrays (Unicode standard)
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

/** Decompose a single Hangul syllable (가-힣) into its constituent jamo. */
function decomposeHangul(ch: string): string[] {
  const code = ch.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7AF) return [ch];
  const offset = code - 0xAC00;
  const choIdx = Math.floor(offset / 588);
  const jungIdx = Math.floor((offset % 588) / 28);
  const jongIdx = offset % 28;
  const result = [CHO[choIdx], JUNG[jungIdx]];
  if (jongIdx > 0) result.push(JONG[jongIdx]);
  return result;
}

/** Map a single jamo to the English key(s). Handles compound jongseong. */
function jamoToKey(jamo: string): string {
  if (JAMO_TO_KEY[jamo]) return JAMO_TO_KEY[jamo];
  // Compound jongseong: split and map individually
  const compound = COMPOUND_JONG[jamo];
  if (compound) {
    return compound.split('').map(j => JAMO_TO_KEY[j] ?? j).join('');
  }
  return jamo;
}

const KOREAN_REGEX = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;

/**
 * Convert any Korean characters in the string to their English keyboard
 * equivalents using the standard Korean dubeolsik layout.
 * Non-Korean characters pass through unchanged.
 */
function convertKoreanToEnglish(text: string): string {
  if (!KOREAN_REGEX.test(text)) return text;
  let result = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    // Composed Hangul syllable (가-힣): decompose first
    if (code >= 0xAC00 && code <= 0xD7AF) {
      const jamos = decomposeHangul(ch);
      result += jamos.map(jamoToKey).join('');
    }
    // Compatibility jamo (ㄱ-ㅣ)
    else if (code >= 0x3130 && code <= 0x318F) {
      result += jamoToKey(ch);
    }
    // Jamo block (U+1100-11FF) — less common in user input but handle anyway
    else if (code >= 0x1100 && code <= 0x11FF) {
      result += jamoToKey(ch);
    }
    // Non-Korean: pass through
    else {
      result += ch;
    }
  }
  return result;
}

interface CollaboratorSectionProps {
  tripId: string;
  collaborators: any[];
  isOwner: boolean;
  onRefreshCollaborators: () => void;
  onLeaveTrip: () => void;
}

const CollaboratorSection: React.FC<CollaboratorSectionProps> = ({
  tripId,
  collaborators,
  isOwner,
  onRefreshCollaborators,
  onLeaveTrip,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('trips');
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, isDark, insets);

  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabEmail, setCollabEmail] = useState('');
  const [collabRole, setCollabRole] = useState<'viewer' | 'editor'>('viewer');
  const [isInviting, setIsInviting] = useState(false);

  const handleEmailChange = (text: string) => {
    const converted = convertKoreanToEnglish(text);
    if (converted !== text) {
      showToast({ type: 'info', message: t('detail.collaboration.autoConverted'), position: 'top' });
      setCollabEmail(converted);
    } else {
      setCollabEmail(text);
    }
  };

  const handleInviteCollaborator = async () => {
    const trimmedEmail = collabEmail.trim();
    if (!trimmedEmail) return;

    // V152 fix: ASCII-only email validation to reject any remaining
    // non-ASCII characters (Korean jamo, etc.) after auto-conversion
    const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      showToast({ type: 'error', message: t('detail.collaboration.invalidEmail'), position: 'top' });
      return;
    }

    // Dismiss keyboard before starting
    Keyboard.dismiss();

    try {
      setIsInviting(true);
      await apiService.addCollaborator(tripId, trimmedEmail, collabRole);
      setCollabEmail('');
      setShowCollabModal(false); // Close modal on success
      onRefreshCollaborators();
      showToast({ type: 'success', message: t('detail.collaboration.inviteSuccess'), position: 'top' });
    } catch (error: any) {
      console.error('Invite collaborator error:', error);
      // V159 i18n principle: use i18n fallback instead of exposing raw error.message
      const serverMsg = error?.response?.data?.message;
      const rawMessage = Array.isArray(serverMsg) ? serverMsg[0] : serverMsg;
      // Only use server message if it looks like a user-facing string (not an error code)
      const errorMessage = (typeof rawMessage === 'string' && rawMessage.length > 0)
        ? rawMessage
        : t('detail.collaboration.inviteFailed');
      showToast({ type: 'error', message: errorMessage, position: 'top' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveCollaborator = async (collabId: string) => {
    const ok = await confirm({
      title: t('detail.collaboration.remove'),
      message: '',
      confirmText: t('detail.alerts.delete'),
      cancelText: t('detail.alerts.cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiService.removeCollaborator(tripId, collabId);
      onRefreshCollaborators();
    } catch {
      showToast({ type: 'error', message: t('detail.collaboration.removeFailed'), position: 'top' });
    }
  };

  return (
    <>
      <View style={styles.collabSection}>
        <View style={styles.collabHeader}>
          <Text style={[styles.collabTitle, { color: theme.colors.text }]}>
            <Icon name="account-group" size={20} color={theme.colors.primary} />{' '}
            {t('detail.collaboration.title')}
          </Text>
          {isOwner && (
            <TouchableOpacity
              onPress={() => setShowCollabModal(true)}
              style={[styles.inviteButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.inviteButtonText}>{t('detail.collaboration.invite')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {collaborators.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            {t('detail.collaboration.noCollaborators')}
          </Text>
        ) : (
          collaborators.map((c: any) => (
            <View key={c.id} style={[styles.collaboratorRow, { borderBottomColor: theme.colors.border }]}>
              <Icon name="account-circle" size={32} color={theme.colors.textSecondary} />
              <View style={styles.collaboratorInfo}>
                <Text style={[styles.collaboratorName, { color: theme.colors.text }]}>
                  {c.user?.name || c.user?.email}
                </Text>
                <Text style={[styles.collaboratorRole, { color: theme.colors.textSecondary }]}>
                  {c.role === 'owner'
                    ? t('detail.collaboration.roleOwner', '여행 만든 사람')
                    : c.role === 'editor'
                      ? t('detail.collaboration.roleEditor')
                      : t('detail.collaboration.roleViewer')}
                </Text>
              </View>
              {isOwner && c.role !== 'owner' && (
                <TouchableOpacity onPress={() => handleRemoveCollaborator(c.id)}>
                  <Icon name="close-circle-outline" size={22} color={colors.error.main} />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {!isOwner && (
          <TouchableOpacity
            onPress={onLeaveTrip}
            style={styles.leaveButton}
          >
            <Icon name="exit-run" size={18} color={colors.error.main} />
            <Text style={styles.leaveButtonText}>{t('detail.collaboration.leave')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Collaboration Invite Modal — uses portal on web */}
      {(() => {
        const collabModalContent = (
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {t('detail.collaboration.invite')}
              </Text>
              <TouchableOpacity onPress={() => setShowCollabModal(false)}>
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.emailInput,
                {
                  borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
                  color: theme.colors.text,
                },
              ]}
              placeholder={t('detail.collaboration.emailPlaceholder')}
              placeholderTextColor={theme.colors.textSecondary}
              value={collabEmail}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              inputMode="email"
              returnKeyType="send"
              onSubmitEditing={handleInviteCollaborator}
              blurOnSubmit={true}
            />

            <View style={styles.roleSelector}>
              {(['viewer', 'editor'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setCollabRole(r)}
                  style={[
                    styles.roleOption,
                    {
                      borderColor: collabRole === r ? theme.colors.primary : (isDark ? colors.neutral[600] : colors.neutral[300]),
                      backgroundColor: collabRole === r
                        ? (isDark ? colors.primary?.[900] || '#1e3a5f' : colors.primary?.[50] || '#eff6ff')
                        : 'transparent',
                    },
                  ]}
                >
                  <Icon
                    name={r === 'editor' ? 'pencil' : 'eye'}
                    size={18}
                    color={collabRole === r ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      {
                        color: collabRole === r ? theme.colors.primary : theme.colors.textSecondary,
                        fontWeight: collabRole === r ? '600' : '400',
                      },
                    ]}
                  >
                    {r === 'editor' ? t('detail.collaboration.roleEditor') : t('detail.collaboration.roleViewer')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleInviteCollaborator}
              disabled={isInviting || !collabEmail.trim()}
              style={[
                styles.sendInviteButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: isInviting || !collabEmail.trim() ? 0.5 : 1,
                },
              ]}
            >
              {isInviting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendInviteText}>{t('detail.collaboration.invite')}</Text>
              )}
            </TouchableOpacity>
          </View>
        );

        if (Platform.OS === 'web') {
          if (!showCollabModal) return null;
          return createPortal(
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                zIndex: 9998,
              }}
              onClick={(e: any) => { if (e.target === e.currentTarget) setShowCollabModal(false); }}
            >
              <div
                style={{ width: '100%', maxWidth: 600 }}
                onClick={(e: any) => e.stopPropagation()}
              >
                {collabModalContent}
              </div>
            </div>,
            document.body,
          );
        }

        return (
          <Modal visible={showCollabModal} transparent animationType="fade" onRequestClose={() => setShowCollabModal(false)}>
            <Pressable style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }} onPress={() => Keyboard.dismiss()}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={Platform.OS === 'ios'} style={{ width: '100%', maxWidth: 400 }}>
                <Pressable onPress={(e) => e.stopPropagation()}>
                  {collabModalContent}
                </Pressable>
              </KeyboardAvoidingView>
            </Pressable>
          </Modal>
        );
      })()}
    </>
  );
};

const createStyles = (theme: any, isDark: boolean, insets: any) =>
  StyleSheet.create({
    collabSection: {
      marginHorizontal: 20,
      marginBottom: 8,
      padding: 20,
      borderRadius: 16,
      backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0],
      ...theme.shadows.sm,
    },
    collabHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    collabTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    inviteButton: {
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    inviteButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      paddingVertical: 12,
    },
    collaboratorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    collaboratorInfo: {
      flex: 1,
      marginLeft: 10,
    },
    collaboratorName: {
      fontSize: 14,
      fontWeight: '500',
    },
    collaboratorRole: {
      fontSize: 12,
    },
    leaveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error.main,
    },
    leaveButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.error.main,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    keyboardAvoidingView: {
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0],
      borderRadius: 16,
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    emailInput: {
      fontSize: 16,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    roleSelector: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    roleOption: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
    },
    roleText: {
      fontSize: 13,
      marginTop: 4,
    },
    sendInviteButton: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    sendInviteText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default memo(CollaboratorSection);
