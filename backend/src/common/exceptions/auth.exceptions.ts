import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from './app.exception';

/**
 * Exception thrown when login credentials are invalid
 */
export class InvalidCredentialsException extends AppException {
  constructor() {
    super(
      'Invalid email or password',
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Exception thrown when JWT token has expired
 */
export class TokenExpiredException extends AppException {
  constructor() {
    super(
      'Authentication token has expired',
      ErrorCode.AUTH_TOKEN_EXPIRED,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Exception thrown when JWT token is invalid
 */
export class TokenInvalidException extends AppException {
  constructor(reason?: string) {
    super(
      reason ? `Invalid authentication token: ${reason}` : 'Invalid authentication token',
      ErrorCode.AUTH_TOKEN_INVALID,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Exception thrown when authenticated user is not found
 */
export class AuthUserNotFoundException extends AppException {
  constructor(userId: string) {
    super(
      `Authenticated user '${userId}' not found`,
      ErrorCode.AUTH_USER_NOT_FOUND,
      HttpStatus.UNAUTHORIZED,
      { userId },
    );
  }
}

/**
 * Exception thrown when email already exists during registration
 */
export class EmailExistsException extends AppException {
  constructor(email: string) {
    super(
      'An account with this email already exists',
      ErrorCode.AUTH_EMAIL_EXISTS,
      HttpStatus.CONFLICT,
      { email },
    );
  }
}

/**
 * Exception thrown when user registration fails
 */
export class RegistrationFailedException extends AppException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      `Registration failed: ${reason}`,
      ErrorCode.AUTH_REGISTRATION_FAILED,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}
