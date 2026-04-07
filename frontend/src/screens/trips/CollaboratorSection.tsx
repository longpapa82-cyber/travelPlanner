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

  const handleInviteCollaborator = async () => {
    if (!collabEmail.trim()) return;

    // Dismiss keyboard before starting
    Keyboard.dismiss();

    try {
      setIsInviting(true);
      await apiService.addCollaborator(tripId, collabEmail.trim(), collabRole);
      setCollabEmail('');
      setShowCollabModal(false); // Close modal on success
      onRefreshCollaborators();
      showToast({ type: 'success', message: t('detail.collaboration.inviteSuccess'), position: 'top' });
    } catch (error: any) {
      console.error('Invite collaborator error:', error);
      const errorMessage = error?.response?.data?.message?.[0] ||
                          error?.response?.data?.message ||
                          error?.message ||
                          t('detail.collaboration.inviteFailed');
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
              onChangeText={setCollabEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
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
          <Modal visible={showCollabModal} transparent animationType="slide">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalOverlay}>
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.keyboardAvoidingView}
                >
                  <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                    <View>
                      {collabModalContent}
                    </View>
                  </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
              </View>
            </TouchableWithoutFeedback>
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
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: Math.max(34, insets.bottom + 20), // Account for Android navigation bar
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
