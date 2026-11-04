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

function generateReference(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export class PaymentVouchersService {
  async findAll(companyId: string) {
    return prisma.paymentVoucher.findMany({
      where: { companyId },
      include: { bankAccount: true, creditor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.paymentVoucher.findFirst({
      where: { companyId, id },
      include: { bankAccount: true, creditor: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>, currentUserId?: string) {
    const voucherNumber = String(payload.voucherNumber ?? '').trim() || generateReference('PV');
    const paymentType = String(payload.paymentType ?? 'GENERAL').trim().toUpperCase();
    const paymentMethod = String(payload.paymentMethod ?? 'BANK_TRANSFER').trim().toUpperCase();
    const amount = parseDecimal(payload.amount, 'Amount');
    const paymentDate = parseDate(payload.paymentDate, 'Payment date');

    if (amount <= 0) throw new Error('Amount must be greater than zero');

    let bankAccountId: string | null = null;
    if (payload.bankAccountId) {
      bankAccountId = String(payload.bankAccountId).trim();
      const bankAccount = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId, isActive: true } });
      if (!bankAccount) throw new Error('Bank account not found or inactive');
    }

    let creditorId: string | null = null;
    if (payload.creditorId) {
      creditorId = String(payload.creditorId).trim();
      const creditor = await prisma.creditor.findFirst({ where: { id: creditorId, companyId } });
      if (!creditor) throw new Error('Creditor not found');
    }

    const existing = await prisma.paymentVoucher.findFirst({ where: { companyId, voucherNumber } });
    if (existing) throw new Error('Voucher number already exists');

    return prisma.paymentVoucher.create({
      data: {
        companyId,
        bankAccountId,
        creditorId,
        voucherNumber,
        paymentType,
        paymentMethod,
        paymentDate,
        amount,
        currencyCode: String(payload.currencyCode ?? 'USD').trim() || 'USD',
        description: payload.description ? String(payload.description).trim() : null,
        status: String(payload.status ?? 'DRAFT').toUpperCase() || 'DRAFT',
        createdBy: currentUserId ?? (payload.createdBy ? String(payload.createdBy).trim() : null),
        submittedBy: payload.submittedBy ? String(payload.submittedBy).trim() : null,
      },
      include: { bankAccount: true, creditor: true },
    });
  }

  async approve(companyId: string, id: string, userId: string) {
    const item = await prisma.paymentVoucher.findFirst({ where: { companyId, id } });
    if (!item) throw new Error('Payment voucher not found');

    return prisma.paymentVoucher.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: userId },
      include: { bankAccount: true, creditor: true },
    });
  }

  async process(companyId: string, id: string, userId: string) {
    const item = await prisma.paymentVoucher.findFirst({
      where: { companyId, id },
      include: { bankAccount: true, creditor: true },
    });
    if (!item) throw new Error('Payment voucher not found');

    const bankAccount = item.bankAccountId ? await prisma.bankAccount.findFirst({ where: { id: item.bankAccountId, companyId }, include: { glAccount: true } }) : null;
    const journalNumber = `PV-${Date.now().toString(36).toUpperCase()}`;
    const creditAccountId = bankAccount?.glAccountId ?? item.bankAccountId ?? item.creditor?.accountId ?? null;
    if (!creditAccountId) {
      throw new Error('Payment voucher requires a bank account GL mapping');
    }

    const journal = await prisma.journalEntry.create({
      data: {
        companyId,
        journalNumber,
        referenceNumber: item.voucherNumber,
        journalDate: item.paymentDate,
        description: `Payment voucher ${item.voucherNumber}`,
        status: 'POSTED',
        totalDebit: item.amount.toNumber(),
        totalCredit: item.amount.toNumber(),
        sourceType: 'PAYMENT_VOUCHER',
        sourceReferenceId: item.id,
        createdBy: userId,
        approvedBy: userId,
        postedBy: userId,
        lines: {
          create: [
            {
              lineNumber: 1,
              accountId: item.creditor?.accountId ?? creditAccountId,
              description: `Supplier payment ${item.voucherNumber}`,
              debitAmount: item.amount,
              creditAmount: 0,
              currencyCode: item.currencyCode,
              baseDebitAmount: item.amount,
              baseCreditAmount: 0,
            },
            {
              lineNumber: 2,
              accountId: creditAccountId,
              description: `Bank payment ${item.voucherNumber}`,
              debitAmount: 0,
              creditAmount: item.amount,
              currencyCode: item.currencyCode,
              baseDebitAmount: 0,
              baseCreditAmount: item.amount,
            },
          ],
        },
      },
    });

    return prisma.paymentVoucher.update({
      where: { id },
      data: { status: 'PROCESSED', processedBy: userId, journalEntryId: journal.id },
      include: { bankAccount: true, creditor: true },
    });
  }
}

export const paymentVouchersService = new PaymentVouchersService();

export async function getPaymentVouchersController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await paymentVouchersService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Payment vouchers retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getPaymentVoucherController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await paymentVouchersService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Payment voucher not found', 404);
      return;
    }
    sendSuccess(res, item, 'Payment voucher retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createPaymentVoucherController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await paymentVouchersService.create(req.user.companyId, req.body, req.user.id);
    sendCreated(res, item, 'Payment voucher created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create payment voucher';
    sendError(res, message, 400);
  }
}

export async function approvePaymentVoucherController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await paymentVouchersService.approve(req.user.companyId, String(req.params.id), req.user.id);
    sendSuccess(res, item, 'Payment voucher approved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve payment voucher';
    sendError(res, message, 400);
  }
}

export async function processPaymentVoucherController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await paymentVouchersService.process(req.user.companyId, String(req.params.id), req.user.id);
    sendSuccess(res, item, 'Payment voucher processed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process payment voucher';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('PAYMENT_VOUCHER_VIEW'), getPaymentVouchersController);
router.get('/:id', authorize('PAYMENT_VOUCHER_VIEW'), getPaymentVoucherController);
router.post('/', authorize('PAYMENT_VOUCHER_CREATE'), createPaymentVoucherController);
router.patch('/:id/approve', authorize('PAYMENT_VOUCHER_APPROVE'), approvePaymentVoucherController);
router.patch('/:id/process', authorize('PAYMENT_VOUCHER_APPROVE'), processPaymentVoucherController);

export default router;
