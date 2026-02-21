import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/feedback/Toast/ToastContext';
import * as Sentry from '@sentry/react-native';

interface ApiErrorOptions {
  /** Custom message to show instead of default */
  customMessage?: string;
  /** Whether to report to Sentry (default: true for 5xx) */
  reportToSentry?: boolean;
  /** Whether to show a toast (default: true) */
  showToast?: boolean;
}

/**
 * Standardized API error handler hook.
 * Maps HTTP status codes to user-friendly toast messages.
 */
export function useApiError() {
  const { t } = useTranslation('common');
  const { showToast } = useToast();

  const handleError = useCallback(
    (error: any, options: ApiErrorOptions = {}) => {
      const { customMessage, reportToSentry = true, showToast: shouldToast = true } = options;
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.message;

      let message: string;
      let type: 'error' | 'warning' = 'error';

      if (customMessage) {
        message = customMessage;
      } else if (!error?.response && error?.request) {
        // Network error (no response received)
        message = t('errors.network', { defaultValue: 'Network error. Please check your connection.' });
        type = 'warning';
      } else if (status === 429) {
        message = t('errors.rateLimit', { defaultValue: 'Too many requests. Please try again shortly.' });
        type = 'warning';
      } else if (status === 403) {
        message = t('errors.forbidden', { defaultValue: 'You do not have permission for this action.' });
      } else if (status === 404) {
        message = t('errors.notFound', { defaultValue: 'The requested resource was not found.' });
      } else if (status === 423) {
        message = t('errors.locked', { defaultValue: 'Account temporarily locked. Try again later.' });
      } else if (status && status >= 500) {
        message = t('errors.server', { defaultValue: 'Server error. Please try again later.' });
      } else {
        message = serverMessage || t('errors.generic', { defaultValue: 'Something went wrong. Please try again.' });
      }

      if (shouldToast) {
        showToast({ type, message, position: 'top', duration: 4000 });
      }

      // Report 5xx errors and network errors to Sentry
      if (reportToSentry && (status >= 500 || !error?.response)) {
        Sentry.captureException(error, {
          extra: { status, serverMessage, url: error?.config?.url },
        });
      }

      return message;
    },
    [t, showToast],
  );

  return { handleError };
}
