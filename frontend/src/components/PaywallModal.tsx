import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';
import { getOfferings, purchasePackage, restorePurchases } from '../services/revenueCat';
import apiService from '../services/api';

interface BenefitItem {
  icon: string;
  key: string;
  free: boolean;
  premium: boolean;
}

const BENEFITS: BenefitItem[] = [
  { icon: 'robot', key: 'unlimitedAi', free: false, premium: true },
  { icon: 'ads', key: 'noAds', free: false, premium: true },
  { icon: 'crown', key: 'premiumBadge', free: false, premium: true },
  { icon: 'map-marker-path', key: 'tripCreation', free: true, premium: true },
  { icon: 'account-group', key: 'social', free: true, premium: true },
  { icon: 'calculator', key: 'expenses', free: true, premium: true },
];

const PaywallModal: React.FC = () => {
  const { t } = useTranslation('premium');
  const { user } = useAuth();
  const { isPaywallVisible, hidePaywall, refreshStatus } = usePremium();
  const { theme, isDark } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [packages, setPackages] = useState<{ monthly: any; yearly: any }>({ monthly: null, yearly: null });
  const offeringsLoaded = useRef(false);
  const paddleInitialized = useRef(false);

  // Load and initialize Paddle SDK on web
  useEffect(() => {
    if (Platform.OS !== 'web' || paddleInitialized.current) return;
    if (typeof window === 'undefined') return;

    const initPaddle = () => {
      const Paddle = (window as any).Paddle;
      if (!Paddle) {
        console.warn('[PADDLE-DEBUG] Paddle global not found after script load');
        return;
      }
      try {
        const token = process.env.EXPO_PUBLIC_PADDLE_CLIENT_TOKEN;
        const env = process.env.EXPO_PUBLIC_PADDLE_ENVIRONMENT || 'sandbox';
        console.log('[PADDLE-DEBUG] Init start — token:', token ? `${token.substring(0, 10)}...` : 'MISSING', '| env:', env);

        if (!token) {
          console.error('[PADDLE-DEBUG] EXPO_PUBLIC_PADDLE_CLIENT_TOKEN is empty!');
          return;
        }

        if (env === 'sandbox') {
          Paddle.Environment.set('sandbox');
          console.log('[PADDLE-DEBUG] Environment set to sandbox');
        }

        Paddle.Initialize({
          token,
          eventCallback: (event: any) => {
            console.log('[PADDLE-DEBUG] Event:', event.name, JSON.stringify(event.data || event, null, 2));
          },
        });
        paddleInitialized.current = true;
        console.log('[PADDLE-DEBUG] Initialize() succeeded');
      } catch (err) {
        console.error('[PADDLE-DEBUG] Init failed:', err);
      }
    };

    // If Paddle.js already loaded
    if ((window as any).Paddle) {
      console.log('[PADDLE-DEBUG] Paddle.js already loaded');
      initPaddle();
      return;
    }

    // Dynamically load Paddle.js
    console.log('[PADDLE-DEBUG] Loading Paddle.js dynamically...');
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => {
      console.log('[PADDLE-DEBUG] Paddle.js script loaded');
      initPaddle();
    };
    script.onerror = (e) => {
      console.error('[PADDLE-DEBUG] Failed to load Paddle.js:', e);
    };
    document.head.appendChild(script);
  }, []);

  // Load RevenueCat offerings when paywall becomes visible
  useEffect(() => {
    if (!isPaywallVisible || offeringsLoaded.current) return;
    if (Platform.OS === 'web') return;

    (async () => {
      const offerings = await getOfferings();
      const current = offerings?.current;
      if (current) {
        setPackages({
          monthly: current.monthly,
          yearly: current.annual,
        });
        offeringsLoaded.current = true;
      }
    })();
  }, [isPaywallVisible]);

  const handlePurchase = async () => {
    if (Platform.OS === 'web') {
      // Web: Paddle Overlay Checkout
      setIsPurchasing(true);
      try {
        console.log('[PADDLE-DEBUG] handlePurchase — selectedPlan:', selectedPlan);
        console.log('[PADDLE-DEBUG] handlePurchase — user:', user?.id, user?.email);
        console.log('[PADDLE-DEBUG] handlePurchase — paddleInitialized:', paddleInitialized.current);

        const result = await apiService.getPaddleCheckoutConfig(selectedPlan);
        console.log('[PADDLE-DEBUG] Backend response:', JSON.stringify(result));
        const { priceId } = result;
        console.log('[PADDLE-DEBUG] priceId:', priceId);

        const Paddle = (window as any).Paddle;
        if (!Paddle) {
          console.error('[PADDLE-DEBUG] Paddle global is undefined');
          throw new Error('Paddle SDK not loaded. Please refresh the page.');
        }
        if (!paddleInitialized.current) {
          console.error('[PADDLE-DEBUG] Paddle not initialized');
          throw new Error('Paddle SDK not initialized. Please refresh the page.');
        }

        const checkoutConfig: any = {
          items: [{ priceId, quantity: 1 }],
        };
        // Only add customData if userId is available and as string
        if (user?.id) {
          checkoutConfig.customData = { userId: String(user.id) };
        }

        console.log('[PADDLE-DEBUG] Checkout.open() config:', JSON.stringify(checkoutConfig));
        Paddle.Checkout.open(checkoutConfig);
        console.log('[PADDLE-DEBUG] Checkout.open() called successfully');
      } catch (error: any) {
        console.error('[PADDLE-DEBUG] handlePurchase error:', error);
        const msg = error?.response?.data?.message || error?.message || 'Failed to start checkout. Please try again.';
        Alert.alert('Error', msg);
      } finally {
        setIsPurchasing(false);
      }
      return;
    }

    const pkg = selectedPlan === 'monthly' ? packages.monthly : packages.yearly;
    if (!pkg) {
      Alert.alert('Error', 'Subscription packages not loaded. Please try again.');
      return;
    }

    setIsPurchasing(true);
    try {
      const customerInfo = await purchasePackage(pkg);
      if (customerInfo) {
        // Purchase successful — refresh user profile from backend
        await refreshStatus();
        hidePaywall();
      }
      // null = user cancelled, do nothing
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Purchase failed. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    try {
      if (Platform.OS === 'web') {
        // Web: restore from backend DB (Paddle subscription state)
        const result = await apiService.restoreSubscription();
        if (result?.restored) {
          await refreshStatus();
          hidePaywall();
          Alert.alert(t('actions.restore'), t('paywall.restoreSuccess') || 'Subscription restored successfully!');
        } else {
          Alert.alert(t('actions.restore'), t('paywall.restoreNone') || 'No active subscription found.');
        }
      } else {
        // Native: restore from RevenueCat (App Store / Play Store)
        const customerInfo = await restorePurchases();
        if (customerInfo?.entitlements?.active?.['premium']) {
          await refreshStatus();
          hidePaywall();
          Alert.alert(t('actions.restore'), t('paywall.restoreSuccess') || 'Subscription restored successfully!');
        } else {
          Alert.alert(t('actions.restore'), t('paywall.restoreNone') || 'No active subscription found.');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Restore failed. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Modal
      visible={isPaywallVisible}
      animationType="slide"
      transparent
      onRequestClose={hidePaywall}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : '#FFF' }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={hidePaywall} style={styles.closeButton}>
              <Icon name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.crownCircle}>
                <Icon name="crown" size={40} color="#F59E0B" />
              </View>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {t('paywall.title')}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                {t('paywall.subtitle')}
              </Text>
            </View>

            {/* Benefits */}
            <View style={styles.benefitsSection}>
              {BENEFITS.map((benefit) => (
                <View key={benefit.key} style={styles.benefitRow}>
                  <Icon
                    name={benefit.icon as any}
                    size={22}
                    color={benefit.premium && !benefit.free ? '#F59E0B' : theme.colors.primary}
                  />
                  <Text style={[styles.benefitText, { color: theme.colors.text }]}>
                    {t(`benefits.${benefit.key}`)}
                  </Text>
                  {benefit.premium && !benefit.free && (
                    <View style={styles.proTag}>
                      <Text style={styles.proTagText}>PRO</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Plan Cards */}
            <View style={styles.planCards}>
              {/* Yearly */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  {
                    borderColor: selectedPlan === 'yearly' ? '#F59E0B' : theme.colors.border,
                    backgroundColor: selectedPlan === 'yearly'
                      ? (isDark ? '#F59E0B15' : '#FFF8E1')
                      : (isDark ? colors.neutral[800] : colors.neutral[50]),
                  },
                ]}
                onPress={() => setSelectedPlan('yearly')}
                activeOpacity={0.7}
              >
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>{t('premium.price.yearlySaving')}</Text>
                </View>
                <Text style={[styles.planName, { color: theme.colors.text }]}>
                  {t('premium.price.yearly')}
                </Text>
                <Text style={[styles.planPrice, { color: theme.colors.text }]}>
                  {packages.yearly?.product?.priceString || '$29.99'}
                </Text>
                <Text style={[styles.planPer, { color: theme.colors.textSecondary }]}>
                  / {t('premium.price.year')}
                </Text>
              </TouchableOpacity>

              {/* Monthly */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  {
                    borderColor: selectedPlan === 'monthly' ? '#F59E0B' : theme.colors.border,
                    backgroundColor: selectedPlan === 'monthly'
                      ? (isDark ? '#F59E0B15' : '#FFF8E1')
                      : (isDark ? colors.neutral[800] : colors.neutral[50]),
                  },
                ]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.7}
              >
                <Text style={[styles.planName, { color: theme.colors.text }]}>
                  {t('premium.price.monthly')}
                </Text>
                <Text style={[styles.planPrice, { color: theme.colors.text }]}>
                  {packages.monthly?.product?.priceString || '$3.99'}
                </Text>
                <Text style={[styles.planPer, { color: theme.colors.textSecondary }]}>
                  / {t('premium.price.month')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Subscribe Button */}
            <TouchableOpacity
              style={[styles.subscribeButton, isPurchasing && styles.subscribeButtonDisabled]}
              onPress={handlePurchase}
              disabled={isPurchasing}
              activeOpacity={0.8}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.subscribeButtonText}>
                  {t('actions.subscribe')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Restore */}
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isPurchasing}
            >
              <Text style={[styles.restoreText, { color: theme.colors.textSecondary }]}>
                {t('actions.restore')}
              </Text>
            </TouchableOpacity>

            {/* Subscription terms & legal links */}
            <View style={styles.legalSection}>
              <Text style={[styles.legalText, { color: theme.colors.textSecondary }]}>
                {t('paywall.autoRenewNotice')}
              </Text>
              <View style={styles.legalLinks}>
                <TouchableOpacity onPress={() => Linking.openURL('https://mytravel-planner.com/terms')}>
                  <Text style={[styles.legalLink, { color: theme.colors.primary }]}>
                    {t('paywall.termsLink')}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.legalSeparator, { color: theme.colors.textSecondary }]}> · </Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://mytravel-planner.com/privacy')}>
                  <Text style={[styles.legalLink, { color: theme.colors.primary }]}>
                    {t('paywall.privacyLink')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  crownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsSection: {
    marginBottom: 24,
    gap: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 15,
    flex: 1,
  },
  proTag: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  planCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  saveBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  saveBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
  },
  planPer: {
    fontSize: 13,
  },
  subscribeButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  restoreText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  legalSection: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  legalText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  legalLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 12,
  },
});

export default PaywallModal;
