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

export class ReceiptsService {
  async findAll(companyId: string) {
    return prisma.receipt.findMany({
      where: { companyId },
      include: { debtor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.receipt.findFirst({
      where: { companyId, id },
      include: { debtor: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const debtorId = String(payload.debtorId ?? '').trim();
    const receiptNumber = String(payload.receiptNumber ?? '').trim();
    const receiptDate = parseDate(payload.receiptDate, 'Receipt date');
    const amount = parseDecimal(payload.amount, 'Amount');

    if (!debtorId) throw new Error('Debtor is required');
    if (!receiptNumber) throw new Error('Receipt number is required');
    if (amount <= 0) throw new Error('Amount must be greater than zero');

    const debtor = await prisma.debtor.findFirst({ where: { id: debtorId, companyId } });
    if (!debtor) throw new Error('Debtor not found');

    const existing = await prisma.receipt.findFirst({ where: { companyId, receiptNumber } });
    if (existing) throw new Error('Receipt number already exists');

    return prisma.receipt.create({
      data: {
        companyId,
        debtorId,
        receiptNumber,
        receiptDate,
        amount,
        currencyCode: String(payload.currencyCode ?? 'USD').trim() || 'USD',
        paymentMethod: String(payload.paymentMethod ?? 'CASH').trim() || 'CASH',
        bankAccountId: payload.bankAccountId ? String(payload.bankAccountId).trim() || null : null,
        referenceNumber: payload.referenceNumber ? String(payload.referenceNumber).trim() : null,
        description: payload.description ? String(payload.description).trim() : null,
        status: String(payload.status ?? 'DRAFT').trim() || 'DRAFT',
        journalEntryId: payload.journalEntryId ? String(payload.journalEntryId).trim() || null : null,
        createdBy: payload.createdBy ? String(payload.createdBy).trim() : null,
      },
      include: { debtor: true },
    });
  }
}

export const receiptsService = new ReceiptsService();

export async function getReceiptsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await receiptsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Receipts retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getReceiptController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await receiptsService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Receipt not found', 404);
      return;
    }
    sendSuccess(res, item, 'Receipt retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createReceiptController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await receiptsService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Receipt created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create receipt';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('RECEIPT_VIEW'), getReceiptsController);
router.get('/:id', authorize('RECEIPT_VIEW'), getReceiptController);
router.post('/', authorize('RECEIPT_CREATE'), createReceiptController);

export default router;
