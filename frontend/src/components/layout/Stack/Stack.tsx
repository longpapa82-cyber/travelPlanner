import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  StackProps,
  StackDirection,
  StackSpacing,
  StackAlign,
  StackJustify,
} from './Stack.types';
import { theme } from '../../../constants/theme';

export const Stack: React.FC<StackProps> = ({
  direction = 'vertical',
  spacing = 'md',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  children,
  style,
}) => {
  const getSpacing = (spacing: StackSpacing): number => {
    switch (spacing) {
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

  const getAlignItems = (align: StackAlign): any => {
    switch (align) {
      case 'start':
        return 'flex-start';
      case 'center':
        return 'center';
      case 'end':
        return 'flex-end';
      case 'stretch':
        return 'stretch';
      default:
        return 'stretch';
    }
  };

  const getJustifyContent = (justify: StackJustify): any => {
    switch (justify) {
      case 'start':
        return 'flex-start';
      case 'center':
        return 'center';
      case 'end':
        return 'flex-end';
      case 'space-between':
        return 'space-between';
      case 'space-around':
        return 'space-around';
      case 'space-evenly':
        return 'space-evenly';
      default:
        return 'flex-start';
    }
  };

  const spacingValue = getSpacing(spacing);
  const isVertical = direction === 'vertical';

  const styles = StyleSheet.create({
    container: {
      flexDirection: isVertical ? 'column' : 'row',
      alignItems: getAlignItems(align),
      justifyContent: getJustifyContent(justify),
      flexWrap: wrap ? 'wrap' : 'nowrap',
    },
    item: {
      ...(isVertical
        ? { marginBottom: spacingValue }
        : { marginRight: spacingValue }),
    },
    lastItem: {
      ...(isVertical ? { marginBottom: 0 } : { marginRight: 0 }),
    },
  });

  const childrenArray = React.Children.toArray(children);

  return (
    <View style={[styles.container, style]}>
      {childrenArray.map((child, index) => {
        const isLast = index === childrenArray.length - 1;
        return (
          <View key={index} style={[styles.item, isLast && styles.lastItem]}>
            {child}
          </View>
        );
      })}
    </View>
  );
};
