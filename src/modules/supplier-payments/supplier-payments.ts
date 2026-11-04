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

export class SupplierPaymentsService {
  async findAll(companyId: string) {
    return prisma.supplierPayment.findMany({
      where: { companyId },
      include: { creditor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.supplierPayment.findFirst({
      where: { companyId, id },
      include: { creditor: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const creditorId = String(payload.creditorId ?? '').trim();
    const paymentNumber = String(payload.paymentNumber ?? '').trim();
    const paymentDate = parseDate(payload.paymentDate, 'Payment date');
    const amount = parseDecimal(payload.amount, 'Amount');

    if (!creditorId) throw new Error('Creditor is required');
    if (!paymentNumber) throw new Error('Payment number is required');
    if (amount <= 0) throw new Error('Amount must be greater than zero');

    const creditor = await prisma.creditor.findFirst({ where: { id: creditorId, companyId } });
    if (!creditor) throw new Error('Creditor not found');

    const existing = await prisma.supplierPayment.findFirst({ where: { companyId, paymentNumber } });
    if (existing) throw new Error('Payment number already exists');

    return prisma.supplierPayment.create({
      data: {
        companyId,
        creditorId,
        paymentNumber,
        paymentDate,
        amount,
        currencyCode: String(payload.currencyCode ?? 'USD').trim() || 'USD',
        paymentMethod: String(payload.paymentMethod ?? 'BANK').trim() || 'BANK',
        bankAccountId: payload.bankAccountId ? String(payload.bankAccountId).trim() || null : null,
        referenceNumber: payload.referenceNumber ? String(payload.referenceNumber).trim() : null,
        description: payload.description ? String(payload.description).trim() : null,
        status: String(payload.status ?? 'DRAFT').trim() || 'DRAFT',
        journalEntryId: payload.journalEntryId ? String(payload.journalEntryId).trim() || null : null,
        createdBy: payload.createdBy ? String(payload.createdBy).trim() : null,
      },
      include: { creditor: true },
    });
  }
}

export const supplierPaymentsService = new SupplierPaymentsService();

export async function getSupplierPaymentsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await supplierPaymentsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Supplier payments retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getSupplierPaymentController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await supplierPaymentsService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Supplier payment not found', 404);
      return;
    }
    sendSuccess(res, item, 'Supplier payment retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createSupplierPaymentController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await supplierPaymentsService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Supplier payment created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create supplier payment';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('SUPPLIER_PAYMENT_VIEW'), getSupplierPaymentsController);
router.get('/:id', authorize('SUPPLIER_PAYMENT_VIEW'), getSupplierPaymentController);
router.post('/', authorize('SUPPLIER_PAYMENT_CREATE'), createSupplierPaymentController);

export default router;
