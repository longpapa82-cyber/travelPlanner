import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import { useAuth } from './AuthContext';
import { useConsent } from './ConsentContext';
import { useNotifications } from './NotificationContext';

const TUTORIAL_KEYS = {
  WELCOME: '@travelplanner:tutorial_welcome',
  COACH: '@travelplanner:tutorial_coach',
};

interface TutorialContextType {
  showWelcome: boolean;
  showCoachMark: boolean;
  navigateToCreateTrip: boolean;
  completeWelcome: (navigate?: boolean) => void;
  completeCoach: () => void;
  resetTutorial: () => Promise<void>;
  clearNavigateFlag: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
};

interface TutorialProviderProps {
  children: ReactNode;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const { needsConsentScreen } = useConsent();
  const { showPrePermissionModal, isPrePermissionResolved, pendingPrePermission } = useNotifications();
  const [welcomeCompleted, setWelcomeCompleted] = useState(true);
  const [coachCompleted, setCoachCompleted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [navigateToCreateTrip, setNavigateToCreateTrip] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoaded(false);
      return;
    }

    (async () => {
      const [welcome, coach] = await Promise.all([
        AsyncStorage.getItem(TUTORIAL_KEYS.WELCOME),
        AsyncStorage.getItem(TUTORIAL_KEYS.COACH),
      ]);
      setWelcomeCompleted(welcome === 'true');
      setCoachCompleted(coach === 'true');
      setLoaded(true);
    })();
  }, [isAuthenticated]);

  // Only show tutorial after BOTH email verification AND consent are complete
  const isFullyVerified = user?.provider !== 'email' || user?.isEmailVerified === true;
  const isFullyOnboarded = isFullyVerified && !needsConsentScreen;

  const [onboardingSettled, setOnboardingSettled] = useState(false);
  const settledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State-based: wait until notification pre-permission modal is dismissed.
  // Now that NotificationProvider wraps TutorialProvider, we can directly
  // subscribe to showPrePermissionModal instead of polling AsyncStorage.
  useEffect(() => {
    if (isFullyOnboarded && loaded && isAuthenticated && isPrePermissionResolved && !showPrePermissionModal && !pendingPrePermission) {
      const handle = InteractionManager.runAfterInteractions(() => {
        settledTimerRef.current = setTimeout(() => {
          setOnboardingSettled(true);
        }, 500);
      });
      return () => {
        handle.cancel();
        if (settledTimerRef.current) clearTimeout(settledTimerRef.current);
      };
    }
    setOnboardingSettled(false);
    return undefined;
  }, [isFullyOnboarded, loaded, isAuthenticated, isPrePermissionResolved, showPrePermissionModal, pendingPrePermission]);

  const showWelcome = onboardingSettled && !welcomeCompleted;
  const showCoachMark = onboardingSettled && welcomeCompleted && !coachCompleted;

  const completeWelcome = useCallback((navigate = false) => {
    setWelcomeCompleted(true);
    AsyncStorage.setItem(TUTORIAL_KEYS.WELCOME, 'true');
    if (navigate) {
      setNavigateToCreateTrip(true);
      // User already chose to create a trip — skip the "click here to create" coach mark
      setCoachCompleted(true);
      AsyncStorage.setItem(TUTORIAL_KEYS.COACH, 'true');
    }
  }, []);

  const completeCoach = useCallback(() => {
    setCoachCompleted(true);
    AsyncStorage.setItem(TUTORIAL_KEYS.COACH, 'true');
  }, []);

  const resetTutorial = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(TUTORIAL_KEYS.WELCOME),
      AsyncStorage.removeItem(TUTORIAL_KEYS.COACH),
    ]);
    setWelcomeCompleted(false);
    setCoachCompleted(false);
    setNavigateToCreateTrip(false);
  }, []);

  const clearNavigateFlag = useCallback(() => {
    setNavigateToCreateTrip(false);
  }, []);

  const value = useMemo<TutorialContextType>(() => ({
    showWelcome,
    showCoachMark,
    navigateToCreateTrip,
    completeWelcome,
    completeCoach,
    resetTutorial,
    clearNavigateFlag,
  }), [showWelcome, showCoachMark, navigateToCreateTrip, completeWelcome, completeCoach, resetTutorial, clearNavigateFlag]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};
