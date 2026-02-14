import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../auth/LoginScreen';
import { TwoFactorRequiredError } from '../../contexts/AuthContext';

// ── Mocks ──

const mockLogin = jest.fn();
const mockLoginWithGoogle = jest.fn();
const mockLoginWithApple = jest.fn();
const mockLoginWithKakao = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('../../contexts/AuthContext', () => {
  const actual = jest.requireActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      login: mockLogin,
      loginWithGoogle: mockLoginWithGoogle,
      loginWithApple: mockLoginWithApple,
      loginWithKakao: mockLoginWithKakao,
      user: null,
      isLoading: false,
      isAuthenticated: false,
    }),
  };
});

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#FFFFFF',
        text: '#1A1A2E',
        textSecondary: '#6B7280',
        primary: '#3B82F6',
      },
      spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
      borderRadius: { sm: 4, md: 8, lg: 12 },
    },
    isDark: false,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'login.title': 'Welcome',
        'login.subtitle': 'Welcome back',
        'login.tagline': 'Plan your trip',
        'login.emailPlaceholder': 'Enter email',
        'login.passwordPlaceholder': 'Enter password',
        'login.email': 'Email',
        'login.password': 'Password',
        'login.submit': 'Login',
        'login.or': 'or',
        'login.socialGoogle': 'Google Login',
        'login.socialApple': 'Apple Login',
        'login.socialKakao': 'Kakao Login',
        'login.noAccount': "Don't have an account?",
        'login.register': 'Sign Up',
        'login.forgotPassword': 'Forgot Password?',
        'login.showPassword': 'Show password',
        'login.hidePassword': 'Hide password',
        'login.alerts.emailRequired': 'Email is required',
        'login.alerts.passwordRequired': 'Password is required',
        'login.alerts.invalidCredentials': 'Invalid credentials',
        'login.alerts.googleFailed': 'Google login failed',
        'login.alerts.appleFailed': 'Apple login failed',
        'login.alerts.kakaoFailed': 'Kakao login failed',
        'login.alerts.networkError': 'Network error',
        'login.validation.emailInvalid': 'Invalid email format',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/animation/FadeIn', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/animation/SlideIn', () => ({
  SlideIn: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/core/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/core/Button', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onPress,
      disabled,
      loading,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
      loading?: boolean;
    }) => (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
      >
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('../../utils/images', () => ({
  getHeroImageUrl: () => 'https://example.com/hero.jpg',
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

// ── Test Helpers ──

const navigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as any;

const renderScreen = () => render(<LoginScreen navigation={navigation} />);

// ── Tests ──

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('should render login form elements', () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      expect(getByText('Welcome')).toBeTruthy();
      expect(getByPlaceholderText('Enter email')).toBeTruthy();
      expect(getByPlaceholderText('Enter password')).toBeTruthy();
      expect(getByText('Forgot Password?')).toBeTruthy();
      expect(getByText('Sign Up')).toBeTruthy();
    });

    it('should render social login buttons', () => {
      const { getByText } = renderScreen();

      expect(getByText('Google Login')).toBeTruthy();
      expect(getByText('Kakao Login')).toBeTruthy();
    });
  });

  // ── Form Validation ──

  describe('validation', () => {
    it('should show error when email is empty', async () => {
      const { getByText } = renderScreen();

      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(getByText('Email is required')).toBeTruthy();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should show error when password is empty', async () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.changeText(getByPlaceholderText('Enter email'), 'test@example.com');
      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(getByText('Password is required')).toBeTruthy();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should show error for invalid email format on blur', async () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      const emailInput = getByPlaceholderText('Enter email');
      fireEvent.changeText(emailInput, 'not-an-email');
      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        expect(getByText('Invalid email format')).toBeTruthy();
      });
    });

    it('should show both errors when both fields empty', async () => {
      const { getByText } = renderScreen();

      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(getByText('Email is required')).toBeTruthy();
        expect(getByText('Password is required')).toBeTruthy();
      });
    });

    it('should clear errors on input change', async () => {
      const { getByText, getByPlaceholderText, queryByText } = renderScreen();

      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(getByText('Email is required')).toBeTruthy();
      });

      fireEvent.changeText(getByPlaceholderText('Enter email'), 'a');

      await waitFor(() => {
        expect(queryByText('Email is required')).toBeNull();
      });
    });
  });

  // ── Email Login ──

  describe('email login', () => {
    it('should call login with email and password', async () => {
      mockLogin.mockResolvedValue(undefined);
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.changeText(getByPlaceholderText('Enter email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Enter password'), 'password123');
      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should show error on invalid credentials', async () => {
      mockLogin.mockRejectedValue({
        response: { data: { message: 'Wrong password' } },
      });
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.changeText(getByPlaceholderText('Enter email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Enter password'), 'wrong');
      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(getByText('Wrong password')).toBeTruthy();
      });
    });

    it('should show generic error when no message from server', async () => {
      mockLogin.mockRejectedValue(new Error('Network error'));
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.changeText(getByPlaceholderText('Enter email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Enter password'), 'password123');
      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(getByText('Invalid credentials')).toBeTruthy();
      });
    });

    it('should navigate to TwoFactorLogin on 2FA required', async () => {
      mockLogin.mockRejectedValue(new TwoFactorRequiredError('temp-token-abc'));
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.changeText(getByPlaceholderText('Enter email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Enter password'), 'password123');
      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('TwoFactorLogin', {
          tempToken: 'temp-token-abc',
        });
      });
    });
  });

  // ── Navigation ──

  describe('navigation', () => {
    it('should navigate to Register screen', () => {
      const { getByText } = renderScreen();

      fireEvent.press(getByText('Sign Up'));

      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });

    it('should navigate to ForgotPassword screen', () => {
      const { getByText } = renderScreen();

      fireEvent.press(getByText('Forgot Password?'));

      expect(mockNavigate).toHaveBeenCalledWith('ForgotPassword');
    });
  });

  // ── Social Login ──

  describe('social login', () => {
    it('should call loginWithGoogle on Google button press', async () => {
      mockLoginWithGoogle.mockResolvedValue(undefined);
      const { getByText } = renderScreen();

      fireEvent.press(getByText('Google Login'));

      await waitFor(() => {
        expect(mockLoginWithGoogle).toHaveBeenCalled();
      });
    });

    it('should call loginWithKakao on Kakao button press', async () => {
      mockLoginWithKakao.mockResolvedValue(undefined);
      const { getByText } = renderScreen();

      fireEvent.press(getByText('Kakao Login'));

      await waitFor(() => {
        expect(mockLoginWithKakao).toHaveBeenCalled();
      });
    });
  });
});
