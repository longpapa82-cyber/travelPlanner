import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  FlatList,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { Announcement } from '../types';
import apiService from '../services/api';
import { colors } from '../constants/theme';

const TYPE_CONFIG: Record<string, { icon: string; gradient: [string, string] }> = {
  system: { icon: 'bell-ring-outline', gradient: ['#6366F1', '#818CF8'] },
  feature: { icon: 'rocket-launch-outline', gradient: [colors.primary[500], '#60A5FA'] },
  important: { icon: 'alert-circle-outline', gradient: ['#EF4444', '#F87171'] },
  promotional: { icon: 'gift-outline', gradient: ['#F59E0B', '#FBBF24'] },
};

const WEB_MAX_WIDTH = 600;
const WEB_DESKTOP_BREAKPOINT = 768;

const AnnouncementBanner: React.FC = () => {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // On web desktop, constrain card width to max-width container
  const isWebDesktop = Platform.OS === 'web' && screenWidth >= WEB_DESKTOP_BREAKPOINT;
  const effectiveWidth = isWebDesktop ? Math.min(screenWidth, WEB_MAX_WIDTH) : screenWidth;
  const cardWidth = effectiveWidth - 32; // 16px margin each side

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const data = await apiService.getAnnouncements();
      const list = Array.isArray(data) ? data : [];
      // Show unread, non-dismissed announcements (exclude notification_only)
      const visible = list.filter(
        (a: Announcement) =>
          a.displayType !== 'notification_only' &&
          !a.isDismissed,
      );
      if (visible.length > 0) {
        setAnnouncements(visible);
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 60,
            friction: 12,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch {
      // silent
    }
  };

  const handlePress = useCallback((item: Announcement) => {
    apiService.markAnnouncementRead(item.id).catch(() => {});
    navigation.navigate('AnnouncementDetail', { announcementId: item.id });
  }, [navigation]);

  const handleDismiss = useCallback((item: Announcement) => {
    apiService.dismissAnnouncement(item.id).catch(() => {});
    setAnnouncements(prev => {
      const next = prev.filter(a => a.id !== item.id);
      if (next.length === 0) {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
      return next;
    });
  }, [fadeAnim]);

  const handleViewAll = useCallback(() => {
    navigation.navigate('AnnouncementList');
  }, [navigation]);

  if (announcements.length === 0) return null;

  const renderCard = ({ item }: { item: Announcement }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
    const [gradStart, gradEnd] = config.gradient;

    return (
      <TouchableOpacity
        style={[styles.card, { width: cardWidth }]}
        onPress={() => handlePress(item)}
        activeOpacity={0.85}
      >
        {/* Gradient-like background using two overlaid views */}
        <View style={[styles.cardBg, { backgroundColor: gradStart }]}>
          <View style={[styles.cardBgOverlay, { backgroundColor: gradEnd }]} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardLeft}>
            <View style={styles.iconCircle}>
              <Icon name={config.icon as any} size={22} color="#FFF" />
            </View>
            <View style={styles.textContainer}>
              <View style={styles.titleRow}>
                {!item.isRead && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                )}
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              <Text style={styles.cardPreview} numberOfLines={2}>
                {item.content}
              </Text>
            </View>
          </View>

          {/* Dismiss button */}
          <TouchableOpacity
            onPress={() => handleDismiss(item)}
            style={styles.dismissBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* CTA arrow */}
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>{t('announcement.readMore')}</Text>
          <Icon name="chevron-right" size={16} color="rgba(255,255,255,0.8)" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {announcements.length === 1 ? (
        renderCard({ item: announcements[0] })
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={announcements}
            renderItem={renderCard}
            keyExtractor={item => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 0 }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
              setCurrentIndex(idx);
            }}
            scrollEventThrottle={16}
          />
          {/* Page dots */}
          <View style={styles.dotsRow}>
            {announcements.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    backgroundColor: idx === currentIndex
                      ? colors.primary[500]
                      : theme.colors.border,
                    width: idx === currentIndex ? 16 : 6,
                  },
                ]}
              />
            ))}
            {announcements.length > 1 && (
              <TouchableOpacity onPress={handleViewAll} style={styles.viewAllBtn}>
                <Text style={[styles.viewAllText, { color: theme.colors.textSecondary }]}>
                  {t('announcement.viewAll')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 3px 8px rgba(0,0,0,0.15)' },
    }),
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  cardBgOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '60%',
    borderTopLeftRadius: 100,
    opacity: 0.5,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  newBadge: {
    backgroundColor: '#FFF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  cardPreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  dismissBtn: {
    padding: 4,
    marginLeft: 4,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 2,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  viewAllBtn: {
    marginLeft: 12,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default AnnouncementBanner;
