import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendError, sendSuccess } from '../../utils/response';

export class AccountTypesService {
  async findAll(companyId: string) {
    return prisma.accountType.findMany({
      where: { companyId },
      orderBy: { typeName: 'asc' },
    });
  }
}

export const accountTypesService = new AccountTypesService();

export async function getAccountTypesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const items = await accountTypesService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Account types retrieved successfully');
  } catch (error) {
    next(error);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('ACCOUNT_TYPE_VIEW'), getAccountTypesController);

export default router;
