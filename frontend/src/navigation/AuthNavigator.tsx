import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthStackParamList } from '../types';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import TwoFactorLoginScreen from '../screens/auth/TwoFactorLoginScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const ONBOARDING_KEY = '@travelplanner:has_seen_onboarding';

const AuthNavigator = () => {
  const [initialRoute, setInitialRoute] = useState<keyof AuthStackParamList | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setInitialRoute(value === 'true' ? 'Login' : 'Onboarding');
    });
  }, []);

  // Wait until we know which screen to start with
  if (!initialRoute) return null;

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="TwoFactorLogin" component={TwoFactorLoginScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
export { ONBOARDING_KEY };
