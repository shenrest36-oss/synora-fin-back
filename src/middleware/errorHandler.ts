import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { sendError } from '../utils/response';
import { config } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.isOperational
    ? err.message
    : config.isDevelopment
      ? err.message
      : 'Internal server error';

  logger.error(`${req.method} ${req.path} - ${err.message}`, err);

  sendError(res, message, statusCode);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.path} not found`, 404);
}
