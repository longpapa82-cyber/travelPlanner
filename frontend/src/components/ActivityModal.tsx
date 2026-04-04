import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Pressable,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { theme } from '../constants/theme';
import { useToast } from './feedback/Toast/ToastContext';
import { PlacesAutocomplete } from './PlacesAutocomplete';

// On web, use createPortal to escape parent stacking contexts (overflow, transform)
const createPortal =
  Platform.OS === 'web'
    ? require('react-dom').createPortal
    : undefined;

interface Activity {
  time: string;
  title: string;
  description: string;
  location: string;
  placeId?: string; // Add placeId for map pin functionality
  estimatedDuration?: number;
  estimatedCost?: number;
  actualCost?: number;
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

// Inline Toast Component for Modal
const InlineToast: React.FC<{
  visible: boolean;
  message: string;
  type: 'warning' | 'error' | 'success' | 'info';
}> = ({ visible, message, type }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  const getTypeConfig = () => {
    switch (type) {
      case 'warning':
        return {
          backgroundColor: theme.colors.warning,
          icon: 'alert',
        };
      case 'error':
        return {
          backgroundColor: theme.colors.error,
          icon: 'alert-circle',
        };
      case 'success':
        return {
          backgroundColor: theme.colors.success,
          icon: 'check-circle',
        };
      default:
        return {
          backgroundColor: theme.colors.primary,
          icon: 'information',
        };
    }
  };

  const typeConfig = getTypeConfig();

  // Don't render if not visible
  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        transform: [{ translateY }],
        opacity,
        backgroundColor: typeConfig.backgroundColor,
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    >
      <Icon name={typeConfig.icon} size={24} color="#fff" />
      <Text style={{
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: theme.spacing.md,
      }}>
        {message}
      </Text>
    </Animated.View>
  );
};

export const ActivityModal: React.FC<ActivityModalProps> = ({
  visible,
  onClose,
  onSave,
  activity,
  mode,
}) => {
  const { t } = useTranslation('components');
  const { showToast } = useToast();
  const insets = useSafeAreaInsets(); // Get safe area insets for Android/iOS
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
  const [showTimePicker, setShowTimePicker] = useState(false);
  const savingRef = useRef(false);

  // State for inline toast
  const [inlineToast, setInlineToast] = useState<{
    visible: boolean;
    message: string;
    type: 'warning' | 'error' | 'success' | 'info';
  }>({ visible: false, message: '', type: 'warning' });

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

  const isValidTime = (time: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

  // Helper function to show toast messages
  const showModalToast = (type: 'warning' | 'error' | 'success' | 'info', message: string) => {
    // On native platforms, use inline toast to avoid modal z-index issues
    if (Platform.OS !== 'web') {
      setInlineToast({ visible: true, message, type });
      setTimeout(() => {
        setInlineToast(prev => ({ ...prev, visible: false }));
      }, 3000);
    } else {
      // On web, use regular toast context
      showToast({ type, message, position: 'top' });
    }
  };

  const handleSave = async () => {
    // Ref-based guard prevents double-execution (onPress + onClick may both fire on web)
    if (savingRef.current) return;
    savingRef.current = true;

    // Validation
    if (!formData.time || !formData.title || !formData.location || !formData.description || !formData.description.trim()) {
      showModalToast('warning', t('activityModal.validationErrorMessage'));
      savingRef.current = false;
      return;
    }
    if (!isValidTime(formData.time)) {
      showModalToast('warning', t('activityModal.invalidTimeFormat'));
      savingRef.current = false;
      return;
    }

    try {
      setLoading(true);
      await onSave(formData);
      onClose();
    } catch (error: any) {
      showModalToast('error', error.response?.data?.message || t('activityModal.saveError'));
    } finally {
      setLoading(false);
      savingRef.current = false;
    }
  };

  const modalInner = (
        <View style={styles.modalContainer}>
          {/* Inline Toast for native platforms */}
          {Platform.OS !== 'web' && (
            <InlineToast
              visible={inlineToast.visible}
              message={inlineToast.message}
              type={inlineToast.type}
            />
          )}

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
                {Platform.OS === 'web' ? (
                  <input
                    type="time"
                    value={formData.time || ''}
                    onChange={(e: any) => setFormData({ ...formData, time: e.target.value })}
                    style={{
                      flex: 1,
                      marginLeft: 8,
                      fontSize: 16,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      color: theme.colors.text,
                      fontFamily: 'inherit',
                    } as any}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.input}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Text style={{
                        fontSize: 16,
                        color: formData.time ? theme.colors.text : theme.colors.textSecondary,
                        fontStyle: formData.time ? 'normal' : 'italic'
                      }}>
                        {formData.time || t('activityModal.timePlaceholder')}
                      </Text>
                    </TouchableOpacity>
                    {showTimePicker && (
                      <DateTimePicker
                        value={(() => {
                          const d = new Date();
                          if (formData.time) {
                            const [h, m] = formData.time.split(':').map(Number);
                            d.setHours(h || 9, m || 0, 0, 0);
                          } else {
                            d.setHours(9, 0, 0, 0);
                          }
                          return d;
                        })()}
                        mode="time"
                        is24Hour={true}
                        display="default"
                        onChange={(_: any, selectedDate?: Date) => {
                          setShowTimePicker(Platform.OS === 'ios'); // iOS keeps picker open
                          if (selectedDate) {
                            const h = selectedDate.getHours().toString().padStart(2, '0');
                            const m = selectedDate.getMinutes().toString().padStart(2, '0');
                            setFormData({ ...formData, time: `${h}:${m}` });
                          }
                        }}
                      />
                    )}
                  </>
                )}
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

            {/* Location Input with Places Autocomplete */}
            <View style={[styles.inputGroup, { zIndex: 10 }]}>
              <Text style={styles.label}>
                {t('activityModal.location')} <Text style={styles.required}>*</Text>
              </Text>
              <PlacesAutocomplete
                value={formData.location || ''}
                onChangeText={(text) => {
                  // Update location text
                  // Only clear placeId if the text actually changed (user is typing)
                  // This prevents clearing placeId when the same text is set during selection
                  setFormData((prev) => {
                    // If location hasn't changed, keep the existing placeId
                    // This happens when PlacesAutocomplete calls onChangeText during selection
                    if (prev.location === text) {
                      return prev;
                    }
                    // Location changed - user is typing, clear placeId
                    return {
                      ...prev,
                      location: text,
                      placeId: undefined
                    };
                  });
                }}
                onSelect={(place) => {
                  // Selection made - update both location and placeId together
                  // This ensures the text and placeId are synchronized
                  setFormData((prev) => ({
                    ...prev,
                    location: place.description,
                    placeId: place.placeId
                  }));
                }}
                placeholder={t('activityModal.locationPlaceholder')}
              />
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('activityModal.description')} <Text style={styles.required}>*</Text></Text>
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

            {/* Actual Cost Input */}
            {mode === 'edit' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('activityModal.actualCost')}</Text>
                <View style={styles.inputContainer}>
                  <Icon name="cash-check" size={20} color="#16A34A" />
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    keyboardType="numeric"
                    value={formData.actualCost?.toString() || ''}
                    onChangeText={(text) =>
                      setFormData({ ...formData, actualCost: parseInt(text) || 0 })
                    }
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t('activityModal.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="activity-save-button"
              accessibilityRole="button"
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              // @ts-ignore Web-only: RNW passes onClick to DOM element for browser compatibility
              onClick={handleSave}
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
  );

  // Web: use createPortal to escape parent stacking contexts (overflow: hidden)
  if (Platform.OS === 'web') {
    if (!visible) return null;
    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          zIndex: 10000,
        }}
        onClick={(e: any) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          style={{ width: '100%', maxWidth: 600 }}
          onClick={(e: any) => e.stopPropagation()}
        >
          {modalInner}
        </div>
      </div>,
      document.body,
    );
  }

  // Native: use React Native Modal
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {modalInner}
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
    // paddingBottom is set dynamically using insets.bottom
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
