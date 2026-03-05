import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import i18next from 'i18next';
import { colors } from '../constants/theme';
import apiService from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_RETRIES = 3;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
  showDetails: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private fadeAnim = new Animated.Value(0);
  private slideAnim = new Animated.Value(30);
  private retryCount = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });
    this.setState({ eventId: eventId ?? null });

    // Report to admin error log (best-effort, never re-throws)
    apiService.reportError({
      errorMessage: `[ErrorBoundary] ${error.name}: ${error.message}`,
      stackTrace: error.stack || errorInfo.componentStack || undefined,
      screen: 'ErrorBoundary',
      severity: 'fatal',
      deviceOS: Platform.OS,
      appVersion: Constants.expoConfig?.version,
    }).catch(() => {});

    if (__DEV__) console.error('ErrorBoundary caught:', error, errorInfo);
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (this.state.hasError && !prevState.hasError) {
      Animated.parallel([
        Animated.timing(this.fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(this.slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }

  handleRetry = () => {
    this.retryCount++;
    this.fadeAnim.setValue(0);
    this.slideAnim.setValue(30);
    this.setState({ hasError: false, error: null, eventId: null, showDetails: false });
  };

  handleGoHome = () => {
    this.retryCount = 0;
    this.fadeAnim.setValue(0);
    this.slideAnim.setValue(30);
    this.setState({ hasError: false, error: null, eventId: null, showDetails: false });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  handleReload = () => {
    this.retryCount = 0;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    } else {
      // On native, reset state fully — RN will re-mount the tree
      this.fadeAnim.setValue(0);
      this.slideAnim.setValue(30);
      this.setState({ hasError: false, error: null, eventId: null, showDetails: false });
    }
  };

  private get isPersistentError(): boolean {
    return this.retryCount >= MAX_RETRIES;
  }

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, eventId, showDetails } = this.state;

      return (
        <View style={styles.container}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: this.fadeAnim,
                transform: [{ translateY: this.slideAnim }],
              },
            ]}
          >
            {/* Illustration area */}
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Icon name="map-marker-question" size={48} color={colors.primary[500]} />
              </View>
              <View style={styles.cloudLeft}>
                <Icon name="cloud-outline" size={28} color={colors.neutral[300]} />
              </View>
              <View style={styles.cloudRight}>
                <Icon name="cloud-outline" size={20} color={colors.neutral[200]} />
              </View>
            </View>

            {/* Title & Message */}
            <Text style={styles.title}>
              {this.isPersistentError
                ? i18next.t('errorBoundary.persistentTitle', {
                    ns: 'common',
                    defaultValue: 'Repeated errors detected',
                  })
                : i18next.t('errorBoundary.title', { ns: 'common' })}
            </Text>
            <Text style={styles.message}>
              {this.isPersistentError
                ? i18next.t('errorBoundary.persistentMessage', {
                    ns: 'common',
                    defaultValue: 'This error keeps occurring. Please try reloading the app.',
                  })
                : i18next.t('errorBoundary.message', { ns: 'common' })}
            </Text>

            {/* Error ID (for support) */}
            {eventId && (
              <Text style={styles.errorId}>
                {i18next.t('errorBoundary.errorId', { ns: 'common', id: eventId.slice(0, 8) })}
              </Text>
            )}

            {/* Action buttons */}
            <View style={styles.buttonRow}>
              {this.isPersistentError ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={this.handleReload}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={i18next.t('errorBoundary.reload', {
                    ns: 'common',
                    defaultValue: 'Reload app',
                  })}
                >
                  <Icon name="restart" size={18} color={colors.neutral[0]} />
                  <Text style={styles.primaryButtonText}>
                    {i18next.t('errorBoundary.reload', {
                      ns: 'common',
                      defaultValue: 'Reload app',
                    })}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={this.handleRetry}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={i18next.t('errorBoundary.retry', { ns: 'common' })}
                >
                  <Icon name="refresh" size={18} color={colors.neutral[0]} />
                  <Text style={styles.primaryButtonText}>
                    {i18next.t('errorBoundary.retry', { ns: 'common' })}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={this.handleGoHome}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={i18next.t('errorBoundary.goHome', { ns: 'common' })}
              >
                <Icon name="home-outline" size={18} color={colors.primary[500]} />
                <Text style={styles.secondaryButtonText}>
                  {i18next.t('errorBoundary.goHome', { ns: 'common' })}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Dev mode error details */}
            {__DEV__ && error && (
              <View style={styles.devSection}>
                <TouchableOpacity
                  onPress={this.toggleDetails}
                  style={styles.detailsToggle}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={showDetails ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.neutral[400]}
                  />
                  <Text style={styles.detailsToggleText}>
                    {showDetails ? 'Hide Details' : 'Show Details'}
                  </Text>
                </TouchableOpacity>
                {showDetails && (
                  <View style={styles.detailsContainer}>
                    <Text style={styles.errorName}>{error.name}</Text>
                    <Text style={styles.errorMessage}>{error.message}</Text>
                    {error.stack && (
                      <Text style={styles.errorStack} numberOfLines={10}>
                        {error.stack}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.neutral[50],
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  // Illustration
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary[100],
  },
  cloudLeft: {
    position: 'absolute',
    top: 4,
    left: -4,
  },
  cloudRight: {
    position: 'absolute',
    top: 16,
    right: -8,
  },
  // Text
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  errorId: {
    fontSize: 12,
    color: colors.neutral[400],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 28,
  },
  // Buttons
  buttonRow: {
    flexDirection: SCREEN_WIDTH < 360 ? 'column' : 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }
      : {}),
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[500],
  },
  // Dev details
  devSection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: 16,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  detailsToggleText: {
    fontSize: 13,
    color: colors.neutral[400],
  },
  detailsContainer: {
    marginTop: 12,
    backgroundColor: colors.neutral[100],
    borderRadius: 8,
    padding: 12,
  },
  errorName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.error.dark,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: colors.neutral[700],
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 11,
    color: colors.neutral[500],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
});

export default ErrorBoundary;
