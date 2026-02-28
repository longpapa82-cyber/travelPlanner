import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Animated,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTutorial } from '../../contexts/TutorialContext';
import { colors } from '../../constants/theme';

interface Slide {
  id: string;
  icon: string;
  color: string;
  titleKey: string;
  descKey: string;
}

const SLIDES: Slide[] = [
  { id: '1', icon: 'robot', color: colors.primary[500], titleKey: 'welcome.slide1.title', descKey: 'welcome.slide1.description' },
  { id: '2', icon: 'account-group', color: colors.secondary[500], titleKey: 'welcome.slide2.title', descKey: 'welcome.slide2.description' },
  { id: '3', icon: 'rocket-launch', color: '#F59E0B', titleKey: 'welcome.slide3.title', descKey: 'welcome.slide3.description' },
];

const WelcomeModal: React.FC = () => {
  const { t } = useTranslation('tutorial');
  const { showWelcome, completeWelcome } = useTutorial();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleSkip = useCallback(() => {
    completeWelcome(false);
  }, [completeWelcome]);

  const handleExplore = useCallback(() => {
    completeWelcome(false);
  }, [completeWelcome]);

  const handleCreateFirst = useCallback(() => {
    completeWelcome(true);
  }, [completeWelcome]);

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToOffset({
        offset: (currentIndex + 1) * (SCREEN_WIDTH - 64),
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, SCREEN_WIDTH]);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH - 64 }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${item.color}15` }]}>
        <Icon name={item.icon as any} size={48} color={item.color} />
      </View>
      <Text style={styles.slideTitle}>{t(item.titleKey)}</Text>
      <Text style={styles.slideDesc}>{t(item.descKey)}</Text>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dots}>
      {SLIDES.map((_, index) => {
        const inputRange = [
          (index - 1) * (SCREEN_WIDTH - 64),
          index * (SCREEN_WIDTH - 64),
          (index + 1) * (SCREEN_WIDTH - 64),
        ];
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });
        const dotOpacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotWidth,
                opacity: dotOpacity,
                backgroundColor: colors.primary[500],
              },
            ]}
          />
        );
      })}
    </View>
  );

  if (!showWelcome) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Skip button */}
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('welcome.skip')}</Text>
          </TouchableOpacity>

          {/* Carousel */}
          <Animated.FlatList
            ref={flatListRef}
            data={SLIDES}
            renderItem={renderSlide}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false },
            )}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 64),
              );
              setCurrentIndex(index);
            }}
            scrollEventThrottle={16}
            style={styles.flatList}
          />

          {/* Pagination dots */}
          {renderDots()}

          {/* Action buttons */}
          <View style={styles.actions}>
            {isLastSlide ? (
              <>
                <TouchableOpacity onPress={handleCreateFirst} style={styles.primaryBtn}>
                  <Icon name="plus-circle-outline" size={20} color="#FFF" />
                  <Text style={styles.primaryBtnText}>{t('welcome.createFirst')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleExplore} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>{t('welcome.explore')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={handleNext} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>{t('common:next')}</Text>
                <Icon name="arrow-right" size={18} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 32,
  },
  container: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingTop: 16,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  flatList: {
    flexGrow: 0,
  },
  slide: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideDesc: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actions: {
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
});

export default WelcomeModal;
