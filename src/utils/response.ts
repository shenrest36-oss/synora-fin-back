import { Response } from 'express';
import { ApiResponse, ValidationError, PaginationMeta } from '../types/api.types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: PaginationMeta,
): void {
  const response: ApiResponse<T> = { success: true, data, message, meta };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: ValidationError[],
): void {
  const response: ApiResponse = { success: false, message, errors };
  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, message ?? 'Created successfully', 201);
}
