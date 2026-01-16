import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from './app.exception';

/**
 * Exception thrown when page analysis fails
 */
export class AnalysisFailedException extends AppException {
  constructor(url: string, reason: string, details?: Record<string, unknown>) {
    super(
      `Analysis failed for '${url}': ${reason}`,
      ErrorCode.ANALYSIS_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { url, ...details },
    );
  }
}

/**
 * Exception thrown when analysis times out
 */
export class AnalysisTimeoutException extends AppException {
  constructor(url: string, timeoutMs: number) {
    super(
      `Analysis timed out for '${url}' after ${timeoutMs}ms`,
      ErrorCode.ANALYSIS_TIMEOUT,
      HttpStatus.REQUEST_TIMEOUT,
      { url, timeoutMs },
    );
  }
}

/**
 * Exception thrown when page fails to load
 */
export class PageLoadFailedException extends AppException {
  constructor(url: string, reason: string, details?: Record<string, unknown>) {
    super(
      `Failed to load page '${url}': ${reason}`,
      ErrorCode.PAGE_LOAD_FAILED,
      HttpStatus.BAD_REQUEST,
      { url, ...details },
    );
  }
}

/**
 * Exception thrown when element extraction fails
 */
export class ElementExtractionFailedException extends AppException {
  constructor(url: string, reason: string, details?: Record<string, unknown>) {
    super(
      `Failed to extract elements from '${url}': ${reason}`,
      ErrorCode.ELEMENT_EXTRACTION_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { url, ...details },
    );
  }
}

/**
 * Exception thrown when selector generation fails
 */
export class SelectorGenerationFailedException extends AppException {
  constructor(elementType: string, reason: string, details?: Record<string, unknown>) {
    super(
      `Failed to generate selector for ${elementType}: ${reason}`,
      ErrorCode.SELECTOR_GENERATION_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { elementType, ...details },
    );
  }
}

/**
 * Exception thrown when authentication is required for analysis
 */
export class AuthenticationRequiredException extends AppException {
  constructor(url: string, details?: Record<string, unknown>) {
    super(
      `Authentication required to access '${url}'`,
      ErrorCode.AUTHENTICATION_REQUIRED,
      HttpStatus.UNAUTHORIZED,
      { url, ...details },
    );
  }
}
