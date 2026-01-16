import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from './app.exception';

/**
 * Exception thrown when a project is not found
 */
export class ProjectNotFoundException extends AppException {
  constructor(projectId: string) {
    super(
      `Project with ID '${projectId}' not found`,
      ErrorCode.PROJECT_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { projectId },
    );
  }
}

/**
 * Exception thrown when project creation fails
 */
export class ProjectCreateFailedException extends AppException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      `Failed to create project: ${reason}`,
      ErrorCode.PROJECT_CREATE_FAILED,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

/**
 * Exception thrown when project update fails
 */
export class ProjectUpdateFailedException extends AppException {
  constructor(projectId: string, reason: string) {
    super(
      `Failed to update project '${projectId}': ${reason}`,
      ErrorCode.PROJECT_UPDATE_FAILED,
      HttpStatus.BAD_REQUEST,
      { projectId },
    );
  }
}

/**
 * Exception thrown when project deletion fails
 */
export class ProjectDeleteFailedException extends AppException {
  constructor(projectId: string, reason: string) {
    super(
      `Failed to delete project '${projectId}': ${reason}`,
      ErrorCode.PROJECT_DELETE_FAILED,
      HttpStatus.BAD_REQUEST,
      { projectId },
    );
  }
}

/**
 * Exception thrown when a project URL is invalid
 */
export class ProjectUrlInvalidException extends AppException {
  constructor(url: string, reason?: string) {
    super(
      reason ? `Invalid project URL '${url}': ${reason}` : `Invalid project URL: '${url}'`,
      ErrorCode.PROJECT_URL_INVALID,
      HttpStatus.BAD_REQUEST,
      { url },
    );
  }
}

/**
 * Exception thrown when a project element is not found
 */
export class ProjectElementNotFoundException extends AppException {
  constructor(projectId: string, elementId: string) {
    super(
      `Element '${elementId}' not found in project '${projectId}'`,
      ErrorCode.PROJECT_ELEMENT_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { projectId, elementId },
    );
  }
}
