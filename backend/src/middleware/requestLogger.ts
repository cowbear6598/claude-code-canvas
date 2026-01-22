// Request Logger Middleware
// Logs incoming HTTP requests and their responses

import { Request, Response, NextFunction } from 'express';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Log incoming request
  console.log(`[Request] ${timestamp} - ${req.method} ${req.path}`);

  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log response with status and duration
    console.log(
      `[Response] ${timestamp} - ${req.method} ${req.path} - ${statusCode} (${duration}ms)`
    );
  });

  next();
}
