/**
 * Ad Debug Screen
 *
 * Special screen for Alpha testers to diagnose and fix ad issues.
 * Provides real-time debugging information and troubleshooting tools.
 */

import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import {
  collectAdDebugInfo,
  formatDebugInfo,
  testAdConfiguration,
  resetAds,
  AdDebugInfo,
} from '../../utils/adDebugger';
import { useRewardedAd } from '../../components/ads';
import { useToast } from '../../components/feedback/Toast/ToastContext';

export default function AdDebugScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { show: showRewardedAd, isLoaded, isLoading, error: adError, reload } = useRewardedAd();

  const [debugInfo, setDebugInfo] = useState<AdDebugInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingAd, setIsTestingAd] = useState(false);

  useEffect(() => {
    loadDebugInfo();
  }, []);

  const loadDebugInfo = async () => {
    try {
      const info = await collectAdDebugInfo();
      setDebugInfo(info);
    } catch (error) {
      console.error('Failed to load debug info:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadDebugInfo();
    setIsRefreshing(false);
  };

  const handleTestConfiguration = async () => {
    const result = await testAdConfiguration();
    setTestResult(result);
    showToast({
      type: result.success ? 'success' : 'error',
      message: result.message,
    });
  };

  const handleTestRewardedAd = async () => {
    if (isTestingAd) return;

    setIsTestingAd(true);
    try {
      await showRewardedAd(() => {
        Alert.alert('Success', 'Rewarded ad completed successfully!');
      });
    } catch (error) {
      Alert.alert('Error', `Failed to show ad: ${error}`);
    } finally {
      setIsTestingAd(false);
    }
  };

  const handleReloadAds = async () => {
    reload();
    showToast({
      type: 'info',
      message: 'Reloading ads...',
    });
    setTimeout(loadDebugInfo, 2000);
  };

  const handleResetAds = async () => {
    Alert.alert(
      'Reset Ads',
      'This will completely reset the ad system. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAds();
              showToast({
                type: 'success',
                message: 'Ads reset successfully',
              });
              setTimeout(loadDebugInfo, 2000);
            } catch (error) {
              showToast({
                type: 'error',
                message: `Reset failed: ${error}`,
              });
            }
          },
        },
      ]
    );
  };

  const handleCopyDebugInfo = async () => {
    if (!debugInfo) return;

    const formatted = formatDebugInfo(debugInfo);
    await Clipboard.setStringAsync(formatted);
    showToast({
      type: 'success',
      message: 'Debug info copied to clipboard',
    });
  };

  const handleCopyDeviceHash = async () => {
    if (!debugInfo?.deviceHash) return;

    await Clipboard.setStringAsync(debugInfo.deviceHash);
    showToast({
      type: 'success',
      message: 'Device hash copied!',
    });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Ad Debug Tools</Text>
        <Text style={styles.subtitle}>Alpha Testing Diagnostics</Text>
      </View>

      {/* Current Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Status</Text>
        <View style={styles.statusGrid}>
          <StatusItem
            label="SDK"
            value={debugInfo?.sdkInitialized ? 'Initialized' : 'Not Ready'}
            success={debugInfo?.sdkInitialized}
          />
          <StatusItem
            label="Ad Loaded"
            value={isLoaded ? 'Ready' : 'Not Loaded'}
            success={isLoaded}
          />
          <StatusItem
            label="Loading"
            value={isLoading ? 'Yes' : 'No'}
            success={!isLoading}
          />
          <StatusItem
            label="Mode"
            value={__DEV__ ? 'Development' : 'Production'}
            success={true}
          />
        </View>
      </View>

      {/* Device Info */}
      {debugInfo?.deviceHash && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Hash</Text>
          <View style={styles.hashContainer}>
            <Text style={styles.hashText} numberOfLines={1}>
              {debugInfo.deviceHash}
            </Text>
            <TouchableOpacity onPress={handleCopyDeviceHash} style={styles.copyButton}>
              <Ionicons name="copy-outline" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
          <Text style={styles.hashHelp}>
            Add this to ALPHA_TEST_DEVICE_HASHES in initAds.native.ts
          </Text>
        </View>
      )}

      {/* Last Error */}
      {(adError || debugInfo?.lastError) && (
        <View style={[styles.section, styles.errorSection]}>
          <Text style={styles.sectionTitle}>Last Error</Text>
          <Text style={styles.errorText}>
            {adError || debugInfo?.lastError}
          </Text>
        </View>
      )}

      {/* Test Result */}
      {testResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration Test</Text>
          <View style={[styles.testResult, testResult.success ? styles.successBg : styles.errorBg]}>
            <Text style={styles.testResultText}>{testResult.message}</Text>
            {testResult.details && (
              <Text style={styles.testResultDetails}>
                {JSON.stringify(testResult.details, null, 2)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Suggestions */}
      {debugInfo?.suggestions && debugInfo.suggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          {debugInfo.suggestions.map((suggestion, index) => (
            <View key={index} style={styles.suggestion}>
              <Text style={styles.suggestionNumber}>{index + 1}.</Text>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleTestRewardedAd}
          disabled={isTestingAd || !isLoaded}
        >
          {isTestingAd ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="play-circle-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Test Rewarded Ad</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestConfiguration}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#3B82F6" />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Test Configuration
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleReloadAds}
        >
          <Ionicons name="refresh-outline" size={20} color="#3B82F6" />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Reload Ads
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.warningButton]}
          onPress={handleResetAds}
        >
          <Ionicons name="warning-outline" size={20} color="#EF4444" />
          <Text style={[styles.buttonText, styles.warningButtonText]}>
            Reset Ad System
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleCopyDebugInfo}
        >
          <Ionicons name="clipboard-outline" size={20} color="#3B82F6" />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Copy Debug Info
          </Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How to Fix Ad Issues</Text>
        <Text style={styles.instructions}>
          1. Pull down to refresh and check current status{'\n'}
          2. If you see a device hash, copy it{'\n'}
          3. Add the hash to ALPHA_TEST_DEVICE_HASHES in initAds.native.ts{'\n'}
          4. Rebuild the app with: eas build --profile preview{'\n'}
          5. Test ads should then work on your device{'\n\n'}
          If ads still don't work after adding device hash:{'\n'}
          • Check AdMob account approval status{'\n'}
          • Verify ad unit IDs are correct{'\n'}
          • Wait 24-48 hours for new ad units to activate{'\n'}
          • Try different network/location
        </Text>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

interface StatusItemProps {
  label: string;
  value: string;
  success?: boolean;
}

function StatusItem({ label, value, success }: StatusItemProps) {
  return (
    <View style={styles.statusItem}>
      <Text style={styles.statusLabel}>{label}</Text>
      <View style={[styles.statusValue, success ? styles.successBg : styles.errorBg]}>
        <Text style={styles.statusValueText}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statusItem: {
    width: '50%',
    padding: 6,
  },
  statusLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statusValue: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  statusValueText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
  successBg: {
    backgroundColor: '#10B981',
  },
  errorBg: {
    backgroundColor: '#EF4444',
  },
  warningBg: {
    backgroundColor: '#F59E0B',
  },
  errorSection: {
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hashContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 6,
  },
  hashText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#374151',
  },
  copyButton: {
    marginLeft: 8,
    padding: 4,
  },
  hashHelp: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  testResult: {
    padding: 12,
    borderRadius: 6,
  },
  testResultText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  testResultDetails: {
    fontSize: 12,
    color: 'white',
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  suggestion: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  suggestionNumber: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  warningButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#374151',
  },
  warningButtonText: {
    color: '#EF4444',
  },
  instructions: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
});