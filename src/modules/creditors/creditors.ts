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

export class CreditorsService {
  async findAll(companyId: string) {
    return prisma.creditor.findMany({
      where: { companyId },
      include: { account: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.creditor.findFirst({
      where: { companyId, id },
      include: { account: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const creditorCode = String(payload.creditorCode ?? '').trim();
    const creditorName = String(payload.creditorName ?? '').trim();
    const creditorType = String(payload.creditorType ?? 'SUPPLIER').trim() || 'SUPPLIER';
    const currencyCode = String(payload.currencyCode ?? 'USD').trim() || 'USD';
    const creditLimit = parseDecimal(payload.creditLimit, 'Credit limit');
    const creditPeriodDays = Number(payload.creditPeriodDays ?? 30);
    const accountId = payload.accountId ? String(payload.accountId).trim() || null : null;

    if (!creditorCode) throw new Error('Creditor code is required');
    if (!creditorName) throw new Error('Creditor name is required');
    if (!Number.isInteger(creditPeriodDays) || creditPeriodDays < 0) {
      throw new Error('Credit period days must be a valid number');
    }

    if (accountId) {
      const account = await prisma.chartOfAccount.findFirst({
        where: { id: accountId, companyId },
      });
      if (!account) throw new Error('Account not found');
    }

    const existing = await prisma.creditor.findFirst({
      where: { companyId, creditorCode },
    });
    if (existing) throw new Error('Creditor code already exists for this company');

    return prisma.creditor.create({
      data: {
        companyId,
        branchId: payload.branchId ? String(payload.branchId).trim() || null : null,
        creditorCode,
        creditorName,
        creditorType,
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
    const creditor = await prisma.creditor.findFirst({ where: { companyId, id } });
    if (!creditor) throw new Error('Creditor not found');

    const nextCode = payload.creditorCode ? String(payload.creditorCode).trim() : creditor.creditorCode;
    const nextName = payload.creditorName ? String(payload.creditorName).trim() : creditor.creditorName;
    const nextType = payload.creditorType ? String(payload.creditorType).trim() || creditor.creditorType : creditor.creditorType;
    const nextCurrency = payload.currencyCode ? String(payload.currencyCode).trim() || creditor.currencyCode : creditor.currencyCode;
    const nextCreditLimit = payload.creditLimit !== undefined ? parseDecimal(payload.creditLimit, 'Credit limit') : Number(creditor.creditLimit);
    const nextCreditPeriod = payload.creditPeriodDays !== undefined ? Number(payload.creditPeriodDays) : creditor.creditPeriodDays;

    if (!nextCode) throw new Error('Creditor code is required');
    if (!nextName) throw new Error('Creditor name is required');
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

    const duplicate = await prisma.creditor.findFirst({
      where: { companyId, creditorCode: nextCode, NOT: { id } },
    });
    if (duplicate) throw new Error('Creditor code already exists for this company');

    return prisma.creditor.update({
      where: { id },
      data: {
        creditorCode: nextCode,
        creditorName: nextName,
        creditorType: nextType,
        contactPerson: payload.contactPerson !== undefined ? payload.contactPerson ? String(payload.contactPerson).trim() : null : creditor.contactPerson,
        email: payload.email !== undefined ? payload.email ? String(payload.email).trim() : null : creditor.email,
        phone: payload.phone !== undefined ? payload.phone ? String(payload.phone).trim() : null : creditor.phone,
        address: payload.address !== undefined ? payload.address ? String(payload.address).trim() : null : creditor.address,
        taxRegistrationNumber: payload.taxRegistrationNumber !== undefined ? payload.taxRegistrationNumber ? String(payload.taxRegistrationNumber).trim() : null : creditor.taxRegistrationNumber,
        creditLimit: nextCreditLimit,
        creditPeriodDays: nextCreditPeriod,
        currencyCode: nextCurrency,
        accountId: payload.accountId !== undefined ? payload.accountId ? String(payload.accountId).trim() || null : null : creditor.accountId,
        isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : creditor.isActive,
        updatedBy: payload.updatedBy ? String(payload.updatedBy) : creditor.updatedBy,
      },
      include: { account: true },
    });
  }

  async getAgingSummary(companyId: string) {
    const creditors = await prisma.creditor.findMany({
      where: { companyId },
      include: { invoices: { where: { status: { not: 'CANCELLED' } } } },
      orderBy: { createdAt: 'desc' },
    });

    const today = new Date();

    return creditors.map((creditor) => {
      const outstandingBalance = creditor.invoices.reduce(
        (sum, invoice) => sum + Number(invoice.outstandingAmount ?? invoice.totalAmount ?? 0),
        0,
      );

      const buckets = {
        current: 0,
        '31_60': 0,
        '61_90': 0,
        '91_plus': 0,
      };

      for (const invoice of creditor.invoices) {
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
        creditorId: creditor.id,
        creditorCode: creditor.creditorCode,
        creditorName: creditor.creditorName,
        currencyCode: creditor.currencyCode,
        outstandingBalance,
        agingBuckets: buckets,
      };
    });
  }

  async getStatement(companyId: string, creditorId: string) {
    const creditor = await prisma.creditor.findFirst({
      where: { companyId, id: creditorId },
      include: { invoices: true, payments: true },
    });

    if (!creditor) {
      throw new Error('Creditor not found');
    }

    const invoiceEntries = creditor.invoices.map((invoice) => ({
      type: 'INVOICE',
      referenceId: invoice.id,
      referenceNumber: invoice.invoiceNumber,
      date: invoice.invoiceDate,
      amount: Number(invoice.totalAmount ?? 0),
      direction: 'CREDIT',
      outstandingAmount: Number(invoice.outstandingAmount ?? 0),
    }));

    const paymentEntries = creditor.payments.map((payment) => ({
      type: 'PAYMENT',
      referenceId: payment.id,
      referenceNumber: payment.paymentNumber,
      date: payment.paymentDate,
      amount: Number(payment.amount ?? 0),
      direction: 'DEBIT',
      outstandingAmount: 0,
    }));

    const entries = [...invoiceEntries, ...paymentEntries]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((entry) => ({
        ...entry,
        amount: Number(entry.amount || 0),
      }));

    let runningBalance = 0;
    const statementEntries = entries.map((entry) => {
      const delta = entry.direction === 'CREDIT' ? Number(entry.amount) : -Number(entry.amount);
      runningBalance += delta;
      return {
        ...entry,
        runningBalance,
      };
    });

    const openingBalance = 0;
    const totalDebits = paymentEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const totalCredits = invoiceEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const outstandingBalance = creditor.invoices.reduce((sum, invoice) => sum + Number(invoice.outstandingAmount ?? 0), 0);

    return {
      creditorId: creditor.id,
      creditorCode: creditor.creditorCode,
      creditorName: creditor.creditorName,
      currencyCode: creditor.currencyCode,
      openingBalance,
      totalDebits,
      totalCredits,
      closingBalance: openingBalance + totalCredits - totalDebits,
      outstandingBalance,
      entries: statementEntries,
    };
  }
}

export const creditorsService = new CreditorsService();

export async function getCreditorsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await creditorsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Creditors retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getCreditorController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await creditorsService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Creditor not found', 404);
      return;
    }
    sendSuccess(res, item, 'Creditor retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getCreditorAgingController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const result = await creditorsService.getAgingSummary(req.user.companyId);
    sendSuccess(res, result, 'Creditor aging retrieved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to retrieve creditor aging';
    sendError(res, message, 400);
  }
}

export async function getCreditorStatementController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const result = await creditorsService.getStatement(req.user.companyId, String(req.params.id));
    sendSuccess(res, result, 'Creditor statement retrieved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to retrieve creditor statement';
    sendError(res, message, 400);
  }
}

export async function createCreditorController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await creditorsService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Creditor created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create creditor';
    sendError(res, message, 400);
  }
}

export async function updateCreditorController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await creditorsService.update(req.user.companyId, String(req.params.id), req.body);
    sendSuccess(res, item, 'Creditor updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update creditor';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/aging', authorize('CREDITOR_AGING_VIEW'), getCreditorAgingController);
router.get('/', authorize('CREDITOR_VIEW'), getCreditorsController);
router.get('/:id/statement', authorize('CREDITOR_STATEMENT_VIEW'), getCreditorStatementController);
router.get('/:id', authorize('CREDITOR_VIEW'), getCreditorController);
router.post('/', authorize('CREDITOR_CREATE'), createCreditorController);
router.patch('/:id', authorize('CREDITOR_UPDATE'), updateCreditorController);

export default router;
