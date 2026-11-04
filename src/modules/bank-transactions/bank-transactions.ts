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

function generateRef(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${stamp}`;
}

async function createJournalForBankTransaction(companyId: string, currentUserId: string | undefined, transaction: any, bankAccount: any) {
  const journalDate = transaction.transactionDate ?? new Date();
  const journalNumber = `BANK-${Date.now().toString(36).toUpperCase()}`;
  const amount = Number(transaction.amount || 0);
  const lines: Array<{ accountId: string; debitAmount?: number; creditAmount?: number; description?: string }> = [];

  if (transaction.transactionType === 'TRANSFER' && transaction.relatedBankAccountId) {
    const related = await prisma.bankAccount.findFirst({
      where: { id: transaction.relatedBankAccountId, companyId },
      include: { glAccount: true },
    });
    if (!related) {
      throw new Error('Related bank account not found');
    }

    lines.push({ accountId: related.glAccountId, debitAmount: amount, description: `${transaction.description ?? 'Bank transfer'} (inbound)` });
    lines.push({ accountId: bankAccount.glAccountId, creditAmount: amount, description: `${transaction.description ?? 'Bank transfer'} (outbound)` });
  } else if (transaction.direction === 'DEBIT') {
    lines.push({ accountId: bankAccount.glAccountId, debitAmount: amount, description: transaction.description ?? 'Bank transaction' });
    lines.push({ accountId: bankAccount.glAccountId, creditAmount: amount, description: `Contra for ${transaction.description ?? 'Bank transaction'}` });
  } else {
    lines.push({ accountId: bankAccount.glAccountId, creditAmount: amount, description: transaction.description ?? 'Bank transaction' });
    lines.push({ accountId: bankAccount.glAccountId, debitAmount: amount, description: `Contra for ${transaction.description ?? 'Bank transaction'}` });
  }

  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debitAmount ?? 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.creditAmount ?? 0), 0);

  const journal = await prisma.journalEntry.create({
    data: {
      companyId,
      journalNumber,
      referenceNumber: transaction.referenceNumber ?? generateRef('BANK-JRN'),
      journalDate,
      description: transaction.description ?? 'Bank transaction posting',
      status: 'POSTED',
      totalDebit,
      totalCredit,
      sourceType: 'BANK_TRANSACTION',
      sourceReferenceId: transaction.id,
      createdBy: currentUserId,
      submittedBy: currentUserId,
      approvedBy: currentUserId,
      postedBy: currentUserId,
      lines: {
        create: lines.map((line, index) => ({
          lineNumber: index + 1,
          accountId: line.accountId,
          description: line.description,
          debitAmount: line.debitAmount ?? 0,
          creditAmount: line.creditAmount ?? 0,
          currencyCode: transaction.currencyCode ?? 'USD',
          exchangeRate: transaction.exchangeRate ?? null,
          baseDebitAmount: line.debitAmount ?? 0,
          baseCreditAmount: line.creditAmount ?? 0,
        })),
      },
    },
  });

  return journal;
}

export class BankTransactionsService {
  async findAll(companyId: string) {
    return prisma.bankTransaction.findMany({
      where: { companyId },
      include: { bankAccount: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.bankTransaction.findFirst({
      where: { companyId, id },
      include: { bankAccount: true },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>, currentUserId?: string) {
    const bankAccountId = String(payload.bankAccountId ?? '').trim();
    const referenceNumber = String(payload.referenceNumber ?? '').trim() || generateRef('BANK');
    const transactionType = String(payload.transactionType ?? 'DEPOSIT').trim().toUpperCase();
    const amount = parseDecimal(payload.amount, 'Amount');
    const transactionDate = parseDate(payload.transactionDate, 'Transaction date');
    const valueDate = parseDate(payload.valueDate ?? payload.transactionDate, 'Value date');

    if (!bankAccountId) throw new Error('Bank account is required');
    if (amount <= 0) throw new Error('Amount must be greater than zero');

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId, isActive: true },
      include: { glAccount: true },
    });
    if (!bankAccount) throw new Error('Bank account not found or inactive');

    const existing = await prisma.bankTransaction.findFirst({
      where: { companyId, referenceNumber },
    });
    if (existing) throw new Error('Transaction reference already exists');

    const tx = await prisma.bankTransaction.create({
      data: {
        companyId,
        bankAccountId,
        transactionType,
        referenceNumber,
        transactionDate,
        valueDate,
        description: payload.description ? String(payload.description).trim() : null,
        amount,
        currencyCode: String(payload.currencyCode ?? bankAccount.currencyCode).trim() || bankAccount.currencyCode,
        exchangeRate: payload.exchangeRate ? Number(payload.exchangeRate) : null,
        baseAmount: parseDecimal(payload.baseAmount ?? amount, 'Base amount'),
        direction: String(payload.direction ?? 'DEBIT').toUpperCase(),
        status: String(payload.status ?? 'DRAFT').toUpperCase(),
        createdBy: currentUserId ?? (payload.createdBy ? String(payload.createdBy).trim() : null),
        relatedTransactionId: payload.relatedTransactionId ? String(payload.relatedTransactionId).trim() || null : null,
      },
      include: { bankAccount: true },
    });

    if (String(payload.status ?? 'DRAFT').toUpperCase() === 'POSTED') {
      await createJournalForBankTransaction(companyId, currentUserId, tx, bankAccount);
    }

    return tx;
  }

  async approve(companyId: string, id: string, userId: string) {
    const item = await prisma.bankTransaction.findFirst({ where: { companyId, id } });
    if (!item) throw new Error('Bank transaction not found');

    return prisma.bankTransaction.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
      },
    });
  }

  async post(companyId: string, id: string, userId: string) {
    const item = await prisma.bankTransaction.findFirst({
      where: { companyId, id },
      include: { bankAccount: true },
    });
    if (!item) throw new Error('Bank transaction not found');

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: item.bankAccountId, companyId },
      include: { glAccount: true },
    });
    if (!bankAccount) throw new Error('Bank account not found');

    const journal = await createJournalForBankTransaction(companyId, userId, item, bankAccount);

    return prisma.bankTransaction.update({
      where: { id },
      data: {
        status: 'POSTED',
        processedBy: userId,
        journalEntryId: journal.id,
      },
      include: { bankAccount: true },
    });
  }
}

export const bankTransactionsService = new BankTransactionsService();

export async function getBankTransactionsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await bankTransactionsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Bank transactions retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getBankTransactionController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankTransactionsService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'Bank transaction not found', 404);
      return;
    }
    sendSuccess(res, item, 'Bank transaction retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createBankTransactionController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankTransactionsService.create(req.user.companyId, req.body, req.user.id);
    sendCreated(res, item, 'Bank transaction created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create bank transaction';
    sendError(res, message, 400);
  }
}

export async function approveBankTransactionController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankTransactionsService.approve(req.user.companyId, String(req.params.id), req.user.id);
    sendSuccess(res, item, 'Bank transaction approved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve bank transaction';
    sendError(res, message, 400);
  }
}

export async function postBankTransactionController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await bankTransactionsService.post(req.user.companyId, String(req.params.id), req.user.id);
    sendSuccess(res, item, 'Bank transaction posted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to post bank transaction';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('BANK_TRANSACTION_VIEW'), getBankTransactionsController);
router.get('/:id', authorize('BANK_TRANSACTION_VIEW'), getBankTransactionController);
router.post('/', authorize('BANK_TRANSACTION_CREATE'), createBankTransactionController);
router.patch('/:id/approve', authorize('BANK_TRANSACTION_APPROVE'), approveBankTransactionController);
router.patch('/:id/post', authorize('BANK_TRANSACTION_APPROVE'), postBankTransactionController);

export default router;
