/**
 * Travel Planner Design System v2.0
 *
 * 2025년 트렌드를 반영한 완전히 새로운 디자인 시스템
 * - Light/Dark 모드 완벽 지원
 * - 50-900 shade system
 * - 확장된 타이포그래피
 * - 애니메이션 상수
 * - 접근성 (WCAG 2.1 AA)
 */

// ============================================================================
// COLOR SYSTEM v2.0
// ============================================================================

export const colors = {
  // Primary Colors - 하늘과 바다, 자유로운 여행
  primary: {
    50: '#EFF6FF',    // 매우 연한 하늘
    100: '#DBEAFE',   // 연한 구름
    200: '#BFDBFE',   // 맑은 하늘
    300: '#93C5FD',   // 오후 하늘
    400: '#60A5FA',   // 선명한 하늘
    500: '#3B82F6',   // 메인 브랜드 (오션 블루)
    600: '#2563EB',   // 깊은 바다
    700: '#1D4ED8',   // 저녁 바다
    800: '#1E40AF',   // 밤 바다
    900: '#1E3A8A',   // 깊은 심해
  },

  // Secondary Colors - 여행지의 석양, 따뜻한 추억
  secondary: {
    50: '#FFF7ED',    // 새벽 하늘
    100: '#FFEDD5',   // 아침 노을
    200: '#FED7AA',   // 연한 석양
    300: '#FDBA74',   // 오렌지 하늘
    400: '#FB923C',   // 따뜻한 석양
    500: '#F59E0B',   // 메인 세컨더리 (석양 오렌지)
    600: '#EA580C',   // 짙은 석양
    700: '#C2410C',   // 저녁 노을
    800: '#9A3412',   // 밤 노을
    900: '#7C2D12',   // 깊은 밤
  },

  // Neutral Colors - 자연스러운 배경, 해변의 모래
  neutral: {
    0: '#FFFFFF',     // 순백
    50: '#FAFAF9',    // 밝은 모래
    100: '#F5F5F4',   // 모래
    200: '#E7E5E4',   // 회색 모래
    300: '#D6D3D1',   // 돌 섞인 모래
    400: '#A8A29E',   // 돌
    500: '#78716C',   // 중간 돌
    600: '#57534E',   // 어두운 돌
    700: '#44403C',   // 바위
    800: '#292524',   // 진한 바위
    900: '#1C1917',   // 검은 바위
  },

  // Semantic Colors
  success: {
    light: '#C6F6D5',
    main: '#48BB78',
    dark: '#2F855A',
  },
  warning: {
    light: '#FED7AA',
    main: '#F6AD55',
    dark: '#DD6B20',
  },
  error: {
    light: '#FED7D7',
    main: '#FC8181',
    dark: '#C53030',
  },
  info: {
    light: '#BEE3F8',
    main: '#4299E1',
    dark: '#2B6CB0',
  },

  // Travel-specific Colors
  travel: {
    ocean: '#0EA5E9',
    mountain: '#10B981',
    forest: '#059669',
    sunset: '#F59E0B',
    night: '#6366F1',
    adventure: '#EF4444',
    relax: '#8B5CF6',
  },

  // Accent Color - 활력과 설렘
  accent: '#FF8B94',  // Coral Pink
} as const;

// Dark Mode Colors - 밤 하늘과 별빛
export const darkColors = {
  background: {
    primary: '#0F172A',   // Deep Navy (밤 하늘)
    secondary: '#1E293B', // 어두운 바다
    tertiary: '#334155',  // 진한 구름
  },
  text: {
    primary: '#F1F5F9',   // 밝은 별빛
    secondary: '#CBD5E1', // 희미한 별빛
    tertiary: '#94A3B8',  // 먼 별빛
  },
  primary: '#60A5FA',     // 밝은 하늘 블루 (다크모드용)
  secondary: '#FB923C',   // 따뜻한 오렌지 (다크모드용)
  border: {
    light: '#334155',
    medium: '#475569',
    dark: '#64748B',
  },
} as const;

// ============================================================================
// TYPOGRAPHY SYSTEM v2.0
// ============================================================================

export const typography = {
  fontFamily: {
    primary: 'System',
    secondary: 'System',
    monospace: 'Courier New',
  },

  // Display (Hero sections, large titles)
  display: {
    large: {
      fontSize: 56,
      fontWeight: '700' as const,
      lineHeight: 64,
      letterSpacing: -1.5,
    },
    medium: {
      fontSize: 44,
      fontWeight: '700' as const,
      lineHeight: 52,
      letterSpacing: -1,
    },
    small: {
      fontSize: 36,
      fontWeight: '700' as const,
      lineHeight: 44,
      letterSpacing: -0.5,
    },
  },

  // Headings
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.25,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
    letterSpacing: 0,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: 0,
  },
  h5: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  h6: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: 0,
  },

  // Body text
  body: {
    large: {
      fontSize: 18,
      fontWeight: '400' as const,
      lineHeight: 28,
      letterSpacing: 0.15,
    },
    medium: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
      letterSpacing: 0.15,
    },
    small: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
  },

  // Special styles
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  overline: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 1.5,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  small: {
    fontSize: 12,
    fontWeight: 'normal' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
} as const;

// ============================================================================
// SPACING SYSTEM v2.0
// ============================================================================

export const spacing = {
  // Base scale (4px unit)
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,

  // Semantic spacing (기존 호환성 유지)
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,

  // Component-specific
  inset: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
  },
  stack: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  inline: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
} as const;

// ============================================================================
// BORDER RADIUS v2.0
// ============================================================================

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,

  // Component-specific
  button: 12,
  card: 16,
  input: 12,
  modal: 24,
  badge: 16,
  avatar: 9999,
  image: 16,
} as const;

// ============================================================================
// SHADOWS & ELEVATION v2.0
// ============================================================================

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 12,
  },

  // Colored shadows (for brand elements)
  primary: {
    shadowColor: '#3B82F6',  // Ocean Blue shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  secondary: {
    shadowColor: '#F59E0B',  // Sunset Orange shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

// ============================================================================
// LAYOUT SYSTEM
// ============================================================================

export const layout = {
  // Screen padding
  screenPadding: {
    horizontal: 16,
    vertical: 16,
  },

  // Card dimensions
  card: {
    minHeight: 120,
    borderRadius: 16,
    padding: 16,
  },

  // Touch targets (WCAG compliance)
  touchTarget: {
    min: 44,
    recommended: 48,
    comfortable: 56,
  },

  // Grid
  grid: {
    columns: 12,
    gutter: 16,
    margin: 16,
  },

  // Breakpoints (for responsive design)
  breakpoints: {
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1400,
  },
} as const;

// ============================================================================
// ANIMATION SYSTEM
// ============================================================================

export const animation = {
  // Duration (in milliseconds)
  duration: {
    instant: 0,
    fast: 150,
    normal: 300,
    slow: 500,
    verySlow: 800,

    // Component-specific
    button: 150,
    modal: 300,
    drawer: 300,
    toast: 200,
    skeleton: 1500,
    pageTransition: 400,
  },

  // Easing curves
  easing: {
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',

    // Material Design curves
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  },

  // Spring presets (for React Native Animated)
  spring: {
    default: {
      friction: 8,
      tension: 40,
    },
    gentle: {
      friction: 10,
      tension: 30,
    },
    bouncy: {
      friction: 5,
      tension: 50,
    },
  },
} as const;

// ============================================================================
// LEGACY THEME (기존 코드 호환성)
// ============================================================================

export const theme = {
  colors: {
    // Primary - 기존 코드 호환성
    primary: colors.primary[500],
    primaryLight: colors.primary[100],
    primaryDark: colors.primary[700],

    // Secondary - 기존 코드 호환성
    secondary: colors.secondary[400],
    secondaryLight: colors.secondary[100],
    secondaryDark: colors.secondary[500],

    // Accent
    accent: colors.accent,

    // Neutral - 기존 코드 호환성
    background: colors.neutral[50],
    surface: colors.neutral[0],
    card: colors.neutral[0],
    text: colors.neutral[700],
    textSecondary: colors.neutral[500],
    textTertiary: colors.neutral[500],
    white: colors.neutral[0],

    // Status Colors - 기존 코드 호환성
    success: colors.success.main,
    warning: colors.warning.main,
    error: colors.error.main,

    // Borders
    border: colors.neutral[200],
  },

  spacing,
  borderRadius,
  typography,
  shadows,
} as const;

// ============================================================================
// THEME v2.0 (새로운 디자인 시스템)
// ============================================================================

export const themeV2 = {
  colors,
  darkColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
  animation,
} as const;

// ============================================================================
// TYPES
// ============================================================================

export type Theme = typeof theme;
export type ThemeV2 = typeof themeV2;
export type ColorPalette = typeof colors;
export type DarkColorPalette = typeof darkColors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Shadows = typeof shadows;
export type Layout = typeof layout;
export type Animation = typeof animation;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get color with opacity
 * @example getColorWithOpacity(colors.primary[500], 0.5) => 'rgba(255, 107, 107, 0.5)'
 */
export const getColorWithOpacity = (color: string, opacity: number): string => {
  // Convert hex to rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Get responsive value based on screen width
 */
export const getResponsiveValue = <T,>(
  values: { xs?: T; sm?: T; md?: T; lg?: T; xl?: T },
  screenWidth: number
): T | undefined => {
  if (screenWidth >= layout.breakpoints.xl && values.xl) return values.xl;
  if (screenWidth >= layout.breakpoints.lg && values.lg) return values.lg;
  if (screenWidth >= layout.breakpoints.md && values.md) return values.md;
  if (screenWidth >= layout.breakpoints.sm && values.sm) return values.sm;
  return values.xs;
};

/**
 * Calculate contrast ratio between two colors
 * Used for accessibility (WCAG 2.1)
 */
export const calculateContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (hex: string): number => {
    const rgb = hex.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)) || [0, 0, 0];
    const [r, g, b] = rgb.map(val => {
      const sRGB = val / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
};

// ============================================================================
// EXPORTS
// ============================================================================

export default theme;
