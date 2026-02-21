import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException, ErrorCode, ExceptionResponse } from '../exceptions/app.exception';

/**
 * Global exception filter that handles all exceptions thrown in the application.
 * Provides consistent error response format across all endpoints.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorResponse: ExceptionResponse;

    if (exception instanceof AppException) {
      // Our custom exception - use its built-in response
      status = exception.getStatus();
      errorResponse = exception.getResponse() as ExceptionResponse;
      errorResponse.error.path = request.url;

      // Log based on status code
      if (status >= 500) {
        this.logger.error(
          `[${errorResponse.error.code}] ${errorResponse.error.message}`,
          exception.stack,
        );
      } else {
        this.logger.warn(
          `[${errorResponse.error.code}] ${errorResponse.error.message}`,
        );
      }
    } else if (exception instanceof HttpException) {
      // NestJS HttpException
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle validation errors from class-validator (message is always an Array)
      if (
        typeof exceptionResponse === 'object' &&
        Array.isArray((exceptionResponse as any).message)
      ) {
        const messages = (exceptionResponse as any).message;

        errorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: messages.join(', '),
            details: { validationErrors: messages },
            timestamp: new Date().toISOString(),
            path: request.url,
          },
        };
      } else {
        const message =
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any)?.message || 'An error occurred';

        errorResponse = {
          success: false,
          error: {
            code: this.mapHttpStatusToErrorCode(status),
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
          },
        };
      }

      this.logger.warn(
        `[${errorResponse.error.code}] ${errorResponse.error.message}`,
      );
    } else {
      // Unknown exception - internal server error
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const errorMessage =
        exception instanceof Error ? exception.message : 'Internal server error';

      errorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      };

      // Always log full stack for unknown errors
      this.logger.error(
        `[${ErrorCode.INTERNAL_ERROR}] Unhandled exception: ${errorMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(errorResponse);
  }

  /**
   * Maps HTTP status codes to appropriate error codes
   */
  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
