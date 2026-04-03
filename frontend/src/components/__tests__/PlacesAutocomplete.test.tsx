import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PlacesAutocomplete } from '../PlacesAutocomplete';
import apiService from '../../services/api';

// Mock the API service
jest.mock('../../services/api', () => ({
  default: {
    placesAutocomplete: jest.fn()
  }
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve())
}));

// Mock i18n
jest.mock('../../i18n', () => ({
  getCurrentLanguage: jest.fn(() => 'en')
}));

describe('PlacesAutocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('should update value when user types', async () => {
    const mockOnChangeText = jest.fn();
    const mockOnSelect = jest.fn();

    const { getByPlaceholderText } = render(
      <PlacesAutocomplete
        value=""
        onChangeText={mockOnChangeText}
        onSelect={mockOnSelect}
        placeholder="Enter location"
      />
    );

    const input = getByPlaceholderText('Enter location');

    // User types "Doky"
    fireEvent.changeText(input, 'Doky');

    expect(mockOnChangeText).toHaveBeenCalledWith('Doky');
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  test('should call onSelect with place data when user selects from dropdown', async () => {
    const mockOnChangeText = jest.fn();
    const mockOnSelect = jest.fn();

    // Mock API response
    (apiService.placesAutocomplete as jest.Mock).mockResolvedValue({
      available: true,
      predictions: [
        {
          placeId: 'place123',
          description: 'Tokyo, Japan',
          mainText: 'Tokyo',
          secondaryText: 'Japan'
        }
      ]
    });

    const { getByPlaceholderText, getByText } = render(
      <PlacesAutocomplete
        value="Doky"
        onChangeText={mockOnChangeText}
        onSelect={mockOnSelect}
        placeholder="Enter location"
      />
    );

    const input = getByPlaceholderText('Enter location');

    // User types to trigger search
    fireEvent.changeText(input, 'Doky');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(500);

    await waitFor(() => {
      expect(apiService.placesAutocomplete).toHaveBeenCalledWith('Doky', expect.any(String), 'en');
    });

    // Wait for dropdown to appear
    await waitFor(() => {
      const tokyoOption = getByText('Tokyo');
      expect(tokyoOption).toBeTruthy();
    });

    // User selects Tokyo from dropdown
    const tokyoOption = getByText('Tokyo');
    fireEvent.press(tokyoOption);

    // CRITICAL: This is where the bug might be
    // onSelect should be called with the place object
    expect(mockOnSelect).toHaveBeenCalledWith({
      placeId: 'place123',
      description: 'Tokyo, Japan',
      mainText: 'Tokyo',
      secondaryText: 'Japan'
    });

    // onChangeText should NOT be called again after selection
    // (unless onSelect is not provided)
    expect(mockOnChangeText).toHaveBeenCalledTimes(1); // Only from initial typing
  });

  test('should handle case when onSelect is not provided', async () => {
    const mockOnChangeText = jest.fn();

    // Mock API response
    (apiService.placesAutocomplete as jest.Mock).mockResolvedValue({
      available: true,
      predictions: [
        {
          placeId: 'place123',
          description: 'Tokyo, Japan',
          mainText: 'Tokyo',
          secondaryText: 'Japan'
        }
      ]
    });

    const { getByPlaceholderText, getByText } = render(
      <PlacesAutocomplete
        value="Doky"
        onChangeText={mockOnChangeText}
        // No onSelect provided
        placeholder="Enter location"
      />
    );

    const input = getByPlaceholderText('Enter location');

    // User types to trigger search
    fireEvent.changeText(input, 'Doky');

    // Advance timers to trigger debounced search
    jest.advanceTimersByTime(500);

    await waitFor(() => {
      expect(apiService.placesAutocomplete).toHaveBeenCalled();
    });

    // Wait for dropdown to appear
    await waitFor(() => {
      const tokyoOption = getByText('Tokyo');
      expect(tokyoOption).toBeTruthy();
    });

    // User selects Tokyo from dropdown
    const tokyoOption = getByText('Tokyo');
    fireEvent.press(tokyoOption);

    // When onSelect is not provided, onChangeText should be called with the description
    expect(mockOnChangeText).toHaveBeenCalledWith('Tokyo, Japan');
  });

  test('BUG REPRODUCTION: Stale closure issue in ActivityModal', async () => {
    // This test simulates the bug from ActivityModal where selection doesn't work
    const mockOnChangeText = jest.fn();
    const mockOnSelect = jest.fn();

    // Mock API response
    (apiService.placesAutocomplete as jest.Mock).mockResolvedValue({
      available: true,
      predictions: [
        {
          placeId: 'place123',
          description: 'Tokyo, Japan',
          mainText: 'Tokyo',
          secondaryText: 'Japan'
        }
      ]
    });

    // Simulate the pattern used in ActivityModal
    let formData = { location: '', placeId: undefined };

    const handleChangeText = (text: string) => {
      formData = { ...formData, location: text, placeId: undefined };
      mockOnChangeText(text);
    };

    const handleSelect = (place: any) => {
      // This is what SHOULD happen
      formData = {
        ...formData,
        location: place.description,
        placeId: place.placeId
      };
      mockOnSelect(place);
    };

    const { getByPlaceholderText, getByText, rerender } = render(
      <PlacesAutocomplete
        value={formData.location}
        onChangeText={handleChangeText}
        onSelect={handleSelect}
        placeholder="Enter location"
      />
    );

    const input = getByPlaceholderText('Enter location');

    // User types "Doky"
    fireEvent.changeText(input, 'Doky');

    // Re-render with updated value
    rerender(
      <PlacesAutocomplete
        value={formData.location}
        onChangeText={handleChangeText}
        onSelect={handleSelect}
        placeholder="Enter location"
      />
    );

    // Advance timers to trigger search
    jest.advanceTimersByTime(500);

    await waitFor(() => {
      expect(apiService.placesAutocomplete).toHaveBeenCalled();
    });

    // Wait for dropdown
    await waitFor(() => {
      const tokyoOption = getByText('Tokyo');
      expect(tokyoOption).toBeTruthy();
    });

    // User selects Tokyo
    const tokyoOption = getByText('Tokyo');
    fireEvent.press(tokyoOption);

    // Check if formData was updated correctly
    expect(formData.location).toBe('Tokyo, Japan');
    expect(formData.placeId).toBe('place123');
    expect(mockOnSelect).toHaveBeenCalled();
  });
});