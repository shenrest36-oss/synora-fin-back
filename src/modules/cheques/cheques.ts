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

export class ChequesService {
  async findAll(companyId: string) {
    return prisma.cheque.findMany({
      where: { companyId },
      include: { bankAccount: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.cheque.findFirst({
      where: { companyId, id },
      include: { bankAccount: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>, currentUserId?: string) {
    const bankAccountId = String(payload.bankAccountId ?? '').trim();
    const chequeNumber = String(payload.chequeNumber ?? '').trim();
    const payee = String(payload.payee ?? '').trim();
    const amount = parseDecimal(payload.amount, 'Amount');
    const issueDate = parseDate(payload.issueDate, 'Issue date');
    const dueDate = parseDate(payload.dueDate ?? payload.issueDate, 'Due date');

    if (!bankAccountId) throw new Error('Bank account is required');
    if (!chequeNumber) throw new Error('Cheque number is required');
    if (!payee) throw new Error('Payee is required');
    if (amount <= 0) throw new Error('Amount must be greater than zero');

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
    });
    if (!bankAccount) throw new Error('Bank account not found');

    const existing = await prisma.cheque.findFirst({ where: { companyId, chequeNumber } });
    if (existing) throw new Error('Cheque number already exists');

    return prisma.cheque.create({
      data: {
        companyId,
        bankAccountId,
        chequeNumber,
        payee,
        amount,
        issueDate,
        dueDate,
        status: String(payload.status ?? 'PENDING').toUpperCase() || 'PENDING',
        description: payload.description ? String(payload.description).trim() : null,
        createdBy: currentUserId ?? (payload.createdBy ? String(payload.createdBy).trim() : null),
      },
      include: { bankAccount: true },
    });
  }

  async updateStatus(companyId: string, id: string, status: string, userId?: string) {
    const item = await prisma.cheque.findFirst({ where: { companyId, id } });
    if (!item) throw new Error('Cheque not found');

    return prisma.cheque.update({
      where: { id },
      data: {
        status: String(status).toUpperCase(),
        approvedBy: userId ?? item.approvedBy,
      },
      include: { bankAccount: true },
    });
  }
}

export const chequesService = new ChequesService();

export async function getChequesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await chequesService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Cheques retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getChequeController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await chequesService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Cheque not found', 404);
      return;
    }
    sendSuccess(res, item, 'Cheque retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createChequeController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await chequesService.create(req.user.companyId, req.body, req.user.id);
    sendCreated(res, item, 'Cheque created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create cheque';
    sendError(res, message, 400);
  }
}

export async function updateChequeStatusController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await chequesService.updateStatus(req.user.companyId, String(req.params.id), String(req.body.status ?? 'PENDING'), req.user.id);
    sendSuccess(res, item, 'Cheque status updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update cheque status';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('CHEQUE_VIEW'), getChequesController);
router.get('/:id', authorize('CHEQUE_VIEW'), getChequeController);
router.post('/', authorize('CHEQUE_CREATE'), createChequeController);
router.patch('/:id/status', authorize('CHEQUE_UPDATE'), updateChequeStatusController);

export default router;
