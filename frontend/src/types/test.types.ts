/**
 * Shared Test-related TypeScript types
 * This file consolidates TestStep and Test interfaces to prevent type conflicts
 */

export interface TestStep {
  id: string;
  type: 'click' | 'type' | 'wait' | 'assert' | 'hover' | 'scroll' | 'select' | 'clear' | 'doubleclick' | 'rightclick' | 'press' | 'upload' | 'check' | 'uncheck' | 'screenshot' | 'navigate';
  selector: string;
  value?: string;
  description: string;
  timeout?: number;
}

export interface Test {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  startingUrl: string;
  steps: TestStep[];
  status?: string;
  authFlowId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExecutionStepResult {
  stepIndex: number;
  step: TestStep;
  success: boolean;
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface ExecutionMetrics {
  totalDuration: number;
  averageStepDuration: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
}

export interface ExecutionLogs {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  stepIndex?: number;
}

export interface TestExecution {
  id: string;
  testId: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  results?: ExecutionStepResult[];
  errorMsg?: string;
  logs?: ExecutionLogs[];
  metrics?: ExecutionMetrics;
  screenshots?: string[];
  videoPath?: string;
  videoThumbnail?: string;
}
