/**
 * ConsentScreen - Phase 0b
 *
 * 사용자 동의 화면 (초기 실행 시 또는 정책 업데이트 시 표시)
 *
 * Features:
 * - 7가지 동의 항목 (필수 2개, 선택 5개)
 * - 다국어 지원 (ko/en)
 * - 전체 동의 기능
 * - Backend API 연동
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../../components/core/Button';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import api from '../../services/api';
import type { ConsentsStatus, ConsentResponse, UpdateConsentsDto } from '../../types';

interface Props {
  onComplete: () => void;
}

const ConsentScreen: React.FC<Props> = ({ onComplete }) => {
  const { t } = useTranslation('consent');
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [consents, setConsents] = useState<ConsentResponse[]>([]);
  const [selectedConsents, setSelectedConsents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConsents();
  }, []);

  const loadConsents = async () => {
    try {
      setLoading(true);
      const data: ConsentsStatus = await api.getConsentsStatus();
      setConsents(data.consents);

      // Initialize selected consents with current state
      const initial: Record<string, boolean> = {};
      data.consents.forEach((consent) => {
        initial[consent.type] = consent.isConsented;
      });
      setSelectedConsents(initial);
    } catch (error) {
      console.error('[ConsentScreen] Failed to load consents:', error);
      showToast({ message: t('errors.updateFailed'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleConsent = (type: string) => {
    setSelectedConsents((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const toggleAllConsents = () => {
    const allSelected = consents.every((c) => selectedConsents[c.type]);
    const newSelected: Record<string, boolean> = {};
    consents.forEach((c) => {
      newSelected[c.type] = !allSelected;
    });
    setSelectedConsents(newSelected);
  };

  const handleSubmit = async () => {
    // Validate required consents
    const requiredConsents = consents.filter((c) => c.isRequired);
    const hasAllRequired = requiredConsents.every((c) => selectedConsents[c.type]);

    if (!hasAllRequired) {
      showToast({ message: t('errors.requiredConsent'), type: 'error' });
      return;
    }

    try {
      setSubmitting(true);

      const dto: UpdateConsentsDto = {
        consents: consents.map((c) => ({
          type: c.type,
          version: c.version,
          isConsented: selectedConsents[c.type] || false,
        })),
      };

      await api.updateConsents(dto);
      showToast({ message: t('toast.updateSuccess'), type: 'success' });
      onComplete();
    } catch (error) {
      console.error('[ConsentScreen] Failed to update consents:', error);
      showToast({ message: t('toast.updateFailed'), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Define colors based on theme
  const backgroundColor = isDark ? '#0F172A' : '#FFFFFF';
  const cardBackground = isDark ? '#1E293B' : '#F5F5F4';
  const textPrimary = isDark ? '#F1F5F9' : '#1C1917';
  const textSecondary = isDark ? '#CBD5E1' : '#78716C';
  const borderColor = isDark ? '#334155' : '#E7E5E4';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={[styles.loadingText, { color: textPrimary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const allSelected = consents.every((c) => selectedConsents[c.type]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textPrimary }]}>{t('title')}</Text>
        <Text style={[styles.subtitle, { color: textSecondary }]}>{t('subtitle')}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* All Agree Button */}
        <TouchableOpacity
          style={[
            styles.consentItem,
            styles.allAgreeItem,
            { backgroundColor: cardBackground, borderColor },
          ]}
          onPress={toggleAllConsents}
        >
          <View style={styles.consentLeft}>
            <Icon
              name={allSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={allSelected ? colors.primary[500] : textSecondary}
            />
            <Text style={[styles.consentTitle, styles.allAgreeText, { color: textPrimary }]}>
              {t('allAgree')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Individual Consents */}
        {consents.map((consent) => {
          const isSelected = selectedConsents[consent.type];
          const translationKey = `types.${consent.type}`;

          return (
            <TouchableOpacity
              key={consent.type}
              style={[
                styles.consentItem,
                { backgroundColor: cardBackground, borderColor },
              ]}
              onPress={() => toggleConsent(consent.type)}
            >
              <View style={styles.consentLeft}>
                <Icon
                  name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={24}
                  color={isSelected ? colors.primary[500] : textSecondary}
                />
                <View style={styles.consentTextContainer}>
                  <View style={styles.consentTitleRow}>
                    <Text style={[styles.consentTitle, { color: textPrimary }]}>
                      {t(`${translationKey}.title`)}
                    </Text>
                    {consent.isRequired && (
                      <View style={[styles.requiredBadge, { backgroundColor: colors.error.main }]}>
                        <Text style={styles.requiredText}>{t('required')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.consentDescription, { color: textSecondary }]}>
                    {t(`${translationKey}.description`)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: cardBackground, borderTopColor: borderColor }]}>
        <Button
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
        >
          {t('confirmButton')}
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  allAgreeItem: {
    marginBottom: 20,
  },
  consentLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  consentTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  consentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  consentTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  allAgreeText: {
    marginLeft: 12,
  },
  consentDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  requiredBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
});

export default ConsentScreen;
