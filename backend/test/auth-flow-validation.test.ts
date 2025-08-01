/**
 * Authentication Flow Validation Test
 * Tests the exact flow specified by the user:
 * 1. Check provided URLs
 * 2. Open each URL
 * 3. Check if opened URL and provided URLs match
 * 4. If current URL is login page → execute auth → navigate back → validate
 * 5. Clean session
 */

import { UnifiedAuthService } from '../src/auth/unified-auth.service';
import { LoginFlow } from '../src/ai/interfaces/element.interface';

describe('Authentication Flow Validation', () => {
  let authService: UnifiedAuthService;

  beforeEach(() => {
    authService = new UnifiedAuthService();
  });

  test('should follow the exact authentication flow as specified', async () => {
    // Mock auth flow for testing
    const mockAuthFlow: LoginFlow = {
      id: 'test-flow',
      name: 'Test Login Flow',
      loginUrl: 'https://httpbin.org/forms/post', // Public test login form
      steps: [
        { type: 'type', selector: 'input[name="custname"]', value: 'test-user', description: 'Enter username' },
        { type: 'type', selector: 'input[name="custtel"]', value: 'test-pass', description: 'Enter password' },
        { type: 'click', selector: 'input[type="submit"]', description: 'Click login button' }
      ],
      credentials: {
        username: 'test-user',
        password: 'test-pass'
      }
    };

    // Test URL that should be accessible after "authentication"
    const targetUrl = 'https://httpbin.org/html';

    console.log('🧪 Testing Authentication Flow:');
    console.log(`Target URL: ${targetUrl}`);
    console.log(`Auth Flow: ${mockAuthFlow.name}`);

    // Execute the authentication flow
    const result = await authService.authenticateForUrl(targetUrl, mockAuthFlow);

    // Validate the results
    console.log('📊 Authentication Flow Results:');
    console.log(`Success: ${result.result.success}`);
    console.log(`Final URL: ${result.result.finalUrl}`);
    console.log(`Authenticated: ${result.result.authenticated}`);
    console.log(`Redirected from Login: ${result.result.redirectedFromLogin}`);

    // Clean up
    if (result.browser) {
      await result.browser.close();
    }

    // Assertions based on expected behavior
    expect(result.result.success).toBe(true);
    expect(result.result.finalUrl).toContain(targetUrl);
  }, 60000); // 60 second timeout for browser operations

  test('should handle direct access to non-protected pages', async () => {
    // Test direct access without authentication
    const publicUrl = 'https://httpbin.org/html';

    console.log('🧪 Testing Direct Access (No Auth Required):');
    console.log(`Target URL: ${publicUrl}`);

    const result = await authService.authenticateForUrl(publicUrl);

    console.log('📊 Direct Access Results:');
    console.log(`Success: ${result.result.success}`);
    console.log(`Final URL: ${result.result.finalUrl}`);
    console.log(`Authenticated: ${result.result.authenticated}`);

    // Clean up
    if (result.browser) {
      await result.browser.close();
    }

    // Should succeed without authentication
    expect(result.result.success).toBe(true);
    expect(result.result.authenticated).toBe(false);
    expect(result.result.finalUrl).toContain(publicUrl);
  }, 30000);

  test('should validate URL matching logic', () => {
    // Test the URL matching function
    const testCases = [
      { url1: 'https://example.com/page', url2: 'https://example.com/page', expected: true },
      { url1: 'https://example.com/page', url2: 'https://example.com/page/', expected: true },
      { url1: 'https://example.com/page', url2: 'https://example.com/other', expected: false },
      { url1: 'https://example.com', url2: 'https://other.com', expected: false }
    ];

    testCases.forEach(({ url1, url2, expected }) => {
      const result = authService.urlsMatch(url1, url2);
      console.log(`URL Match Test: "${url1}" vs "${url2}" = ${result} (expected: ${expected})`);
      expect(result).toBe(expected);
    });
  });
});