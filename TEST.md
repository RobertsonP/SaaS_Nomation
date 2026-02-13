# Testing Guide

This document explains how to run tests locally and understand the CI/CD pipeline.

## Quick Start

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests (requires running app)
cd backend && npx playwright test
```

## Test Types

### Unit Tests (Jest)
Fast tests that verify individual functions and components.

**Backend:**
```bash
cd backend
npm test                          # Run all tests
npm test -- --watch               # Watch mode
npm test -- --coverage            # With coverage report
npm test -- --testPathPattern=auth  # Run specific tests
```

**Frontend:**
```bash
cd frontend
npm test                          # Run all tests
npm test -- --watch               # Watch mode
npm test -- --coverage            # With coverage report
```

### E2E Tests (Playwright)
End-to-end tests that verify full user flows in a real browser.

```bash
cd backend

# Run E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test file
npx playwright test auth.spec.ts

# Debug mode
npx playwright test --debug

# Generate report
npx playwright show-report
```

## Coverage

Coverage thresholds are enforced at **60% minimum** (will be raised to 85% over time).

View coverage reports:
- Backend: `backend/coverage/lcov-report/index.html`
- Frontend: `frontend/coverage/lcov-report/index.html`

## CI/CD Pipeline

### On Every Push
- TypeScript compilation check
- Unit tests (backend + frontend)
- Lint checks

### On Pull Request to Main
- All of the above
- E2E tests with Playwright
- Coverage report uploaded to PR

### Required Checks
PRs cannot be merged if:
- Any tests fail
- TypeScript has errors
- Build fails

## Test File Structure

```
backend/
  test/
    unit/           # Unit tests
    e2e/            # E2E Playwright tests
    api/            # API integration tests
    setup.ts        # Test setup

frontend/
  src/
    components/
      __tests__/    # Component tests
    lib/
      __tests__/    # Utility tests
```

## Writing Tests

### Backend Unit Test Example
```typescript
describe('MyService', () => {
  it('should do something', async () => {
    const result = await myService.doSomething();
    expect(result).toBe(expected);
  });
});
```

### Frontend Component Test Example
```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E Test Example
```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

## Troubleshooting

### Tests are slow
- Use `--runInBand` for sequential execution
- Check for database connection issues
- Ensure Docker services are running

### Playwright tests fail
- Run `npx playwright install` to update browsers
- Check if app is running on expected ports
- Use `--debug` flag to step through

### Coverage too low
- Check `coverageThreshold` in jest.config.js
- Run with `--coverage` to see which files need tests
