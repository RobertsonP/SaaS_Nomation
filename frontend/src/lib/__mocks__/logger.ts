/**
 * Mock Logger for Jest tests
 * Bypasses import.meta.env usage
 */

class MockLogger {
  private scope?: string;

  constructor(scope?: string) {
    this.scope = scope;
  }

  debug(_message: string, ..._args: unknown[]): void {
    // Suppressed in tests
  }

  info(_message: string, ..._args: unknown[]): void {
    // Suppressed in tests
  }

  warn(_message: string, ..._args: unknown[]): void {
    // Suppressed in tests
  }

  error(message: string, ...args: unknown[]): void {
    // Errors are logged even in tests
    console.error(`[ERROR] [${this.scope || 'root'}]`, message, ...args);
  }

  child(scope: string): MockLogger {
    const childScope = this.scope ? `${this.scope}:${scope}` : scope;
    return new MockLogger(childScope);
  }
}

export function configureLogger(_config: Record<string, unknown>): void {
  // No-op in tests
}

export function createLogger(scope: string): MockLogger {
  return new MockLogger(scope);
}

export const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: (scope: string) => createLogger(scope),
};

export default logger;
