import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from './app.exception';

/**
 * Exception thrown when an organization is not found
 */
export class OrganizationNotFoundException extends AppException {
  constructor(organizationId: string) {
    super(
      `Organization with ID '${organizationId}' not found`,
      ErrorCode.ORG_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { organizationId },
    );
  }
}

/**
 * Exception thrown when user lacks access to organization
 */
export class OrganizationAccessDeniedException extends AppException {
  constructor(organizationId: string, userId: string) {
    super(
      'You do not have access to this organization',
      ErrorCode.ORG_ACCESS_DENIED,
      HttpStatus.FORBIDDEN,
      { organizationId, userId },
    );
  }
}

/**
 * Exception thrown when organization limit is exceeded
 */
export class OrganizationLimitExceededException extends AppException {
  constructor(limitType: string, currentValue: number, maxValue: number) {
    super(
      `Organization limit exceeded: ${limitType} (${currentValue}/${maxValue})`,
      ErrorCode.ORG_LIMIT_EXCEEDED,
      HttpStatus.FORBIDDEN,
      { limitType, currentValue, maxValue },
    );
  }
}
