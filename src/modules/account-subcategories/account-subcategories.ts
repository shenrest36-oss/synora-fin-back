import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendCreated, sendError, sendSuccess } from '../../utils/response';

export class AccountSubcategoriesService {
  async findAll(companyId: string, categoryId?: string) {
    return prisma.accountSubcategory.findMany({
      where: { companyId, ...(categoryId ? { categoryId } : {}) },
      orderBy: { subcategoryName: 'asc' },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const categoryId = String(payload.categoryId ?? '').trim();
    const subcategoryCode = String(payload.subcategoryCode ?? '').trim();
    const subcategoryName = String(payload.subcategoryName ?? '').trim();

    if (!categoryId) throw new Error('Category is required');
    if (!subcategoryCode) throw new Error('Subcategory code is required');
    if (!subcategoryName) throw new Error('Subcategory name is required');

    const category = await prisma.accountCategory.findFirst({
      where: { id: categoryId, companyId },
    });

    if (!category) throw new Error('Category not found');
    if (!category.isActive) throw new Error('Inactive category cannot be used');

    const existing = await prisma.accountSubcategory.findFirst({
      where: { categoryId, subcategoryCode },
    });
    if (existing) throw new Error('Subcategory code already exists in this category');

    return prisma.accountSubcategory.create({
      data: {
        companyId,
        categoryId,
        subcategoryCode,
        subcategoryName,
        description: payload.description ? String(payload.description).trim() : null,
        isActive: payload.isActive === false ? false : true,
      },
    });
  }
}

export const accountSubcategoriesService = new AccountSubcategoriesService();

export async function getAccountSubcategoriesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const items = await accountSubcategoriesService.findAll(
      req.user.companyId,
      req.query.categoryId ? String(req.query.categoryId) : undefined,
    );

    sendSuccess(res, items, 'Account subcategories retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createAccountSubcategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const item = await accountSubcategoriesService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Account subcategory created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create account subcategory';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('ACCOUNT_SUBCATEGORY_VIEW'), getAccountSubcategoriesController);
router.post('/', authorize('ACCOUNT_SUBCATEGORY_CREATE'), createAccountSubcategoryController);

export default router;
