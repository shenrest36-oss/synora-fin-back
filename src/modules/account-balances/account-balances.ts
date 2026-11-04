import { NextFunction, Request, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendError, sendSuccess } from '../../utils/response';

function normalBalance(typeName: string | null): 'DEBIT' | 'CREDIT' {
  if (!typeName) return 'DEBIT';
  const upper = typeName.toUpperCase();
  return ['LIABILITY', 'EQUITY', 'REVENUE'].some((token) => upper.includes(token)) ? 'CREDIT' : 'DEBIT';
}

export async function getAccountBalancesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const where: Prisma.LedgerPostingWhereInput = {
      companyId: req.user.companyId,
      ...(req.query.accountId ? { accountId: String(req.query.accountId) } : {}),
      ...(req.query.financialYearId ? { financialYearId: String(req.query.financialYearId) } : {}),
      ...(req.query.accountingPeriodId ? { accountingPeriodId: String(req.query.accountingPeriodId) } : {}),
    };

    const accounts = await prisma.chartOfAccount.findMany({
      where: { companyId: req.user.companyId },
      include: { accountType: true },
    });

    const balances = await Promise.all(
      accounts.map(async (account) => {
        const postings = await prisma.ledgerPosting.findMany({
          where: { ...where, accountId: account.id },
        });

        const debit = postings.reduce((sum, p) => sum.plus(new Prisma.Decimal(p.debitAmount.toString())), new Prisma.Decimal('0.00'));
        const credit = postings.reduce((sum, p) => sum.plus(new Prisma.Decimal(p.creditAmount.toString())), new Prisma.Decimal('0.00'));
        const balance = normalBalance(account.accountType?.typeName ?? null) === 'DEBIT'
          ? debit.minus(credit)
          : credit.minus(debit);

        return {
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          openingBalance: '0.00',
          totalDebits: debit.toString(),
          totalCredits: credit.toString(),
          closingBalance: balance.toString(),
        };
      }),
    );

    sendSuccess(res, balances, 'Account balances retrieved successfully');
  } catch (error) {
    next(error);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('ACCOUNT_BALANCE_VIEW'), getAccountBalancesController);

export default router;
