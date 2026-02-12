import '@testing-library/jest-dom';

// Mock import.meta.env for Jest (Vite uses this at runtime)
// We need to define this on the global scope for ts-jest to pick up
(globalThis as any).importMetaEnv = {
  VITE_API_URL: 'http://localhost:3002',
  PROD: false,
  DEV: true,
  MODE: 'test',
};

// Mock matchMedia for components that use media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});