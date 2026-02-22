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

  // Refresh session token periodically (every 3 minutes like Google recommends)
  useEffect(() => {
    const interval = setInterval(() => {
      sessionToken.current = generateSessionToken();
    }, 180_000);
    return () => clearInterval(interval);
  }, []);

  const searchPlaces = useCallback(async (input: string) => {
    if (input.trim().length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    try {
      setLoading(true);
      const result = await apiService.placesAutocomplete(
        input,
        sessionToken.current,
        getCurrentLanguage(),
      );

      if (!result.available) {
        setApiAvailable(false);
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      setPredictions(result.predictions);
      setShowDropdown(result.predictions.length > 0);
    } catch {
      // Silently fail — user can still type manually
      setPredictions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    onChangeText(text);

    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    if (!apiAvailable) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => searchPlaces(text), 350);
  };

  const handleSelect = (place: PlacePrediction) => {
    skipNextSearch.current = true;
    onChangeText(place.description);
    setPredictions([]);
    setShowDropdown(false);
    sessionToken.current = generateSessionToken(); // New session after selection
    onSelect?.(place);
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
    </View>
  );
};

function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
});
