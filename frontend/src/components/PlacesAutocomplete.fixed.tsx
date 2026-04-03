/**
 * PlacesAutocomplete - Complete Rewrite with Uncontrolled Pattern
 *
 * This version uses an uncontrolled component pattern internally
 * to completely avoid race conditions and state synchronization issues.
 *
 * FIXES:
 * - No more race conditions between typing and selection
 * - Clean separation of internal and external state
 * - Imperative handle for external control
 * - Robust error handling
 */

import React, {
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { theme } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlacesAutocompleteRef {
  setValue: (value: string) => void;
  getValue: () => string;
  clear: () => void;
  focus: () => void;
}

interface PlacesAutocompleteProps {
  placeholder?: string;
  style?: any;
  onSelect?: (place: PlacePrediction) => void;
  onChangeText?: (text: string) => void;
  initialValue?: string;
}

export const PlacesAutocomplete = forwardRef<
  PlacesAutocompleteRef,
  PlacesAutocompleteProps
>((props, ref) => {
  const {
    placeholder = 'Search location...',
    style,
    onSelect,
    onChangeText,
    initialValue = '',
  } = props;

  const { t } = useTranslation();

  // Internal state - completely independent from props
  const [internalValue, setInternalValue] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);

  // Refs for internal management
  const inputRef = useRef<TextInput>(null);
  const sessionToken = useRef<string>(generateSessionToken());
  const searchTimer = useRef<NodeJS.Timeout>();
  const isSelecting = useRef(false);
  const lastSearchQuery = useRef<string>('');

  // Generate session token
  function generateSessionToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    setValue: (value: string) => {
      setInternalValue(value);
      if (inputRef.current) {
        inputRef.current.setNativeProps({ text: value });
      }
    },
    getValue: () => internalValue,
    clear: () => {
      setInternalValue('');
      if (inputRef.current) {
        inputRef.current.clear();
      }
    },
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  // Search for places
  const searchPlaces = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    // Skip if same as last search
    if (query === lastSearchQuery.current) {
      return;
    }

    lastSearchQuery.current = query;
    setLoading(true);

    try {
      console.log('[PlacesAutocomplete] Searching for:', query);
      const response = await apiService.searchPlaces({
        input: query,
        sessiontoken: sessionToken.current,
      });

      if (response.predictions) {
        setPredictions(response.predictions);
        setShowDropdown(true);
      } else {
        setPredictions([]);
        setShowDropdown(false);
      }
    } catch (error) {
      console.error('[PlacesAutocomplete] Search error:', error);
      setApiAvailable(false);
      setPredictions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle text input changes
  const handleTextChange = useCallback((text: string) => {
    // If we're in the middle of selecting, ignore changes
    if (isSelecting.current) {
      return;
    }

    // Update internal value
    setInternalValue(text);

    // Notify parent if needed
    if (onChangeText) {
      onChangeText(text);
    }

    // Clear existing timer
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    // Set new timer for search
    searchTimer.current = setTimeout(() => {
      searchPlaces(text);
    }, 300);
  }, [onChangeText, searchPlaces]);

  // Handle place selection
  const handleSelectPlace = useCallback((place: PlacePrediction) => {
    console.log('[PlacesAutocomplete] Selected:', place.description);

    // Set flag to prevent race conditions
    isSelecting.current = true;

    // Update internal value
    setInternalValue(place.description);

    // Update native input directly
    if (inputRef.current) {
      inputRef.current.setNativeProps({ text: place.description });
    }

    // Clear predictions and hide dropdown
    setPredictions([]);
    setShowDropdown(false);

    // Reset session token
    sessionToken.current = generateSessionToken();
    lastSearchQuery.current = place.description;

    // Notify parent
    if (onSelect) {
      onSelect(place);
    } else if (onChangeText) {
      // Fallback to onChangeText if no onSelect
      onChangeText(place.description);
    }

    // Clear selecting flag after a delay
    setTimeout(() => {
      isSelecting.current = false;
    }, 500);
  }, [onSelect, onChangeText]);

  // Handle focus
  const handleFocus = useCallback(() => {
    if (predictions.length > 0 && !isSelecting.current) {
      setShowDropdown(true);
    }
  }, [predictions]);

  // Handle blur
  const handleBlur = useCallback(() => {
    // Delay to allow tap on dropdown
    setTimeout(() => {
      if (!isSelecting.current) {
        setShowDropdown(false);
      }
    }, 200);
  }, []);

  // Update internal value if initialValue changes
  useEffect(() => {
    if (initialValue !== internalValue && !isSelecting.current) {
      setInternalValue(initialValue);
      if (inputRef.current) {
        inputRef.current.setNativeProps({ text: initialValue });
      }
    }
  }, [initialValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, []);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputRow}>
        <Icon name="map-marker" size={20} color={theme.colors.primary} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          defaultValue={initialValue}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="default"
        />
        {loading && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
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
                onPress={() => handleSelectPlace(item)}
                activeOpacity={0.7}
              >
                <Icon
                  name="map-marker-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                />
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

      {!apiAvailable && internalValue.length >= 3 && !loading && (
        <View style={styles.fallbackContainer}>
          <Icon
            name="map-marker-off"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.fallbackText}>
            {t('components.placesAutocomplete.apiUnavailable')}
          </Text>
        </View>
      )}
    </View>
  );
});

PlacesAutocomplete.displayName = 'PlacesAutocomplete';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
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
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
      },
    }),
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: theme.spacing.xs,
    maxHeight: 200,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      } as any,
    }),
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownTextContainer: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  mainText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  secondaryText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  fallbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  fallbackText: {
    marginLeft: theme.spacing.xs,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});