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

const SPOT_PADDING = 12;
const SPOT_RADIUS = 16;
const TOOLTIP_GAP = 24;
const WEB_MAX_WIDTH = 600;
const WEB_DESKTOP_BREAKPOINT = 768;

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
  const [tooltipHeight, setTooltipHeight] = React.useState(0);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      fadeAnim.stopAnimation();
    };
  }, []);

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

  // On web desktop, content is centered in a 600px wrapper.
  // measureInWindow() returns viewport coords, but the tooltip should
  // be constrained within the centered container for proper alignment.
  const isWebDesktop = Platform.OS === 'web' && screenWidth >= WEB_DESKTOP_BREAKPOINT;
  const containerOffset = isWebDesktop ? Math.max((screenWidth - WEB_MAX_WIDTH) / 2, 0) : 0;
  const containerRight = isWebDesktop ? containerOffset + WEB_MAX_WIDTH : screenWidth;

  // Clamp spotlight within the visible container
  const clampedX = isWebDesktop ? Math.max(x, containerOffset) : x;
  const clampedW = isWebDesktop ? Math.min(width, containerRight - clampedX) : width;

  const spotX = clampedX - SPOT_PADDING;
  const spotY = y - SPOT_PADDING;
  const spotW = clampedW + SPOT_PADDING * 2;
  const spotH = height + SPOT_PADDING * 2;

  const tooltipLeft = isWebDesktop ? containerOffset + 16 : 16;
  const tooltipRight = isWebDesktop ? screenWidth - containerRight + 16 : 16;
  const tooltipStyle: any = { left: tooltipLeft, right: tooltipRight };
  if (position === 'below') {
    tooltipStyle.top = spotY + spotH + TOOLTIP_GAP;
  } else {
    // Use measured tooltip height for accurate positioning above the spotlight
    const effectiveHeight = tooltipHeight > 0 ? tooltipHeight : 120;
    tooltipStyle.top = spotY - TOOLTIP_GAP - effectiveHeight;
    // Prevent negative top (tooltip going off-screen)
    if (tooltipStyle.top < 16) tooltipStyle.top = 16;
  }

  const arrowLeft = Math.min(
    Math.max(clampedX + clampedW / 2 - tooltipLeft - 24, 8),
    (isWebDesktop ? WEB_MAX_WIDTH : screenWidth) - 56,
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      /*
       * V115 (V114-2a fix, 6회 회귀의 근본 원인):
       *
       * Android Modal은 기본적으로 새 Window 루트에서 렌더링되는데,
       * statusBarTranslucent=false 이면 Modal 내용이 status bar "아래"에서
       * 시작한다. 반면 createTripRef.measureInWindow()는 status bar 포함
       * 전체 window 기준 좌표를 리턴 — 결과적으로 Modal 안 spotlight가
       * 정확히 status bar 높이(24~40dp)만큼 위로 어긋나 보인다.
       *
       * 다른 Modal 계열 컴포넌트(Modal, ConfirmDialog, BottomSheet, Loading)는
       * 모두 이 prop을 설정하고 있으나 CoachMark에만 누락되어 있었음.
       * V107~V114 수정들은 전부 padding/timing만 건드렸고 좌표계 자체는
       * 건드린 적이 없어 매번 회귀했다.
       */
      statusBarTranslucent
    >
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
        <View
          style={[styles.tooltip, tooltipStyle]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== tooltipHeight) setTooltipHeight(h);
          }}
        >
          {position === 'below' && (
            <View style={[styles.arrow, styles.arrowUp, { left: arrowLeft - 16 }]} />
          )}

          <Text style={styles.tooltipText}>{message}</Text>

          {/* V115 (V114-2b fix): [건너뛰기] 버튼 제거. 사용자는 오버레이
           * 바깥을 탭하거나 [다음] 버튼으로 진행한다. onDismiss prop은
           * 부모가 여전히 사용(외부 dismiss)하지만 이 UI에서는 노출 안 함.
           */}
          <View style={styles.tooltipButtons}>
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
