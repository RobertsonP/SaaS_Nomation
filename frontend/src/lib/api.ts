import axios from 'axios';
import { ProjectElement, PageAnalysisResult, SelectorValidationResult } from '../types/element.types';

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
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
        
        // Redirect to login
        window.location.href = '/login';
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
  clearElements: async (projectId: string) => {
    const response = await api.delete(`/projects/${projectId}/elements`);
    return response.data;
  },
  // Dynamic Element Discovery - Hunt New Elements
  huntNewElements: async (projectId: string, data: { steps: any[], testId: string }) => {
    const response = await api.post(`/projects/${projectId}/hunt-elements`, data);
    return response.data;
  },
  // Live Step Execution
  liveExecuteStep: async (projectId: string, data: { step: any, startingUrl: string, tempExecutionId: string }) => {
    const response = await api.post(`/projects/${projectId}/live-execute-step`, data);
    return response.data;
  },
  // Project Upload Analysis - Create Elements from Source Code
  createElements: async (projectId: string, elements: Array<{
    selector: string;
    elementType: string;
    description: string;
    attributes?: any;
    confidence?: number;
    category?: string;
    source?: string;
  }>) => {
    const response = await api.post(`/projects/${projectId}/elements`, { elements });
    return response.data;
  },
  
  // Server-side Project Folder Analysis
  analyzeProjectFolder: async (files: Array<{
    name: string;
    path: string;
    size: number;
    type: string;
    content: string;
  }>) => {
    const response = await api.post('/projects/analyze-folder', { files });
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
  createSession: async (projectId: string, authFlow?: any) => {
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
  create: (data: { name: string; description?: string; projectId: string; startingUrl: string; steps: any[] }) =>
    api.post('/api/tests', data),
  update: (testId: string, data: { name: string; description?: string; startingUrl: string; steps: any[] }) =>
    api.put(`/api/tests/${testId}`, data),
  updateSteps: (testId: string, steps: any[]) =>
    api.put(`/api/tests/${testId}/steps`, { steps }),
  execute: (testId: string) => api.post(`/api/tests/${testId}/execute`),
  delete: (testId: string) => api.delete(`/api/tests/${testId}`),
};

// Execution API
export const executionAPI = {
  run: (testId: string) => api.post(`/api/execution/test/${testId}/run`),
  runLive: (testId: string) => api.post(`/api/execution/test/${testId}/run-live`),
  stop: (executionId: string) => api.post(`/api/execution/${executionId}/stop`),
  getResults: (testId: string) => api.get(`/api/execution/test/${testId}/results`),
  getById: (executionId: string) => api.get(`/api/execution/${executionId}`),
};

// Auth Flows API
export const authFlowsAPI = {
  create: (projectId: string, authFlow: any) => api.post('/api/auth-flows', { projectId, ...authFlow }),
  getByProject: (projectId: string) => api.get(`/api/auth-flows/project/${projectId}`),
  getById: (id: string) => api.get(`/api/auth-flows/${id}`),
  update: (id: string, authFlow: any) => api.put(`/api/auth-flows/${id}`, authFlow),
  delete: (id: string) => api.delete(`/api/auth-flows/${id}`),
  // NEW: Fixed API methods for templates and testing
  getTemplates: () => api.get('/api/templates/auth'), // Updated to use standalone endpoint
  testAuth: (data: { loginUrl: string; username: string; password: string; steps?: any[] }) =>
    api.post('/api/auth-flows/test', data),
};

// Test Suites API - NEW: Complete test suite management
export const testSuitesAPI = {
  getByProject: (projectId: string) => api.get(`/api/test-suites/project/${projectId}`),
  create: (data: { name: string; description?: string; projectId: string }) =>
    api.post('/api/test-suites', data),
  getById: (suiteId: string) => api.get(`/api/test-suites/${suiteId}`),
  update: (suiteId: string, data: { name: string; description?: string; status?: string }) =>
    api.put(`/api/test-suites/${suiteId}`, data),
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

// Convenience functions for AI features
export const analyzeProjectPages = (projectId: string, urlIds?: string[]) => projectsAPI.analyze(projectId, urlIds);
export const getProjectElements = (projectId: string) => projectsAPI.getElements(projectId);
export const validateSelector = (projectId: string, selector: string) => 
  projectsAPI.validateSelector(projectId, selector);