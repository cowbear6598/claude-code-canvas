// Error Handler Middleware
// Global error handling for Express application

import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types/index.js';
import { AppError } from '../utils/errors.js';

// Error handler middleware
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error with timestamp and stack trace
  const timestamp = new Date().toISOString();
  console.error(`[Error] ${timestamp} - ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  // Determine status code and error response
  let statusCode = 500;
  let errorResponse: ApiError = {
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
  };

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorResponse = {
      error: err.message,
      code: err.code,
      details: err.details,
    };
  }
  // Handle known error types
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorResponse.code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorResponse.code = 'UNAUTHORIZED';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorResponse.code = 'NOT_FOUND';
  }

  // Send JSON error response
  res.status(statusCode).json(errorResponse);
}
