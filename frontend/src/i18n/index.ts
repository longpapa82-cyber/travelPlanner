import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager, Platform } from 'react-native';
import { secureStorage } from '../utils/storage';
import { STORAGE_KEYS } from '../constants/config';

const RTL_LANGUAGES: readonly string[] = ['ar'] as const;

import ko_common from './locales/ko/common.json';
import ko_auth from './locales/ko/auth.json';
import ko_home from './locales/ko/home.json';
import ko_trips from './locales/ko/trips.json';
import ko_profile from './locales/ko/profile.json';
import ko_components from './locales/ko/components.json';
import ko_legal from './locales/ko/legal.json';
import ko_admin from './locales/ko/admin.json';
import ko_social from './locales/ko/social.json';
import ko_premium from './locales/ko/premium.json';
import ko_tutorial from './locales/ko/tutorial.json';
import ko_consent from './locales/ko/consent.json';

import en_common from './locales/en/common.json';
import en_auth from './locales/en/auth.json';
import en_home from './locales/en/home.json';
import en_trips from './locales/en/trips.json';
import en_profile from './locales/en/profile.json';
import en_components from './locales/en/components.json';
import en_legal from './locales/en/legal.json';
import en_admin from './locales/en/admin.json';
import en_social from './locales/en/social.json';
import en_premium from './locales/en/premium.json';
import en_tutorial from './locales/en/tutorial.json';
import en_consent from './locales/en/consent.json';

import ja_common from './locales/ja/common.json';
import ja_auth from './locales/ja/auth.json';
import ja_home from './locales/ja/home.json';
import ja_trips from './locales/ja/trips.json';
import ja_profile from './locales/ja/profile.json';
import ja_components from './locales/ja/components.json';
import ja_legal from './locales/ja/legal.json';
import ja_admin from './locales/ja/admin.json';
import ja_social from './locales/ja/social.json';
import ja_premium from './locales/ja/premium.json';
import ja_tutorial from './locales/ja/tutorial.json';
import ja_consent from './locales/ja/consent.json';

import zh_common from './locales/zh/common.json';
import zh_auth from './locales/zh/auth.json';
import zh_home from './locales/zh/home.json';
import zh_trips from './locales/zh/trips.json';
import zh_profile from './locales/zh/profile.json';
import zh_components from './locales/zh/components.json';
import zh_legal from './locales/zh/legal.json';
import zh_admin from './locales/zh/admin.json';
import zh_social from './locales/zh/social.json';
import zh_premium from './locales/zh/premium.json';
import zh_tutorial from './locales/zh/tutorial.json';
import zh_consent from './locales/zh/consent.json';

import es_common from './locales/es/common.json';
import es_auth from './locales/es/auth.json';
import es_home from './locales/es/home.json';
import es_trips from './locales/es/trips.json';
import es_profile from './locales/es/profile.json';
import es_components from './locales/es/components.json';
import es_legal from './locales/es/legal.json';
import es_admin from './locales/es/admin.json';
import es_social from './locales/es/social.json';
import es_premium from './locales/es/premium.json';
import es_tutorial from './locales/es/tutorial.json';
import es_consent from './locales/es/consent.json';

import de_common from './locales/de/common.json';
import de_auth from './locales/de/auth.json';
import de_home from './locales/de/home.json';
import de_trips from './locales/de/trips.json';
import de_profile from './locales/de/profile.json';
import de_components from './locales/de/components.json';
import de_legal from './locales/de/legal.json';
import de_admin from './locales/de/admin.json';
import de_social from './locales/de/social.json';
import de_premium from './locales/de/premium.json';
import de_tutorial from './locales/de/tutorial.json';
import de_consent from './locales/de/consent.json';

import fr_common from './locales/fr/common.json';
import fr_auth from './locales/fr/auth.json';
import fr_home from './locales/fr/home.json';
import fr_trips from './locales/fr/trips.json';
import fr_profile from './locales/fr/profile.json';
import fr_components from './locales/fr/components.json';
import fr_legal from './locales/fr/legal.json';
import fr_admin from './locales/fr/admin.json';
import fr_social from './locales/fr/social.json';
import fr_premium from './locales/fr/premium.json';
import fr_tutorial from './locales/fr/tutorial.json';
import fr_consent from './locales/fr/consent.json';

import th_common from './locales/th/common.json';
import th_auth from './locales/th/auth.json';
import th_home from './locales/th/home.json';
import th_trips from './locales/th/trips.json';
import th_profile from './locales/th/profile.json';
import th_components from './locales/th/components.json';
import th_legal from './locales/th/legal.json';
import th_admin from './locales/th/admin.json';
import th_social from './locales/th/social.json';
import th_premium from './locales/th/premium.json';
import th_tutorial from './locales/th/tutorial.json';
import th_consent from './locales/th/consent.json';

import vi_common from './locales/vi/common.json';
import vi_auth from './locales/vi/auth.json';
import vi_home from './locales/vi/home.json';
import vi_trips from './locales/vi/trips.json';
import vi_profile from './locales/vi/profile.json';
import vi_components from './locales/vi/components.json';
import vi_legal from './locales/vi/legal.json';
import vi_admin from './locales/vi/admin.json';
import vi_social from './locales/vi/social.json';
import vi_premium from './locales/vi/premium.json';
import vi_tutorial from './locales/vi/tutorial.json';
import vi_consent from './locales/vi/consent.json';

import pt_common from './locales/pt/common.json';
import pt_auth from './locales/pt/auth.json';
import pt_home from './locales/pt/home.json';
import pt_trips from './locales/pt/trips.json';
import pt_profile from './locales/pt/profile.json';
import pt_components from './locales/pt/components.json';
import pt_legal from './locales/pt/legal.json';
import pt_admin from './locales/pt/admin.json';
import pt_social from './locales/pt/social.json';
import pt_premium from './locales/pt/premium.json';
import pt_tutorial from './locales/pt/tutorial.json';
import pt_consent from './locales/pt/consent.json';

import ar_common from './locales/ar/common.json';
import ar_auth from './locales/ar/auth.json';
import ar_home from './locales/ar/home.json';
import ar_trips from './locales/ar/trips.json';
import ar_profile from './locales/ar/profile.json';
import ar_components from './locales/ar/components.json';
import ar_legal from './locales/ar/legal.json';
import ar_admin from './locales/ar/admin.json';
import ar_social from './locales/ar/social.json';
import ar_premium from './locales/ar/premium.json';
import ar_tutorial from './locales/ar/tutorial.json';
import ar_consent from './locales/ar/consent.json';

import id_common from './locales/id/common.json';
import id_auth from './locales/id/auth.json';
import id_home from './locales/id/home.json';
import id_trips from './locales/id/trips.json';
import id_profile from './locales/id/profile.json';
import id_components from './locales/id/components.json';
import id_legal from './locales/id/legal.json';
import id_admin from './locales/id/admin.json';
import id_social from './locales/id/social.json';
import id_premium from './locales/id/premium.json';
import id_tutorial from './locales/id/tutorial.json';
import id_consent from './locales/id/consent.json';

import hi_common from './locales/hi/common.json';
import hi_auth from './locales/hi/auth.json';
import hi_home from './locales/hi/home.json';
import hi_trips from './locales/hi/trips.json';
import hi_profile from './locales/hi/profile.json';
import hi_components from './locales/hi/components.json';
import hi_legal from './locales/hi/legal.json';
import hi_admin from './locales/hi/admin.json';
import hi_social from './locales/hi/social.json';
import hi_premium from './locales/hi/premium.json';
import hi_tutorial from './locales/hi/tutorial.json';
import hi_consent from './locales/hi/consent.json';

import it_common from './locales/it/common.json';
import it_auth from './locales/it/auth.json';
import it_home from './locales/it/home.json';
import it_trips from './locales/it/trips.json';
import it_profile from './locales/it/profile.json';
import it_components from './locales/it/components.json';
import it_legal from './locales/it/legal.json';
import it_admin from './locales/it/admin.json';
import it_social from './locales/it/social.json';
import it_premium from './locales/it/premium.json';
import it_tutorial from './locales/it/tutorial.json';
import it_consent from './locales/it/consent.json';

import ru_common from './locales/ru/common.json';
import ru_auth from './locales/ru/auth.json';
import ru_home from './locales/ru/home.json';
import ru_trips from './locales/ru/trips.json';
import ru_profile from './locales/ru/profile.json';
import ru_components from './locales/ru/components.json';
import ru_legal from './locales/ru/legal.json';
import ru_admin from './locales/ru/admin.json';
import ru_social from './locales/ru/social.json';
import ru_premium from './locales/ru/premium.json';
import ru_tutorial from './locales/ru/tutorial.json';
import ru_consent from './locales/ru/consent.json';

import tr_common from './locales/tr/common.json';
import tr_auth from './locales/tr/auth.json';
import tr_home from './locales/tr/home.json';
import tr_trips from './locales/tr/trips.json';
import tr_profile from './locales/tr/profile.json';
import tr_components from './locales/tr/components.json';
import tr_legal from './locales/tr/legal.json';
import tr_admin from './locales/tr/admin.json';
import tr_social from './locales/tr/social.json';
import tr_premium from './locales/tr/premium.json';
import tr_tutorial from './locales/tr/tutorial.json';
import tr_consent from './locales/tr/consent.json';

import ms_common from './locales/ms/common.json';
import ms_auth from './locales/ms/auth.json';
import ms_home from './locales/ms/home.json';
import ms_trips from './locales/ms/trips.json';
import ms_profile from './locales/ms/profile.json';
import ms_components from './locales/ms/components.json';
import ms_legal from './locales/ms/legal.json';
import ms_admin from './locales/ms/admin.json';
import ms_social from './locales/ms/social.json';
import ms_premium from './locales/ms/premium.json';
import ms_tutorial from './locales/ms/tutorial.json';
import ms_consent from './locales/ms/consent.json';

export const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja', 'zh', 'es', 'de', 'fr', 'th', 'vi', 'pt', 'ar', 'id', 'hi', 'it', 'ru', 'tr', 'ms'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  pt: 'Português',
  ar: 'العربية',
  id: 'Bahasa Indonesia',
  hi: 'हिन्दी',
  it: 'Italiano',
  ru: 'Русский',
  tr: 'Türkçe',
  ms: 'Bahasa Melayu',
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
  es: '🇪🇸',
  de: '🇩🇪',
  fr: '🇫🇷',
  th: '🇹🇭',
  vi: '🇻🇳',
  pt: '🇧🇷',
  ar: '🇸🇦',
  id: '🇮🇩',
  hi: '🇮🇳',
  it: '🇮🇹',
  ru: '🇷🇺',
  tr: '🇹🇷',
  ms: '🇲🇾',
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
    social: ko_social,
    premium: ko_premium,
    tutorial: ko_tutorial,
    consent: ko_consent,
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
    social: en_social,
    premium: en_premium,
    tutorial: en_tutorial,
    consent: en_consent,
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
    social: ja_social,
    premium: ja_premium,
    tutorial: ja_tutorial,
    consent: ja_consent,
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
    social: zh_social,
    premium: zh_premium,
    tutorial: zh_tutorial,
    consent: zh_consent,
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
    social: es_social,
    premium: es_premium,
    tutorial: es_tutorial,
    consent: es_consent,
  },
  de: {
    common: de_common,
    auth: de_auth,
    home: de_home,
    trips: de_trips,
    profile: de_profile,
    components: de_components,
    legal: de_legal,
    admin: de_admin,
    social: de_social,
    premium: de_premium,
    tutorial: de_tutorial,
    consent: de_consent,
  },
  fr: {
    common: fr_common,
    auth: fr_auth,
    home: fr_home,
    trips: fr_trips,
    profile: fr_profile,
    components: fr_components,
    legal: fr_legal,
    admin: fr_admin,
    social: fr_social,
    premium: fr_premium,
    tutorial: fr_tutorial,
    consent: fr_consent,
  },
  th: {
    common: th_common,
    auth: th_auth,
    home: th_home,
    trips: th_trips,
    profile: th_profile,
    components: th_components,
    legal: th_legal,
    admin: th_admin,
    social: th_social,
    premium: th_premium,
    tutorial: th_tutorial,
    consent: th_consent,
  },
  vi: {
    common: vi_common,
    auth: vi_auth,
    home: vi_home,
    trips: vi_trips,
    profile: vi_profile,
    components: vi_components,
    legal: vi_legal,
    admin: vi_admin,
    social: vi_social,
    premium: vi_premium,
    tutorial: vi_tutorial,
    consent: vi_consent,
  },
  pt: {
    common: pt_common,
    auth: pt_auth,
    home: pt_home,
    trips: pt_trips,
    profile: pt_profile,
    components: pt_components,
    legal: pt_legal,
    admin: pt_admin,
    social: pt_social,
    premium: pt_premium,
    tutorial: pt_tutorial,
    consent: pt_consent,
  },
  ar: {
    common: ar_common,
    auth: ar_auth,
    home: ar_home,
    trips: ar_trips,
    profile: ar_profile,
    components: ar_components,
    legal: ar_legal,
    admin: ar_admin,
    social: ar_social,
    premium: ar_premium,
    tutorial: ar_tutorial,
    consent: ar_consent,
  },
  id: {
    common: id_common,
    auth: id_auth,
    home: id_home,
    trips: id_trips,
    profile: id_profile,
    components: id_components,
    legal: id_legal,
    admin: id_admin,
    social: id_social,
    premium: id_premium,
    tutorial: id_tutorial,
    consent: id_consent,
  },
  hi: {
    common: hi_common,
    auth: hi_auth,
    home: hi_home,
    trips: hi_trips,
    profile: hi_profile,
    components: hi_components,
    legal: hi_legal,
    admin: hi_admin,
    social: hi_social,
    premium: hi_premium,
    tutorial: hi_tutorial,
    consent: hi_consent,
  },
  it: {
    common: it_common,
    auth: it_auth,
    home: it_home,
    trips: it_trips,
    profile: it_profile,
    components: it_components,
    legal: it_legal,
    admin: it_admin,
    social: it_social,
    premium: it_premium,
    tutorial: it_tutorial,
    consent: it_consent,
  },
  ru: {
    common: ru_common,
    auth: ru_auth,
    home: ru_home,
    trips: ru_trips,
    profile: ru_profile,
    components: ru_components,
    legal: ru_legal,
    admin: ru_admin,
    social: ru_social,
    premium: ru_premium,
    tutorial: ru_tutorial,
    consent: ru_consent,
  },
  tr: {
    common: tr_common,
    auth: tr_auth,
    home: tr_home,
    trips: tr_trips,
    profile: tr_profile,
    components: tr_components,
    legal: tr_legal,
    admin: tr_admin,
    social: tr_social,
    premium: tr_premium,
    tutorial: tr_tutorial,
    consent: tr_consent,
  },
  ms: {
    common: ms_common,
    auth: ms_auth,
    home: ms_home,
    trips: ms_trips,
    profile: ms_profile,
    components: ms_components,
    legal: ms_legal,
    admin: ms_admin,
    social: ms_social,
    premium: ms_premium,
    tutorial: ms_tutorial,
    consent: ms_consent,
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

  const isRTL = RTL_LANGUAGES.includes(language);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'ko',
    ns: ['common', 'auth', 'home', 'trips', 'profile', 'components', 'legal', 'admin', 'social', 'premium', 'tutorial', 'consent'],
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
  const isRTL = RTL_LANGUAGES.includes(lang);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
  }
  await i18n.changeLanguage(lang);
  await secureStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
}

export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language as SupportedLanguage) || 'ko';
}

export default i18n;
