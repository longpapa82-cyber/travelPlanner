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
import ko_legal from './locales/ko/legal.json';
import ko_admin from './locales/ko/admin.json';

import en_common from './locales/en/common.json';
import en_auth from './locales/en/auth.json';
import en_home from './locales/en/home.json';
import en_trips from './locales/en/trips.json';
import en_profile from './locales/en/profile.json';
import en_components from './locales/en/components.json';
import en_legal from './locales/en/legal.json';
import en_admin from './locales/en/admin.json';

import ja_common from './locales/ja/common.json';
import ja_auth from './locales/ja/auth.json';
import ja_home from './locales/ja/home.json';
import ja_trips from './locales/ja/trips.json';
import ja_profile from './locales/ja/profile.json';
import ja_components from './locales/ja/components.json';
import ja_legal from './locales/ja/legal.json';
import ja_admin from './locales/ja/admin.json';

import zh_common from './locales/zh/common.json';
import zh_auth from './locales/zh/auth.json';
import zh_home from './locales/zh/home.json';
import zh_trips from './locales/zh/trips.json';
import zh_profile from './locales/zh/profile.json';
import zh_components from './locales/zh/components.json';
import zh_legal from './locales/zh/legal.json';
import zh_admin from './locales/zh/admin.json';

import es_common from './locales/es/common.json';
import es_auth from './locales/es/auth.json';
import es_home from './locales/es/home.json';
import es_trips from './locales/es/trips.json';
import es_profile from './locales/es/profile.json';
import es_components from './locales/es/components.json';
import es_legal from './locales/es/legal.json';
import es_admin from './locales/es/admin.json';

export const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja', 'zh', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
  es: '🇪🇸',
};

const resources = {
  ko: {
    common: ko_common,
    auth: ko_auth,
    home: ko_home,
    trips: ko_trips,
    profile: ko_profile,
    components: ko_components,
    legal: ko_legal,
    admin: ko_admin,
  },
  en: {
    common: en_common,
    auth: en_auth,
    home: en_home,
    trips: en_trips,
    profile: en_profile,
    components: en_components,
    legal: en_legal,
    admin: en_admin,
  },
  ja: {
    common: ja_common,
    auth: ja_auth,
    home: ja_home,
    trips: ja_trips,
    profile: ja_profile,
    components: ja_components,
    legal: ja_legal,
    admin: ja_admin,
  },
  zh: {
    common: zh_common,
    auth: zh_auth,
    home: zh_home,
    trips: zh_trips,
    profile: zh_profile,
    components: zh_components,
    legal: zh_legal,
    admin: zh_admin,
  },
  es: {
    common: es_common,
    auth: es_auth,
    home: es_home,
    trips: es_trips,
    profile: es_profile,
    components: es_components,
    legal: es_legal,
    admin: es_admin,
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
    ns: ['common', 'auth', 'home', 'trips', 'profile', 'components', 'legal', 'admin'],
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
