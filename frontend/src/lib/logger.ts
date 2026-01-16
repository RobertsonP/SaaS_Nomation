/**
 * Frontend Logger Utility
 *
 * A structured logging utility that:
 * - Provides consistent log levels (debug, info, warn, error)
 * - Filters logs based on environment (suppresses debug in production)
 * - Supports component-scoped logging
 * - Provides styled console output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  minLevel: LogLevel;
  enableTimestamps: boolean;
  enableColors: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_STYLES: Record<LogLevel, string> = {
  debug: 'color: #6b7280; font-weight: normal;',
  info: 'color: #3b82f6; font-weight: normal;',
  warn: 'color: #f59e0b; font-weight: bold;',
  error: 'color: #ef4444; font-weight: bold;',
};

const LOG_PREFIXES: Record<LogLevel, string> = {
  debug: '[DEBUG]',
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
};

// Determine environment
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
const isTest = import.meta.env.MODE === 'test';

// Default configuration
const defaultConfig: LoggerConfig = {
  minLevel: isDevelopment ? 'debug' : 'warn',
  enableTimestamps: isDevelopment,
  enableColors: true,
};

let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Check if a log level should be displayed
 */
function shouldLog(level: LogLevel): boolean {
  // Always suppress in test environment unless it's an error
  if (isTest && level !== 'error') {
    return false;
  }
  return LOG_LEVELS[level] >= LOG_LEVELS[currentConfig.minLevel];
}

/**
 * Format the log message with optional timestamp and prefix
 */
function formatMessage(level: LogLevel, scope: string | undefined, message: string): string {
  const parts: string[] = [];

  if (currentConfig.enableTimestamps) {
    parts.push(`[${new Date().toISOString().slice(11, 23)}]`);
  }

  parts.push(LOG_PREFIXES[level]);

  if (scope) {
    parts.push(`[${scope}]`);
  }

  parts.push(message);

  return parts.join(' ');
}

/**
 * Core logging function
 */
function log(level: LogLevel, scope: string | undefined, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) {
    return;
  }

  const formattedMessage = formatMessage(level, scope, message);
  const consoleMethod = level === 'debug' ? 'log' : level;

  if (currentConfig.enableColors && typeof window !== 'undefined') {
    console[consoleMethod](`%c${formattedMessage}`, LOG_STYLES[level], ...args);
  } else {
    console[consoleMethod](formattedMessage, ...args);
  }
}

/**
 * Main Logger class with scoped logging support
 */
class Logger {
  private scope?: string;

  constructor(scope?: string) {
    this.scope = scope;
  }

  /**
   * Debug level - for development debugging
   * Suppressed in production
   */
  debug(message: string, ...args: unknown[]): void {
    log('debug', this.scope, message, ...args);
  }

  /**
   * Info level - for general information
   * Suppressed in production by default
   */
  info(message: string, ...args: unknown[]): void {
    log('info', this.scope, message, ...args);
  }

  /**
   * Warn level - for warnings that don't break functionality
   * Shown in all environments
   */
  warn(message: string, ...args: unknown[]): void {
    log('warn', this.scope, message, ...args);
  }

  /**
   * Error level - for errors and exceptions
   * Always shown
   */
  error(message: string, ...args: unknown[]): void {
    log('error', this.scope, message, ...args);
  }

  /**
   * Create a child logger with a scope
   */
  child(scope: string): Logger {
    const childScope = this.scope ? `${this.scope}:${scope}` : scope;
    return new Logger(childScope);
  }
}

// Default logger instance
const defaultLogger = new Logger();

/**
 * Create a scoped logger for a specific component/module
 *
 * @example
 * const logger = createLogger('TestBuilder');
 * logger.debug('Step added', { stepId: '123' });
 */
export function createLogger(scope: string): Logger {
  return new Logger(scope);
}

// Export convenience functions for quick logging
export const logger = {
  debug: (message: string, ...args: unknown[]) => defaultLogger.debug(message, ...args),
  info: (message: string, ...args: unknown[]) => defaultLogger.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => defaultLogger.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => defaultLogger.error(message, ...args),
  child: (scope: string) => createLogger(scope),
};

export default logger;
