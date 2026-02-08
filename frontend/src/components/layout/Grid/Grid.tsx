import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GridProps, GridGap } from './Grid.types';
import { theme } from '../../../constants/theme';

export const Grid: React.FC<GridProps> = ({
  columns = 2,
  gap = 'md',
  children,
  style,
  itemStyle,
}) => {
  const getGapSize = (gap: GridGap): number => {
    switch (gap) {
      case 'none':
        return 0;
      case 'xs':
        return theme.spacing.xs;
      case 'sm':
        return theme.spacing.sm;
      case 'md':
        return theme.spacing.md;
      case 'lg':
        return theme.spacing.lg;
      case 'xl':
        return theme.spacing.xl;
      default:
        return theme.spacing.md;
    }
  };

  const gapSize = getGapSize(gap);

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -gapSize / 2,
    },
    item: {
      width: `${100 / columns}%` as any,
      paddingHorizontal: gapSize / 2,
      marginBottom: gapSize,
    },
  });

  const childrenArray = React.Children.toArray(children);

  return (
    <View style={[styles.container, style]}>
      {childrenArray.map((child, index) => (
        <View key={index} style={[styles.item, itemStyle]}>
          {child}
        </View>
      ))}
    </View>
  );
};
