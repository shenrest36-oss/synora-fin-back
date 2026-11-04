import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendCreated, sendError, sendSuccess } from '../../utils/response';

function parseDecimal(value: unknown, fieldName: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} is invalid`);
  }
  return parsed;
}

export class DebtorsService {
  async findAll(companyId: string) {
    return prisma.debtor.findMany({
      where: { companyId },
      include: { account: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.debtor.findFirst({
      where: { companyId, id },
      include: { account: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const debtorCode = String(payload.debtorCode ?? '').trim();
    const debtorName = String(payload.debtorName ?? '').trim();
    const debtorType = String(payload.debtorType ?? 'INDIVIDUAL').trim() || 'INDIVIDUAL';
    const currencyCode = String(payload.currencyCode ?? 'USD').trim() || 'USD';
    const creditLimit = parseDecimal(payload.creditLimit, 'Credit limit');
    const creditPeriodDays = Number(payload.creditPeriodDays ?? 30);
    const accountId = payload.accountId ? String(payload.accountId).trim() || null : null;

    if (!debtorCode) throw new Error('Debtor code is required');
    if (!debtorName) throw new Error('Debtor name is required');
    if (!Number.isInteger(creditPeriodDays) || creditPeriodDays < 0) {
      throw new Error('Credit period days must be a valid number');
    }

    if (accountId) {
      const account = await prisma.chartOfAccount.findFirst({
        where: { id: accountId, companyId },
      });
      if (!account) throw new Error('Account not found');
    }

    const existing = await prisma.debtor.findFirst({
      where: { companyId, debtorCode },
    });
    if (existing) throw new Error('Debtor code already exists for this company');

    return prisma.debtor.create({
      data: {
        companyId,
        branchId: payload.branchId ? String(payload.branchId).trim() || null : null,
        debtorCode,
        debtorName,
        debtorType,
        contactPerson: payload.contactPerson ? String(payload.contactPerson).trim() : null,
        email: payload.email ? String(payload.email).trim() : null,
        phone: payload.phone ? String(payload.phone).trim() : null,
        address: payload.address ? String(payload.address).trim() : null,
        taxRegistrationNumber: payload.taxRegistrationNumber ? String(payload.taxRegistrationNumber).trim() : null,
        creditLimit,
        creditPeriodDays,
        currencyCode,
        accountId,
        isActive: payload.isActive === false ? false : true,
        createdBy: payload.createdBy ? String(payload.createdBy) : null,
      },
      include: { account: true },
    });
  }

  async update(companyId: string, id: string, payload: Record<string, unknown>) {
    const debtor = await prisma.debtor.findFirst({ where: { companyId, id } });
    if (!debtor) throw new Error('Debtor not found');

    const nextCode = payload.debtorCode ? String(payload.debtorCode).trim() : debtor.debtorCode;
    const nextName = payload.debtorName ? String(payload.debtorName).trim() : debtor.debtorName;
    const nextType = payload.debtorType ? String(payload.debtorType).trim() || debtor.debtorType : debtor.debtorType;
    const nextCurrency = payload.currencyCode ? String(payload.currencyCode).trim() || debtor.currencyCode : debtor.currencyCode;
    const nextCreditLimit = payload.creditLimit !== undefined ? parseDecimal(payload.creditLimit, 'Credit limit') : Number(debtor.creditLimit);
    const nextCreditPeriod = payload.creditPeriodDays !== undefined ? Number(payload.creditPeriodDays) : debtor.creditPeriodDays;

    if (!nextCode) throw new Error('Debtor code is required');
    if (!nextName) throw new Error('Debtor name is required');
    if (!Number.isInteger(nextCreditPeriod) || nextCreditPeriod < 0) {
      throw new Error('Credit period days must be a valid number');
    }

    if (payload.accountId !== undefined) {
      const accountId = payload.accountId ? String(payload.accountId).trim() || null : null;
      if (accountId) {
        const account = await prisma.chartOfAccount.findFirst({ where: { id: accountId, companyId } });
        if (!account) throw new Error('Account not found');
      }
    }

    const duplicate = await prisma.debtor.findFirst({
      where: { companyId, debtorCode: nextCode, NOT: { id } },
    });
    if (duplicate) throw new Error('Debtor code already exists for this company');

    return prisma.debtor.update({
      where: { id },
      data: {
        debtorCode: nextCode,
        debtorName: nextName,
        debtorType: nextType,
        contactPerson: payload.contactPerson !== undefined ? payload.contactPerson ? String(payload.contactPerson).trim() : null : debtor.contactPerson,
        email: payload.email !== undefined ? payload.email ? String(payload.email).trim() : null : debtor.email,
        phone: payload.phone !== undefined ? payload.phone ? String(payload.phone).trim() : null : debtor.phone,
        address: payload.address !== undefined ? payload.address ? String(payload.address).trim() : null : debtor.address,
        taxRegistrationNumber: payload.taxRegistrationNumber !== undefined ? payload.taxRegistrationNumber ? String(payload.taxRegistrationNumber).trim() : null : debtor.taxRegistrationNumber,
        creditLimit: nextCreditLimit,
        creditPeriodDays: nextCreditPeriod,
        currencyCode: nextCurrency,
        accountId: payload.accountId !== undefined ? payload.accountId ? String(payload.accountId).trim() || null : null : debtor.accountId,
        isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : debtor.isActive,
        updatedBy: payload.updatedBy ? String(payload.updatedBy) : debtor.updatedBy,
      },
      include: { account: true },
    });
  }

  async getAgingSummary(companyId: string) {
    const debtors = await prisma.debtor.findMany({
      where: { companyId },
      include: { invoices: { where: { status: { not: 'CANCELLED' } } } },
      orderBy: { createdAt: 'desc' },
    });

    const today = new Date();

    return debtors.map((debtor) => {
      const outstandingBalance = debtor.invoices.reduce(
        (sum, invoice) => sum + Number(invoice.outstandingAmount ?? invoice.totalAmount ?? 0),
        0,
      );

      const buckets = {
        current: 0,
        '31_60': 0,
        '61_90': 0,
        '91_plus': 0,
      };

      for (const invoice of debtor.invoices) {
        const outstanding = Number(invoice.outstandingAmount ?? invoice.totalAmount ?? 0);
        if (outstanding <= 0) continue;

        const dueDate = new Date(invoice.dueDate);
        const diffDays = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        if (diffDays <= 0) {
          buckets.current += outstanding;
        } else if (diffDays <= 30) {
          buckets['31_60'] += outstanding;
        } else if (diffDays <= 60) {
          buckets['61_90'] += outstanding;
        } else {
          buckets['91_plus'] += outstanding;
        }
      }

      return {
        debtorId: debtor.id,
        debtorCode: debtor.debtorCode,
        debtorName: debtor.debtorName,
        currencyCode: debtor.currencyCode,
        outstandingBalance,
        agingBuckets: buckets,
      };
    });
  }

  async getStatement(companyId: string, debtorId: string) {
    const debtor = await prisma.debtor.findFirst({
      where: { companyId, id: debtorId },
      include: { invoices: true, receipts: true },
    });

    if (!debtor) {
      throw new Error('Debtor not found');
    }

    const invoiceEntries = debtor.invoices.map((invoice) => ({
      type: 'INVOICE',
      referenceId: invoice.id,
      referenceNumber: invoice.invoiceNumber,
      date: invoice.invoiceDate,
      amount: Number(invoice.totalAmount ?? 0),
      direction: 'DEBIT',
      outstandingAmount: Number(invoice.outstandingAmount ?? 0),
    }));

    const receiptEntries = debtor.receipts.map((receipt) => ({
      type: 'RECEIPT',
      referenceId: receipt.id,
      referenceNumber: receipt.receiptNumber,
      date: receipt.receiptDate,
      amount: Number(receipt.amount ?? 0),
      direction: 'CREDIT',
      outstandingAmount: 0,
    }));

    const entries = [...invoiceEntries, ...receiptEntries]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((entry) => ({
        ...entry,
        amount: Number(entry.amount || 0),
      }));

    let runningBalance = 0;
    const statementEntries = entries.map((entry) => {
      const delta = entry.direction === 'DEBIT' ? Number(entry.amount) : -Number(entry.amount);
      runningBalance += delta;
      return {
        ...entry,
        runningBalance,
      };
    });

    const openingBalance = 0;
    const totalDebits = invoiceEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const totalCredits = receiptEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const outstandingBalance = debtor.invoices.reduce((sum, invoice) => sum + Number(invoice.outstandingAmount ?? 0), 0);

    return {
      debtorId: debtor.id,
      debtorCode: debtor.debtorCode,
      debtorName: debtor.debtorName,
      currencyCode: debtor.currencyCode,
      openingBalance,
      totalDebits,
      totalCredits,
      closingBalance: openingBalance + totalDebits - totalCredits,
      outstandingBalance,
      entries: statementEntries,
    };
  }
}

export const debtorsService = new DebtorsService();

export async function getDebtorsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await debtorsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Debtors retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getDebtorController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await debtorsService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Debtor not found', 404);
      return;
    }
    sendSuccess(res, item, 'Debtor retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getDebtorAgingController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const result = await debtorsService.getAgingSummary(req.user.companyId);
    sendSuccess(res, result, 'Debtor aging retrieved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to retrieve debtor aging';
    sendError(res, message, 400);
  }
}

export async function getDebtorStatementController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const result = await debtorsService.getStatement(req.user.companyId, String(req.params.id));
    sendSuccess(res, result, 'Debtor statement retrieved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to retrieve debtor statement';
    sendError(res, message, 400);
  }
}

export async function createDebtorController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await debtorsService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Debtor created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create debtor';
    sendError(res, message, 400);
  }
}

export async function updateDebtorController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await debtorsService.update(req.user.companyId, String(req.params.id), req.body);
    sendSuccess(res, item, 'Debtor updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update debtor';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/aging', authorize('DEBTOR_AGING_VIEW'), getDebtorAgingController);
router.get('/', authorize('DEBTOR_VIEW'), getDebtorsController);
router.get('/:id/statement', authorize('DEBTOR_STATEMENT_VIEW'), getDebtorStatementController);
router.get('/:id', authorize('DEBTOR_VIEW'), getDebtorController);
router.post('/', authorize('DEBTOR_CREATE'), createDebtorController);
router.patch('/:id', authorize('DEBTOR_UPDATE'), updateDebtorController);

export default router;
