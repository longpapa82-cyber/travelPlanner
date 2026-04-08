import React from 'react';
import { render } from '@testing-library/react-native';
import { ActivityModal } from '../ActivityModal';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

// Mock the toast context
jest.mock('../feedback/Toast/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

// Mock safe area insets
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock PlacesAutocomplete
jest.mock('../PlacesAutocomplete', () => ({
  PlacesAutocomplete: () => null,
}));

// Mock DateTimePicker (native module)
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

describe('ActivityModal - Time Input Field', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  it('should display placeholder text when time is empty', () => {
    const { queryByText } = render(
      <I18nextProvider i18n={i18n}>
        <ActivityModal
          visible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          mode="add"
        />
      </I18nextProvider>
    );

    // Should show "Select time" placeholder (or localized equivalent)
    // Should NOT show "09:00" as placeholder
    const placeholder = queryByText('시간 선택') || queryByText('Select time') || queryByText('時間を選択');
    const misleadingPlaceholder = queryByText('09:00');

    expect(placeholder).toBeTruthy();
    expect(misleadingPlaceholder).toBeFalsy();
  });

  it('should display actual time value when set', () => {
    const activityWithTime = {
      time: '14:30',
      title: 'Test Activity',
      description: 'Test Description',
      location: 'Test Location',
    };

    const { queryByText } = render(
      <I18nextProvider i18n={i18n}>
        <ActivityModal
          visible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          activity={activityWithTime}
          mode="edit"
        />
      </I18nextProvider>
    );

    // Should show actual time value
    const actualTime = queryByText('14:30');
    expect(actualTime).toBeTruthy();
  });
});