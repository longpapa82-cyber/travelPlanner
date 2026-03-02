import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Announcement } from '../types';
import apiService from '../services/api';

const TYPE_COLORS: Record<string, string> = {
  system: '#6366F1',
  feature: '#3B82F6',
  important: '#EF4444',
  promotional: '#F59E0B',
};

const AnnouncementBanner: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [banner, setBanner] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    fetchBanner();
  }, []);

  const fetchBanner = async () => {
    try {
      const announcements = await apiService.getAnnouncements();
      const list = Array.isArray(announcements) ? announcements : [];
      // Show the highest-priority unread banner-type announcement
      const bannerAnnouncement = list.find(
        (a: Announcement) =>
          a.displayType === 'banner' &&
          !a.isDismissed &&
          !a.isRead,
      );
      if (bannerAnnouncement) {
        setBanner(bannerAnnouncement);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } catch {
      // silent
    }
  };

  const handlePress = () => {
    if (banner) {
      apiService.markAnnouncementRead(banner.id).catch(() => {});
      navigation.navigate('AnnouncementDetail', { announcementId: banner.id });
    }
  };

  const handleDismiss = () => {
    if (banner) {
      apiService.dismissAnnouncement(banner.id).catch(() => {});
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setDismissed(true));
    }
  };

  if (!banner || dismissed) return null;

  const color = TYPE_COLORS[banner.type] || '#6366F1';

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: color + '10', borderLeftColor: color }]}>
      <TouchableOpacity style={styles.content} onPress={handlePress} activeOpacity={0.7}>
        <Icon name="bullhorn" size={18} color={color} style={styles.icon} />
        <View style={styles.textContent}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={[styles.preview, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {banner.content}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
        <Icon name="close" size={16} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
  },
  icon: { marginRight: 10 },
  textContent: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  preview: { fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 10 },
});

export default AnnouncementBanner;
