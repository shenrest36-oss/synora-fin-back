import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { authService } from './auth.service';
import { sendSuccess } from '../../utils/response';
import { validate } from '../../middleware/validate';

export const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.login(
      req.body as { username: string; password: string },
      req.ip,
    );
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.logout(req.user!.id, req.ip);
    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

export async function getMeController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.id);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}
