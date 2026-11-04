import { NextFunction, Request, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendError, sendSuccess } from '../../utils/response';

function getParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function getNormalBalanceType(accountTypeName?: string | null): 'DEBIT' | 'CREDIT' {
  if (!accountTypeName) return 'DEBIT';
  const normalized = accountTypeName.toUpperCase();
  if (['LIABILITY', 'EQUITY', 'REVENUE'].some((token) => normalized.includes(token))) {
    return 'CREDIT';
  }
  return 'DEBIT';
}

async function getAccountBalanceData(companyId: string, accountId: string, filters: Record<string, string | undefined>) {
  const where: Prisma.LedgerPostingWhereInput = {
    companyId,
    ...(accountId ? { accountId } : {}),
    ...(filters.accountingPeriodId ? { accountingPeriodId: filters.accountingPeriodId } : {}),
    ...(filters.financialYearId ? { financialYearId: filters.financialYearId } : {}),
    ...(filters.startDate ? { postingDate: { gte: new Date(filters.startDate) } } : {}),
    ...(filters.endDate ? { postingDate: { lte: new Date(filters.endDate) } } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.subDepartmentId ? { subDepartmentId: filters.subDepartmentId } : {}),
  };

  const postings = await prisma.ledgerPosting.findMany({
    where,
    include: { account: { include: { accountType: true } } },
    orderBy: [{ postingDate: 'asc' }, { createdAt: 'asc' }],
  });

  const account = await prisma.chartOfAccount.findUnique({
    where: { id: accountId },
    include: { accountType: true },
  });

  let runningBalance = new Prisma.Decimal('0.00');
  const rows = postings.map((posting) => {
    const debit = new Prisma.Decimal(posting.debitAmount.toString());
    const credit = new Prisma.Decimal(posting.creditAmount.toString());
    const normalBalance = getNormalBalanceType(account?.accountType?.typeName ?? null);
    if (normalBalance === 'DEBIT') {
      runningBalance = runningBalance.plus(debit).minus(credit);
    } else {
      runningBalance = runningBalance.plus(credit).minus(debit);
    }

    return {
      ...posting,
      runningBalance: runningBalance.toString(),
    };
  });

  const openingBalance = new Prisma.Decimal('0.00');
  const totalDebits = postings.reduce((sum, p) => sum.plus(new Prisma.Decimal(p.debitAmount.toString())), new Prisma.Decimal('0.00'));
  const totalCredits = postings.reduce((sum, p) => sum.plus(new Prisma.Decimal(p.creditAmount.toString())), new Prisma.Decimal('0.00'));
  const closingBalance = normalBalanceBehaviour(account?.accountType?.typeName ?? null, openingBalance, totalDebits, totalCredits);

  return {
    account,
    openingBalance: openingBalance.toString(),
    totalDebits: totalDebits.toString(),
    totalCredits: totalCredits.toString(),
    closingBalance: closingBalance.toString(),
    entries: rows,
  };
}

function normalBalanceBehaviour(typeName: string | null, openingBalance: Prisma.Decimal, totalDebits: Prisma.Decimal, totalCredits: Prisma.Decimal): Prisma.Decimal {
  const normal = getNormalBalanceType(typeName);
  if (normal === 'DEBIT') {
    return openingBalance.plus(totalDebits).minus(totalCredits);
  }
  return openingBalance.plus(totalCredits).minus(totalDebits);
}

export async function getGeneralLedgerController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.LedgerPostingWhereInput = {
      companyId: req.user.companyId,
      ...(req.query.accountId ? { accountId: String(req.query.accountId) } : {}),
      ...(req.query.accountCode ? { account: { accountCode: { contains: String(req.query.accountCode) } } } : {}),
      ...(req.query.accountName ? { account: { accountName: { contains: String(req.query.accountName) } } } : {}),
      ...(req.query.financialYearId ? { financialYearId: String(req.query.financialYearId) } : {}),
      ...(req.query.accountingPeriodId ? { accountingPeriodId: String(req.query.accountingPeriodId) } : {}),
      ...(req.query.departmentId ? { departmentId: String(req.query.departmentId) } : {}),
      ...(req.query.subDepartmentId ? { subDepartmentId: String(req.query.subDepartmentId) } : {}),
      ...(req.query.journalNumber ? { journalEntry: { journalNumber: { contains: String(req.query.journalNumber) } } } : {}),
      ...(req.query.referenceNumber ? { referenceNumber: { contains: String(req.query.referenceNumber) } } : {}),
      ...(req.query.startDate ? { postingDate: { gte: new Date(String(req.query.startDate)) } } : {}),
      ...(req.query.endDate ? { postingDate: { lte: new Date(String(req.query.endDate)) } } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.ledgerPosting.findMany({
        where,
        include: {
          account: true,
          department: true,
          subDepartment: true,
          journalEntry: true,
        },
        orderBy: [{ postingDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.ledgerPosting.count({ where }),
    ]);

    sendSuccess(res, items, 'General ledger retrieved successfully', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getGeneralLedgerAccountBalanceController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const accountId = getParamValue(req.params.accountId);
    const result = await getAccountBalanceData(req.user.companyId, accountId, {
      financialYearId: typeof req.query.financialYearId === 'string' ? req.query.financialYearId : undefined,
      accountingPeriodId: typeof req.query.accountingPeriodId === 'string' ? req.query.accountingPeriodId : undefined,
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      departmentId: typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined,
      subDepartmentId: typeof req.query.subDepartmentId === 'string' ? req.query.subDepartmentId : undefined,
    });

    sendSuccess(res, result, 'Account balance retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getGeneralLedgerSummaryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const rows = await prisma.ledgerPosting.groupBy({
      by: ['accountId'],
      where: { companyId: req.user.companyId },
      _sum: { debitAmount: true, creditAmount: true },
    });

    sendSuccess(res, rows, 'General ledger summary retrieved successfully');
  } catch (error) {
    next(error);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('GENERAL_LEDGER_VIEW'), getGeneralLedgerController);
router.get('/accounts/:accountId/balance', authorize('ACCOUNT_BALANCE_VIEW'), getGeneralLedgerAccountBalanceController);
router.get('/summary', authorize('GENERAL_LEDGER_VIEW'), getGeneralLedgerSummaryController);

export default router;
