// User types matching backend
export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'email' | 'google' | 'apple' | 'kakao';
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Trip types matching backend
export interface TripPreferences {
  budget?: string;
  travelStyle?: string;
  interests?: string[];
}

export interface Activity {
  time: string;
  type: string;
  title: string;
  location: string;
  description: string;
  estimatedCost: number;
  estimatedDuration: number;
  completed?: boolean;
}

export interface Weather {
  temp: number;
  main: string;
  description: string;
  humidity: number;
  windSpeed?: number;
}

export interface Itinerary {
  id: string;
  tripId: string;
  date: string;
  dayNumber: number;
  activities: Activity[];
  weather: Weather | null;
  timezone: string | null;
  timezoneOffset: number | null;
  notes: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Trip {
  id: string;
  userId: string;
  destination: string;
  country?: string;
  city?: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  description?: string;
  numberOfTravelers?: number;
  preferences?: TripPreferences;
  shareToken?: string;
  isPublic?: boolean;
  shareExpiresAt?: string;
  itineraries: Itinerary[];
  createdAt: string;
  updatedAt: string;
}

// Create Trip DTO
export interface CreateTripDto {
  destination: string;
  country?: string;
  city?: string;
  startDate: string;
  endDate: string;
  description?: string;
  numberOfTravelers?: number;
  preferences?: TripPreferences;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Trips: { screen?: string } | undefined;
  Profile: undefined;
};

export type TripsStackParamList = {
  TripList: undefined;
  TripDetail: { tripId: string };
  CreateTrip: undefined;
  EditTrip: { tripId: string };
};
