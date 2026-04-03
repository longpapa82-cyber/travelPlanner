import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import apiService from '../services/api';
import { getCurrentLanguage } from '../i18n';

interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface PlacesAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect?: (place: PlacePrediction) => void;
  placeholder?: string;
  style?: any;
}

export const PlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({
  value,
  onChangeText,
  onSelect,
  placeholder,
  style,
}) => {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionToken = useRef(generateSessionToken());
  const skipNextSearch = useRef(false);
  // Track if we just made a selection to prevent input value conflicts
  const justSelected = useRef(false);

  // Refresh session token periodically (every 3 minutes like Google recommends)
  useEffect(() => {
    const interval = setInterval(() => {
      sessionToken.current = generateSessionToken();
    }, 180_000);
    return () => clearInterval(interval);
  }, []);

  const searchPlaces = useCallback(async (input: string) => {
    if (input.trim().length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    const language = getCurrentLanguage();

    // 1. Check local cache first
    const cached = await getCachedPlaces(input, language);
    if (cached) {
      setPredictions(cached);
      setShowDropdown(cached.length > 0);
      return;
    }

    // 2. Fetch from API
    try {
      setLoading(true);
      const result = await apiService.placesAutocomplete(
        input,
        sessionToken.current,
        language,
      );

      if (!result.available) {
        setApiAvailable(false);
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      setPredictions(result.predictions);
      setShowDropdown(result.predictions.length > 0);

      // 3. Save to cache
      if (result.predictions.length > 0) {
        await setCachedPlaces(input, language, result.predictions);
      }
    } catch {
      // Silently fail — user can still type manually
      setPredictions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    // CRITICAL FIX: Check both flags BEFORE calling onChangeText
    // This prevents the field from being reset when a selection is made
    if (skipNextSearch.current || justSelected.current) {
      if (skipNextSearch.current) {
        skipNextSearch.current = false;
      }
      return;
    }

    onChangeText(text);

    if (!apiAvailable) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => searchPlaces(text), 500);
  };

  const handleSelect = (place: PlacePrediction) => {
    // Set flags BEFORE any state updates to prevent race conditions
    skipNextSearch.current = true;
    justSelected.current = true;

    // Clear dropdown immediately
    setPredictions([]);
    setShowDropdown(false);
    sessionToken.current = generateSessionToken(); // New session after selection

    // CRITICAL FIX: Only call onSelect if provided, otherwise fall back to onChangeText
    // This prevents double state updates and ensures the selection is properly handled
    if (onSelect) {
      onSelect(place);
    } else {
      // Fallback for components that only use onChangeText
      onChangeText(place.description);
    }

    // Clear the justSelected flag after a short delay
    setTimeout(() => {
      justSelected.current = false;
    }, 100);
  };

  const handleBlur = () => {
    // Delay hiding to allow tap on dropdown item
    setTimeout(() => setShowDropdown(false), 200);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputRow}>
        <Icon name="map-marker" size={20} color={theme.colors.primary} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => {
            if (predictions.length > 0) setShowDropdown(true);
          }}
          onBlur={handleBlur}
        />
        {loading && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </View>

      {showDropdown && predictions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => handleSelect(item)}
              >
                <Icon name="map-marker-outline" size={16} color={theme.colors.textSecondary} />
                <View style={styles.dropdownTextContainer}>
                  <Text style={styles.mainText} numberOfLines={1}>
                    {item.mainText}
                  </Text>
                  {item.secondaryText ? (
                    <Text style={styles.secondaryText} numberOfLines={1}>
                      {item.secondaryText}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {!apiAvailable && value.length >= 3 && !loading && (
        <View style={styles.apiUnavailable}>
          <Text style={styles.apiUnavailableText}>
            위치 자동완성을 사용할 수 없습니다. 직접 입력해주세요.
          </Text>
        </View>
      )}
    </View>
  );
};

function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Local caching helpers
const CACHE_KEY = '@places_autocomplete_cache';
const MAX_CACHE_SIZE = 100;
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedPlace {
  query: string;
  language: string;
  predictions: PlacePrediction[];
  timestamp: number;
}

async function getCachedPlaces(query: string, language: string): Promise<PlacePrediction[] | null> {
  try {
    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    if (!cacheStr) return null;

    const cache: CachedPlace[] = JSON.parse(cacheStr);
    const normalizedQuery = query.trim().toLowerCase();

    // Find exact match
    const cached = cache.find(
      (item) =>
        item.query === normalizedQuery &&
        item.language === language &&
        Date.now() - item.timestamp < CACHE_EXPIRY_MS
    );

    return cached?.predictions || null;
  } catch {
    return null;
  }
}

async function setCachedPlaces(
  query: string,
  language: string,
  predictions: PlacePrediction[]
): Promise<void> {
  try {
    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    let cache: CachedPlace[] = cacheStr ? JSON.parse(cacheStr) : [];

    const normalizedQuery = query.trim().toLowerCase();

    // Remove existing entry for this query
    cache = cache.filter((item) => item.query !== normalizedQuery || item.language !== language);

    // Add new entry at the front (LRU)
    cache.unshift({
      query: normalizedQuery,
      language,
      predictions,
      timestamp: Date.now(),
    });

    // Keep only MAX_CACHE_SIZE items
    if (cache.length > MAX_CACHE_SIZE) {
      cache = cache.slice(0, MAX_CACHE_SIZE);
    }

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently fail — caching is optional
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.text,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  mainText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  secondaryText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  apiUnavailable: {
    marginTop: 4,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
  },
  apiUnavailableText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
});
