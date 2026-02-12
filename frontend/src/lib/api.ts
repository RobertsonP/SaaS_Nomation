import axios from 'axios';
import { ProjectElement, PageAnalysisResult, SelectorValidationResult } from '../types/element.types';
import { TestStep } from '../types/test.types';
import {
  NotificationPreferences,
  AuthFlow,
  AuthStep,
  LiveStepRequest,
  ElementHuntRequest
} from '../types/api.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 900000, // 15 minutes for enterprise project analysis (up to 1GB)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests (skip auth for public endpoints)
api.interceptors.request.use((config) => {
  // Skip auth for public endpoints
  if (config.url?.includes('/api/public/')) {
    return config;
  }

  const token = localStorage.getItem('auth_token');
  const organizationId = localStorage.getItem('organizationId');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add organizationId to all requests
  if (organizationId) {
    if (config.method === 'get') {
      config.params = { ...config.params, organizationId };
    } else if (['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
      config.data = { ...config.data, organizationId };
    }
  }

  return config;
});

// Track failed auth attempts to prevent infinite loops
let authFailureCount = 0;
const MAX_AUTH_FAILURES = 3;

// Handle auth errors with retry limits
api.interceptors.response.use(
  (response) => {
    // Reset auth failure count on successful response
    authFailureCount = 0;
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Skip auth failure tracking for public endpoints
      if (error.config?.url?.includes('/api/public/')) {
        return Promise.reject(error);
      }
      
      authFailureCount++;
      
      // Log the auth failure for debugging
      console.warn(`🔐 Auth failure ${authFailureCount}/${MAX_AUTH_FAILURES}:`, error.config?.url);
      
      // Clear auth data and redirect after max failures to prevent infinite loops
      if (authFailureCount >= MAX_AUTH_FAILURES) {
        console.error('🚨 Max auth failures reached. Clearing auth data and redirecting to login.');
        localStorage.removeItem('auth_token');
        sessionStorage.clear();

        // Prevent further requests by clearing headers
        delete api.defaults.headers.common['Authorization'];

        // Dispatch custom event for App to handle navigation properly
        // This prevents full page reload and maintains React Router state
        window.dispatchEvent(new CustomEvent('auth:logout', {
          detail: { reason: 'max_auth_failures' }
        }));

        return Promise.reject(new Error('Authentication failed after multiple attempts'));
      }
      
      // For first few failures, just remove token but don't redirect immediately
      localStorage.removeItem('auth_token');
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  profile: () => api.get('/auth/profile'),
  updateProfile: (data: { name?: string; theme?: string; timezone?: string }) =>
    api.patch('/auth/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
  getNotificationPreferences: () => api.get('/auth/notifications'),
  updateNotificationPreferences: (data: NotificationPreferences) => api.patch('/auth/notifications', data),
};

// Projects API
export const projectsAPI = {
  getAll: () => api.get('/projects'),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name: string; description?: string; urls: Array<{url: string; title?: string; description?: string}> }) =>
    api.post('/projects', data),
  update: (id: string, data: { name?: string; description?: string; urls?: Array<{url: string; title?: string; description?: string}> }) =>
    api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  // AI Enhancement methods
  analyze: async (projectId: string, urlIds?: string[]): Promise<PageAnalysisResult> => {
    const response = await api.post(`/projects/${projectId}/analyze`, { urlIds });
    return response.data;
  },
  getElements: async (projectId: string): Promise<ProjectElement[]> => {
    const response = await api.get(`/projects/${projectId}/elements`);
    return response.data;
  },
  validateSelector: async (projectId: string, selector: string): Promise<SelectorValidationResult> => {
    const response = await api.post(`/projects/${projectId}/validate-selector`, { selector });
    return response.data;
  },
  // Phase 2: Cross-page selector validation
  validateSelectorAcrossProject: async (projectId: string, selector: string): Promise<SelectorValidationResult> => {
    const response = await api.post(`/projects/${projectId}/validate-selector-cross-page`, { selector });
    return response.data;
  },
  captureElementScreenshot: async (projectId: string, elementId: string, selector: string, url: string) => {
    const response = await api.post(`/projects/${projectId}/element/${elementId}/screenshot`, { selector, url });
    return response.data;
  },
  getAnalysisMetrics: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/analysis-metrics`);
    return response.data;
  },
  getAnalysisHistory: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/analysis-history`);
    return response.data;
  },
  getTestStats: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/test-stats`);
    return response.data;
  },
  clearElements: async (projectId: string) => {
    const response = await api.delete(`/projects/${projectId}/elements`);
    return response.data;
  },
  // Dynamic Element Discovery - Hunt New Elements
  huntNewElements: async (projectId: string, data: { steps: TestStep[], testId: string }) => {
    const response = await api.post(`/projects/${projectId}/hunt-elements`, data);
    return response.data;
  },
  // Live Step Execution
  liveExecuteStep: async (projectId: string, data: { step: TestStep, startingUrl: string, tempExecutionId: string }) => {
    const response = await api.post(`/projects/${projectId}/live-execute-step`, data);
    return response.data;
  },
  // Project Upload Analysis - Create Elements from Source Code
  createElements: async (projectId: string, elements: Array<{
    selector: string;
    elementType: string;
    description: string;
    attributes?: Record<string, unknown>;
    confidence?: number;
    category?: string;
    source?: string;
  }>) => {
    const response = await api.post(`/projects/${projectId}/elements`, { elements });
    return response.data;
  },

  // GitHub Integration
  importGitHub: async (repoUrl: string, token?: string) => {
    const response = await api.post('/projects/import-github', { repoUrl, token });
    return response.data;
  },
  
  // Self-Healing
  healSelector: async (projectId: string, failedSelector: string) => {
    const response = await api.post(`/projects/${projectId}/heal-selector`, { failedSelector });
    return response.data;
  },

  // URL Discovery
  startDiscovery: async (projectId: string, rootUrl: string, options?: {
    maxDepth?: number;
    maxPages?: number;
    useSitemap?: boolean;
    authFlowId?: string;  // Optional: use authentication for discovering protected pages
  }) => {
    const response = await api.post(`/projects/${projectId}/discover`, {
      rootUrl,
      ...options,
    });
    return response.data;
  },

  getDiscoveryProgress: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/discover/progress`);
    return response.data;
  },

  getSiteMap: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/sitemap`);
    return response.data;
  },

  selectPagesForAnalysis: async (projectId: string, urlIds: string[]) => {
    const response = await api.post(`/projects/${projectId}/select-pages`, { urlIds });
    return response.data;
  },
};

// Browser API for live element interaction - Using public endpoints to bypass auth
export const browserAPI = {
  // Cross-origin element detection using backend headless browser
  crossOriginElementDetection: async (data: {
    url: string;
    clickX: number;
    clickY: number;
    viewport: { width: number; height: number };
  }) => {
    const response = await api.post('/api/public/browser/cross-origin-element-detection', data);
    return response.data;
  },
  
  // Create browser session for live interaction
  createSession: async (projectId: string, authFlow?: AuthFlow) => {
    const response = await api.post('/api/public/browser/sessions', { projectId, authFlow });
    return response.data;
  },
  
  // Navigate session to page
  navigateSession: async (sessionToken: string, url: string) => {
    const response = await api.post(`/api/public/browser/sessions/${sessionToken}/navigate`, { url });
    return response.data;
  },
  
  // Capture elements from current page in session
  captureElements: async (sessionToken: string) => {
    const response = await api.get(`/api/public/browser/sessions/${sessionToken}/elements`);
    return response.data;
  },
  
  // Execute action in browser session
  executeAction: async (sessionToken: string, action: { type: string; selector: string; value?: string }) => {
    const response = await api.post(`/api/public/browser/sessions/${sessionToken}/actions`, action);
    return response.data;
  },
  
  // Get session information
  getSessionInfo: async (sessionToken: string) => {
    const response = await api.get(`/api/public/browser/sessions/${sessionToken}`);
    return response.data;
  },
  
  // Get session screenshot for live visual display
  getSessionScreenshot: async (sessionToken: string) => {
    const response = await api.get(`/api/public/browser/sessions/${sessionToken}/screenshot`);
    return response.data;
  },
  
  // Close browser session
  closeSession: async (sessionToken: string) => {
    const response = await api.delete(`/api/public/browser/sessions/${sessionToken}`);
    return response.data;
  },
};

// Tests API
export const testsAPI = {
  getByProject: (projectId: string) => api.get(`/api/tests/project/${projectId}`),
  getById: (testId: string) => api.get(`/api/tests/${testId}`),
  create: (data: { name: string; description?: string; projectId: string; startingUrl: string; steps: TestStep[] }) =>
    api.post('/api/tests', data),
  update: (testId: string, data: { name: string; description?: string; startingUrl: string; steps: TestStep[] }) =>
    api.put(`/api/tests/${testId}`, data),
  updateSteps: (testId: string, steps: TestStep[]) =>
    api.put(`/api/tests/${testId}/steps`, { steps }),
  execute: (testId: string) => api.post(`/api/tests/${testId}/execute`),
  delete: (testId: string) => api.delete(`/api/tests/${testId}`),
};

// Execution API
export const executionAPI = {
  run: (testId: string) => api.post(`/api/execution/test/${testId}/run`),
  runLive: (testId: string) => api.post(`/api/execution/test/${testId}/run-live`),
  getJobStatus: (jobId: string) => api.get(`/api/execution/job/${jobId}`),
  stop: (executionId: string) => api.post(`/api/execution/${executionId}/stop`),
  getResults: (testId: string) => api.get(`/api/execution/test/${testId}/results`),
  getById: (executionId: string) => api.get(`/api/execution/${executionId}`),
};

// Auth Flows API
export const authFlowsAPI = {
  create: (projectId: string, authFlow: Omit<AuthFlow, 'id'>) => api.post('/api/auth-flows', { projectId, ...authFlow }),
  getByProject: (projectId: string) => api.get(`/api/auth-flows/project/${projectId}`),
  getById: (id: string) => api.get(`/api/auth-flows/${id}`),
  update: (id: string, authFlow: Partial<AuthFlow>) => api.put(`/api/auth-flows/${id}`, authFlow),
  delete: (id: string) => api.delete(`/api/auth-flows/${id}`),
  // NEW: Fixed API methods for templates and testing
  getTemplates: () => api.get('/api/templates/auth'), // Updated to use standalone endpoint
  testAuth: (data: { loginUrl: string; username: string; password: string; steps?: AuthStep[] }) =>
    api.post('/api/auth-flows/test', data),
};

// Test Suites API - NEW: Complete test suite management
export const testSuitesAPI = {
  getByProject: (projectId: string) => api.get(`/api/test-suites/project/${projectId}`),
  create: (data: { name: string; description?: string; projectId: string }) =>
    api.post('/api/test-suites', data),
  getById: (suiteId: string) => api.get(`/api/test-suites/${suiteId}`),
  update: (suiteId: string, data: { name: string; description?: string; status?: string }) =>
    api.put(`/api/test-suites/${suiteId}`, { ...data }),
  delete: (suiteId: string) => api.delete(`/api/test-suites/${suiteId}`),
  addTests: (suiteId: string, testIds: string[]) =>
    api.post(`/api/test-suites/${suiteId}/tests`, { testIds }),
  removeTest: (suiteId: string, testId: string) =>
    api.delete(`/api/test-suites/${suiteId}/tests/${testId}`),
  reorderTests: (suiteId: string, testOrder: Array<{testId: string, order: number}>) =>
    api.put(`/api/test-suites/${suiteId}/tests/reorder`, { testOrder }),
  execute: (suiteId: string) => api.post(`/api/test-suites/${suiteId}/execute`),
  getExecutions: (suiteId: string) => api.get(`/api/test-suites/${suiteId}/executions`),
  getExecution: (executionId: string) => api.get(`/api/test-suites/executions/${executionId}`)
};

// Billing API
export const billingAPI = {
  createCheckout: (organizationId: string, priceId: string) => 
    api.post('/billing/checkout', { organizationId, priceId }),
  createPortal: (organizationId: string) => 
    api.post('/billing/portal', { organizationId })
};

// Organizations API
export const organizationsAPI = {
  removeMember: (organizationId: string, userId: string) => 
    api.delete(`/organizations/${organizationId}/members/${userId}`),
  updateMemberRole: (organizationId: string, userId: string, role: string) => 
    api.patch(`/organizations/${organizationId}/members/${userId}`, { role }),
  revokeInvite: (organizationId: string, inviteId: string) => 
    api.delete(`/organizations/${organizationId}/invites/${inviteId}`),
  deleteOrganization: (organizationId: string) => 
    api.delete(`/organizations/${organizationId}`)
};

// Reporting API
export const reportingAPI = {
  downloadPdf: (executionId: string) => 
    api.get(`/reporting/execution/${executionId}/pdf`, { responseType: 'blob' }),
  emailReport: (executionId: string, email: string) => 
    api.post(`/reporting/execution/${executionId}/email`, { email })
};

// Convenience functions for AI features
export const analyzeProjectPages = (projectId: string, urlIds?: string[]) => projectsAPI.analyze(projectId, urlIds);
export const getProjectElements = (projectId: string) => projectsAPI.getElements(projectId);
export const validateSelector = (projectId: string, selector: string) => 
  projectsAPI.validateSelector(projectId, selector);