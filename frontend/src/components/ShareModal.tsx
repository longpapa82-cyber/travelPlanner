/**
 * ShareModal Component
 *
 * Features:
 * - Generate share link for trip
 * - Copy link to clipboard
 * - Set expiration (optional)
 * - Disable sharing
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';
import apiService from '../services/api';
import { APP_URL } from '../constants/config';
import { useToast } from './feedback/Toast/ToastContext';
import { useConfirm } from './feedback/ConfirmDialog';

const getExpiryOptions = (t: TFunction) => [
  { label: t('shareModal.expiry.none'), value: undefined },
  { label: t('shareModal.expiry.7days'), value: 7 },
  { label: t('shareModal.expiry.30days'), value: 30 },
  { label: t('shareModal.expiry.90days'), value: 90 },
];

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  tripDestination: string;
  currentShareToken?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  visible,
  onClose,
  tripId,
  tripDestination,
  currentShareToken,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('components');
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(false);
  const [shareToken, setShareToken] = useState<string | undefined>(currentShareToken);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState<number | undefined>(undefined);

  const EXPIRY_OPTIONS = getExpiryOptions(t);

  useEffect(() => {
    if (visible) {
      setShareToken(currentShareToken);
      if (currentShareToken) {
        const url = `${getBaseUrl()}/share/${currentShareToken}`;
        setShareUrl(url);
      }
      setCopied(false);
    }
  }, [visible, currentShareToken]);

  const getBaseUrl = () => {
    if (Platform.OS === 'web') {
      return window.location.origin;
    }
    return APP_URL;
  };

  const handleGenerateLink = async () => {
    try {
      setLoading(true);
      const response = await apiService.generateShareLink(tripId, selectedExpiry);
      setShareToken(response.shareToken);
      const url = `${getBaseUrl()}${response.shareUrl}`;
      setShareUrl(url);
      setCopied(false);
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('shareModal.generateError'), position: 'top' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await Clipboard.setStringAsync(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      showToast({ type: 'success', message: t('shareModal.copiedToClipboard'), position: 'top', duration: 2000 });
    } catch (error) {
      showToast({ type: 'error', message: t('shareModal.copyError'), position: 'top' });
    }
  };

  const handleDisableSharing = async () => {
    const ok = await confirm({
      title: t('shareModal.disable'),
      message: t('shareModal.disableConfirm'),
      confirmText: t('shareModal.disableAction'),
      cancelText: t('shareModal.cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      setLoading(true);
      await apiService.disableSharing(tripId);
      setShareToken(undefined);
      setShareUrl('');
      showToast({ type: 'success', message: t('shareModal.disableSuccess'), position: 'top' });
      onClose();
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('shareModal.disableError'), position: 'top' });
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme, isDark);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer} testID="share-modal">
         <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
         >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Icon name="share-variant" size={24} color={theme.colors.primary} />
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {t('shareModal.title')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Destination */}
          <View style={styles.destinationCard}>
            <Icon name="map-marker" size={20} color={theme.colors.primary} />
            <Text style={[styles.destinationText, { color: theme.colors.text }]}>
              {tripDestination}
            </Text>
          </View>

          {/* Share Link Section */}
          {!shareToken ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('shareModal.generate')}
              </Text>
              <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
                {t('shareModal.generateDescription')}
              </Text>

              {/* Expiry Options */}
              <View style={styles.expiryContainer}>
                <Text style={[styles.expiryLabel, { color: theme.colors.text }]}>
                  {t('shareModal.expiry.title')}
                </Text>
                <View style={styles.expiryOptions}>
                  {EXPIRY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.label}
                      style={[
                        styles.expiryOption,
                        {
                          backgroundColor: selectedExpiry === option.value
                            ? theme.colors.primary
                            : isDark
                            ? colors.neutral[700]
                            : colors.neutral[100],
                          borderColor: selectedExpiry === option.value
                            ? theme.colors.primary
                            : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedExpiry(option.value)}
                    >
                      <Text
                        style={[
                          styles.expiryOptionText,
                          {
                            color: selectedExpiry === option.value
                              ? colors.neutral[0]
                              : theme.colors.text,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Generate Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.colors.primary },
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleGenerateLink}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Icon name="link-variant" size={20} color={colors.neutral[0]} />
                    <Text style={styles.primaryButtonText}>{t('shareModal.generateButton')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('shareModal.linkTitle')}
              </Text>

              {/* Share URL Display */}
              <View
                style={[
                  styles.urlContainer,
                  {
                    backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.urlText, { color: theme.colors.textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {shareUrl}
                </Text>
              </View>

              {/* Copy Button */}
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: copied
                      ? colors.success.light
                      : isDark
                      ? colors.neutral[700]
                      : colors.neutral[100],
                    borderColor: copied ? colors.success.main : theme.colors.border,
                  },
                ]}
                onPress={handleCopyLink}
              >
                <Icon
                  name={copied ? 'check' : 'content-copy'}
                  size={20}
                  color={copied ? colors.success.main : theme.colors.primary}
                />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    {
                      color: copied ? colors.success.main : theme.colors.primary,
                    },
                  ]}
                >
                  {copied ? t('shareModal.copied') : t('shareModal.copy')}
                </Text>
              </TouchableOpacity>

              {/* Disable Sharing Button */}
              <TouchableOpacity
                style={[
                  styles.dangerButton,
                  { borderColor: colors.error.main },
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleDisableSharing}
                disabled={loading}
              >
                <Icon name="link-variant-off" size={20} color={colors.error.main} />
                <Text style={[styles.dangerButtonText, { color: colors.error.main }]}>
                  {t('shareModal.disable')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Info Section */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark
                  ? `${colors.primary[700]}20`
                  : `${colors.primary[50]}80`,
              },
            ]}
          >
            <Icon name="information-outline" size={18} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              {t('shareModal.info')}
            </Text>
          </View>
         </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: 24,
      width: '100%',
      maxWidth: 480,
      maxHeight: Dimensions.get('window').height * 0.85,
      ...theme.shadows.lg,
    },
    modalScroll: {
      flexGrow: 0,
    },
    modalScrollContent: {
      padding: 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
    },
    destinationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      marginBottom: 24,
    },
    destinationText: {
      fontSize: 16,
      fontWeight: '600',
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 8,
    },
    sectionDescription: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    expiryContainer: {
      marginBottom: 20,
    },
    expiryLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 12,
    },
    expiryOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    expiryOption: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 2,
    },
    expiryOptionText: {
      fontSize: 14,
      fontWeight: '600',
    },
    urlContainer: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    urlText: {
      fontSize: 14,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 12,
      ...theme.shadows.sm,
    },
    primaryButtonText: {
      color: colors.neutral[0],
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      marginBottom: 12,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
    },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      backgroundColor: 'transparent',
    },
    dangerButtonText: {
      fontSize: 16,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
      borderRadius: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
  });
