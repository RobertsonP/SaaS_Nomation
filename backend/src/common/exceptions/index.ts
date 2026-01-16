/**
 * Central export file for all custom exceptions
 * Import from '@common/exceptions' in other modules
 */

// Base exception and error codes
export {
  AppException,
  ErrorCode,
  ExceptionResponse,
  ValidationException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from './app.exception';

// Project exceptions
export {
  ProjectNotFoundException,
  ProjectCreateFailedException,
  ProjectUpdateFailedException,
  ProjectDeleteFailedException,
  ProjectUrlInvalidException,
  ProjectElementNotFoundException,
} from './project.exceptions';

// Execution exceptions
export {
  ExecutionNotFoundException,
  ExecutionFailedException,
  ExecutionTimeoutException,
  ExecutionCancelledException,
  BrowserLaunchFailedException,
  SelectorNotFoundException,
  StepExecutionFailedException,
} from './execution.exceptions';

// Analysis exceptions
export {
  AnalysisFailedException,
  AnalysisTimeoutException,
  PageLoadFailedException,
  ElementExtractionFailedException,
  SelectorGenerationFailedException,
  AuthenticationRequiredException,
} from './analysis.exceptions';

// Auth exceptions
export {
  InvalidCredentialsException,
  TokenExpiredException,
  TokenInvalidException,
  AuthUserNotFoundException,
  EmailExistsException,
  RegistrationFailedException,
} from './auth.exceptions';

// Organization exceptions
export {
  OrganizationNotFoundException,
  OrganizationAccessDeniedException,
  OrganizationLimitExceededException,
} from './organization.exceptions';

// Suite and test exceptions
export {
  SuiteNotFoundException,
  SuiteCreateFailedException,
  SuiteExecutionFailedException,
  TestNotFoundException,
} from './suite.exceptions';
