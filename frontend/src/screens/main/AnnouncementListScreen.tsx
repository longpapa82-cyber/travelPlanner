import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { Announcement } from '../../types';
import apiService from '../../services/api';

const TYPE_ICONS: Record<string, string> = {
  system: 'cog',
  feature: 'star-circle',
  important: 'alert-circle',
  promotional: 'tag',
};

const TYPE_COLORS: Record<string, string> = {
  system: '#6366F1',
  feature: '#3B82F6',
  important: '#EF4444',
  promotional: '#F59E0B',
};

const AnnouncementListScreen: React.FC = () => {
  const { t } = useTranslation('admin');
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getAnnouncements();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAnnouncements(); }, [fetchAnnouncements]));

  const handlePress = async (item: Announcement) => {
    if (!item.isRead) {
      try {
        await apiService.markAnnouncementRead(item.id);
      } catch {
        // silent
      }
    }
    navigation.navigate('AnnouncementDetail', { announcementId: item.id });
  };

  const renderItem = ({ item }: { item: Announcement }) => {
    const color = TYPE_COLORS[item.type] || '#6B7280';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: theme.colors.white },
          !item.isRead && styles.unreadCard,
        ]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.typeIcon, { backgroundColor: color + '15' }]}>
          <Icon name={(TYPE_ICONS[item.type] || 'bell') as any} size={22} color={color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text
              style={[
                styles.cardTitle,
                { color: theme.colors.text },
                !item.isRead && { fontWeight: '700' },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text
            style={[styles.cardPreview, { color: theme.colors.textSecondary }]}
            numberOfLines={2}
          >
            {item.content}
          </Text>
          <Text style={[styles.cardDate, { color: theme.colors.textSecondary }]}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={announcements.filter(a => !a.isDismissed)}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchAnnouncements} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Icon name="bullhorn-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {t('announcements.noAnnouncements')}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '500' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  cardPreview: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  cardDate: { fontSize: 12, marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },
});

export default AnnouncementListScreen;
