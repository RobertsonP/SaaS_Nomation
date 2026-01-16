import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from './app.exception';

/**
 * Exception thrown when a test suite is not found
 */
export class SuiteNotFoundException extends AppException {
  constructor(suiteId: string) {
    super(
      `Test suite with ID '${suiteId}' not found`,
      ErrorCode.SUITE_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { suiteId },
    );
  }
}

/**
 * Exception thrown when test suite creation fails
 */
export class SuiteCreateFailedException extends AppException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      `Failed to create test suite: ${reason}`,
      ErrorCode.SUITE_CREATE_FAILED,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

/**
 * Exception thrown when test suite execution fails
 */
export class SuiteExecutionFailedException extends AppException {
  constructor(suiteId: string, reason: string, details?: Record<string, unknown>) {
    super(
      `Test suite '${suiteId}' execution failed: ${reason}`,
      ErrorCode.SUITE_EXECUTION_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { suiteId, ...details },
    );
  }
}

/**
 * Exception thrown when a test is not found
 */
export class TestNotFoundException extends AppException {
  constructor(testId: string) {
    super(
      `Test with ID '${testId}' not found`,
      ErrorCode.TEST_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { testId },
    );
  }
}
