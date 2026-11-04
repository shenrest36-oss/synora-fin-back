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

export class DebtorCreditNotesService {
  async findAll(companyId: string) {
    return prisma.debtorCreditNote.findMany({
      where: { companyId },
      include: { debtor: true, invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.debtorCreditNote.findFirst({
      where: { companyId, id },
      include: { debtor: true, invoice: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const debtorId = String(payload.debtorId ?? '').trim();
    const noteNumber = String(payload.noteNumber ?? '').trim();
    const noteDate = parseDate(payload.noteDate, 'Note date');
    const subtotal = parseDecimal(payload.subtotal, 'Subtotal');
    const taxAmount = parseDecimal(payload.taxAmount ?? 0, 'Tax amount');
    const totalAmount = parseDecimal(payload.totalAmount ?? subtotal + taxAmount, 'Total amount');
    const currencyCode = String(payload.currencyCode ?? 'USD').trim() || 'USD';

    if (!debtorId) throw new Error('Debtor is required');
    if (!noteNumber) throw new Error('Note number is required');

    const debtor = await prisma.debtor.findFirst({ where: { id: debtorId, companyId } });
    if (!debtor) throw new Error('Debtor not found');

    const existing = await prisma.debtorCreditNote.findFirst({ where: { companyId, noteNumber } });
    if (existing) throw new Error('Note number already exists');

    return prisma.debtorCreditNote.create({
      data: {
        companyId,
        debtorId,
        invoiceId: payload.invoiceId ? String(payload.invoiceId).trim() || null : null,
        noteNumber,
        noteDate,
        reason: payload.reason ? String(payload.reason).trim() : null,
        subtotal,
        taxAmount,
        totalAmount,
        currencyCode,
        status: String(payload.status ?? 'DRAFT').trim() || 'DRAFT',
        journalEntryId: payload.journalEntryId ? String(payload.journalEntryId).trim() || null : null,
        createdBy: payload.createdBy ? String(payload.createdBy).trim() : null,
      },
      include: { debtor: true, invoice: true },
    });
  }
}

export const debtorCreditNotesService = new DebtorCreditNotesService();

export async function getDebtorCreditNotesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await debtorCreditNotesService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Debtor credit notes retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getDebtorCreditNoteController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await debtorCreditNotesService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Debtor credit note not found', 404);
      return;
    }
    sendSuccess(res, item, 'Debtor credit note retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createDebtorCreditNoteController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await debtorCreditNotesService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Debtor credit note created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create debtor credit note';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('DEBTOR_CREDIT_NOTE_VIEW'), getDebtorCreditNotesController);
router.get('/:id', authorize('DEBTOR_CREDIT_NOTE_VIEW'), getDebtorCreditNoteController);
router.post('/', authorize('DEBTOR_CREDIT_NOTE_CREATE'), createDebtorCreditNoteController);

export default router;
