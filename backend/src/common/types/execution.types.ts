/**
 * Test execution related type definitions
 */

/**
 * Test step definition
 */
export interface TestStep {
  id?: string;
  type: TestStepType;
  selector: string;
  value?: string;
  description?: string;
  timeout?: number;
  optional?: boolean;
}

/**
 * Test step types
 */
export type TestStepType =
  | 'click'
  | 'doubleclick'
  | 'rightclick'
  | 'type'
  | 'clear'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'hover'
  | 'scroll'
  | 'press'
  | 'upload'
  | 'wait'
  | 'navigate'
  | 'assert'
  | 'screenshot';

/**
 * Step execution result
 */
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

/**
 * Test execution result
 */
export interface TestExecutionResult {
  testId: string;
  executionId: string;
  success: boolean;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  steps: StepExecutionResult[];
  error?: string;
  videoPath?: string;
  screenshots: string[];
}

/**
 * Execution status
 */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'cancelled'
  | 'timeout';

/**
 * Execution progress event
 */
export interface ExecutionProgressEvent {
  executionId: string;
  testId: string;
  status: ExecutionStatus;
  currentStep: number;
  totalSteps: number;
  stepResult?: StepExecutionResult;
  message?: string;
  timestamp: Date;
}

/**
 * Auth flow credentials
 */
export interface AuthCredentials {
  username: string;
  password: string;
  [key: string]: string;
}

/**
 * Auth flow configuration
 */
export interface AuthFlowConfig {
  loginUrl: string;
  credentials: AuthCredentials;
  steps: TestStep[];
  successIndicator?: string;
  failureIndicator?: string;
}

/**
 * Auth flow result
 */
export interface AuthFlowResult {
  success: boolean;
  authenticated: boolean;
  error?: string;
  cookies?: Record<string, string>[];
  sessionData?: Record<string, unknown>;
}

/**
 * Browser session data
 */
export interface BrowserSessionData {
  sessionToken: string;
  pageUrl: string;
  cookies: Record<string, string>[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

/**
 * Live execution step data
 */
export interface LiveStepData {
  step: TestStep;
  startingUrl: string;
  tempExecutionId: string;
}

/**
 * Live execution result
 */
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

/**
 * URL analysis result for multi-URL authentication-aware analysis
 */
export interface UrlAnalysisResult {
  url: string;
  elements: unknown[];  // DetectedElement[] - using unknown to avoid circular import
  success: boolean;
  errorMessage?: string;
}

/**
 * Multi-URL analysis result with authentication
 */
export interface MultiUrlAnalysisResult {
  success: boolean;
  urlResults: UrlAnalysisResult[];
  authenticationUsed: boolean;
}

/**
 * Element hunting configuration after executing test steps
 */
export interface ElementHuntConfig {
  startingUrl: string;
  steps: TestStep[];
  projectId: string;
  testId: string;
}

/**
 * Element hunting result
 */
export interface ElementHuntResult {
  success: boolean;
  elements?: unknown[];  // DetectedElement[] - using unknown to avoid circular import
  error?: string;
}
