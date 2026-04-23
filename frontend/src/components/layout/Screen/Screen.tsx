import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenProps } from './Screen.types';
import { Loading } from '../../feedback/Loading';
import { theme, darkColors } from '../../../constants/theme';
import { useTheme } from '../../../contexts/ThemeContext';

const WEB_MAX_WIDTH = 600;
const WEB_DESKTOP_BREAKPOINT = 768;

export const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable = false,
  loading = false,
  header,
  footer,
  backgroundColor,
  keyboardAvoiding = true,
  padding = 0,
  style,
  contentStyle,
}) => {
  const { isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && windowWidth >= WEB_DESKTOP_BREAKPOINT;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        backgroundColor ||
        (isDark ? darkColors.background.primary : theme.colors.background),
    },
    content: {
      flex: 1,
      padding: padding,
    },
    scrollContent: {
      flexGrow: 1,
      padding: padding,
    },
  });

  const renderContent = () => {
    if (loading) {
      return <Loading visible={true} overlay={false} text="Loading..." />;
    }

    if (scrollable) {
      return (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      );
    }

    return <View style={[styles.content, contentStyle]}>{children}</View>;
  };

  const content = (
    <SafeAreaView style={[styles.container, style]} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={
          backgroundColor ||
          (isDark ? darkColors.background.primary : theme.colors.background)
        }
      />
      {header}
      {renderContent()}
      {footer}
    </SafeAreaView>
  );

  const wrappedContent = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {content}
    </KeyboardAvoidingView>
  ) : content;

  if (isWebDesktop) {
    return (
      <View style={webStyles.outerContainer}>
        <View style={[webStyles.centeredContainer, {
          backgroundColor: backgroundColor || (isDark ? darkColors.background.primary : theme.colors.background),
        }]}>
          {wrappedContent}
        </View>
      </View>
    );
  }

  return wrappedContent;
};

const webStyles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  centeredContainer: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_MAX_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
});
