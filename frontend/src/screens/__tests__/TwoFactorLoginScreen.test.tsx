import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TwoFactorLoginScreen from '../auth/TwoFactorLoginScreen';

// ── Mocks ──

const mockCompleteTwoFactorLogin = jest.fn();
const mockGoBack = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    completeTwoFactorLogin: mockCompleteTwoFactorLogin,
  }),
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#FFFFFF',
        text: '#1A1A2E',
        textSecondary: '#6B7280',
      },
      spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
    },
    isDark: false,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'twoFactor.title': '2FA Verification',
        'twoFactor.subtitle': 'Enter your 6-digit code',
        'twoFactor.codePlaceholder': '000000',
        'twoFactor.backupCodePlaceholder': 'Enter backup code',
        'twoFactor.verify': 'Verify',
        'twoFactor.useBackupCode': 'Use backup code',
        'twoFactor.alerts.invalidCode': 'Invalid code',
      };
      return map[key] || key;
    },
  }),
}));

jest.mock('../../components/animation/FadeIn', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/core/Button', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

// ── Helpers ──

const route = { params: { tempToken: 'temp-token-123' } } as any;
const navigation = { goBack: mockGoBack } as any;

const renderScreen = () =>
  render(<TwoFactorLoginScreen navigation={navigation} route={route} />);

// ── Tests ──

describe('TwoFactorLoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render title and input', () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      expect(getByText('2FA Verification')).toBeTruthy();
      expect(getByPlaceholderText('000000')).toBeTruthy();
      expect(getByText('Verify')).toBeTruthy();
    });

    it('should render backup code toggle', () => {
      const { getByText } = renderScreen();

      expect(getByText('Use backup code')).toBeTruthy();
    });
  });

  describe('TOTP verification', () => {
    it('should call completeTwoFactorLogin with code', async () => {
      mockCompleteTwoFactorLogin.mockResolvedValue(undefined);
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.changeText(getByPlaceholderText('000000'), '123456');
      fireEvent.press(getByText('Verify'));

      await waitFor(() => {
        expect(mockCompleteTwoFactorLogin).toHaveBeenCalledWith(
          'temp-token-123',
          '123456',
        );
      });
    });

    it('should show error on invalid code', async () => {
      mockCompleteTwoFactorLogin.mockRejectedValue({
        response: { data: { message: 'Code expired' } },
      });
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.changeText(getByPlaceholderText('000000'), '000000');
      fireEvent.press(getByText('Verify'));

      await waitFor(() => {
        expect(getByText('Code expired')).toBeTruthy();
      });
    });

    it('should show generic error when no server message', async () => {
      mockCompleteTwoFactorLogin.mockRejectedValue(new Error('fail'));
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.changeText(getByPlaceholderText('000000'), '000000');
      fireEvent.press(getByText('Verify'));

      await waitFor(() => {
        expect(getByText('Invalid code')).toBeTruthy();
      });
    });
  });

  describe('backup code mode', () => {
    it('should switch to backup code mode', () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.press(getByText('Use backup code'));

      expect(getByPlaceholderText('Enter backup code')).toBeTruthy();
    });

    it('should accept 8-character backup codes', async () => {
      mockCompleteTwoFactorLogin.mockResolvedValue(undefined);
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.press(getByText('Use backup code'));
      fireEvent.changeText(getByPlaceholderText('Enter backup code'), 'A3B2C1D0');
      fireEvent.press(getByText('Verify'));

      await waitFor(() => {
        expect(mockCompleteTwoFactorLogin).toHaveBeenCalledWith(
          'temp-token-123',
          'A3B2C1D0',
        );
      });
    });

    it('should toggle back to TOTP mode', () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      // Switch to backup
      fireEvent.press(getByText('Use backup code'));
      expect(getByPlaceholderText('Enter backup code')).toBeTruthy();

      // Switch back — the toggle text changes to subtitle in backup mode
      fireEvent.press(getByText('Enter your 6-digit code'));
      expect(getByPlaceholderText('000000')).toBeTruthy();
    });
  });

  describe('button state', () => {
    it('should not submit with empty code', () => {
      const { getByText } = renderScreen();

      fireEvent.press(getByText('Verify'));

      expect(mockCompleteTwoFactorLogin).not.toHaveBeenCalled();
    });
  });
});
