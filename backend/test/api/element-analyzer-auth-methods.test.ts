import { Test, TestingModule } from '@nestjs/testing';
import { ElementAnalyzerService } from '../../src/ai/element-analyzer.service';
import { AiService } from '../../src/ai/ai.service';
import { AdvancedSelectorGeneratorService } from '../../src/browser/advanced-selector-generator.service';

describe.skip('ElementAnalyzerService - Authentication Methods', () => {
  let service: ElementAnalyzerService;
  let mockAiService: Partial<AiService>;

  const mockAdvancedSelectorService = {
    generateSelectors: jest.fn().mockReturnValue([{
      selector: 'mock-selector',
      confidence: 1,
      type: 'css',
      description: 'Mock selector',
      isUnique: true,
      isPlaywrightOptimized: true
    }])
  };

  beforeEach(async () => {
    mockAiService = {
      // analyzeElements: jest.fn().mockResolvedValue([]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElementAnalyzerService,
        { provide: AiService, useValue: mockAiService },
        { provide: AdvancedSelectorGeneratorService, useValue: mockAdvancedSelectorService },
      ],
    }).compile();

    service = module.get<ElementAnalyzerService>(ElementAnalyzerService);
  });

  describe('detectAuthenticationNeeded', () => {
    let mockPage: any;

    beforeEach(() => {
      mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        url: jest.fn(),
        locator: jest.fn(),
        waitForTimeout: jest.fn().mockResolvedValue(undefined),
      };
    });

    it('should return false when no redirect occurs (direct access)', async () => {
      const intendedUrl = 'https://example.com/dashboard';
      mockPage.url.mockReturnValue(intendedUrl);

      const result = await service['detectAuthenticationNeeded'](mockPage, intendedUrl);

      expect(result.authNeeded).toBe(false);
      expect(mockPage.goto).toHaveBeenCalledWith(intendedUrl, expect.any(Object));
    });

    it('should return true when redirected to login page', async () => {
      const intendedUrl = 'https://example.com/dashboard';
      const loginUrl = 'https://example.com/login';
      
      mockPage.url.mockReturnValue(loginUrl);

      const result = await service['detectAuthenticationNeeded'](mockPage, intendedUrl);

      expect(result.authNeeded).toBe(true);
      expect(result.redirectedUrl).toBe(loginUrl);
      expect(result.isLoginPage).toBe(true);
      expect(result.reason).toContain('Redirected to login page');
    });

    it('should return true when access denied detected', async () => {
      const intendedUrl = 'https://example.com/dashboard';
      const redirectUrl = 'https://example.com/unauthorized';
      
      mockPage.url.mockReturnValue(redirectUrl);
      
      // Mock checkForAccessDenied to return true
      const mockLocator = {
        count: jest.fn().mockResolvedValue(1),
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const result = await service['detectAuthenticationNeeded'](mockPage, intendedUrl);

      expect(result.authNeeded).toBe(true);
      expect(result.redirectedUrl).toBe(redirectUrl);
      expect(result.isLoginPage).toBe(false);
      expect(result.reason).toContain('Access denied');
    });

    it('should return false when redirected to non-login page without access denied', async () => {
      const intendedUrl = 'https://example.com/dashboard';
      const redirectUrl = 'https://example.com/welcome';
      
      mockPage.url.mockReturnValue(redirectUrl);
      
      // Mock checkForAccessDenied to return false
      const mockLocator = {
        count: jest.fn().mockResolvedValue(0),
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const result = await service['detectAuthenticationNeeded'](mockPage, intendedUrl);

      expect(result.authNeeded).toBe(false);
      expect(result.redirectedUrl).toBe(redirectUrl);
      expect(result.reason).toContain('Redirected to non-login page');
    });

    it('should handle errors gracefully', async () => {
      const intendedUrl = 'https://example.com/dashboard';
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      const result = await service['detectAuthenticationNeeded'](mockPage, intendedUrl);

      expect(result.authNeeded).toBe(false);
      expect(result.reason).toContain('Error during detection');
    });
  });

  describe('isLoginPage', () => {
    it('should identify common login page patterns', () => {
      const loginUrls = [
        'https://example.com/login',
        'https://example.com/signin',
        'https://example.com/sign-in',
        'https://example.com/auth',
        'https://example.com/authentication',
        'https://example.com/logon',
        'https://example.com/sso',
        'https://example.com/oauth',
        'https://example.com/login.php',
        'https://example.com/login.html',
        'https://example.com/login.aspx',
        'https://EXAMPLE.COM/LOGIN', // Test case insensitive
      ];

      loginUrls.forEach(url => {
        expect(service['isLoginPage'](url)).toBe(true);
      });
    });

    it('should not identify non-login pages', () => {
      const nonLoginUrls = [
        'https://example.com/dashboard',
        'https://example.com/home',
        'https://example.com/profile',
        'https://example.com/settings',
        'https://example.com/logout',
        'https://example.com/register',
        'https://example.com/signup',
        'https://example.com/aboutlogin', // Contains login but not as path
      ];

      nonLoginUrls.forEach(url => {
        expect(service['isLoginPage'](url)).toBe(false);
      });
    });
  });

  describe('urlsMatch', () => {
    it('should match identical URLs', () => {
      const url1 = 'https://example.com/dashboard';
      const url2 = 'https://example.com/dashboard';
      
      expect(service['urlsMatch'](url1, url2)).toBe(true);
    });

    it('should match URLs with same origin and path but different query parameters', () => {
      const url1 = 'https://example.com/dashboard?param1=value1';
      const url2 = 'https://example.com/dashboard?param2=value2';
      
      expect(service['urlsMatch'](url1, url2)).toBe(true);
    });

    it('should match URLs with same origin and path but different fragments', () => {
      const url1 = 'https://example.com/dashboard#section1';
      const url2 = 'https://example.com/dashboard#section2';
      
      expect(service['urlsMatch'](url1, url2)).toBe(true);
    });

    it('should not match URLs with different origins', () => {
      const url1 = 'https://example.com/dashboard';
      const url2 = 'https://different.com/dashboard';
      
      expect(service['urlsMatch'](url1, url2)).toBe(false);
    });

    it('should not match URLs with different paths', () => {
      const url1 = 'https://example.com/dashboard';
      const url2 = 'https://example.com/profile';
      
      expect(service['urlsMatch'](url1, url2)).toBe(false);
    });

    it('should not match URLs with different protocols', () => {
      const url1 = 'https://example.com/dashboard';
      const url2 = 'http://example.com/dashboard';
      
      expect(service['urlsMatch'](url1, url2)).toBe(false);
    });

    it('should not match URLs with different ports', () => {
      const url1 = 'https://example.com:8080/dashboard';
      const url2 = 'https://example.com:3000/dashboard';
      
      expect(service['urlsMatch'](url1, url2)).toBe(false);
    });

    it('should fallback to string comparison for invalid URLs', () => {
      const url1 = 'invalid-url';
      const url2 = 'invalid-url';
      
      expect(service['urlsMatch'](url1, url2)).toBe(true);
    });

    it('should handle mixed valid and invalid URLs', () => {
      const url1 = 'https://example.com/dashboard';
      const url2 = 'invalid-url';
      
      expect(service['urlsMatch'](url1, url2)).toBe(false);
    });
  });

  describe('checkForAccessDenied', () => {
    let mockPage: any;

    beforeEach(() => {
      mockPage = {
        locator: jest.fn(),
      };
    });

    it('should detect access denied through error selectors', async () => {
      const mockLocator = {
        count: jest.fn().mockResolvedValue(1),
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const result = await service['checkForAccessDenied'](mockPage);

      expect(result).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('.error');
    });

    it('should detect access denied through specific CSS classes', async () => {
      const mockLocator = {
        count: jest.fn()
          .mockResolvedValueOnce(0) // .error
          .mockResolvedValueOnce(1), // .alert-danger
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const result = await service['checkForAccessDenied'](mockPage);

      expect(result).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('.alert-danger');
    });

    it('should detect access denied through text patterns', async () => {
      const mockLocator = {
        count: jest.fn()
          .mockResolvedValue(0) // All CSS selectors return 0
          .mockResolvedValueOnce(1), // First text pattern found
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const result = await service['checkForAccessDenied'](mockPage);

      expect(result).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('text=Access Denied');
    });

    it('should detect various access denied text patterns', async () => {
      const textPatterns = [
        'Access Denied',
        'Unauthorized',
        'Please log in',
        'Login required',
        'Authentication required',
        'Permission denied',
        'You need to sign in',
        'Please sign in',
        'Login to continue',
      ];

      for (const pattern of textPatterns) {
        const mockLocator = {
          count: jest.fn()
            .mockResolvedValue(0) // All CSS selectors return 0
            .mockImplementation((selector) => {
              if (selector === `text=${pattern}`) {
                return Promise.resolve(1);
              }
              return Promise.resolve(0);
            }),
        };
        mockPage.locator.mockReturnValue(mockLocator);

        const result = await service['checkForAccessDenied'](mockPage);

        expect(result).toBe(true);
      }
    });

    it('should return false when no access denied indicators found', async () => {
      const mockLocator = {
        count: jest.fn().mockResolvedValue(0), // All selectors return 0
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const result = await service['checkForAccessDenied'](mockPage);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockPage.locator.mockImplementation(() => {
        throw new Error('Page locator error');
      });

      const result = await service['checkForAccessDenied'](mockPage);

      expect(result).toBe(false);
    });

    it('should continue checking after locator errors', async () => {
      const mockLocator = {
        count: jest.fn()
          .mockRejectedValueOnce(new Error('Locator error')) // First selector fails
          .mockResolvedValue(1), // Second selector succeeds
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const result = await service['checkForAccessDenied'](mockPage);

      expect(result).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    let mockPage: any;

    beforeEach(() => {
      mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        url: jest.fn(),
        locator: jest.fn(),
        waitForTimeout: jest.fn().mockResolvedValue(undefined),
      };
    });

    it('should handle complete authentication flow detection', async () => {
      // Scenario: User tries to access protected page, gets redirected to login
      const intendedUrl = 'https://app.example.com/dashboard';
      const loginUrl = 'https://app.example.com/auth/login';
      
      mockPage.url.mockReturnValue(loginUrl);

      const result = await service['detectAuthenticationNeeded'](mockPage, intendedUrl);

      expect(result.authNeeded).toBe(true);
      expect(result.isLoginPage).toBe(true);
      expect(service['isLoginPage'](loginUrl)).toBe(true);
      expect(service['urlsMatch'](intendedUrl, loginUrl)).toBe(false);
    });

    it('should handle access denied scenario', async () => {
      // Scenario: User tries to access page but gets access denied
      const intendedUrl = 'https://app.example.com/admin';
      const currentUrl = 'https://app.example.com/error';
      
      mockPage.url.mockReturnValue(currentUrl);
      
      // Mock access denied detection
      const mockLocator = {
        count: jest.fn()
          .mockResolvedValue(0) // No CSS selectors match
          .mockResolvedValueOnce(1), // "Access Denied" text found
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const result = await service['detectAuthenticationNeeded'](mockPage, intendedUrl);

      expect(result.authNeeded).toBe(true);
      expect(result.isLoginPage).toBe(false);
      expect(service['isLoginPage'](currentUrl)).toBe(false);
      expect(service['urlsMatch'](intendedUrl, currentUrl)).toBe(false);
    });

    it('should handle successful direct access', async () => {
      // Scenario: User can access page directly without authentication
      const intendedUrl = 'https://app.example.com/public';
      
      mockPage.url.mockReturnValue(intendedUrl);

      const result = await service['detectAuthenticationNeeded'](mockPage, intendedUrl);

      expect(result.authNeeded).toBe(false);
      expect(service['urlsMatch'](intendedUrl, intendedUrl)).toBe(true);
    });
  });
});