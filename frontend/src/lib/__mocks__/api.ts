// Mock API module for Jest tests
// This bypasses the import.meta.env issue in api.ts

import axios from 'axios';

const API_URL = 'http://localhost:3002';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 900000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mock all API endpoints
export const authAPI = {
  login: jest.fn(),
  register: jest.fn(),
  profile: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
};

export const projectsAPI = {
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  analyze: jest.fn(),
  getElements: jest.fn(),
  validateSelector: jest.fn(),
  validateSelectorAcrossProject: jest.fn(),
  captureElementScreenshot: jest.fn(),
  getAnalysisMetrics: jest.fn(),
  getAnalysisHistory: jest.fn(),
  getTestStats: jest.fn(),
  clearElements: jest.fn(),
  huntNewElements: jest.fn(),
  liveExecuteStep: jest.fn(),
  createElements: jest.fn(),
  importGitHub: jest.fn(),
  healSelector: jest.fn(),
  startDiscovery: jest.fn(),
  getDiscoveryProgress: jest.fn(),
  getSiteMap: jest.fn(),
  selectPagesForAnalysis: jest.fn(),
};

export const browserAPI = {
  crossOriginElementDetection: jest.fn(),
  createSession: jest.fn(),
  navigateSession: jest.fn(),
  captureElements: jest.fn(),
  executeAction: jest.fn(),
  getSessionInfo: jest.fn(),
  getSessionScreenshot: jest.fn(),
  closeSession: jest.fn(),
};

export const testsAPI = {
  getByProject: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateSteps: jest.fn(),
  execute: jest.fn(),
  delete: jest.fn(),
};

export const executionAPI = {
  run: jest.fn(),
  runLive: jest.fn(),
  getJobStatus: jest.fn(),
  stop: jest.fn(),
  getResults: jest.fn(),
  getById: jest.fn(),
};

export const authFlowsAPI = {
  create: jest.fn(),
  getByProject: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getTemplates: jest.fn(),
  testAuth: jest.fn(),
};

export const testSuitesAPI = {
  getByProject: jest.fn(),
  create: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addTests: jest.fn(),
  removeTest: jest.fn(),
  reorderTests: jest.fn(),
  execute: jest.fn(),
  getExecutions: jest.fn(),
  getExecution: jest.fn(),
};

export const billingAPI = {
  createCheckout: jest.fn(),
  createPortal: jest.fn(),
};

export const organizationsAPI = {
  removeMember: jest.fn(),
  updateMemberRole: jest.fn(),
  revokeInvite: jest.fn(),
  deleteOrganization: jest.fn(),
};

export const reportingAPI = {
  downloadPdf: jest.fn(),
  emailReport: jest.fn(),
};

export const analyzeProjectPages = jest.fn();
export const getProjectElements = jest.fn();
export const validateSelector = jest.fn();
