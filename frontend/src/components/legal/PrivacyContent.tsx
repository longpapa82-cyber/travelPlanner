import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const ARTICLE_KEYS = [
  'art1', 'art2', 'art3', 'art4', 'art5', 'art6',
  'art7', 'art8', 'art9', 'art10', 'art11', 'art12',
  'art13', 'art14',
] as const;

const PrivacyContent: React.FC = () => {
  const { t } = useTranslation('legal');
  const { isDark, theme } = useTheme();

  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(
    new Set(['art1']),
  );

  const toggleArticle = (key: string) => {
    setExpandedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const styles = createStyles(theme, isDark);

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="shield-check-outline" size={32} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('privacy.title')}
        </Text>
        <Text style={[styles.effectiveDate, { color: theme.colors.textSecondary }]}>
          {t('privacy.effectiveDate')}
        </Text>
      </View>

      {/* Articles */}
      <View style={styles.articlesContainer}>
        {ARTICLE_KEYS.map((key) => {
          const isExpanded = expandedArticles.has(key);
          return (
            <TouchableOpacity
              key={key}
              style={[styles.article, { borderBottomColor: theme.colors.border }]}
              onPress={() => toggleArticle(key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
              accessibilityLabel={t(`privacy.articles.${key}.title`)}
            >
              <View style={styles.articleHeader}>
                <Text
                  style={[
                    styles.articleTitle,
                    { color: isExpanded ? theme.colors.primary : theme.colors.text },
                  ]}
                >
                  {t(`privacy.articles.${key}.title`)}
                </Text>
                <Icon
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={theme.colors.textSecondary}
                />
              </View>
              {isExpanded && (
                <Text style={[styles.articleContent, { color: theme.colors.textSecondary }]}>
                  {t(`privacy.articles.${key}.content`)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </>
  );
};

const createStyles = (theme: any, _isDark: boolean) =>
  StyleSheet.create({
    header: {
      backgroundColor: theme.colors.white,
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 16,
      gap: 6,
      ...theme.shadows.sm,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      marginTop: 4,
    },
    effectiveDate: {
      fontSize: 13,
    },
    articlesContainer: {
      backgroundColor: theme.colors.white,
      marginTop: 12,
      ...theme.shadows.sm,
    },
    article: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    articleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    articleTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 22,
    },
    articleContent: {
      marginTop: 12,
      fontSize: 14,
      lineHeight: 22,
    },
  });

export default PrivacyContent;
