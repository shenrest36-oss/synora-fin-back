import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendCreated, sendError, sendSuccess } from '../../utils/response';

function normalizeAccountCode(value: string): string {
  return String(value ?? '').trim();
}

function normalizeRangeCheck(accountCode: string, category: { accountNumberStart: number; accountNumberEnd: number }) {
  if (!/^\d+$/.test(accountCode)) {
    return true;
  }

  const parsed = Number(accountCode);
  return parsed >= category.accountNumberStart && parsed <= category.accountNumberEnd;
}

export class ChartOfAccountsService {
  async findAll(companyId: string, filters: Record<string, string | undefined>) {
    return prisma.chartOfAccount.findMany({
      where: {
        companyId,
        ...(filters.accountCode ? { accountCode: { contains: filters.accountCode } } : {}),
        ...(filters.accountName ? { accountName: { contains: filters.accountName } } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.accountTypeId ? { accountTypeId: filters.accountTypeId } : {}),
        ...(filters.isActive !== undefined ? { isActive: filters.isActive === 'true' } : {}),
      },
      include: {
        category: true,
        subcategory: true,
        accountType: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>, createdBy?: string) {
    const accountCode = normalizeAccountCode(String(payload.accountCode ?? ''));
    const accountName = String(payload.accountName ?? '').trim();
    const categoryId = String(payload.categoryId ?? '').trim();

    if (!accountCode) throw new Error('Account code is required');
    if (!accountName) throw new Error('Account name is required');
    if (!categoryId) throw new Error('Account category is required');

    const category = await prisma.accountCategory.findFirst({
      where: { id: categoryId, companyId },
    });

    if (!category) throw new Error('Account category not found');
    if (!category.isActive) throw new Error('Inactive category cannot be used');

    if (!normalizeRangeCheck(accountCode, category)) {
      throw new Error(
        `Account code ${accountCode} is outside the configured range for ${category.categoryName} (${category.accountNumberStart}-${category.accountNumberEnd})`,
      );
    }

    const existing = await prisma.chartOfAccount.findFirst({
      where: { companyId, accountCode },
    });
    if (existing) {
      throw new Error('Account code already exists for this company');
    }

    let subcategoryId: string | undefined;
    if (payload.subcategoryId) {
      const subcategory = await prisma.accountSubcategory.findFirst({
        where: { id: String(payload.subcategoryId), companyId },
      });
      if (!subcategory) throw new Error('Subcategory not found');
      if (subcategory.categoryId !== categoryId) {
        throw new Error('Selected subcategory does not belong to the selected category');
      }
      subcategoryId = subcategory.id;
    } else if (payload.subcategoryName) {
      const name = String(payload.subcategoryName).trim();
      if (name) {
        const generatedCode = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20) || 'GEN';
        const existingSub = await prisma.accountSubcategory.upsert({
          where: {
            categoryId_subcategoryCode: { categoryId, subcategoryCode: generatedCode },
          },
          update: {},
          create: {
            companyId,
            categoryId,
            subcategoryCode: generatedCode,
            subcategoryName: name,
            description: 'Auto-created from account input',
          },
        });
        subcategoryId = existingSub.id;
      }
    }

    let accountTypeId: string | undefined;
    const accountTypeValue = payload.accountType ? String(payload.accountType).trim() : '';
    if (accountTypeValue) {
      const type = await prisma.accountType.upsert({
        where: {
          companyId_typeCode: {
            companyId,
            typeCode: accountTypeValue,
          },
        },
        update: { typeName: accountTypeValue },
        create: {
          companyId,
          typeCode: accountTypeValue,
          typeName: accountTypeValue,
          description: 'Created automatically for chart of accounts',
        },
      });
      accountTypeId = type.id;
    }

    return prisma.chartOfAccount.create({
      data: {
        companyId,
        categoryId,
        subcategoryId,
        accountTypeId,
        accountCode,
        accountName,
        description: payload.description ? String(payload.description).trim() : null,
        isActive: payload.isActive === false ? false : true,
        isSystemAccount: Boolean(payload.isSystemAccount),
        createdBy: createdBy ?? undefined,
        updatedBy: createdBy ?? undefined,
      },
      include: {
        category: true,
        subcategory: true,
        accountType: true,
      },
    });
  }
}

export const chartOfAccountsService = new ChartOfAccountsService();

export async function getChartOfAccountsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const items = await chartOfAccountsService.findAll(req.user.companyId, {
      accountCode: typeof req.query.accountCode === 'string' ? req.query.accountCode : undefined,
      accountName: typeof req.query.accountName === 'string' ? req.query.accountName : undefined,
      categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
      accountTypeId: typeof req.query.accountTypeId === 'string' ? req.query.accountTypeId : undefined,
      isActive: typeof req.query.isActive === 'string' ? req.query.isActive : undefined,
    });

    sendSuccess(res, items, 'Chart of accounts retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createChartOfAccountController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const item = await chartOfAccountsService.create(
      req.user.companyId,
      req.body,
      req.user.id,
    );
    sendCreated(res, item, 'Account created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create account';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('COA_VIEW'), getChartOfAccountsController);
router.post('/', authorize('COA_CREATE'), createChartOfAccountController);
router.get('/search', authorize('COA_VIEW'), getChartOfAccountsController);

export default router;
