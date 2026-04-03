import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ActivityModal } from '../ActivityModal';
import { ToastProvider } from '../feedback/Toast/ToastContext';

// Mock dependencies
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'activityModal.addTitle': 'Add Activity',
        'activityModal.editTitle': 'Edit Activity',
        'activityModal.validationErrorMessage': 'Please fill in all required fields',
        'activityModal.invalidTimeFormat': 'Invalid time format',
        'activityModal.cancel': 'Cancel',
        'activityModal.add': 'Add',
        'activityModal.save': 'Save',
        'activityModal.time': 'Time',
        'activityModal.title': 'Title',
        'activityModal.location': 'Location',
        'activityModal.description': 'Description',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'Icon',
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

describe('ActivityModal - Inline Toast', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show validation error toast when required fields are empty', async () => {
    const { getByTestId, getByText } = render(
      <ToastProvider>
        <ActivityModal
          visible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          mode="add"
        />
      </ToastProvider>
    );

    // Try to save without filling required fields
    const saveButton = getByTestId('activity-save-button');
    fireEvent.press(saveButton);

    // Check that validation message appears
    await waitFor(() => {
      expect(getByText('Please fill in all required fields')).toBeTruthy();
    });

    // Ensure save was not called due to validation
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should show time format error for invalid time', async () => {
    const { getByTestId, getByPlaceholderText, getByText } = render(
      <ToastProvider>
        <ActivityModal
          visible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          mode="add"
        />
      </ToastProvider>
    );

    // Fill in fields with invalid time format
    const timeInput = getByPlaceholderText('HH:MM');
    fireEvent.changeText(timeInput, '25:00'); // Invalid hour

    const titleInput = getByPlaceholderText('Activity title');
    fireEvent.changeText(titleInput, 'Test Activity');

    const locationInput = getByPlaceholderText('Location');
    fireEvent.changeText(locationInput, 'Test Location');

    const descriptionInput = getByPlaceholderText('Description');
    fireEvent.changeText(descriptionInput, 'Test Description');

    // Try to save
    const saveButton = getByTestId('activity-save-button');
    fireEvent.press(saveButton);

    // Check that time format error appears
    await waitFor(() => {
      expect(getByText('Invalid time format')).toBeTruthy();
    });

    // Ensure save was not called due to validation
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should successfully save when all fields are valid', async () => {
    mockOnSave.mockResolvedValueOnce(undefined);

    const { getByTestId, getByPlaceholderText } = render(
      <ToastProvider>
        <ActivityModal
          visible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          mode="add"
        />
      </ToastProvider>
    );

    // Fill in all required fields with valid data
    const timeInput = getByPlaceholderText('HH:MM');
    fireEvent.changeText(timeInput, '14:30');

    const titleInput = getByPlaceholderText('Activity title');
    fireEvent.changeText(titleInput, 'Lunch at Restaurant');

    const locationInput = getByPlaceholderText('Location');
    fireEvent.changeText(locationInput, 'Downtown Restaurant');

    const descriptionInput = getByPlaceholderText('Description');
    fireEvent.changeText(descriptionInput, 'Having lunch with friends');

    // Save the activity
    const saveButton = getByTestId('activity-save-button');
    fireEvent.press(saveButton);

    // Check that save was called with correct data
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        time: '14:30',
        title: 'Lunch at Restaurant',
        location: 'Downtown Restaurant',
        description: 'Having lunch with friends',
        estimatedDuration: 0,
        estimatedCost: 0,
        type: 'other',
      });
    });
  });
});