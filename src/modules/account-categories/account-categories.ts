import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendCreated, sendError, sendSuccess } from '../../utils/response';

export class AccountCategoriesService {
  async findAll(companyId: string) {
    return prisma.accountCategory.findMany({
      where: { companyId },
      orderBy: { accountNumberStart: 'asc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.accountCategory.findFirst({
      where: { companyId, id },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const categoryCode = String(payload.categoryCode ?? '').trim();
    const categoryName = String(payload.categoryName ?? '').trim();
    const description = payload.description ? String(payload.description).trim() : null;
    const start = Number(payload.accountNumberStart);
    const end = Number(payload.accountNumberEnd);

    if (!categoryCode) throw new Error('Category code is required');
    if (!categoryName) throw new Error('Category name is required');
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error('Account number range is invalid');
    }
    if (start > end) {
      throw new Error('Account number start must be less than or equal to end');
    }

    const existing = await prisma.accountCategory.findFirst({
      where: { companyId, categoryCode },
    });
    if (existing) {
      throw new Error('Account category code already exists for this company');
    }

    const overlap = await prisma.accountCategory.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [
          {
            accountNumberStart: { lte: start },
            accountNumberEnd: { gte: start },
          },
          {
            accountNumberStart: { lte: end },
            accountNumberEnd: { gte: end },
          },
          {
            accountNumberStart: { gte: start },
            accountNumberEnd: { lte: end },
          },
        ],
      },
    });

    if (overlap) {
      throw new Error(
        `Account range overlaps with existing category ${overlap.categoryName} (${overlap.accountNumberStart}-${overlap.accountNumberEnd})`,
      );
    }

    return prisma.accountCategory.create({
      data: {
        companyId,
        categoryCode,
        categoryName,
        accountNumberStart: start,
        accountNumberEnd: end,
        description,
        isActive: payload.isActive === false ? false : true,
      },
    });
  }

  async update(companyId: string, id: string, payload: Record<string, unknown>) {
    const category = await prisma.accountCategory.findFirst({
      where: { companyId, id },
    });

    if (!category) {
      throw new Error('Account category not found');
    }

    const nextCode = payload.categoryCode
      ? String(payload.categoryCode).trim()
      : category.categoryCode;
    const nextName = payload.categoryName
      ? String(payload.categoryName).trim()
      : category.categoryName;
    const nextStart = payload.accountNumberStart != null ? Number(payload.accountNumberStart) : category.accountNumberStart;
    const nextEnd = payload.accountNumberEnd != null ? Number(payload.accountNumberEnd) : category.accountNumberEnd;

    if (!nextCode) throw new Error('Category code is required');
    if (!nextName) throw new Error('Category name is required');
    if (!Number.isFinite(nextStart) || !Number.isFinite(nextEnd)) {
      throw new Error('Account number range is invalid');
    }
    if (nextStart > nextEnd) {
      throw new Error('Account number start must be less than or equal to end');
    }

    const duplicate = await prisma.accountCategory.findFirst({
      where: {
        companyId,
        categoryCode: nextCode,
        NOT: { id },
      },
    });
    if (duplicate) {
      throw new Error('Account category code already exists for this company');
    }

    const overlap = await prisma.accountCategory.findFirst({
      where: {
        companyId,
        isActive: true,
        NOT: { id },
        OR: [
          {
            accountNumberStart: { lte: nextStart },
            accountNumberEnd: { gte: nextStart },
          },
          {
            accountNumberStart: { lte: nextEnd },
            accountNumberEnd: { gte: nextEnd },
          },
          {
            accountNumberStart: { gte: nextStart },
            accountNumberEnd: { lte: nextEnd },
          },
        ],
      },
    });
    if (overlap) {
      throw new Error(
        `Account range overlaps with existing category ${overlap.categoryName} (${overlap.accountNumberStart}-${overlap.accountNumberEnd})`,
      );
    }

    return prisma.accountCategory.update({
      where: { id },
      data: {
        categoryCode: nextCode,
        categoryName: nextName,
        accountNumberStart: nextStart,
        accountNumberEnd: nextEnd,
        description:
          payload.description !== undefined
            ? payload.description
              ? String(payload.description).trim()
              : null
            : category.description,
        isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : category.isActive,
      },
    });
  }
}

export const accountCategoriesService = new AccountCategoriesService();

export async function getAccountCategoriesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const items = await accountCategoriesService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Account categories retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createAccountCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const item = await accountCategoriesService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Account category created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create account category';
    sendError(res, message, 400);
  }
}

export async function updateAccountCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const item = await accountCategoriesService.update(
      req.user.companyId,
      String(req.params.id),
      req.body,
    );

    sendSuccess(res, item, 'Account category updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update account category';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('ACCOUNT_CATEGORY_VIEW'), getAccountCategoriesController);
router.post('/', authorize('ACCOUNT_CATEGORY_CREATE'), createAccountCategoryController);
router.put('/:id', authorize('ACCOUNT_CATEGORY_UPDATE'), updateAccountCategoryController);

export default router;
