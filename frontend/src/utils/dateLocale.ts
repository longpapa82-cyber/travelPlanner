import { getCurrentLanguage, SupportedLanguage } from '../i18n';

const LOCALE_MAP: Record<SupportedLanguage, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
  es: 'es-ES',
};

export function getDateLocale(): string {
  return LOCALE_MAP[getCurrentLanguage()] || 'ko-KR';
}

export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(getDateLocale(), options);
}

export function formatShortDate(date: Date | string): string {
  return formatDate(date, { month: 'short', day: 'numeric' });
}

export function formatFullDate(date: Date | string): string {
  return formatDate(date, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateRange(start: Date | string, end: Date | string): string {
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}
