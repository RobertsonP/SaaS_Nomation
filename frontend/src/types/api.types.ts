/**
 * API Response and Request Types
 * Centralizes all API-related type definitions
 */

import { TestStep, Test, TestExecution } from './test.types';
import { ProjectElement } from './element.types';

// ==================== Error Types ====================

/**
 * Standard API error response
 */
export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Type guard for API errors
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  );
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

// ==================== Auth Types ====================

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthStep {
  type: 'type' | 'click' | 'wait';
  selector: string;
  value?: string;
  description?: string;
  timeout?: number;
  optional?: boolean;
}

export interface AuthFlow {
  id?: string;
  name: string;
  loginUrl: string;
  steps: AuthStep[];
  credentials?: AuthCredentials;
  username?: string;
  password?: string;
  useAutoDetection?: boolean;
  manualSelectors?: {
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
  } | null;
}

export interface AuthTestRequest {
  loginUrl: string;
  username: string;
  password: string;
  steps?: AuthStep[];
}

export interface AuthTestResponse {
  success: boolean;
  message?: string;
  screenshot?: string;
  cookies?: Record<string, string>[];
}

// ==================== Project Types ====================

export interface ProjectUrl {
  id?: string;
  url: string;
  title?: string;
  description?: string;
  isVerified?: boolean;
  lastVerified?: string;
  verificationError?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  urls: ProjectUrl[];
  elements: ProjectElement[];
  authFlows?: AuthFlow[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    tests?: number;
    elements?: number;
    urls?: number;
  };
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  urls: ProjectUrl[];
  organizationId: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  urls?: ProjectUrl[];
}

// ==================== Execution Types ====================

export interface StepExecutionResult {
  stepIndex: number;
  step: TestStep;
  success: boolean;
  duration: number;
  error?: string;
  screenshot?: string;
  beforeScreenshot?: string;
  afterScreenshot?: string;
}

export interface ExecutionResult {
  testId: string;
  executionId: string;
  success: boolean;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  duration: number;
  startTime: string;
  endTime: string;
  steps: StepExecutionResult[];
  error?: string;
  videoPath?: string;
  screenshots: string[];
}

export interface LiveExecutionStepResult {
  success: boolean;
  result?: string;
  error?: string;
  step: TestStep;
  beforeScreenshot?: string;
  screenshot: string | null;
  tempExecutionId: string;
  executedAt: string;
}

export interface LiveStepRequest {
  step: TestStep;
  startingUrl: string;
  tempExecutionId: string;
}

// ==================== WebSocket Event Types ====================

export interface ExecutionProgressEvent {
  executionId: string;
  testId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'timeout';
  currentStep: number;
  totalSteps: number;
  stepResult?: StepExecutionResult;
  message?: string;
  timestamp: string;
}

export interface SuiteExecutionEvent {
  suiteId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentTest?: number;
  totalTests?: number;
  testResults?: TestExecutionSummary[];
  message?: string;
}

export interface TestExecutionSummary {
  testId: string;
  testName: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  passedSteps?: number;
  totalSteps?: number;
}

// ==================== Analysis Types ====================

export interface AnalysisProgressDetails {
  currentUrl?: string;
  currentUrlIndex?: number;
  totalUrls?: number;
  elementsFound?: number;
  step?: string;
  message?: string;
}

export interface AnalysisResult {
  success: boolean;
  elements: ProjectElement[];
  totalUrls?: number;
  analyzedUrls?: number;
  errorMessage?: string;
}

export interface FolderAnalysisResult {
  success: boolean;
  analysis: {
    projectName: string;
    framework: string;
    elements: ProjectElement[];
    pages: PageInfo[];
    statistics: AnalysisStatistics;
  };
}

export interface PageInfo {
  path: string;
  name: string;
  route?: string;
  components?: string[];
}

export interface AnalysisStatistics {
  totalFiles: number;
  totalPages: number;
  totalElements: number;
  byType: Record<string, number>;
}

// ==================== Element Hunting Types ====================

export interface ElementHuntRequest {
  steps: TestStep[];
  testId: string;
}

export interface ElementHuntResult {
  success: boolean;
  newElements?: ProjectElement[];
  totalDiscovered?: number;
  duplicatesFiltered?: number;
  error?: string;
  message?: string;
}

// ==================== Test Suite Types ====================

export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  tests: Test[];
  createdAt: string;
  updatedAt: string;
}

export interface SuiteExecutionResult {
  suiteId: string;
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  tests: TestExecutionSummary[];
}

// ==================== Notification Types ====================

export interface NotificationPreferences {
  emailNotifications?: boolean;
  executionAlerts?: boolean;
  weeklyReport?: boolean;
  emailFailures?: boolean;
  emailSuccess?: boolean;
  emailWeeklyDigest?: boolean;
  notificationEmails?: string[];
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

// ==================== File Upload Types ====================

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
  type: string;
  content?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: string;
  relativePath?: string;
}

// ==================== WebSocket Execution Event Types ====================

/**
 * Base WebSocket execution event structure
 */
export interface WebSocketExecutionEvent {
  type: 'test' | 'step' | 'suite';
  status: 'started' | 'running' | 'completed' | 'failed' | 'pending';
  message?: string;
  timestamp: string;
  details: WebSocketEventDetails;
}

export interface WebSocketEventDetails {
  stepIndex?: number;
  totalSteps?: number;
  stepDescription?: string;
  duration?: number;
  error?: string;
  currentTest?: number;
  totalTests?: number;
  testName?: string;
  testId?: string;
  passedSteps?: number;
  failedSteps?: number;
}

/**
 * Test-specific WebSocket event
 */
export interface TestWebSocketEvent extends WebSocketExecutionEvent {
  type: 'test';
  details: {
    duration?: number;
    error?: string;
    passedSteps?: number;
    failedSteps?: number;
    totalSteps?: number;
  };
}

/**
 * Step-specific WebSocket event
 */
export interface StepWebSocketEvent extends WebSocketExecutionEvent {
  type: 'step';
  details: {
    stepIndex: number;
    totalSteps: number;
    stepDescription: string;
    duration?: number;
    error?: string;
  };
}

/**
 * Suite-specific WebSocket event
 */
export interface SuiteWebSocketEvent extends WebSocketExecutionEvent {
  type: 'suite';
  details: {
    currentTest?: number;
    totalTests?: number;
    testName?: string;
    testId?: string;
    duration?: number;
    error?: string;
  };
}

// ==================== Session Types ====================

export interface BrowserSessionInfo {
  sessionToken: string;
  projectId: string;
  status: 'active' | 'idle' | 'closed';
  currentUrl?: string;
  createdAt: string;
}

export interface SessionScreenshot {
  screenshot: string;
  timestamp: string;
  url: string;
}

// ==================== Validation Types ====================

export interface ValidationError {
  message: string;
  statusCode?: number;
  error?: string;
  details?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

// ==================== DOM/Element Types ====================

export interface ElementCSSInfo {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  borderRadius?: string;
  padding?: string;
  margin?: string;
}

export interface ElementBoundingRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ElementAttributes {
  type?: string;
  placeholder?: string;
  cssInfo?: ElementCSSInfo;
  boundingRect?: ElementBoundingRect;
  discoveryState?: 'auto' | 'live' | 'manual' | 'upload';
  discoveryTrigger?: string;
  [key: string]: unknown;
}
