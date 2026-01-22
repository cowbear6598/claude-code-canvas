// Custom Error Classes
// Application-specific error classes for consistent error handling

// Base error class for all application errors
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// 404 - Resource not found
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

// 400 - Validation error
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

// 409 - Resource conflict
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

// 401 - Unauthorized
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

// 500 - Internal server error
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: unknown) {
    super(500, 'INTERNAL_ERROR', message, details);
  }
}
