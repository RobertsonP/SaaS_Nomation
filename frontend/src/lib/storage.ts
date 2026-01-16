/**
 * Centralized localStorage key management to prevent collisions
 * All keys are prefixed with the app name
 */
import { createLogger } from './logger';

const logger = createLogger('Storage');
const APP_PREFIX = 'nomation_';

export const StorageKeys = {
  AUTH_TOKEN: `${APP_PREFIX}auth_token`,
  ONBOARDING_COMPLETED: `${APP_PREFIX}onboarding_completed`,
  ONBOARDING_MINIMIZED: `${APP_PREFIX}onboarding_minimized`,
  CONTEXTUAL_HELP_ENABLED: `${APP_PREFIX}contextual_help_enabled`,
  THEME_PREFERENCE: `${APP_PREFIX}theme_preference`,

  // Dynamic keys
  testSteps: (testId: string) => `${APP_PREFIX}test_steps_${testId}`,
} as const;

/**
 * Type-safe localStorage wrapper
 */
export const storage = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      logger.error('localStorage.getItem error', error);
      return null;
    }
  },

  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      logger.error('localStorage.setItem error', error);
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logger.error('localStorage.removeItem error', error);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      logger.error('localStorage.clear error', error);
    }
  }
};
