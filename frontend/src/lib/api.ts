import axios from 'axios';
import { ProjectElement, PageAnalysisResult, SelectorValidationResult } from '../types/element.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
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
  getAll: () => api.get('/api/projects'),
  getById: (id: string) => api.get(`/api/projects/${id}`),
  create: (data: { name: string; description?: string; urls: Array<{url: string; title?: string; description?: string}> }) =>
    api.post('/api/projects', data),
  update: (id: string, data: { name?: string; description?: string; urls?: Array<{url: string; title?: string; description?: string}> }) =>
    api.put(`/api/projects/${id}`, data),
  delete: (id: string) => api.delete(`/api/projects/${id}`),
  // AI Enhancement methods
  analyze: async (projectId: string): Promise<PageAnalysisResult> => {
    const response = await api.post(`/api/projects/${projectId}/analyze`);
    return response.data;
  },
  getElements: async (projectId: string): Promise<ProjectElement[]> => {
    const response = await api.get(`/api/projects/${projectId}/elements`);
    return response.data;
  },
  validateSelector: async (projectId: string, selector: string): Promise<SelectorValidationResult> => {
    const response = await api.post(`/api/projects/${projectId}/validate-selector`, { selector });
    return response.data;
  },
  captureElementScreenshot: async (projectId: string, elementId: string, selector: string, url: string) => {
    const response = await api.post(`/api/projects/${projectId}/element/${elementId}/screenshot`, { selector, url });
    return response.data;
  },
  getAnalysisMetrics: async (projectId: string) => {
    const response = await api.get(`/api/projects/${projectId}/analysis-metrics`);
    return response.data;
  },
  getAnalysisHistory: async (projectId: string) => {
    const response = await api.get(`/api/projects/${projectId}/analysis-history`);
    return response.data;
  },
  clearElements: async (projectId: string) => {
    const response = await api.delete(`/api/projects/${projectId}/elements`);
    return response.data;
  },
};

// Tests API
export const testsAPI = {
  getByProject: (projectId: string) => api.get(`/api/tests/project/${projectId}`),
  getById: (testId: string) => api.get(`/api/tests/${testId}`),
  create: (data: { name: string; description?: string; projectId: string; startingUrl: string; steps: any[] }) =>
    api.post('/api/tests', data),
  updateSteps: (testId: string, steps: any[]) =>
    api.put(`/api/tests/${testId}/steps`, { steps }),
  execute: (testId: string) => api.post(`/api/tests/${testId}/execute`),
};

// Execution API
export const executionAPI = {
  run: (testId: string) => api.post(`/api/execution/test/${testId}/run`),
  getResults: (testId: string) => api.get(`/api/execution/test/${testId}/results`),
  getById: (executionId: string) => api.get(`/api/execution/${executionId}`),
};

// Auth Flows API
export const authFlowsAPI = {
  create: (projectId: string, authFlow: any) => api.post('/api/auth-flows', { projectId, ...authFlow }),
  getByProject: (projectId: string) => api.get(`/api/auth-flows/project/${projectId}`),
  delete: (id: string) => api.delete(`/api/auth-flows/${id}`),
  // NEW: Fixed API methods for templates and testing
  getTemplates: () => api.get('/api/templates/auth'), // Updated to use standalone endpoint
  testAuth: (data: { loginUrl: string; username: string; password: string; steps?: any[] }) => 
    api.post('/api/auth-flows/test', data),
};

// Convenience functions for AI features
export const analyzeProjectPages = (projectId: string) => projectsAPI.analyze(projectId);
export const getProjectElements = (projectId: string) => projectsAPI.getElements(projectId);
export const validateSelector = (projectId: string, selector: string) => 
  projectsAPI.validateSelector(projectId, selector);