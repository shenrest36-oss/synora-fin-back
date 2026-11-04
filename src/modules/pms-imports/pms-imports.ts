import { NextFunction, Request, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendCreated, sendError, sendSuccess } from '../../utils/response';

function toDecimal(value: unknown): Prisma.Decimal {
  const raw = value === null || value === undefined || value === '' ? '0' : String(value);
  const number = Number(raw);
  if (!Number.isFinite(number)) {
    throw new Error('Invalid monetary value');
  }
  return new Prisma.Decimal(number.toFixed(2));
}

function generateBatchNumber(): string {
  return `PMS-${Date.now().toString(36).toUpperCase()}`;
}

async function buildPmsPreview(companyId: string, connectionName: string, sourceSystem: string, businessDate: string, transactions: Array<Record<string, unknown>>) {
  const connection = await prisma.pmsConnection.findFirst({
    where: { companyId, name: connectionName, isActive: true },
  });
  if (!connection) {
    throw new Error('PMS connection not found or inactive');
  }

  const batch = await prisma.pmsImportBatch.create({
    data: {
      companyId,
      connectionId: connection.id,
      batchNumber: generateBatchNumber(),
      sourceSystem: String(sourceSystem || 'PMS').trim() || 'PMS',
      businessDateStart: new Date(businessDate),
      businessDateEnd: new Date(businessDate),
      totalRecords: transactions.length,
      status: 'VALIDATING',
      createdBy: 'system',
    },
  });

  const staged: Array<Record<string, unknown>> = [];
  let validRecords = 0;
  let failedRecords = 0;

  for (const txn of transactions) {
    const sourceTransactionId = String(txn.sourceTransactionId ?? '').trim();
    const sourceType = String(txn.sourceType ?? '').trim().toUpperCase();
    const departmentCode = String(txn.department ?? '').trim();

    if (!sourceTransactionId) {
      failedRecords += 1;
      staged.push({ sourceTransactionId, sourceType, validationStatus: 'FAILED', error: 'Missing source transaction ID' });
      continue;
    }

    const duplicate = await prisma.pmsImportTransaction.findFirst({
      where: { companyId, sourceTransactionId, sourceType },
    });
    if (duplicate) {
      failedRecords += 1;
      staged.push({ sourceTransactionId, sourceType, validationStatus: 'FAILED', error: 'Duplicate transaction already imported' });
      continue;
    }

    const mapping = await prisma.pmsAccountMapping.findFirst({
      where: { companyId, sourceType, isActive: true },
    });
    const departmentMapping = departmentCode
      ? await prisma.pmsDepartmentMapping.findFirst({
          where: { companyId, sourceDepartmentCode: departmentCode, isActive: true },
        })
      : null;

    const validationStatus = mapping && departmentMapping ? 'VALID' : 'FAILED';
    if (validationStatus === 'VALID') {
      validRecords += 1;
    } else {
      failedRecords += 1;
    }

    const transaction = await prisma.pmsImportTransaction.create({
      data: {
        companyId,
        batchId: batch.id,
        connectionId: connection.id,
        sourceTransactionId,
        sourceType,
        businessDate: new Date(String(txn.businessDate ?? businessDate)),
        transactionDate: txn.transactionDate ? new Date(String(txn.transactionDate)) : null,
        guestReference: txn.guestReference ? String(txn.guestReference).trim() : null,
        department: departmentCode || null,
        currencyCode: String(txn.currency ?? 'USD').trim() || 'USD',
        grossAmount: toDecimal(txn.grossAmount ?? 0),
        taxAmount: toDecimal(txn.taxAmount ?? 0),
        serviceCharge: toDecimal(txn.serviceCharge ?? 0),
        discount: toDecimal(txn.discount ?? 0),
        netAmount: toDecimal(txn.netAmount ?? (txn.grossAmount ?? 0)),
        validationStatus,
        importStatus: validationStatus === 'VALID' ? 'READY_FOR_REVIEW' : 'FAILED',
        validationErrors: validationStatus === 'VALID' ? Prisma.JsonNull : {
          missingAccountMapping: !mapping,
          missingDepartmentMapping: !departmentMapping,
        },
        rawPayload: txn as Prisma.InputJsonValue,
        mappedAccountId: mapping?.accountId ?? null,
        mappedDepartmentId: departmentMapping?.departmentId ?? null,
      },
    });

    staged.push({
      id: transaction.id,
      sourceTransactionId,
      sourceType,
      validationStatus,
      mappedAccountId: mapping?.accountId ?? null,
      mappedDepartmentId: departmentMapping?.departmentId ?? null,
      error: validationStatus === 'VALID' ? null : 'Missing PMS mapping validation',
    });
  }

  await prisma.pmsImportBatch.update({
    where: { id: batch.id },
    data: {
      importedRecords: validRecords,
      failedRecords,
      totalRecords: transactions.length,
      status: failedRecords > 0 && validRecords > 0 ? 'PARTIALLY_FAILED' : (validRecords > 0 ? 'READY_FOR_REVIEW' : 'FAILED'),
    },
  });

  return {
    batch: { id: batch.id, batchNumber: batch.batchNumber, status: failedRecords > 0 && validRecords > 0 ? 'PARTIALLY_FAILED' : (validRecords > 0 ? 'READY_FOR_REVIEW' : 'FAILED') },
    preview: {
      totalRecords: transactions.length,
      validRecords,
      failedRecords,
      totalDebit: validRecords > 0 ? new Prisma.Decimal('0.00').toString() : '0.00',
      totalCredit: validRecords > 0 ? new Prisma.Decimal('0.00').toString() : '0.00',
      transactions: staged,
    },
  };
}

export class PmsImportsService {
  async findBatches(companyId: string) {
    return prisma.pmsImportBatch.findMany({
      where: { companyId },
      include: {
        transactions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBatch(companyId: string, id: string) {
    return prisma.pmsImportBatch.findFirst({
      where: { companyId, id },
      include: { transactions: true },
    });
  }

  async preview(companyId: string, payload: Record<string, unknown>, currentUserId?: string) {
    const connectionName = String(payload.connectionName ?? '').trim();
    const sourceSystem = String(payload.sourceSystem ?? 'PMS').trim();
    const businessDate = String(payload.businessDate ?? new Date().toISOString().slice(0, 10));
    const transactions = Array.isArray(payload.transactions) ? payload.transactions as Array<Record<string, unknown>> : [];

    if (!connectionName) throw new Error('PMS connection name is required');
    if (transactions.length === 0) throw new Error('No transactions were supplied for preview');

    const result = await buildPmsPreview(companyId, connectionName, sourceSystem, businessDate, transactions);
    return result;
  }

  async approveBatch(companyId: string, batchId: string, userId: string) {
    const batch = await prisma.pmsImportBatch.findFirst({ where: { companyId, id: batchId } });
    if (!batch) throw new Error('PMS import batch not found');

    const validTransactions = await prisma.pmsImportTransaction.count({
      where: { companyId, batchId, validationStatus: 'VALID' },
    });

    if (validTransactions === 0) {
      throw new Error('No valid transactions are available to approve');
    }

    return prisma.pmsImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });
  }

  async postBatch(companyId: string, batchId: string, userId: string) {
    const batch = await prisma.pmsImportBatch.findFirst({
      where: { companyId, id: batchId },
      include: { transactions: true },
    });
    if (!batch) throw new Error('PMS import batch not found');

    if (batch.status === 'POSTED') {
      throw new Error('Batch has already been posted');
    }

    const journal = await prisma.journalEntry.create({
      data: {
        companyId,
        journalNumber: `PMS-${Date.now().toString(36).toUpperCase()}`,
        journalDate: batch.businessDateStart ?? new Date(),
        financialYearId: (await prisma.financialYear.findFirst({ where: { companyId, isActive: true } }))?.id ?? null,
        accountingPeriodId: (await prisma.accountingPeriod.findFirst({ where: { financialYearId: (await prisma.financialYear.findFirst({ where: { companyId, isActive: true } }))?.id ?? '', status: 'OPEN' } }))?.id ?? null,
        description: `PMS import batch ${batch.batchNumber}`,
        status: 'POSTED',
        totalDebit: batch.totalDebit.toString(),
        totalCredit: batch.totalCredit.toString(),
        sourceType: 'PMS_IMPORT',
        sourceReferenceId: batch.id,
        createdBy: userId,
        approvedBy: userId,
        postedBy: userId,
        lines: {
          create: [
            {
              lineNumber: 1,
              accountId: (await prisma.chartOfAccount.findFirst({ where: { companyId, accountCode: '1100' } }))?.id ?? '',
              description: 'PMS import posting',
              debitAmount: batch.totalDebit,
              creditAmount: 0,
              currencyCode: 'USD',
              baseDebitAmount: batch.totalDebit,
              baseCreditAmount: 0,
            },
            {
              lineNumber: 2,
              accountId: (await prisma.chartOfAccount.findFirst({ where: { companyId, accountCode: '4000' } }))?.id ?? '',
              description: 'PMS import posting',
              debitAmount: 0,
              creditAmount: batch.totalCredit,
              currencyCode: 'USD',
              baseDebitAmount: 0,
              baseCreditAmount: batch.totalCredit,
            },
          ],
        },
      },
    });

    await prisma.pmsImportTransaction.updateMany({
      where: { companyId, batchId },
      data: { importStatus: 'POSTED', validationStatus: 'POSTED' },
    });

    return prisma.pmsImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'POSTED',
        postedBy: userId,
        postedAt: new Date(),
      },
    });
  }
}

export const pmsImportsService = new PmsImportsService();

export async function getPmsImportBatchesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await pmsImportsService.findBatches(req.user.companyId);
    sendSuccess(res, items, 'PMS import batches retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function previewPmsImportController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const result = await pmsImportsService.preview(req.user.companyId, req.body, req.user.id);
    sendSuccess(res, result, 'PMS import preview generated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to preview PMS import';
    const status = message.includes('already imported') ? 409 : 400;
    sendError(res, message, status);
  }
}

export async function approvePmsImportController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await pmsImportsService.approveBatch(req.user.companyId, String(req.params.id), req.user.id);
    sendSuccess(res, item, 'PMS import batch approved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve PMS import batch';
    sendError(res, message, 400);
  }
}

export async function postPmsImportController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await pmsImportsService.postBatch(req.user.companyId, String(req.params.id), req.user.id);
    sendSuccess(res, item, 'PMS import batch posted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to post PMS import batch';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/batches', authorize('PMS_IMPORT_VIEW'), getPmsImportBatchesController);
router.post('/preview', authorize('PMS_IMPORT_CREATE'), previewPmsImportController);
router.patch('/batches/:id/approve', authorize('PMS_IMPORT_APPROVE'), approvePmsImportController);
router.patch('/batches/:id/post', authorize('PMS_IMPORT_POST'), postPmsImportController);

export default router;
