import { Request, Response, NextFunction } from 'express';
import { rolesService } from './roles.service';
import { sendSuccess } from '../../utils/response';

export async function getRolesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await rolesService.findAll();
    sendSuccess(res, roles);
  } catch (err) { next(err); }
}

export async function getRoleController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = await rolesService.findById(req.params['id'] as string);
    sendSuccess(res, role);
  } catch (err) { next(err); }
}
