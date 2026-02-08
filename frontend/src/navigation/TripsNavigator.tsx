import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TripsStackParamList } from '../types';
import TripListScreen from '../screens/trips/TripListScreen';
import TripDetailScreen from '../screens/trips/TripDetailScreen';
import CreateTripScreen from '../screens/trips/CreateTripScreen';
import EditTripScreen from '../screens/trips/EditTripScreen';
import { theme } from '../constants/theme';

const Stack = createNativeStackNavigator<TripsStackParamList>();

const TripsNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="TripList"
        component={TripListScreen}
        options={{ title: 'My Trips' }}
      />
      <Stack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: 'Trip Details' }}
      />
      <Stack.Screen
        name="CreateTrip"
        component={CreateTripScreen}
        options={{ title: 'Create New Trip' }}
      />
      <Stack.Screen
        name="EditTrip"
        component={EditTripScreen}
        options={{ title: 'Edit Trip' }}
      />
    </Stack.Navigator>
  );
};

export default TripsNavigator;
