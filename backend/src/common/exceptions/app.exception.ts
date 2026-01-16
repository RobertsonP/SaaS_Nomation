import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Error codes for categorizing exceptions across the application
 */
export enum ErrorCode {
  // General errors (1xxx)
  INTERNAL_ERROR = 'ERR_1000',
  VALIDATION_ERROR = 'ERR_1001',
  NOT_FOUND = 'ERR_1002',
  UNAUTHORIZED = 'ERR_1003',
  FORBIDDEN = 'ERR_1004',
  CONFLICT = 'ERR_1005',
  BAD_REQUEST = 'ERR_1006',

  // Project errors (2xxx)
  PROJECT_NOT_FOUND = 'ERR_2000',
  PROJECT_CREATE_FAILED = 'ERR_2001',
  PROJECT_UPDATE_FAILED = 'ERR_2002',
  PROJECT_DELETE_FAILED = 'ERR_2003',
  PROJECT_URL_INVALID = 'ERR_2004',
  PROJECT_ELEMENT_NOT_FOUND = 'ERR_2005',

  // Execution errors (3xxx)
  EXECUTION_NOT_FOUND = 'ERR_3000',
  EXECUTION_FAILED = 'ERR_3001',
  EXECUTION_TIMEOUT = 'ERR_3002',
  EXECUTION_CANCELLED = 'ERR_3003',
  BROWSER_LAUNCH_FAILED = 'ERR_3004',
  SELECTOR_NOT_FOUND = 'ERR_3005',
  STEP_EXECUTION_FAILED = 'ERR_3006',

  // Analysis errors (4xxx)
  ANALYSIS_FAILED = 'ERR_4000',
  ANALYSIS_TIMEOUT = 'ERR_4001',
  PAGE_LOAD_FAILED = 'ERR_4002',
  ELEMENT_EXTRACTION_FAILED = 'ERR_4003',
  SELECTOR_GENERATION_FAILED = 'ERR_4004',
  AUTHENTICATION_REQUIRED = 'ERR_4005',

  // Auth errors (5xxx)
  AUTH_INVALID_CREDENTIALS = 'ERR_5000',
  AUTH_TOKEN_EXPIRED = 'ERR_5001',
  AUTH_TOKEN_INVALID = 'ERR_5002',
  AUTH_USER_NOT_FOUND = 'ERR_5003',
  AUTH_EMAIL_EXISTS = 'ERR_5004',
  AUTH_REGISTRATION_FAILED = 'ERR_5005',

  // Organization errors (6xxx)
  ORG_NOT_FOUND = 'ERR_6000',
  ORG_ACCESS_DENIED = 'ERR_6001',
  ORG_LIMIT_EXCEEDED = 'ERR_6002',

  // Test Suite errors (7xxx)
  SUITE_NOT_FOUND = 'ERR_7000',
  SUITE_CREATE_FAILED = 'ERR_7001',
  SUITE_EXECUTION_FAILED = 'ERR_7002',
  TEST_NOT_FOUND = 'ERR_7003',
}

/**
 * Base exception response structure
 */
export interface ExceptionResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    path?: string;
  };
}

/**
 * Base application exception class
 * All custom exceptions should extend this class
 */
export class AppException extends HttpException {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    details?: Record<string, unknown>,
  ) {
    const response: ExceptionResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    };

    super(response, status);
    this.code = code;
    this.details = details;
  }

  /**
   * Get the error code
   */
  getErrorCode(): ErrorCode {
    return this.code;
  }

  /**
   * Get the error details
   */
  getDetails(): Record<string, unknown> | undefined {
    return this.details;
  }
}

/**
 * Validation exception for request validation errors
 */
export class ValidationException extends AppException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * Not found exception for missing resources
 */
export class NotFoundException extends AppException {
  constructor(
    resource: string,
    identifier?: string,
    code: ErrorCode = ErrorCode.NOT_FOUND,
  ) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, code, HttpStatus.NOT_FOUND, { resource, identifier });
  }
}

/**
 * Unauthorized exception for authentication failures
 */
export class UnauthorizedException extends AppException {
  constructor(message = 'Authentication required', code: ErrorCode = ErrorCode.UNAUTHORIZED) {
    super(message, code, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * Forbidden exception for authorization failures
 */
export class ForbiddenException extends AppException {
  constructor(message = 'Access denied', code: ErrorCode = ErrorCode.FORBIDDEN) {
    super(message, code, HttpStatus.FORBIDDEN);
  }
}

/**
 * Conflict exception for resource conflicts
 */
export class ConflictException extends AppException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.CONFLICT, HttpStatus.CONFLICT, details);
  }
}

/**
 * Bad request exception for invalid requests
 */
export class BadRequestException extends AppException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST, details);
  }
}
