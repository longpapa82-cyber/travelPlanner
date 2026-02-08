import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { getDateLocale } from '../../utils/dateLocale';

interface DatePickerProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
}

const DatePickerField: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  disabled = false,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('common');
  const [showPicker, setShowPicker] = useState(false);

  const formatForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(getDateLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const currentDate = value ? new Date(value + 'T00:00:00') : new Date();

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0], borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
        <input
          type="date"
          value={value}
          onChange={(e: any) => onChange(e.target.value)}
          min={minimumDate?.toISOString().split('T')[0]}
          max={maximumDate?.toISOString().split('T')[0]}
          disabled={disabled}
          style={{
            fontSize: 16,
            fontWeight: '500',
            color: isDark ? '#fff' : '#1a1a1a',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            width: '100%',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        />
      </View>
    );
  }

  // Native: use modal with month/day scrollable picker
  const DateTimePicker = require('@react-native-community/datetimepicker').default;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0], borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => !disabled && setShowPicker(true)}
        disabled={disabled}
      >
        <Text style={[styles.dateText, { color: value ? theme.colors.text : theme.colors.textSecondary }]}>
          {value ? formatForDisplay(value) : 'YYYY-MM-DD'}
        </Text>
        <Icon name="calendar" size={20} color={theme.colors.primary} />
      </TouchableOpacity>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_: any, selectedDate?: Date) => {
            setShowPicker(false);
            if (selectedDate) {
              onChange(selectedDate.toISOString().split('T')[0]);
            }
          }}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={[styles.modalButton, { color: theme.colors.textSecondary }]}>{t('cancel')}</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{label}</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={[styles.modalButton, { color: theme.colors.primary }]}>{t('done')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={currentDate}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(_: any, selectedDate?: Date) => {
                  if (selectedDate) {
                    onChange(selectedDate.toISOString().split('T')[0]);
                  }
                }}
                locale={getDateLocale()}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButton: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DatePickerField;
