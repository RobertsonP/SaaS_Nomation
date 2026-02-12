module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.{ts,tsx}', '**/?(*.)+(spec|test).{ts,tsx}'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: false,
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Task 1.12: Coverage thresholds (60% initial, raise to 85% over time)
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  testTimeout: 10000,
  moduleNameMapper: {
    // CSS and style files - use custom mock for all CSS imports
    '^.+\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
    // Mock modules that use import.meta.env (Vite-specific)
    // These modules use import.meta.env which Jest can't parse
    '^(\\.\\./)*lib/api$': '<rootDir>/src/lib/__mocks__/api.ts',
    '^(\\.\\./)*lib/logger$': '<rootDir>/src/lib/__mocks__/logger.ts',
    '^(\\.\\./)*lib/analytics$': '<rootDir>/src/lib/__mocks__/analytics.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Transform ignore patterns - don't transform node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
};
