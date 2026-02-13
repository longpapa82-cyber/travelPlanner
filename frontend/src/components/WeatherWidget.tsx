/**
 * WeatherWidget - 날씨 & 시차 정보 표시 컴포넌트
 *
 * 기능:
 * - 날씨 아이콘 및 온도 표시
 * - 습도, 풍속 등 상세 정보
 * - 시차 정보 표시
 * - 다크모드 지원
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';
import { Weather } from '../types';

interface WeatherWidgetProps {
  weather: Weather | null;
  timezone?: string | null;
  timezoneOffset?: number | null;
  date?: string;
  compact?: boolean;
}

// 날씨 상태에 따른 아이콘 매핑
const getWeatherIcon = (condition: string | undefined | null): string => {
  if (!condition) return 'weather-partly-cloudy';
  const conditionLower = condition.toLowerCase();

  if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
    return 'weather-sunny';
  } else if (conditionLower.includes('cloud')) {
    return 'weather-cloudy';
  } else if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
    return 'weather-rainy';
  } else if (conditionLower.includes('snow')) {
    return 'weather-snowy';
  } else if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
    return 'weather-lightning';
  } else if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
    return 'weather-fog';
  } else if (conditionLower.includes('wind')) {
    return 'weather-windy';
  }

  return 'weather-partly-cloudy';
};

// 날씨 상태에 따른 색상
const getWeatherColor = (condition: string | undefined | null): string => {
  if (!condition) return colors.primary[500];
  const conditionLower = condition.toLowerCase();

  if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
    return colors.warning.main; // 주황색 (맑음)
  } else if (conditionLower.includes('rain') || conditionLower.includes('storm')) {
    return colors.primary[400]; // 파란색 (비)
  } else if (conditionLower.includes('snow')) {
    return colors.primary[200]; // 연한 파란색 (눈)
  } else if (conditionLower.includes('cloud')) {
    return colors.neutral[500]; // 회색 (흐림)
  }

  return colors.primary[500];
};

// 시차 포맷팅
const formatTimezoneOffset = (offset: number): string => {
  const sign = offset >= 0 ? '+' : '';
  return `UTC${sign}${offset}`;
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = React.memo(({
  weather,
  timezone,
  timezoneOffset,
  date,
  compact = false,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('components');
  const styles = createStyles(theme, isDark);

  if (!weather && !timezone) {
    return null;
  }

  // Backend uses "condition"/"temperature", frontend type has "main"/"temp" — support both
  const weatherCondition = weather?.main || weather?.condition;
  const weatherTemp = weather?.temp ?? weather?.temperature;
  const weatherIcon = weather ? getWeatherIcon(weatherCondition) : 'help-circle-outline';
  const weatherColor = weather ? getWeatherColor(weatherCondition) : colors.neutral[500];

  if (compact) {
    // 컴팩트 모드: 한 줄로 날씨와 시차 표시
    return (
      <View style={styles.compactContainer}>
        {weather && (
          <View style={styles.compactItem}>
            <Icon name={weatherIcon} size={16} color={weatherColor} />
            <Text style={styles.compactText}>{Math.round(weatherTemp ?? 0)}°C</Text>
          </View>
        )}
        {timezoneOffset !== null && timezoneOffset !== undefined && (
          <View style={styles.compactItem}>
            <Icon name="clock-outline" size={16} color={colors.primary[400]} />
            <Text style={styles.compactText}>{formatTimezoneOffset(timezoneOffset)}</Text>
          </View>
        )}
      </View>
    );
  }

  // 풀 모드: 상세 정보 표시
  return (
    <View style={styles.container}>
      {/* 날씨 정보 */}
      {weather && (
        <View style={styles.weatherSection}>
          <View style={styles.weatherHeader}>
            <Icon name={weatherIcon} size={40} color={weatherColor} />
            <View style={styles.weatherInfo}>
              <Text style={styles.temperature}>{Math.round(weatherTemp ?? 0)}°C</Text>
              <Text style={styles.condition}>{weather.description || weatherCondition || ''}</Text>
            </View>
          </View>

          {/* 상세 정보 */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Icon name="water-percent" size={18} color={colors.primary[400]} />
              <Text style={styles.detailText}>{t('weatherWidget.humidity')} {weather.humidity}%</Text>
            </View>
            {weather.windSpeed !== undefined && weather.windSpeed > 0 && (
              <View style={styles.detailItem}>
                <Icon name="weather-windy" size={18} color={colors.primary[400]} />
                <Text style={styles.detailText}>{t('weatherWidget.windSpeed')} {weather.windSpeed.toFixed(1)}m/s</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 시차 정보 */}
      {(timezone || timezoneOffset !== null) && (
        <View style={styles.timezoneSection}>
          <View style={styles.timezoneRow}>
            <Icon name="clock-time-four-outline" size={20} color={colors.primary[500]} />
            <View style={styles.timezoneInfo}>
              {timezone && <Text style={styles.timezone}>{timezone}</Text>}
              {timezoneOffset !== null && timezoneOffset !== undefined && (
                <Text style={styles.timezoneOffset}>
                  {formatTimezoneOffset(timezoneOffset)}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  // 컴팩트 모드
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  compactText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  // 풀 모드
  container: {
    backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
  },

  // 날씨 섹션
  weatherSection: {
    marginBottom: theme.spacing.sm,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  weatherInfo: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  temperature: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  condition: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  detailText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  // 시차 섹션
  timezoneSection: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
  },
  timezoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timezoneInfo: {
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  timezone: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  timezoneOffset: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
});

WeatherWidget.displayName = 'WeatherWidget';
export default WeatherWidget;
