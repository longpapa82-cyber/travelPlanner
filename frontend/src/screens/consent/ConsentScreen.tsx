/**
 * ConsentScreen - Phase 0b (Redesigned)
 *
 * 사용자 동의 화면 — 필수/선택 그룹 분리, JIT 권한 항목 제외
 *
 * Features:
 * - 4개 동의 항목만 표시 (필수 2 + 선택 2)
 * - location, notification, photo는 JIT 방식으로 기능 사용 시 요청
 * - 필수/선택 섹션 헤더 그룹핑
 * - useSafeAreaInsets()로 Android 하단 가림 해결
 * - 전체 동의 강조 카드
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../../components/core/Button';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import AuthLegalModal from '../../components/legal/AuthLegalModal';
import api from '../../services/api';
import type { ConsentsStatus, ConsentResponse, UpdateConsentsDto } from '../../types';

// JIT consent types — shown at feature use time, not on initial screen
// Global benchmarking (Google Maps, Airbnb, TripAdvisor, Booking.com) confirms
// photo/notification should use JIT pattern, not initial consent screen
const JIT_CONSENT_TYPES = ['location', 'notification', 'photo'];

interface Props {
  onComplete: () => void;
}

const ConsentScreen: React.FC<Props> = ({ onComplete }) => {
  const { t } = useTranslation('consent');
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allConsents, setAllConsents] = useState<ConsentResponse[]>([]);
  const [selectedConsents, setSelectedConsents] = useState<Record<string, boolean>>({});
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  // Filter: only show initial consent items (exclude JIT types)
  const visibleConsents = allConsents.filter(
    (c) => !JIT_CONSENT_TYPES.includes(c.type),
  );
  const requiredConsents = visibleConsents.filter((c) => c.isRequired);
  const optionalConsents = visibleConsents.filter((c) => !c.isRequired);

  useEffect(() => {
    loadConsents();
  }, []);

  const loadConsents = async () => {
    try {
      setLoading(true);
      const data: ConsentsStatus = await api.getConsentsStatus();
      setAllConsents(data.consents);

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
    const allSelected = visibleConsents.every((c) => selectedConsents[c.type]);
    const newSelected = { ...selectedConsents };
    visibleConsents.forEach((c) => {
      newSelected[c.type] = !allSelected;
    });
    setSelectedConsents(newSelected);
  };

  const handleSubmit = async () => {
    if (visibleConsents.length === 0) {
      showToast({ message: t('errors.updateFailed'), type: 'error' });
      loadConsents();
      return;
    }

    const hasAllRequired = requiredConsents.every((c) => selectedConsents[c.type]);
    if (!hasAllRequired) {
      showToast({ message: t('errors.requiredConsent'), type: 'error' });
      return;
    }

    try {
      setSubmitting(true);

      // Submit only visible consents (JIT types are not submitted here)
      const dto: UpdateConsentsDto = {
        consents: visibleConsents.map((c) => ({
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

  const backgroundColor = isDark ? '#0F172A' : '#FFFFFF';
  const cardBackground = isDark ? '#1E293B' : '#F8F8F7';
  const textPrimary = isDark ? '#F1F5F9' : '#1C1917';
  const textSecondary = isDark ? '#CBD5E1' : '#78716C';
  const borderColor = isDark ? '#334155' : '#E7E5E4';
  const sectionBg = isDark ? '#1A2332' : '#FAFAF9';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  const allVisibleSelected = visibleConsents.every((c) => selectedConsents[c.type]);
  const hasAllRequired = requiredConsents.every((c) => selectedConsents[c.type]);

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textPrimary }]}>{t('title')}</Text>
        <Text style={[styles.subtitle, { color: textSecondary }]}>{t('subtitle')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* All Agree — highlighted card */}
        <TouchableOpacity
          style={[
            styles.allAgreeCard,
            {
              backgroundColor: allVisibleSelected
                ? (isDark ? colors.primary[900] : colors.primary[50])
                : cardBackground,
              borderColor: allVisibleSelected ? colors.primary[500] : borderColor,
            },
          ]}
          onPress={toggleAllConsents}
          activeOpacity={0.7}
        >
          <Icon
            name={allVisibleSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={allVisibleSelected ? colors.primary[500] : textSecondary}
          />
          <View style={styles.allAgreeTextContainer}>
            <Text style={[styles.allAgreeTitle, { color: textPrimary }]}>
              {t('allAgree')}
            </Text>
            <Text style={[styles.allAgreeDescription, { color: textSecondary }]}>
              {t('allAgreeDescription', '필수 및 선택 항목에 모두 동의합니다')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Required Consents Section */}
        <Text style={[styles.sectionHeader, { color: textSecondary }]}>
          {t('sectionRequired', '필수 동의')}
        </Text>
        <View style={[styles.sectionCard, { backgroundColor: sectionBg, borderColor }]}>
          {requiredConsents.map((consent, index) => {
            const isSelected = selectedConsents[consent.type];
            const translationKey = `types.${consent.type}`;
            const isLast = index === requiredConsents.length - 1;
            const hasDetail = consent.type === 'terms' || consent.type === 'privacy_required';

            return (
              <View
                key={consent.type}
                style={[
                  styles.consentRow,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
                ]}
              >
                <TouchableOpacity
                  style={styles.consentCheckArea}
                  onPress={() => toggleConsent(consent.type)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={isSelected ? colors.primary[500] : textSecondary}
                  />
                  <Text style={[styles.consentLabel, { color: textPrimary, flex: 1 }]}>
                    {t(`${translationKey}.title`)}
                  </Text>
                </TouchableOpacity>
                <View style={[styles.requiredBadge, { backgroundColor: colors.primary[500] }]}>
                  <Text style={styles.requiredText}>{t('required')}</Text>
                </View>
                {hasDetail ? (
                  <TouchableOpacity
                    onPress={() => setLegalModalType(consent.type === 'terms' ? 'terms' : 'privacy')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="chevron-right" size={20} color={textSecondary} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 20 }} />
                )}
              </View>
            );
          })}
        </View>

        {/* Optional Consents Section */}
        {optionalConsents.length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { color: textSecondary }]}>
              {t('sectionOptional', '선택 동의')}
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: sectionBg, borderColor }]}>
              {optionalConsents.map((consent, index) => {
                const isSelected = selectedConsents[consent.type];
                const translationKey = `types.${consent.type}`;
                const isLast = index === optionalConsents.length - 1;

                return (
                  <TouchableOpacity
                    key={consent.type}
                    style={[
                      styles.consentRow,
                      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
                    ]}
                    onPress={() => toggleConsent(consent.type)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={22}
                      color={isSelected ? colors.primary[500] : textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.consentLabel, { color: textPrimary }]}>
                        {t(`${translationKey}.title`)}
                      </Text>
                      <Text style={[styles.consentDescription, { color: textSecondary }]}>
                        {t(`${translationKey}.description`)}
                      </Text>
                    </View>
                    <Text style={[styles.optionalTag, { color: textSecondary }]}>
                      {t('optional')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={{ paddingTop: 16, paddingBottom: 24 }}>

          <Button
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !hasAllRequired}
          >
            {hasAllRequired
              ? t('confirmButtonEnabled', '동의하고 시작하기')
              : t('confirmButtonDisabled', '필수 항목에 동의해주세요')}
          </Button>
        </View>
      </ScrollView>

      <AuthLegalModal
        visible={legalModalType !== null}
        onClose={() => setLegalModalType(null)}
        type={legalModalType ?? 'terms'}
      />
    </View>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  // All Agree card
  allAgreeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 24,
  },
  allAgreeTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  allAgreeTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  allAgreeDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  // Section
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  consentCheckArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  consentLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  consentDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  requiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  optionalTag: {
    fontSize: 12,
  },
  footer: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
});

export default ConsentScreen;
