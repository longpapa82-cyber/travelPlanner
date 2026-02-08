import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { secureStorage } from '../utils/storage';
import { STORAGE_KEYS } from '../constants/config';

import ko_common from './locales/ko/common.json';
import ko_auth from './locales/ko/auth.json';
import ko_home from './locales/ko/home.json';
import ko_trips from './locales/ko/trips.json';
import ko_profile from './locales/ko/profile.json';
import ko_components from './locales/ko/components.json';

import en_common from './locales/en/common.json';
import en_auth from './locales/en/auth.json';
import en_home from './locales/en/home.json';
import en_trips from './locales/en/trips.json';
import en_profile from './locales/en/profile.json';
import en_components from './locales/en/components.json';

import ja_common from './locales/ja/common.json';
import ja_auth from './locales/ja/auth.json';
import ja_home from './locales/ja/home.json';
import ja_trips from './locales/ja/trips.json';
import ja_profile from './locales/ja/profile.json';
import ja_components from './locales/ja/components.json';

export const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
};

const resources = {
  ko: {
    common: ko_common,
    auth: ko_auth,
    home: ko_home,
    trips: ko_trips,
    profile: ko_profile,
    components: ko_components,
  },
  en: {
    common: en_common,
    auth: en_auth,
    home: en_home,
    trips: en_trips,
    profile: en_profile,
    components: en_components,
  },
  ja: {
    common: ja_common,
    auth: ja_auth,
    home: ja_home,
    trips: ja_trips,
    profile: ja_profile,
    components: ja_components,
  },
};

function detectDeviceLanguage(): SupportedLanguage {
  const locales = Localization.getLocales();
  if (locales.length > 0) {
    const langCode = locales[0].languageCode;
    if (langCode && SUPPORTED_LANGUAGES.includes(langCode as SupportedLanguage)) {
      return langCode as SupportedLanguage;
    }
  }
  return 'ko';
}

export async function initI18n(): Promise<void> {
  let savedLang: string | null = null;
  try {
    savedLang = await secureStorage.getItem(STORAGE_KEYS.LANGUAGE);
  } catch {
    // Ignore storage errors on first launch
  }

  const language = (savedLang as SupportedLanguage) || detectDeviceLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'ko',
    ns: ['common', 'auth', 'home', 'trips', 'profile', 'components'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  await secureStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
}

export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language as SupportedLanguage) || 'ko';
}

export default i18n;
