import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

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
  const { isAuthenticated } = useAuth();
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

  const showWelcome = loaded && isAuthenticated && !welcomeCompleted;
  const showCoachMark = loaded && isAuthenticated && welcomeCompleted && !coachCompleted;

  const completeWelcome = useCallback((navigate = false) => {
    setWelcomeCompleted(true);
    AsyncStorage.setItem(TUTORIAL_KEYS.WELCOME, 'true');
    if (navigate) {
      setNavigateToCreateTrip(true);
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
