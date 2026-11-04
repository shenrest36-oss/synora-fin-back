import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export function authorize(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (requiredPermissions.length === 0) {
      next();
      return;
    }

    const hasPermission = requiredPermissions.every((perm) =>
      req.user!.permissions.includes(perm),
    );

    if (!hasPermission) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }

    next();
  };
}
