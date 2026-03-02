import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { ProfileStackParamList, AnnouncementAdmin } from '../../types';
import apiService from '../../services/api';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AnnouncementForm'>;

const TYPES = ['system', 'feature', 'important', 'promotional'] as const;
const PRIORITIES = ['critical', 'high', 'normal', 'low'] as const;
const DISPLAY_TYPES = ['banner', 'modal', 'bottom_sheet', 'notification_only'] as const;
const AUDIENCES = ['all', 'premium', 'free'] as const;

const AnnouncementFormScreen: React.FC<Props> = ({ navigation, route }) => {
  const { announcementId } = route.params || {};
  const isEdit = !!announcementId;
  const { t } = useTranslation('admin');
  const { theme } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [type, setType] = useState<typeof TYPES[number]>('system');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('normal');
  const [displayType, setDisplayType] = useState<typeof DISPLAY_TYPES[number]>('banner');
  const [targetAudience, setTargetAudience] = useState<typeof AUDIENCES[number]>('all');
  const [titleKo, setTitleKo] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [contentKo, setContentKo] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabelKo, setActionLabelKo] = useState('');
  const [actionLabelEn, setActionLabelEn] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (isEdit && announcementId) {
      loadAnnouncement(announcementId);
    }
  }, [announcementId]);

  const loadAnnouncement = async (id: string) => {
    setIsLoading(true);
    try {
      const data: AnnouncementAdmin = await apiService.getAdminAnnouncement(id);
      setType(data.type);
      setPriority(data.priority);
      setDisplayType(data.displayType);
      setTargetAudience(data.targetAudience);
      setTitleKo(data.title?.ko || '');
      setTitleEn(data.title?.en || '');
      setContentKo(data.content?.ko || '');
      setContentEn(data.content?.en || '');
      setImageUrl(data.imageUrl || '');
      setActionUrl(data.actionUrl || '');
      setActionLabelKo(data.actionLabel?.ko || '');
      setActionLabelEn(data.actionLabel?.en || '');
      setStartDate(data.startDate ? new Date(data.startDate).toISOString().slice(0, 16) : '');
      setEndDate(data.endDate ? new Date(data.endDate).toISOString().slice(0, 16) : '');
    } catch {
      Alert.alert('Error', 'Failed to load announcement');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!titleKo && !titleEn) {
      Alert.alert(t('announcements.validation'), t('announcements.titleRequired'));
      return;
    }
    if (!contentKo && !contentEn) {
      Alert.alert(t('announcements.validation'), t('announcements.contentRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        type,
        priority,
        displayType,
        targetAudience,
        title: { ko: titleKo, en: titleEn },
        content: { ko: contentKo, en: contentEn },
        imageUrl: imageUrl || undefined,
        actionUrl: actionUrl || undefined,
        actionLabel: (actionLabelKo || actionLabelEn)
          ? { ko: actionLabelKo, en: actionLabelEn }
          : undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      };

      if (isEdit && announcementId) {
        await apiService.updateAnnouncement(announcementId, payload);
      } else {
        await apiService.createAnnouncement(payload);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save announcement');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const renderChipGroup = <T extends string>(
    label: string,
    options: readonly T[],
    value: T,
    onChange: (v: T) => void,
    translateKey: string,
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.chip,
              {
                backgroundColor: value === opt ? theme.colors.primary : theme.colors.white,
                borderColor: value === opt ? theme.colors.primary : theme.colors.border,
              },
            ]}
            onPress={() => onChange(opt)}
          >
            <Text style={{ fontSize: 13, color: value === opt ? '#FFF' : theme.colors.text }}>
              {t(`announcements.${translateKey}.${opt}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {renderChipGroup(t('announcements.typeLabel'), TYPES, type, setType, 'types')}
      {renderChipGroup(t('announcements.priorityLabel'), PRIORITIES, priority, setPriority, 'priorities')}
      {renderChipGroup(t('announcements.displayLabel'), DISPLAY_TYPES, displayType, setDisplayType, 'displays')}
      {renderChipGroup(t('announcements.audienceLabel'), AUDIENCES, targetAudience, setTargetAudience, 'audiences')}

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{t('announcements.titleKo')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.white, color: theme.colors.text, borderColor: theme.colors.border }]}
          value={titleKo}
          onChangeText={setTitleKo}
          placeholder={t('announcements.titlePlaceholder')}
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{t('announcements.titleEn')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.white, color: theme.colors.text, borderColor: theme.colors.border }]}
          value={titleEn}
          onChangeText={setTitleEn}
          placeholder="Title (English)"
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{t('announcements.contentKo')}</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: theme.colors.white, color: theme.colors.text, borderColor: theme.colors.border }]}
          value={contentKo}
          onChangeText={setContentKo}
          placeholder={t('announcements.contentPlaceholder')}
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{t('announcements.contentEn')}</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: theme.colors.white, color: theme.colors.text, borderColor: theme.colors.border }]}
          value={contentEn}
          onChangeText={setContentEn}
          placeholder="Content (English)"
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{t('announcements.startDateLabel')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.white, color: theme.colors.text, borderColor: theme.colors.border }]}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DDTHH:mm"
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{t('announcements.endDateLabel')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.white, color: theme.colors.text, borderColor: theme.colors.border }]}
          value={endDate}
          onChangeText={setEndDate}
          placeholder={t('announcements.endDatePlaceholder')}
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{t('announcements.imageUrlLabel')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.white, color: theme.colors.text, borderColor: theme.colors.border }]}
          value={imageUrl}
          onChangeText={setImageUrl}
          placeholder="https://..."
          placeholderTextColor={theme.colors.textSecondary}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{t('announcements.actionUrlLabel')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.white, color: theme.colors.text, borderColor: theme.colors.border }]}
          value={actionUrl}
          onChangeText={setActionUrl}
          placeholder="https://..."
          placeholderTextColor={theme.colors.textSecondary}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Icon name="content-save" size={20} color="#FFF" />
            <Text style={styles.saveButtonText}>
              {isEdit ? t('announcements.update') : t('announcements.create')}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

export default AnnouncementFormScreen;
