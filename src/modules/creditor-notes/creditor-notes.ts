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

export class CreditorNotesService {
  async findAll(companyId: string) {
    return prisma.creditorNote.findMany({
      where: { companyId },
      include: { creditor: true, invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.creditorNote.findFirst({
      where: { companyId, id },
      include: { creditor: true, invoice: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const creditorId = String(payload.creditorId ?? '').trim();
    const noteNumber = String(payload.noteNumber ?? '').trim();
    const noteDate = parseDate(payload.noteDate, 'Note date');
    const subtotal = parseDecimal(payload.subtotal, 'Subtotal');
    const taxAmount = parseDecimal(payload.taxAmount ?? 0, 'Tax amount');
    const totalAmount = parseDecimal(payload.totalAmount ?? subtotal + taxAmount, 'Total amount');
    const currencyCode = String(payload.currencyCode ?? 'USD').trim() || 'USD';

    if (!creditorId) throw new Error('Creditor is required');
    if (!noteNumber) throw new Error('Note number is required');

    const creditor = await prisma.creditor.findFirst({ where: { id: creditorId, companyId } });
    if (!creditor) throw new Error('Creditor not found');

    const existing = await prisma.creditorNote.findFirst({ where: { companyId, noteNumber } });
    if (existing) throw new Error('Note number already exists');

    return prisma.creditorNote.create({
      data: {
        companyId,
        creditorId,
        invoiceId: payload.invoiceId ? String(payload.invoiceId).trim() || null : null,
        noteNumber,
        noteDate,
        noteType: String(payload.noteType ?? 'CREDIT').trim() || 'CREDIT',
        reason: payload.reason ? String(payload.reason).trim() : null,
        subtotal,
        taxAmount,
        totalAmount,
        currencyCode,
        status: String(payload.status ?? 'DRAFT').trim() || 'DRAFT',
        journalEntryId: payload.journalEntryId ? String(payload.journalEntryId).trim() || null : null,
        createdBy: payload.createdBy ? String(payload.createdBy).trim() : null,
      },
      include: { creditor: true, invoice: true },
    });
  }
}

export const creditorNotesService = new CreditorNotesService();

export async function getCreditorNotesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await creditorNotesService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Creditor notes retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getCreditorNoteController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await creditorNotesService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Creditor note not found', 404);
      return;
    }
    sendSuccess(res, item, 'Creditor note retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createCreditorNoteController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await creditorNotesService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Creditor note created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create creditor note';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('CREDITOR_NOTE_VIEW'), getCreditorNotesController);
router.get('/:id', authorize('CREDITOR_NOTE_VIEW'), getCreditorNoteController);
router.post('/', authorize('CREDITOR_NOTE_CREATE'), createCreditorNoteController);

export default router;
