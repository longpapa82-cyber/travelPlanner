import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '../ThemeContext';

// ── Mocks ──

jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  getColorScheme: jest.fn(() => 'light'),
  addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const THEME_KEY = '@travel_planner_theme';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  // ── Initial State ──

  describe('initial state', () => {
    it('should default to light mode', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.mode).toBe('light');
      });

      expect(result.current.isDark).toBe(false);
      expect(result.current.theme).toBeDefined();
      expect(result.current.colors).toBeDefined();
    });

    it('should restore saved theme from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.mode).toBe('dark');
      });

      expect(result.current.isDark).toBe(true);
    });

    it('should handle storage failure gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isDark).toBe(false);
      });
    });
  });

  // ── setTheme ──

  describe('setTheme', () => {
    it('should switch to dark mode', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.mode).toBe('light');
      });

      await act(async () => {
        result.current.setTheme('dark');
      });

      expect(result.current.mode).toBe('dark');
      expect(result.current.isDark).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_KEY, 'dark');
    });

    it('should switch to light mode', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isDark).toBe(true);
      });

      await act(async () => {
        result.current.setTheme('light');
      });

      expect(result.current.mode).toBe('light');
      expect(result.current.isDark).toBe(false);
    });

    it('should use system theme when set to system mode', async () => {
      (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.mode).toBe('light');
      });

      await act(async () => {
        result.current.setTheme('system');
      });

      expect(result.current.mode).toBe('system');
      expect(result.current.isDark).toBe(true);
    });
  });

  // ── toggleTheme ──

  describe('toggleTheme', () => {
    it('should toggle from light to dark', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isDark).toBe(false);
      });

      await act(async () => {
        result.current.toggleTheme();
      });

      expect(result.current.isDark).toBe(true);
      expect(result.current.mode).toBe('dark');
    });

    it('should toggle from dark to light', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isDark).toBe(true);
      });

      await act(async () => {
        result.current.toggleTheme();
      });

      expect(result.current.isDark).toBe(false);
      expect(result.current.mode).toBe('light');
    });
  });

  // ── Dark mode theme values ──

  describe('dark mode theme', () => {
    it('should provide different colors in dark mode', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.mode).toBe('light');
      });

      const lightBackground = result.current.theme.colors.background;

      await act(async () => {
        result.current.setTheme('dark');
      });

      const darkBackground = result.current.theme.colors.background;
      expect(lightBackground).not.toBe(darkBackground);
    });
  });

  // ── System theme listener ──

  describe('system theme listener', () => {
    it('should register listener when in system mode', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.mode).toBe('light');
      });

      await act(async () => {
        result.current.setTheme('system');
      });

      expect(Appearance.addChangeListener).toHaveBeenCalled();
    });
  });

  // ── useTheme outside provider ──

  describe('useTheme outside provider', () => {
    it('should throw when used outside ThemeProvider', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      spy.mockRestore();
    });
  });
});
