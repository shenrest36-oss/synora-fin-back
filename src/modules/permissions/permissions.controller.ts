import { Request, Response, NextFunction } from 'express';
import { permissionsService } from './permissions.service';
import { sendSuccess } from '../../utils/response';

export async function getPermissionsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const permissions = await permissionsService.findAll();
    sendSuccess(res, permissions);
  } catch (err) { next(err); }
}
