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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiService from '../../services/api';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { useConfirm } from '../../components/feedback/ConfirmDialog';

interface CollaboratorSectionProps {
  tripId: string;
  collaborators: any[];
  onRefreshCollaborators: () => void;
}

const CollaboratorSection: React.FC<CollaboratorSectionProps> = ({
  tripId,
  collaborators,
  onRefreshCollaborators,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('trips');
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const styles = createStyles(theme, isDark);

  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabEmail, setCollabEmail] = useState('');
  const [collabRole, setCollabRole] = useState<'viewer' | 'editor'>('viewer');
  const [isInviting, setIsInviting] = useState(false);

  const handleInviteCollaborator = async () => {
    if (!collabEmail.trim()) return;
    try {
      setIsInviting(true);
      await apiService.addCollaborator(tripId, collabEmail.trim(), collabRole);
      setCollabEmail('');
      onRefreshCollaborators();
      showToast({ type: 'success', message: t('detail.collaboration.inviteSuccess'), position: 'top' });
    } catch {
      showToast({ type: 'error', message: t('detail.collaboration.inviteFailed'), position: 'top' });
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
          <TouchableOpacity
            onPress={() => setShowCollabModal(true)}
            style={[styles.inviteButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.inviteButtonText}>{t('detail.collaboration.invite')}</Text>
          </TouchableOpacity>
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
                  {c.role === 'editor' ? t('detail.collaboration.roleEditor') : t('detail.collaboration.roleViewer')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveCollaborator(c.id)}>
                <Icon name="close-circle-outline" size={22} color={colors.error.main} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Collaboration Invite Modal */}
      <Modal visible={showCollabModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
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
        </View>
      </Modal>
    </>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
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
    // Modal styles
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalContent: {
      backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0],
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 34,
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
