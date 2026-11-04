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

export class DebtorInvoicesService {
  async findAll(companyId: string) {
    return prisma.debtorInvoice.findMany({
      where: { companyId },
      include: { debtor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.debtorInvoice.findFirst({
      where: { companyId, id },
      include: { debtor: true, creditNotes: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const debtorId = String(payload.debtorId ?? '').trim();
    const invoiceNumber = String(payload.invoiceNumber ?? '').trim();
    const invoiceDate = parseDate(payload.invoiceDate, 'Invoice date');
    const dueDate = parseDate(payload.dueDate ?? payload.invoiceDate, 'Due date');
    const subtotal = parseDecimal(payload.subtotal, 'Subtotal');
    const taxAmount = parseDecimal(payload.taxAmount ?? 0, 'Tax amount');
    const totalAmount = parseDecimal(payload.totalAmount ?? subtotal + taxAmount, 'Total amount');
    const currencyCode = String(payload.currencyCode ?? 'USD').trim() || 'USD';

    if (!debtorId) throw new Error('Debtor is required');
    if (!invoiceNumber) throw new Error('Invoice number is required');

    const debtor = await prisma.debtor.findFirst({ where: { id: debtorId, companyId } });
    if (!debtor) throw new Error('Debtor not found');

    const existing = await prisma.debtorInvoice.findFirst({ where: { companyId, invoiceNumber } });
    if (existing) throw new Error('Invoice number already exists');

    return prisma.debtorInvoice.create({
      data: {
        companyId,
        debtorId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        referenceNumber: payload.referenceNumber ? String(payload.referenceNumber).trim() : null,
        description: payload.description ? String(payload.description).trim() : null,
        subtotal,
        taxAmount,
        totalAmount,
        allocatedAmount: parseDecimal(payload.allocatedAmount ?? 0, 'Allocated amount'),
        outstandingAmount: parseDecimal(payload.outstandingAmount ?? totalAmount, 'Outstanding amount'),
        currencyCode,
        status: String(payload.status ?? 'DRAFT').trim() || 'DRAFT',
        journalEntryId: payload.journalEntryId ? String(payload.journalEntryId).trim() || null : null,
        createdBy: payload.createdBy ? String(payload.createdBy).trim() : null,
      },
      include: { debtor: true },
    });
  }

  async update(companyId: string, id: string, payload: Record<string, unknown>) {
    const invoice = await prisma.debtorInvoice.findFirst({ where: { companyId, id } });
    if (!invoice) throw new Error('Debtor invoice not found');

    const nextNumber = payload.invoiceNumber ? String(payload.invoiceNumber).trim() : invoice.invoiceNumber;
    const nextSubtotal = payload.subtotal !== undefined ? parseDecimal(payload.subtotal, 'Subtotal') : Number(invoice.subtotal);
    const nextTax = payload.taxAmount !== undefined ? parseDecimal(payload.taxAmount, 'Tax amount') : Number(invoice.taxAmount);
    const nextTotal = payload.totalAmount !== undefined ? parseDecimal(payload.totalAmount, 'Total amount') : Number(invoice.totalAmount);
    const nextAllocated = payload.allocatedAmount !== undefined ? parseDecimal(payload.allocatedAmount, 'Allocated amount') : Number(invoice.allocatedAmount);
    const nextOutstanding = payload.outstandingAmount !== undefined ? parseDecimal(payload.outstandingAmount, 'Outstanding amount') : Number(invoice.outstandingAmount);

    const duplicate = await prisma.debtorInvoice.findFirst({
      where: { companyId, invoiceNumber: nextNumber, NOT: { id } },
    });
    if (duplicate) throw new Error('Invoice number already exists');

    return prisma.debtorInvoice.update({
      where: { id },
      data: {
        invoiceNumber: nextNumber,
        invoiceDate: payload.invoiceDate ? parseDate(payload.invoiceDate, 'Invoice date') : invoice.invoiceDate,
        dueDate: payload.dueDate ? parseDate(payload.dueDate, 'Due date') : invoice.dueDate,
        referenceNumber: payload.referenceNumber !== undefined ? payload.referenceNumber ? String(payload.referenceNumber).trim() : null : invoice.referenceNumber,
        description: payload.description !== undefined ? payload.description ? String(payload.description).trim() : null : invoice.description,
        subtotal: nextSubtotal,
        taxAmount: nextTax,
        totalAmount: nextTotal,
        allocatedAmount: nextAllocated,
        outstandingAmount: nextOutstanding,
        currencyCode: payload.currencyCode ? String(payload.currencyCode).trim() || invoice.currencyCode : invoice.currencyCode,
        status: payload.status ? String(payload.status).trim() || invoice.status : invoice.status,
        journalEntryId: payload.journalEntryId !== undefined ? payload.journalEntryId ? String(payload.journalEntryId).trim() || null : null : invoice.journalEntryId,
      },
      include: { debtor: true },
    });
  }
}

export const debtorInvoicesService = new DebtorInvoicesService();

export async function getDebtorInvoicesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await debtorInvoicesService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Debtor invoices retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getDebtorInvoiceController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await debtorInvoicesService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Debtor invoice not found', 404);
      return;
    }
    sendSuccess(res, item, 'Debtor invoice retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createDebtorInvoiceController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await debtorInvoicesService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Debtor invoice created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create debtor invoice';
    sendError(res, message, 400);
  }
}

export async function updateDebtorInvoiceController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await debtorInvoicesService.update(req.user.companyId, String(req.params.id), req.body);
    sendSuccess(res, item, 'Debtor invoice updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update debtor invoice';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('DEBTOR_INVOICE_VIEW'), getDebtorInvoicesController);
router.get('/:id', authorize('DEBTOR_INVOICE_VIEW'), getDebtorInvoiceController);
router.post('/', authorize('DEBTOR_INVOICE_CREATE'), createDebtorInvoiceController);
router.patch('/:id', authorize('DEBTOR_INVOICE_UPDATE'), updateDebtorInvoiceController);

export default router;
