/**
 * ThemeContext - Dark Mode Support
 *
 * 앱 전체의 테마(Light/Dark)를 관리하는 Context
 * - AsyncStorage로 사용자 설정 영구 저장
 * - 시스템 테마 자동 감지 (선택사항)
 * - 부드러운 테마 전환 애니메이션
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme as lightTheme, themeV2, darkColors, colors } from '../constants/theme';

// Storage wrapper for web/native compatibility
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
};

// ============================================================================
// TYPES
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  // Current theme mode
  mode: ThemeMode;

  // Actual theme being used (resolved from mode)
  isDark: boolean;

  // Theme objects
  theme: typeof lightTheme;
  themeV2: typeof themeV2;
  colors: typeof colors | typeof darkColors;

  // Actions
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = '@travel_planner_theme';

// ============================================================================
// PROVIDER
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState(false);

  // Get system theme
  const getSystemTheme = (): boolean => {
    const colorScheme = Appearance.getColorScheme();
    return colorScheme === 'dark';
  };

  // Resolve actual theme from mode
  const resolveTheme = (themeMode: ThemeMode): boolean => {
    if (themeMode === 'system') {
      return getSystemTheme();
    }
    return themeMode === 'dark';
  };

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await storage.getItem(THEME_STORAGE_KEY);
        if (storedTheme) {
          const parsedMode = storedTheme as ThemeMode;
          setMode(parsedMode);
          setIsDark(resolveTheme(parsedMode));
        } else {
          // Default to system theme
          setIsDark(getSystemTheme());
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
        setIsDark(getSystemTheme());
      }
    };

    loadTheme();
  }, []);

  // Listen to system theme changes when mode is 'system'
  useEffect(() => {
    if (mode !== 'system') return;

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDark(colorScheme === 'dark');
    });

    return () => subscription.remove();
  }, [mode]);

  // Set theme and persist to storage
  const setTheme = async (newMode: ThemeMode) => {
    try {
      setMode(newMode);
      setIsDark(resolveTheme(newMode));
      await storage.setItem(THEME_STORAGE_KEY, newMode);
      console.log('Theme changed to:', newMode, 'isDark:', resolveTheme(newMode));
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  // Toggle between light and dark (ignores system mode)
  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark';
    setTheme(newMode);
  };

  // Create theme object based on current mode
  const currentTheme = isDark
    ? {
        ...lightTheme,
        colors: {
          // Dark mode overrides
          primary: darkColors.primary,
          primaryLight: colors.primary[200],
          primaryDark: colors.primary[900],

          secondary: darkColors.secondary,
          secondaryLight: colors.secondary[200],
          secondaryDark: colors.secondary[900],

          accent: colors.accent,

          background: darkColors.background.primary,
          text: darkColors.text.primary,
          textSecondary: darkColors.text.secondary,
          white: darkColors.background.secondary,

          success: colors.success.main,
          warning: colors.warning.main,
          error: colors.error.main,

          border: darkColors.border.light,
        },
      }
    : lightTheme;

  const currentColors = isDark ? darkColors : colors;

  const value: ThemeContextValue = {
    mode,
    isDark,
    theme: currentTheme,
    themeV2,
    colors: currentColors,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

// ============================================================================
// EXPORTS
// ============================================================================

export default ThemeContext;
