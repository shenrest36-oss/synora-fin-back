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

function parseDate(value: unknown, fieldName: string): Date {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }
  return date;
}

export class BankReconciliationsService {
  async findAll(companyId: string) {
    return prisma.bankReconciliation.findMany({
      where: { companyId },
      include: { bankAccount: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.bankReconciliation.findFirst({
      where: { companyId, id },
      include: { bankAccount: true, items: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>, currentUserId?: string) {
    const bankAccountId = String(payload.bankAccountId ?? '').trim();
    const statementDate = parseDate(payload.statementDate, 'Statement date');
    const statementOpeningBalance = parseDecimal(payload.statementOpeningBalance ?? 0, 'Opening balance');
    const statementClosingBalance = parseDecimal(payload.statementClosingBalance ?? 0, 'Closing balance');

    if (!bankAccountId) throw new Error('Bank account is required');

    const bankAccount = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
    if (!bankAccount) throw new Error('Bank account not found');

    return prisma.bankReconciliation.create({
      data: {
        companyId,
        bankAccountId,
        statementDate,
        statementOpeningBalance,
        statementClosingBalance,
        importedFileName: payload.importedFileName ? String(payload.importedFileName).trim() : null,
        status: String(payload.status ?? 'OPEN').toUpperCase() || 'OPEN',
        createdBy: currentUserId ?? (payload.createdBy ? String(payload.createdBy).trim() : null),
      },
      include: { bankAccount: true, items: true },
    });
  }

  async addItem(companyId: string, reconciliationId: string, payload: Record<string, unknown>) {
    const reconciliation = await prisma.bankReconciliation.findFirst({ where: { companyId, id: reconciliationId } });
    if (!reconciliation) throw new Error('Reconciliation not found');

    const transactionDate = parseDate(payload.transactionDate, 'Transaction date');
    const amount = parseDecimal(payload.amount ?? 0, 'Amount');

    return prisma.bankReconciliationItem.create({
      data: {
        reconciliationId,
        bankTransactionId: payload.bankTransactionId ? String(payload.bankTransactionId).trim() || null : null,
        itemType: String(payload.itemType ?? 'MANUAL').toUpperCase(),
        referenceNumber: payload.referenceNumber ? String(payload.referenceNumber).trim() : null,
        transactionDate,
        description: payload.description ? String(payload.description).trim() : null,
        amount,
        direction: String(payload.direction ?? 'DEBIT').toUpperCase(),
        matchStatus: String(payload.matchStatus ?? 'UNMATCHED').toUpperCase(),
      },
    });
  }
}

export const bankReconciliationsService = new BankReconciliationsService();

export async function getBankReconciliationsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await bankReconciliationsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Bank reconciliations retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getBankReconciliationController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankReconciliationsService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Bank reconciliation not found', 404);
      return;
    }
    sendSuccess(res, item, 'Bank reconciliation retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createBankReconciliationController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankReconciliationsService.create(req.user.companyId, req.body, req.user.id);
    sendCreated(res, item, 'Bank reconciliation created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create bank reconciliation';
    sendError(res, message, 400);
  }
}

export async function addBankReconciliationItemController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankReconciliationsService.addItem(req.user.companyId, String(req.params.id), req.body);
    sendCreated(res, item, 'Reconciliation item added successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add reconciliation item';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('RECONCILIATION_VIEW'), getBankReconciliationsController);
router.get('/:id', authorize('RECONCILIATION_VIEW'), getBankReconciliationController);
router.post('/', authorize('RECONCILIATION_CREATE'), createBankReconciliationController);
router.post('/:id/items', authorize('RECONCILIATION_CREATE'), addBankReconciliationItemController);

export default router;
