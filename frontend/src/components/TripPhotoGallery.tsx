import React, { memo, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';
import { Trip } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 56) / 4;

interface Props {
  trip: Trip;
}

const TripPhotoGallery: React.FC<Props> = memo(({ trip }) => {
  const { t } = useTranslation('trips');
  const { isDark } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const allPhotos = useMemo(() => {
    const photos: { url: string; day: number; title: string }[] = [];
    for (const itinerary of trip.itineraries) {
      for (const activity of itinerary.activities) {
        if (activity.photos && activity.photos.length > 0) {
          for (const url of activity.photos) {
            photos.push({
              url,
              day: itinerary.dayNumber,
              title: activity.title,
            });
          }
        }
      }
    }
    return photos;
  }, [trip.itineraries]);

  const handleClose = useCallback(() => setSelectedIndex(null), []);
  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);
  const handleNext = useCallback(() => {
    setSelectedIndex((prev) =>
      prev !== null && prev < allPhotos.length - 1 ? prev + 1 : prev
    );
  }, [allPhotos.length]);

  if (allPhotos.length === 0) return null;

  const selected = selectedIndex !== null ? allPhotos[selectedIndex] : null;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.header}>
        <Icon name="image-multiple" size={20} color={colors.primary[500]} />
        <Text style={[styles.title, isDark && styles.textDark]}>
          {t('detail.photos.photoCount', { count: allPhotos.length })}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {allPhotos.map((photo, index) => (
          <TouchableOpacity
            key={`${photo.url}-${index}`}
            onPress={() => setSelectedIndex(index)}
            activeOpacity={0.8}
            accessibilityLabel={`${photo.title}, Day ${photo.day}`}
            accessibilityRole="imagebutton"
          >
            <Image source={{ uri: photo.url }} style={styles.thumb} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Fullscreen Viewer */}
      <Modal
        visible={selectedIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalBackdrop}>
          {/* Close */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityLabel={t('common:close')}
            accessibilityRole="button"
          >
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Image */}
          {selected && (
            <Image
              source={{ uri: selected.url }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}

          {/* Caption */}
          {selected && (
            <View style={styles.caption}>
              <Text style={styles.captionText}>
                Day {selected.day} — {selected.title}
              </Text>
              <Text style={styles.captionCounter}>
                {(selectedIndex ?? 0) + 1} / {allPhotos.length}
              </Text>
            </View>
          )}

          {/* Nav arrows */}
          {selectedIndex !== null && selectedIndex > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.navLeft]}
              onPress={handlePrev}
              accessibilityRole="button"
            >
              <Icon name="chevron-left" size={36} color="#fff" />
            </TouchableOpacity>
          )}
          {selectedIndex !== null && selectedIndex < allPhotos.length - 1 && (
            <TouchableOpacity
              style={[styles.navButton, styles.navRight]}
              onPress={handleNext}
              accessibilityRole="button"
            >
              <Icon name="chevron-right" size={36} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
});

TripPhotoGallery.displayName = 'TripPhotoGallery';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } as any,
    }),
  },
  containerDark: {
    backgroundColor: colors.neutral[800],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  textDark: {
    color: colors.neutral[100],
  },
  scrollContent: {
    gap: 8,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    backgroundColor: colors.neutral[200],
  },
  // Fullscreen modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
    borderRadius: 8,
  },
  caption: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : 32,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  captionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  captionCounter: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
  navLeft: {
    left: 12,
  },
  navRight: {
    right: 12,
  },
});

export default TripPhotoGallery;
