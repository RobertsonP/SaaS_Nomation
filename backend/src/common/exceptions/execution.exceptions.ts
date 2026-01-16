import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from './app.exception';

/**
 * Exception thrown when an execution is not found
 */
export class ExecutionNotFoundException extends AppException {
  constructor(executionId: string) {
    super(
      `Execution with ID '${executionId}' not found`,
      ErrorCode.EXECUTION_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { executionId },
    );
  }
}

/**
 * Exception thrown when test execution fails
 */
export class ExecutionFailedException extends AppException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      `Test execution failed: ${reason}`,
      ErrorCode.EXECUTION_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}

/**
 * Exception thrown when execution times out
 */
export class ExecutionTimeoutException extends AppException {
  constructor(timeoutMs: number, details?: Record<string, unknown>) {
    super(
      `Execution timed out after ${timeoutMs}ms`,
      ErrorCode.EXECUTION_TIMEOUT,
      HttpStatus.REQUEST_TIMEOUT,
      { timeoutMs, ...details },
    );
  }
}

/**
 * Exception thrown when execution is cancelled
 */
export class ExecutionCancelledException extends AppException {
  constructor(executionId: string, reason?: string) {
    super(
      reason ? `Execution '${executionId}' cancelled: ${reason}` : `Execution '${executionId}' was cancelled`,
      ErrorCode.EXECUTION_CANCELLED,
      HttpStatus.BAD_REQUEST,
      { executionId },
    );
  }
}

/**
 * Exception thrown when browser fails to launch
 */
export class BrowserLaunchFailedException extends AppException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      `Failed to launch browser: ${reason}`,
      ErrorCode.BROWSER_LAUNCH_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}

/**
 * Exception thrown when a selector cannot be found on the page
 */
export class SelectorNotFoundException extends AppException {
  constructor(selector: string, details?: Record<string, unknown>) {
    super(
      `Selector '${selector}' not found on page`,
      ErrorCode.SELECTOR_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { selector, ...details },
    );
  }
}

/**
 * Exception thrown when a test step fails to execute
 */
export class StepExecutionFailedException extends AppException {
  constructor(
    stepIndex: number,
    stepType: string,
    reason: string,
    details?: Record<string, unknown>,
  ) {
    super(
      `Step ${stepIndex + 1} (${stepType}) failed: ${reason}`,
      ErrorCode.STEP_EXECUTION_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { stepIndex, stepType, ...details },
    );
  }
}
