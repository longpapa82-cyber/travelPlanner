// User types matching backend
export type SubscriptionTier = 'free' | 'premium';

export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'email' | 'google' | 'apple' | 'kakao';
  profileImage?: string;
  isEmailVerified?: boolean;
  isTwoFactorEnabled?: boolean;
  travelPreferences?: TripPreferences;
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiresAt?: string;
  aiTripsUsedThisMonth?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isPremium: boolean;
  platform?: string;
  expiresAt?: string;
  aiTripsUsed: number;
  aiTripsLimit: number;
  aiTripsRemaining: number;
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
  latitude?: number;
  longitude?: number;
  description: string;
  estimatedCost: number;
  actualCost?: number;
  currency?: string;
  estimatedDuration: number;
  completed?: boolean;
  photos?: string[];
}

export interface Weather {
  temp?: number;
  temperature?: number;
  main?: string;
  condition?: string;
  description?: string;
  humidity: number;
  windSpeed?: number;
  icon?: string;
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
  totalBudget?: number;
  budgetCurrency?: string;
  shareToken?: string;
  isPublic?: boolean;
  coverImage?: string;
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
  totalBudget?: number;
  budgetCurrency?: string;
}

// Expense types
export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  user?: { id: string; name: string; profileImage?: string };
  amount: number;
  isSettled: boolean;
}

export interface Expense {
  id: string;
  tripId: string;
  paidByUserId: string;
  paidBy?: { id: string; name: string; profileImage?: string };
  description: string;
  amount: number;
  currency: string;
  category: 'food' | 'transport' | 'accommodation' | 'activity' | 'shopping' | 'other';
  splitMethod: 'equal' | 'exact';
  date: string;
  splits: ExpenseSplit[];
  createdAt: string;
}

export interface Balance {
  userId: string;
  userName: string;
  balance: number;
}

export interface Settlement {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

// Announcement types
export interface Announcement {
  id: string;
  type: 'system' | 'feature' | 'important' | 'promotional';
  title: string;
  content: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  displayType: 'banner' | 'modal' | 'bottom_sheet' | 'notification_only';
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  startDate: string;
  endDate?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

export interface AnnouncementAdmin {
  id: string;
  type: 'system' | 'feature' | 'important' | 'promotional';
  title: Record<string, string>;
  content: Record<string, string>;
  targetAudience: 'all' | 'premium' | 'free';
  priority: 'critical' | 'high' | 'normal' | 'low';
  displayType: 'banner' | 'modal' | 'bottom_sheet' | 'notification_only';
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: Record<string, string>;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  VerifyEmail: { token: string };
  SharedTrip: { shareToken: string };
  AnnouncementList: undefined;
  AnnouncementDetail: { announcementId: string };
};

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  VerifyEmail: { token: string };
  TwoFactorLogin: { tempToken: string };
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Trips: { screen?: string; params?: Record<string, unknown> } | undefined;
  Notifications: undefined;
  Profile: { screen?: string } | undefined;
};

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export type ProfileStackParamList = {
  ProfileMain: undefined;
  TwoFactorSettings: undefined;
  RevenueDashboard: undefined;
  Subscription: undefined;
  AdminDashboard: undefined;
  UserManagement: undefined;
  ErrorLog: undefined;
  AnnouncementManagement: undefined;
  AnnouncementForm: { announcementId?: string };
  Help: undefined;
  Terms: undefined;
  PrivacyPolicy: undefined;
  UserProfile: { userId: string };
};

// Social types
export interface FeedTrip {
  id: string;
  destination: string;
  country?: string;
  coverImage?: string;
  startDate: string;
  endDate: string;
  likesCount: number;
  isLiked: boolean;
  user: {
    id: string;
    name: string;
    profileImage?: string;
  };
}

export interface PublicUserProfile {
  id: string;
  name: string;
  profileImage?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  publicTrips: FeedTrip[];
  publicTripsTotal: number;
}

export type TripsStackParamList = {
  TripList: undefined;
  TripDetail: { tripId: string };
  CreateTrip: { destination?: string; duration?: number; travelers?: number } | undefined;
  EditTrip: { tripId: string };
  Expenses: { tripId: string };
  AddExpense: { tripId: string; expenseId?: string };
};
