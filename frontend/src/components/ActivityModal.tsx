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

const ACTIVITY_TYPES = [
  { value: 'meal', label: '식사', icon: 'silverware-fork-knife' },
  { value: 'sightseeing', label: '관광', icon: 'camera' },
  { value: 'shopping', label: '쇼핑', icon: 'shopping' },
  { value: 'experience', label: '체험', icon: 'drama-masks' },
  { value: 'relaxation', label: '휴식', icon: 'coffee' },
  { value: 'transportation', label: '이동', icon: 'car' },
  { value: 'other', label: '기타', icon: 'dots-horizontal' },
];

export const ActivityModal: React.FC<ActivityModalProps> = ({
  visible,
  onClose,
  onSave,
  activity,
  mode,
}) => {
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
      Alert.alert('입력 오류', '시간, 제목, 장소는 필수 입력 항목입니다.');
      return;
    }

    try {
      setLoading(true);
      await onSave(formData);
      onClose();
    } catch (error: any) {
      Alert.alert(
        '오류',
        error.response?.data?.message || '활동 저장 중 오류가 발생했습니다.'
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
              {mode === 'add' ? '활동 추가' : '활동 수정'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Time Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                시간 <Text style={styles.required}>*</Text>
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
                제목 <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Icon name="format-title" size={20} color={theme.colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder="활동 제목"
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                />
              </View>
            </View>

            {/* Location Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                장소 <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Icon name="map-marker" size={20} color={theme.colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder="장소 또는 주소"
                  value={formData.location}
                  onChangeText={(text) => setFormData({ ...formData, location: text })}
                />
              </View>
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>설명</Text>
              <TextInput
                style={[styles.inputContainer, styles.textArea]}
                placeholder="활동에 대한 상세 설명"
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Activity Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>활동 유형</Text>
              <View style={styles.typeContainer}>
                {ACTIVITY_TYPES.map((type) => (
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
              <Text style={styles.label}>예상 소요 시간 (분)</Text>
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
              <Text style={styles.label}>예상 비용 (원)</Text>
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
              <Text style={styles.cancelButtonText}>취소</Text>
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
                  {mode === 'add' ? '추가' : '저장'}
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
