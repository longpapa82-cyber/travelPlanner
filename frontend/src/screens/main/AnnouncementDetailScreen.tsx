import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { RootStackParamList, Announcement } from '../../types';
import apiService from '../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'AnnouncementDetail'>;

const TYPE_COLORS: Record<string, string> = {
  system: '#6366F1',
  feature: '#3B82F6',
  important: '#EF4444',
  promotional: '#F59E0B',
};

const AnnouncementDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { announcementId } = route.params;
  const { t } = useTranslation('admin');
  const { theme } = useTheme();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnnouncement();
  }, [announcementId]);

  const loadAnnouncement = async () => {
    try {
      setIsLoading(true);
      const announcements = await apiService.getAnnouncements();
      const found = (Array.isArray(announcements) ? announcements : [])
        .find((a: Announcement) => a.id === announcementId);
      setAnnouncement(found || null);

      // Mark as read
      if (found && !found.isRead) {
        apiService.markAnnouncementRead(announcementId).catch(() => {});
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await apiService.dismissAnnouncement(announcementId);
      navigation.goBack();
    } catch {
      // silent
    }
  };

  const handleAction = () => {
    if (announcement?.actionUrl) {
      Linking.openURL(announcement.actionUrl).catch(() => {});
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!announcement) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Icon name="bullhorn-outline" size={48} color={theme.colors.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          {t('announcements.notFound')}
        </Text>
      </View>
    );
  }

  const color = TYPE_COLORS[announcement.type] || '#6B7280';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: color + '10' }]}>
        <View style={[styles.typeChip, { backgroundColor: color + '20' }]}>
          <Text style={[styles.typeText, { color }]}>
            {t(`announcements.types.${announcement.type}`)}
          </Text>
        </View>
        <Text style={[styles.date, { color: theme.colors.textSecondary }]}>
          {new Date(announcement.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Image */}
      {announcement.imageUrl && (
        <Image
          source={{ uri: announcement.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      {/* Title & Content */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {announcement.title}
        </Text>
        <Text style={[styles.contentText, { color: theme.colors.text }]}>
          {announcement.content}
        </Text>
      </View>

      {/* Action Button */}
      {announcement.actionUrl && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleAction}
        >
          <Text style={styles.actionButtonText}>
            {announcement.actionLabel || t('announcements.learnMore')}
          </Text>
          <Icon name="open-in-new" size={18} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Dismiss */}
      <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
        <Text style={[styles.dismissText, { color: theme.colors.textSecondary }]}>
          {t('announcements.dismiss')}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  typeChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  typeText: { fontSize: 13, fontWeight: '600' },
  date: { fontSize: 13 },
  image: { width: '100%', height: 200 },
  body: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, lineHeight: 30 },
  contentText: { fontSize: 15, lineHeight: 24 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  dismissText: { fontSize: 14 },
});

export default AnnouncementDetailScreen;
