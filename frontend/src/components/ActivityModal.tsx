import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { theme } from '../constants/theme';

interface Activity {
  time: string;
  title: string;
  description: string;
  location: string;
  estimatedDuration?: number;
  estimatedCost?: number;
  type?: string;
}

interface ActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (activityData: Partial<Activity>) => Promise<void>;
  activity?: Activity;
  mode: 'add' | 'edit';
}

const ACTIVITY_TYPES_META = [
  { value: 'meal', key: 'activityModal.types.meal' as const, icon: 'silverware-fork-knife' },
  { value: 'sightseeing', key: 'activityModal.types.sightseeing' as const, icon: 'camera' },
  { value: 'shopping', key: 'activityModal.types.shopping' as const, icon: 'shopping' },
  { value: 'experience', key: 'activityModal.types.experience' as const, icon: 'drama-masks' },
  { value: 'relaxation', key: 'activityModal.types.rest' as const, icon: 'coffee' },
  { value: 'transportation', key: 'activityModal.types.transport' as const, icon: 'car' },
  { value: 'other', key: 'activityModal.types.other' as const, icon: 'dots-horizontal' },
];

export const ActivityModal: React.FC<ActivityModalProps> = ({
  visible,
  onClose,
  onSave,
  activity,
  mode,
}) => {
  const { t } = useTranslation('components');
  const activityTypes = ACTIVITY_TYPES_META.map(item => ({
    ...item,
    label: t(item.key),
  }));
  const [formData, setFormData] = useState<Partial<Activity>>({
    time: '',
    title: '',
    description: '',
    location: '',
    estimatedDuration: 0,
    estimatedCost: 0,
    type: 'other',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activity) {
      setFormData(activity);
    } else {
      // Reset form for add mode
      setFormData({
        time: '',
        title: '',
        description: '',
        location: '',
        estimatedDuration: 0,
        estimatedCost: 0,
        type: 'other',
      });
    }
  }, [activity, visible]);

  const handleSave = async () => {
    // Validation
    if (!formData.time || !formData.title || !formData.location) {
      Alert.alert(t('activityModal.validationError'), t('activityModal.validationErrorMessage'));
      return;
    }

    try {
      setLoading(true);
      await onSave(formData);
      onClose();
    } catch (error: any) {
      Alert.alert(
        t('activityModal.errorTitle'),
        error.response?.data?.message || t('activityModal.saveError')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {mode === 'add' ? t('activityModal.addTitle') : t('activityModal.editTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Time Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {t('activityModal.time')} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Icon name="clock-outline" size={20} color={theme.colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder="09:00"
                  value={formData.time}
                  onChangeText={(text) => setFormData({ ...formData, time: text })}
                />
              </View>
            </View>

            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {t('activityModal.title')} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Icon name="format-title" size={20} color={theme.colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder={t('activityModal.titlePlaceholder')}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                />
              </View>
            </View>

            {/* Location Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {t('activityModal.location')} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Icon name="map-marker" size={20} color={theme.colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder={t('activityModal.locationPlaceholder')}
                  value={formData.location}
                  onChangeText={(text) => setFormData({ ...formData, location: text })}
                />
              </View>
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('activityModal.description')}</Text>
              <TextInput
                style={[styles.inputContainer, styles.textArea]}
                placeholder={t('activityModal.descriptionPlaceholder')}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Activity Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('activityModal.type')}</Text>
              <View style={styles.typeContainer}>
                {activityTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeChip,
                      formData.type === type.value && styles.typeChipSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, type: type.value })}
                  >
                    <Icon
                      name={type.icon}
                      size={20}
                      color={
                        formData.type === type.value
                          ? theme.colors.white
                          : theme.colors.text
                      }
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        formData.type === type.value && styles.typeLabelSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Duration Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('activityModal.duration')}</Text>
              <View style={styles.inputContainer}>
                <Icon name="timer-outline" size={20} color={theme.colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder="60"
                  keyboardType="numeric"
                  value={formData.estimatedDuration?.toString() || ''}
                  onChangeText={(text) =>
                    setFormData({ ...formData, estimatedDuration: parseInt(text) || 0 })
                  }
                />
              </View>
            </View>

            {/* Cost Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('activityModal.cost')}</Text>
              <View style={styles.inputContainer}>
                <Icon name="currency-usd" size={20} color={theme.colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={formData.estimatedCost?.toString() || ''}
                  onChangeText={(text) =>
                    setFormData({ ...formData, estimatedCost: parseInt(text) || 0 })
                  }
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t('activityModal.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>
                  {mode === 'add' ? t('activityModal.add') : t('activityModal.save')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  required: {
    color: theme.colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.text,
  },
  textArea: {
    height: 100,
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.md,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.xs,
  },
  typeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  typeLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  typeLabelSelected: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
});
