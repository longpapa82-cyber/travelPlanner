import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../constants/theme';

type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  return (
    <LinearGradient
      colors={[theme.colors.primary[500], theme.colors.primary[700]]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo/Hero Section */}
          <View style={styles.heroSection}>
            <Text variant="displayLarge" style={styles.title}>
              ✈️
            </Text>
            <Text variant="headlineLarge" style={styles.appName}>
              TravelPlanner
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              AI가 만들어주는{'\n'}완벽한 여행 계획
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featuresSection}>
            <FeatureItem
              icon="✨"
              text="목적지와 날짜만 입력하면 자동 계획 생성"
            />
            <FeatureItem
              icon="🌤️"
              text="현지 날씨와 시간대 정보 제공"
            />
            <FeatureItem
              icon="✏️"
              text="자유로운 일정 수정과 추가"
            />
          </View>

          {/* CTA Buttons */}
          <View style={styles.buttonSection}>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('Login')}
              style={styles.primaryButton}
              labelStyle={styles.primaryButtonLabel}
            >
              시작하기
            </Button>
            <Button
              mode="text"
              onPress={() => navigation.navigate('Signup')}
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonLabel}
            >
              계정이 없으신가요? 회원가입
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const FeatureItem: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 80,
    marginBottom: 16,
  },
  appName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 28,
  },
  featuresSection: {
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  buttonSection: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
  },
  primaryButtonLabel: {
    color: theme.colors.primary[500],
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    borderRadius: 12,
  },
  secondaryButtonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
