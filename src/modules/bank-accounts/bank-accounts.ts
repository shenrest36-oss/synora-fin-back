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

export class BankAccountsService {
  async findAll(companyId: string) {
    return prisma.bankAccount.findMany({
      where: { companyId },
      include: { glAccount: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.bankAccount.findFirst({
      where: { companyId, id },
      include: { glAccount: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const bankName = String(payload.bankName ?? '').trim();
    const branch = payload.branch ? String(payload.branch).trim() : null;
    const accountName = String(payload.accountName ?? '').trim();
    const accountNumber = String(payload.accountNumber ?? '').trim();
    const currencyCode = String(payload.currencyCode ?? 'USD').trim() || 'USD';
    const glAccountId = String(payload.glAccountId ?? '').trim();
    const openingBalance = parseDecimal(payload.openingBalance ?? 0, 'Opening balance');

    if (!bankName) throw new Error('Bank name is required');
    if (!accountName) throw new Error('Account name is required');
    if (!accountNumber) throw new Error('Account number is required');
    if (!glAccountId) throw new Error('GL account mapping is required');

    const glAccount = await prisma.chartOfAccount.findFirst({
      where: { id: glAccountId, companyId, isActive: true },
    });
    if (!glAccount) throw new Error('GL account not found or inactive');

    const existing = await prisma.bankAccount.findFirst({
      where: { companyId, accountNumber },
    });
    if (existing) throw new Error('Account number already exists for this company');

    return prisma.bankAccount.create({
      data: {
        companyId,
        branchId: payload.branchId ? String(payload.branchId).trim() || null : null,
        bankName,
        branch,
        accountName,
        accountNumber,
        currencyCode,
        openingBalance,
        currentBalance: openingBalance,
        glAccountId,
        status: String(payload.status ?? 'ACTIVE').toUpperCase() || 'ACTIVE',
        isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
        createdBy: payload.createdBy ? String(payload.createdBy).trim() : null,
      },
      include: { glAccount: true },
    });
  }

  async update(companyId: string, id: string, payload: Record<string, unknown>) {
    const existing = await prisma.bankAccount.findFirst({ where: { companyId, id } });
    if (!existing) throw new Error('Bank account not found');

    const nextBankName = payload.bankName ? String(payload.bankName).trim() : existing.bankName;
    const nextAccountName = payload.accountName ? String(payload.accountName).trim() : existing.accountName;
    const nextAccountNumber = payload.accountNumber ? String(payload.accountNumber).trim() : existing.accountNumber;
    const nextCurrency = payload.currencyCode ? String(payload.currencyCode).trim() || existing.currencyCode : existing.currencyCode;
    const nextStatus = payload.status ? String(payload.status).toUpperCase() || existing.status : existing.status;
    const nextOpeningBalance = payload.openingBalance !== undefined ? parseDecimal(payload.openingBalance, 'Opening balance') : Number(existing.openingBalance);
    const nextCurrentBalance = payload.currentBalance !== undefined ? parseDecimal(payload.currentBalance, 'Current balance') : Number(existing.currentBalance);

    if (payload.glAccountId) {
      const glAccount = await prisma.chartOfAccount.findFirst({
        where: { id: String(payload.glAccountId).trim(), companyId, isActive: true },
      });
      if (!glAccount) throw new Error('GL account not found or inactive');
    }

    const duplicate = await prisma.bankAccount.findFirst({
      where: { companyId, accountNumber: nextAccountNumber, NOT: { id } },
    });
    if (duplicate) throw new Error('Account number already exists for this company');

    return prisma.bankAccount.update({
      where: { id },
      data: {
        bankName: nextBankName,
        branch: payload.branch !== undefined ? (String(payload.branch).trim() || null) : existing.branch,
        accountName: nextAccountName,
        accountNumber: nextAccountNumber,
        currencyCode: nextCurrency,
        openingBalance: nextOpeningBalance,
        currentBalance: nextCurrentBalance,
        glAccountId: payload.glAccountId ? String(payload.glAccountId).trim() : existing.glAccountId,
        status: nextStatus,
        isActive: payload.isActive === undefined ? existing.isActive : Boolean(payload.isActive),
        updatedBy: payload.updatedBy ? String(payload.updatedBy).trim() : existing.updatedBy,
      },
      include: { glAccount: true },
    });
  }
}

export const bankAccountsService = new BankAccountsService();

export async function getBankAccountsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await bankAccountsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Bank accounts retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getBankAccountController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankAccountsService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Bank account not found', 404);
      return;
    }
    sendSuccess(res, item, 'Bank account retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createBankAccountController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankAccountsService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Bank account created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create bank account';
    sendError(res, message, 400);
  }
}

export async function updateBankAccountController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankAccountsService.update(req.user.companyId, String(req.params.id), req.body);
    sendSuccess(res, item, 'Bank account updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update bank account';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('BANK_ACCOUNT_VIEW'), getBankAccountsController);
router.get('/:id', authorize('BANK_ACCOUNT_VIEW'), getBankAccountController);
router.post('/', authorize('BANK_ACCOUNT_CREATE'), createBankAccountController);
router.put('/:id', authorize('BANK_ACCOUNT_UPDATE'), updateBankAccountController);

export default router;
