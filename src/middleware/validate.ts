import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { sendError } from '../utils/response';

export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map((e) => ({
      field: e.type === 'field' ? (e as { path: string }).path : 'unknown',
      message: e.msg as string,
    }));
    sendError(res, 'Validation failed', 422, validationErrors);
    return;
  }
  next();
}
