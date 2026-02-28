import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../constants/theme';

interface TargetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CoachMarkProps {
  visible: boolean;
  targetLayout: TargetLayout | null;
  message: string;
  position?: 'above' | 'below';
  onNext: () => void;
  onDismiss: () => void;
}

const SPOT_PADDING = 8;
const SPOT_RADIUS = 16;

const CoachMark: React.FC<CoachMarkProps> = ({
  visible,
  targetLayout,
  message,
  position = 'below',
  onNext,
  onDismiss,
}) => {
  const { t } = useTranslation('tutorial');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    if (visible && targetLayout) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, targetLayout]);

  if (!visible || !targetLayout) return null;

  const { x, y, width, height } = targetLayout;

  const spotX = x - SPOT_PADDING;
  const spotY = y - SPOT_PADDING;
  const spotW = width + SPOT_PADDING * 2;
  const spotH = height + SPOT_PADDING * 2;

  const tooltipStyle: any = { left: 16, right: 16 };
  if (position === 'below') {
    tooltipStyle.top = spotY + spotH + 16;
  } else {
    tooltipStyle.bottom = undefined;
    tooltipStyle.top = spotY - 16 - 120;
  }

  const arrowLeft = Math.min(
    Math.max(x + width / 2 - 24, 24),
    screenWidth - 40,
  );

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* 4-part overlay for spotlight effect */}
        <View style={[styles.overlay, { top: 0, left: 0, right: 0, height: spotY }]} />
        <View style={[styles.overlay, { top: spotY, left: 0, width: spotX, height: spotH }]} />
        <View style={[styles.overlay, { top: spotY, left: spotX + spotW, right: 0, height: spotH }]} />
        <View style={[styles.overlay, { top: spotY + spotH, left: 0, right: 0, bottom: 0 }]} />

        {/* Spotlight border */}
        <View
          style={[
            styles.spotlight,
            {
              top: spotY,
              left: spotX,
              width: spotW,
              height: spotH,
              borderRadius: SPOT_RADIUS,
            },
          ]}
        />

        {/* Tooltip */}
        <View style={[styles.tooltip, tooltipStyle]}>
          {position === 'below' && (
            <View style={[styles.arrow, styles.arrowUp, { left: arrowLeft - 16 }]} />
          )}

          <Text style={styles.tooltipText}>{message}</Text>

          <View style={styles.tooltipButtons}>
            <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>{t('coach.dismiss')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} style={styles.nextBtn}>
              <Text style={styles.nextText}>{t('coach.next')}</Text>
            </TouchableOpacity>
          </View>

          {position === 'above' && (
            <View style={[styles.arrow, styles.arrowDown, { left: arrowLeft - 16 }]} />
          )}
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  spotlight: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.primary[400],
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      },
    }),
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowUp: {
    top: -10,
    borderBottomWidth: 10,
    borderBottomColor: '#FFF',
  },
  arrowDown: {
    bottom: -10,
    borderTopWidth: 10,
    borderTopColor: '#FFF',
  },
  tooltipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 24,
    marginBottom: 16,
  },
  tooltipButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dismissBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  nextBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.primary[500],
    borderRadius: 20,
  },
  nextText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
});

export default CoachMark;
