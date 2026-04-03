/**
 * ActivityModal - Fixed to work with new PlacesAutocomplete
 *
 * Key changes:
 * - Uses ref to control PlacesAutocomplete
 * - Handles selection through onSelect callback
 * - Maintains clean separation of concerns
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Activity, ActivityType } from '../types';
import { useTranslation } from 'react-i18next';
import { theme } from '../constants/theme';
import { useToast } from './feedback/Toast/ToastContext';
import { PlacesAutocomplete, PlacesAutocompleteRef, PlacePrediction } from './PlacesAutocomplete.fixed';

// Rest of imports remain the same...
const createPortal =
  Platform.OS === 'web'
    ? require('react-dom').createPortal
    : (children: any) => children;

interface ActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (activity: Partial<Activity>) => void;
  initialData?: Partial<Activity>;
  isEditing?: boolean;
}

export const ActivityModal: React.FC<ActivityModalProps> = ({
  visible,
  onClose,
  onSave,
  initialData,
  isEditing = false,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const placesRef = useRef<PlacesAutocompleteRef>(null);

  const [formData, setFormData] = useState<Partial<Activity>>({
    type: 'sightseeing',
    name: '',
    location: '',
    startTime: '',
    endTime: '',
    notes: '',
    cost: 0,
    ...initialData,
  });

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      const data = {
        type: 'sightseeing',
        name: '',
        location: '',
        startTime: '',
        endTime: '',
        notes: '',
        cost: 0,
        ...initialData,
      };
      setFormData(data);

      // Set initial location in PlacesAutocomplete
      if (data.location && placesRef.current) {
        placesRef.current.setValue(data.location);
      }
    }
  }, [visible, initialData]);

  const handleLocationSelect = (place: PlacePrediction) => {
    console.log('[ActivityModal] Location selected:', place.description);
    setFormData(prev => ({
      ...prev,
      location: place.description,
      placeId: place.placeId,
    }));
  };

  const handleLocationChange = (text: string) => {
    // Only update if user is manually typing (not selecting)
    setFormData(prev => ({
      ...prev,
      location: text,
      placeId: undefined, // Clear placeId when manually typing
    }));
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name?.trim()) {
      showToast(t('activityModal.nameRequired'), 'error');
      return;
    }

    if (!formData.location?.trim()) {
      showToast(t('activityModal.locationRequired'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save activity:', error);
      showToast(t('activityModal.saveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const activityTypes: ActivityType[] = [
    'sightseeing',
    'restaurant',
    'shopping',
    'accommodation',
    'transportation',
    'entertainment',
    'other',
  ];

  const getActivityIcon = (type: ActivityType) => {
    const icons: Record<ActivityType, string> = {
      sightseeing: 'camera',
      restaurant: 'food',
      shopping: 'shopping',
      accommodation: 'home',
      transportation: 'car',
      entertainment: 'party-popper',
      other: 'dots-horizontal',
    };
    return icons[type] || 'dots-horizontal';
  };

  const formatTimeForDisplay = (time: string | undefined) => {
    if (!time) return '';
    try {
      const [hours, minutes] = time.split(':');
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const renderTimeInput = (
    value: string | undefined,
    onPress: () => void,
    placeholder: string
  ) => {
    const hasValue = value && value !== '';
    return (
      <TouchableOpacity style={styles.timeButton} onPress={onPress}>
        <Icon name="clock-outline" size={20} color={theme.colors.primary} />
        <Text
          style={[
            styles.timeButtonText,
            !hasValue && styles.timeButtonPlaceholder,
          ]}
        >
          {hasValue ? formatTimeForDisplay(value) : placeholder}
        </Text>
      </TouchableOpacity>
    );
  };

  const modalContent = (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditing ? t('activityModal.editActivity') : t('activityModal.addActivity')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Activity Type */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('activityModal.type')}</Text>
              <View style={styles.typeContainer}>
                {activityTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeChip,
                      formData.type === type && styles.typeChipSelected,
                    ]}
                    onPress={() => setFormData((prev) => ({ ...prev, type }))}
                  >
                    <Icon
                      name={getActivityIcon(type)}
                      size={20}
                      color={
                        formData.type === type
                          ? theme.colors.background
                          : theme.colors.text
                      }
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        formData.type === type && styles.typeChipTextSelected,
                      ]}
                    >
                      {t(`activityModal.types.${type}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {t('activityModal.name')} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Icon name="text" size={20} color={theme.colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder={t('activityModal.namePlaceholder')}
                  value={formData.name}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                />
              </View>
            </View>

            {/* Location */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {t('activityModal.location')} <Text style={styles.required}>*</Text>
              </Text>
              <PlacesAutocomplete
                ref={placesRef}
                initialValue={formData.location || ''}
                placeholder={t('activityModal.locationPlaceholder')}
                onSelect={handleLocationSelect}
                onChangeText={handleLocationChange}
              />
            </View>

            {/* Time */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('activityModal.time')}</Text>
              <View style={styles.timeContainer}>
                {renderTimeInput(
                  formData.startTime,
                  () => setShowStartPicker(true),
                  t('components.activityModal.selectTime')
                )}
                <Text style={styles.timeSeparator}>-</Text>
                {renderTimeInput(
                  formData.endTime,
                  () => setShowEndPicker(true),
                  t('components.activityModal.selectTime')
                )}
              </View>
            </View>

            {/* Cost */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('activityModal.cost')}</Text>
              <View style={styles.inputContainer}>
                <Icon name="currency-usd" size={20} color={theme.colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={formData.cost?.toString() || ''}
                  onChangeText={(text) => {
                    const cost = parseInt(text) || 0;
                    setFormData((prev) => ({ ...prev, cost }));
                  }}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('activityModal.notes')}</Text>
              <View style={[styles.inputContainer, styles.textArea]}>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder={t('activityModal.notesPlaceholder')}
                  value={formData.notes}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, notes: text }))}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.colors.background} />
              ) : (
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Time Pickers */}
          {Platform.OS !== 'web' && showStartPicker && (
            <DateTimePicker
              value={
                formData.startTime
                  ? new Date(`2000-01-01T${formData.startTime}`)
                  : new Date()
              }
              mode="time"
              is24Hour={true}
              display="default"
              onChange={(event, selectedDate) => {
                setShowStartPicker(false);
                if (selectedDate) {
                  const hours = selectedDate.getHours().toString().padStart(2, '0');
                  const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
                  setFormData((prev) => ({ ...prev, startTime: `${hours}:${minutes}` }));
                }
              }}
            />
          )}

          {Platform.OS !== 'web' && showEndPicker && (
            <DateTimePicker
              value={
                formData.endTime
                  ? new Date(`2000-01-01T${formData.endTime}`)
                  : new Date()
              }
              mode="time"
              is24Hour={true}
              display="default"
              onChange={(event, selectedDate) => {
                setShowEndPicker(false);
                if (selectedDate) {
                  const hours = selectedDate.getHours().toString().padStart(2, '0');
                  const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
                  setFormData((prev) => ({ ...prev, endTime: `${hours}:${minutes}` }));
                }
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  return Platform.OS === 'web' && typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

// Styles remain the same as original
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  form: {
    padding: theme.spacing.lg,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
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
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  typeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  typeChipText: {
    marginLeft: theme.spacing.xs,
    fontSize: 14,
    color: theme.colors.text,
  },
  typeChipTextSelected: {
    color: theme.colors.background,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  timeButtonText: {
    marginLeft: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.text,
  },
  timeButtonPlaceholder: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  timeSeparator: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  button: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ActivityModal;