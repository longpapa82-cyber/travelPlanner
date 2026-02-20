import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SectionProps, SectionPadding, SectionSpacing } from './Section.types';
import { useTheme } from '../../../contexts/ThemeContext';

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  children,
  padding = 'md',
  spacing = 'md',
  action,
  backgroundColor,
  rounded = false,
  elevated = false,
  style,
  contentStyle,
}) => {
  const { isDark, theme } = useTheme();

  const getPadding = (size: SectionPadding): number => {
    switch (size) {
      case 'none':
        return 0;
      case 'sm':
        return theme.spacing.sm;
      case 'md':
        return theme.spacing.md;
      case 'lg':
        return theme.spacing.lg;
      default:
        return theme.spacing.md;
    }
  };

  const getSpacing = (size: SectionSpacing): number => {
    switch (size) {
      case 'none':
        return 0;
      case 'sm':
        return theme.spacing.sm;
      case 'md':
        return theme.spacing.md;
      case 'lg':
        return theme.spacing.lg;
      default:
        return theme.spacing.md;
    }
  };

  const styles = StyleSheet.create({
    container: {
      padding: getPadding(padding),
      backgroundColor:
        backgroundColor ||
        (isDark ? theme.colors.background : theme.colors.white),
      borderRadius: rounded ? theme.borderRadius.lg : 0,
      ...(elevated ? theme.shadows.md : {}),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: title || description ? getSpacing(spacing) : 0,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: theme.typography.h3.fontWeight as any,
      color: isDark ? theme.colors.text : theme.colors.text,
      marginBottom: description ? theme.spacing.xs : 0,
    },
    description: {
      fontSize: theme.typography.body.small.fontSize,
      fontWeight: theme.typography.body.small.fontWeight as any,
      color: theme.colors.textSecondary,
    },
    content: {},
  });

  return (
    <View style={[styles.container, style]}>
      {(title || description || action) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title && <Text style={styles.title}>{title}</Text>}
            {description && <Text style={styles.description}>{description}</Text>}
          </View>
          {action}
        </View>
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
};
