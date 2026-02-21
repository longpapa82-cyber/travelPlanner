import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

interface PremiumBadgeProps {
  size?: 'small' | 'medium';
}

const PremiumBadge: React.FC<PremiumBadgeProps> = ({ size = 'small' }) => {
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, isSmall ? styles.badgeSmall : styles.badgeMedium]}>
      <Icon name="crown" size={isSmall ? 10 : 14} color="#FFF" />
      {!isSmall && <Text style={styles.text}>PRO</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    gap: 2,
  },
  badgeSmall: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  text: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default PremiumBadge;
