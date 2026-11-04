import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { usersService } from './users.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { validate } from '../../middleware/validate';

export const createUserValidation = [
  body('username').trim().notEmpty().isLength({ min: 3, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  validate,
];

export async function getUsersController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await usersService.findAll({
      companyId: req.user!.companyId,
      page: req.query['page'] ? Number(req.query['page']) : 1,
      limit: req.query['limit'] ? Number(req.query['limit']) : 20,
      search: req.query['search'] as string | undefined,
    });
    sendSuccess(res, result.users, undefined, 200, result.meta);
  } catch (err) { next(err); }
}

export async function getUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await usersService.findById(req.params['id'] as string);
    sendSuccess(res, user);
  } catch (err) { next(err); }
}

export async function createUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await usersService.create({ ...req.body, companyId: req.user!.companyId }, req.user!.id);
    sendCreated(res, user);
  } catch (err) { next(err); }
}

export async function updateUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await usersService.update(req.params['id'] as string, req.body, req.user!.id);
    sendSuccess(res, user, 'User updated successfully');
  } catch (err) { next(err); }
}
