import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenProps } from './Screen.types';
import { Loading } from '../../feedback/Loading';
import { theme } from '../../../constants/theme';
import { useTheme } from '../../../contexts/ThemeContext';

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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        backgroundColor ||
        (isDark ? theme.darkColors.background : theme.colors.background),
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
          (isDark ? theme.darkColors.background : theme.colors.background)
        }
      />
      {header}
      {renderContent()}
      {footer}
    </SafeAreaView>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return content;
};
