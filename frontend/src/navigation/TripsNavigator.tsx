import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { TripsStackParamList } from '../types';
import TripListScreen from '../screens/trips/TripListScreen';
import TripDetailScreen from '../screens/trips/TripDetailScreen';
import CreateTripScreen from '../screens/trips/CreateTripScreen';
import EditTripScreen from '../screens/trips/EditTripScreen';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';

const Stack = createNativeStackNavigator<TripsStackParamList>();

const TripsNavigator = () => {
  const { theme } = useTheme();
  const { t } = useTranslation('trips');

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: colors.neutral[0],
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="TripList"
        component={TripListScreen}
        options={{ title: t('list.title') }}
      />
      <Stack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateTrip"
        component={CreateTripScreen}
        options={{ title: t('create.title') }}
      />
      <Stack.Screen
        name="EditTrip"
        component={EditTripScreen}
        options={{ title: t('edit.title') }}
      />
    </Stack.Navigator>
  );
};

export default TripsNavigator;
