import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { ProfileStackParamList, AnnouncementAdmin } from '../../types';
import apiService from '../../services/api';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AnnouncementManagement'>;

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

const AnnouncementManagementScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation('admin');
  const { theme } = useTheme();
  const [announcements, setAnnouncements] = useState<AnnouncementAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAnnouncements = useCallback(async (p = 1) => {
    try {
      setIsLoading(true);
      const data = await apiService.getAdminAnnouncements({ page: p, limit: 20 });
      setAnnouncements(p === 1 ? data.items : [...announcements, ...data.items]);
      setTotalPages(data.totalPages);
      setPage(p);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAnnouncements(1); }, [fetchAnnouncements]));

  const handleDelete = (id: string) => {
    Alert.alert(
      t('announcements.deleteConfirm'),
      t('announcements.deleteMessage'),
      [
        { text: t('announcements.cancel'), style: 'cancel' },
        {
          text: t('announcements.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteAnnouncement(id);
              fetchAnnouncements(1);
            } catch {
              Alert.alert('Error', 'Failed to delete announcement');
            }
          },
        },
      ],
    );
  };

  const handleTogglePublish = async (item: AnnouncementAdmin) => {
    try {
      if (item.isPublished) {
        await apiService.unpublishAnnouncement(item.id);
      } else {
        await apiService.publishAnnouncement(item.id);
      }
      fetchAnnouncements(1);
    } catch {
      Alert.alert('Error', 'Failed to update announcement');
    }
  };

  const lang = i18n.language;

  const renderItem = ({ item }: { item: AnnouncementAdmin }) => {
    const title = item.title[lang] || item.title['en'] || Object.values(item.title)[0] || '';
    const color = TYPE_COLORS[item.type] || '#6B7280';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.colors.white }]}
        onPress={() => navigation.navigate('AnnouncementForm', { announcementId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: color + '15' }]}>
            <Icon name={(TYPE_ICONS[item.type] || 'bell') as any} size={20} color={color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: item.isPublished ? '#10B98120' : '#6B728020' }]}>
                <Text style={{ fontSize: 11, color: item.isPublished ? '#10B981' : '#6B7280' }}>
                  {item.isPublished ? t('announcements.published') : t('announcements.draft')}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: color + '15' }]}>
                <Text style={{ fontSize: 11, color }}>{t(`announcements.types.${item.type}`)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => handleTogglePublish(item)} style={styles.actionBtn}>
            <Icon
              name={item.isPublished ? 'eye-off' : 'eye'}
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
            <Icon name="delete-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => fetchAnnouncements(1)} />
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
        onEndReached={() => {
          if (page < totalPages && !isLoading) fetchAnnouncements(page + 1);
        }}
        onEndReachedThreshold={0.3}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('AnnouncementForm', {})}
        activeOpacity={0.8}
      >
        <Icon name="plus" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 80 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default AnnouncementManagementScreen;
