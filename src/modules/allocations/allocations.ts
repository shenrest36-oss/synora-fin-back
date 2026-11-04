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

export class AllocationsService {
  async findAll(companyId: string) {
    return prisma.allocation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.allocation.findFirst({
      where: { companyId, id },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const allocationNumber = String(payload.allocationNumber ?? '').trim();
    const allocationDate = parseDate(payload.allocationDate, 'Allocation date');
    const sourceTransactionType = String(payload.sourceTransactionType ?? '').trim();
    const sourceTransactionId = String(payload.sourceTransactionId ?? '').trim();
    const targetTransactionType = String(payload.targetTransactionType ?? '').trim();
    const targetTransactionId = String(payload.targetTransactionId ?? '').trim();
    const allocatedAmount = parseDecimal(payload.allocatedAmount, 'Allocated amount');
    const currencyCode = String(payload.currencyCode ?? 'USD').trim() || 'USD';

    if (!allocationNumber) throw new Error('Allocation number is required');
    if (!sourceTransactionType || !sourceTransactionId) throw new Error('Source transaction is required');
    if (!targetTransactionType || !targetTransactionId) throw new Error('Target transaction is required');
    if (allocatedAmount <= 0) throw new Error('Allocated amount must be greater than zero');

    const existing = await prisma.allocation.findFirst({ where: { companyId, allocationNumber } });
    if (existing) throw new Error('Allocation number already exists');

    return prisma.allocation.create({
      data: {
        companyId,
        allocationNumber,
        allocationDate,
        sourceTransactionType,
        sourceTransactionId,
        targetTransactionType,
        targetTransactionId,
        allocatedAmount,
        currencyCode,
        status: String(payload.status ?? 'POSTED').trim() || 'POSTED',
        createdBy: payload.createdBy ? String(payload.createdBy).trim() : null,
      },
    });
  }
}

export const allocationsService = new AllocationsService();

export async function getAllocationsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await allocationsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Allocations retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getAllocationController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await allocationsService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Allocation not found', 404);
      return;
    }
    sendSuccess(res, item, 'Allocation retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createAllocationController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await allocationsService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Allocation created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create allocation';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('ALLOCATION_VIEW'), getAllocationsController);
router.get('/:id', authorize('ALLOCATION_VIEW'), getAllocationController);
router.post('/', authorize('ALLOCATION_CREATE'), createAllocationController);

export default router;
