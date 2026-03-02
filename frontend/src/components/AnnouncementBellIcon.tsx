import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import apiService from '../services/api';

interface Props {
  tintColor?: string;
}

const AnnouncementBellIcon: React.FC<Props> = ({ tintColor = '#FFF' }) => {
  const navigation = useNavigation<any>();
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const fetchCount = async () => {
        try {
          const data = await apiService.getAnnouncementUnreadCount();
          setUnreadCount(data.count);
        } catch {
          // silent
        }
      };
      fetchCount();
      const interval = setInterval(fetchCount, 120000); // every 2 min
      return () => clearInterval(interval);
    }, []),
  );

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('AnnouncementList')}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Announcements${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
    >
      <Icon name="bullhorn-outline" size={22} color={tintColor} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 6,
    marginRight: 4,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default AnnouncementBellIcon;
