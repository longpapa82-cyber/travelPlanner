import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { ProfileStackParamList } from '../../types';
import { useToast } from '../../components/feedback/Toast/ToastContext';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Help'>;

interface FaqItem {
  key: string;
  q: string;
  a: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  gettingStarted: 'rocket-launch-outline',
  tripManagement: 'map-outline',
  accountSettings: 'account-cog-outline',
  offlineSync: 'cloud-sync-outline',
  adsPartners: 'cash-multiple',
  contact: 'email-outline',
};

const CATEGORY_KEYS = [
  'gettingStarted',
  'tripManagement',
  'accountSettings',
  'offlineSync',
  'adsPartners',
] as const;

const FAQ_ITEM_KEYS: Record<string, string[]> = {
  gettingStarted: ['signup', 'createTrip', 'aiPlan', 'appTour'],
  tripManagement: ['editPlan', 'tripStatus', 'mapView', 'weather'],
  accountSettings: ['editProfile', 'changePassword', 'twoFactor', 'notifications', 'deleteAccount'],
  offlineSync: ['offlineUse', 'syncStatus', 'syncError'],
  adsPartners: ['freeService', 'adInfo', 'affiliates'],
};

const HelpScreen: React.FC<Props> = () => {
  const { t } = useTranslation('legal');
  const { t: tCommon } = useTranslation('common');
  const { isDark, theme } = useTheme();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const allFaqItems = useMemo(() => {
    const items: (FaqItem & { category: string })[] = [];
    for (const category of CATEGORY_KEYS) {
      for (const itemKey of FAQ_ITEM_KEYS[category]) {
        items.push({
          key: `${category}.${itemKey}`,
          category,
          q: t(`help.${category}.${itemKey}.q`),
          a: t(`help.${category}.${itemKey}.a`),
        });
      }
    }
    return items;
  }, [t]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return allFaqItems.filter(
      (item) =>
        item.q.toLowerCase().includes(query) ||
        item.a.toLowerCase().includes(query),
    );
  }, [searchQuery, allFaqItems]);

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('TravelPlanner Support');
    const body = encodeURIComponent(
      `\n\n---\nDevice: ${Platform.OS} ${Platform.Version}\nApp Version: 1.0.0`,
    );
    Linking.openURL(
      `mailto:${t('help.contact.emailAddress')}?subject=${subject}&body=${body}`,
    ).catch(() => {
      showToast({ type: 'error', message: tCommon('error'), position: 'top' });
    });
  };

  const renderFaqItem = (item: FaqItem) => {
    const isExpanded = expandedItems.has(item.key);
    return (
      <TouchableOpacity
        key={item.key}
        style={[styles.faqItem, { borderBottomColor: theme.colors.border }]}
        onPress={() => toggleExpand(item.key)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={item.q}
      >
        <View style={styles.faqHeader}>
          <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>
            {item.q}
          </Text>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={theme.colors.textSecondary}
          />
        </View>
        {isExpanded && (
          <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }]}>
            {item.a}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const styles = createStyles(theme, isDark);

  return (
    <ScrollView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder={t('help.searchPlaceholder')}
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          accessibilityLabel={t('help.searchPlaceholder')}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results */}
      {filteredItems ? (
        <View style={styles.section}>
          {filteredItems.length > 0 ? (
            filteredItems.map(renderFaqItem)
          ) : (
            <View style={styles.emptySearch}>
              <Icon name="magnify-close" size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptySearchText, { color: theme.colors.textSecondary }]}>
                {tCommon('noResults')}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <>
          {/* FAQ Categories */}
          {CATEGORY_KEYS.map((category) => (
            <View key={category} style={styles.section}>
              <View style={styles.categoryHeader}>
                <Icon
                  name={CATEGORY_ICONS[category] as any}
                  size={22}
                  color={theme.colors.primary}
                />
                <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>
                  {t(`help.categories.${category}`)}
                </Text>
              </View>
              {FAQ_ITEM_KEYS[category].map((itemKey) =>
                renderFaqItem({
                  key: `${category}.${itemKey}`,
                  q: t(`help.${category}.${itemKey}.q`),
                  a: t(`help.${category}.${itemKey}.a`),
                }),
              )}
            </View>
          ))}

          {/* Contact Section */}
          <View style={styles.contactSection}>
            <Icon name="email-outline" size={28} color={theme.colors.primary} />
            <Text style={[styles.contactTitle, { color: theme.colors.text }]}>
              {t('help.contact.email')}
            </Text>
            <Text style={[styles.contactDescription, { color: theme.colors.textSecondary }]}>
              {t('help.contact.emailDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSendEmail}
              accessibilityRole="button"
              accessibilityLabel={t('help.contact.sendEmail')}
            >
              <Icon name="send-outline" size={20} color="#fff" />
              <Text style={styles.contactButtonText}>{t('help.contact.sendEmail')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      borderRadius: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      padding: 0,
    },
    section: {
      backgroundColor: theme.colors.white,
      marginBottom: 12,
      paddingVertical: 4,
      ...theme.shadows.sm,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
      gap: 10,
    },
    categoryTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    faqItem: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    faqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    faqQuestion: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 22,
    },
    faqAnswer: {
      marginTop: 10,
      fontSize: 14,
      lineHeight: 22,
    },
    emptySearch: {
      padding: 40,
      alignItems: 'center',
      gap: 12,
    },
    emptySearchText: {
      fontSize: 14,
    },
    contactSection: {
      backgroundColor: theme.colors.white,
      margin: 16,
      padding: 24,
      borderRadius: 16,
      alignItems: 'center',
      gap: 10,
      ...theme.shadows.sm,
    },
    contactTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    contactDescription: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    contactButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 6,
      gap: 8,
    },
    contactButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
  });

export default HelpScreen;
