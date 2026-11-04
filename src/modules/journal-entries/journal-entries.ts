import { NextFunction, Request, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendCreated, sendError, sendSuccess } from '../../utils/response';

const DECIMAL_ZERO = new Prisma.Decimal('0.00');

function toDecimal(value: unknown, fieldName: string): Prisma.Decimal {
  const raw = value === null || value === undefined || value === '' ? '0' : String(value);
  const numeric = Number(raw);

  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldName} must be numeric`);
  }

  if (numeric < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }

  return new Prisma.Decimal(numeric.toFixed(2));
}

function toMoneyString(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value.toString()).toFixed(2);
}

function getParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function generateJournalNumber(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  return `JRN-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normaliseLineInput(lines: Array<Record<string, unknown>> = []) {
  return lines.map((line, index) => ({
    lineNumber: Number(line.lineNumber ?? index + 1),
    accountId: String(line.accountId ?? '').trim(),
    departmentId: line.departmentId ? String(line.departmentId).trim() : undefined,
    subDepartmentId: line.subDepartmentId ? String(line.subDepartmentId).trim() : undefined,
    description: line.description ? String(line.description).trim() : undefined,
    debitAmount: toDecimal(line.debitAmount ?? 0, `journal line ${index + 1} debit`),
    creditAmount: toDecimal(line.creditAmount ?? 0, `journal line ${index + 1} credit`),
    currencyCode: String(line.currencyCode ?? 'USD').trim() || 'USD',
    exchangeRate: line.exchangeRate ? new Prisma.Decimal(String(line.exchangeRate)) : undefined,
  }));
}

function getLineTotals(lines: Array<{ debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal }>) {
  return lines.reduce(
    (acc, line) => {
      acc.debit = acc.debit.plus(line.debitAmount);
      acc.credit = acc.credit.plus(line.creditAmount);
      return acc;
    },
    { debit: new Prisma.Decimal('0.00'), credit: new Prisma.Decimal('0.00') },
  );
}

async function validateJournalPayload(
  companyId: string,
  payload: Record<string, any>,
  options: { allowPosting?: boolean } = {},
) {
  const { allowPosting = false } = options;
  const journalDate = payload.journalDate ? new Date(payload.journalDate) : new Date();
  const periodId = payload.accountingPeriodId ? String(payload.accountingPeriodId) : '';

  if (!periodId) {
    throw new Error('Accounting period is required');
  }

  const accountingPeriod = await prisma.accountingPeriod.findUnique({
    where: { id: periodId },
    include: { financialYear: true },
  });

  if (!accountingPeriod) {
    throw new Error('Accounting period not found');
  }

  if (payload.financialYearId && String(payload.financialYearId) !== accountingPeriod.financialYearId) {
    throw new Error('Selected financial year and period do not match');
  }

  if (accountingPeriod.status === 'CLOSED') {
    throw new Error('Accounting period is closed');
  }

  const periodStart = new Date(accountingPeriod.startDate);
  const periodEnd = new Date(accountingPeriod.endDate);
  if (journalDate < periodStart || journalDate > periodEnd) {
    throw new Error('Journal date is outside the selected accounting period');
  }

  const lines = normaliseLineInput(Array.isArray(payload.lines) ? payload.lines : []);

  if (lines.length < 2) {
    throw new Error('A journal entry must contain at least two valid lines');
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.accountId) {
      throw new Error(`Journal line ${i + 1} requires an account`);
    }

    if (line.debitAmount.lt(DECIMAL_ZERO) || line.creditAmount.lt(DECIMAL_ZERO)) {
      throw new Error(`Journal line ${i + 1} has a negative amount`);
    }

    if (line.debitAmount.gt(DECIMAL_ZERO) && line.creditAmount.gt(DECIMAL_ZERO)) {
      throw new Error(`Journal line ${i + 1} cannot contain both debit and credit values`);
    }

    if (line.debitAmount.eq(DECIMAL_ZERO) && line.creditAmount.eq(DECIMAL_ZERO)) {
      throw new Error(`Journal line ${i + 1} must contain either a debit or a credit value`);
    }

    const account = await prisma.chartOfAccount.findFirst({
      where: { id: line.accountId, companyId, isActive: true },
      include: { accountType: true },
    });

    if (!account) {
      throw new Error(`Account on journal line ${i + 1} is invalid or inactive`);
    }

    if (line.departmentId) {
      const mapping = await prisma.accountDepartment.findFirst({
        where: {
          accountId: line.accountId,
          departmentId: line.departmentId,
          ...(line.subDepartmentId ? { subDepartmentId: line.subDepartmentId } : { subDepartmentId: null }),
        },
      });

      if (!mapping) {
        throw new Error(`Department mapping is invalid for account ${account.accountName}`);
      }
    }
  }

  const totals = getLineTotals(lines);
  if (!totals.debit.eq(totals.credit)) {
    throw new Error('Journal total debits and credits must balance');
  }

  if (allowPosting && totals.debit.eq(DECIMAL_ZERO)) {
    throw new Error('Journal entry cannot be zero value');
  }

  return {
    accountingPeriod,
    lines,
    totals,
  };
}

export class JournalEntriesService {
  async findAll(companyId: string, filters: Record<string, string | undefined>, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.JournalEntryWhereInput = {
      companyId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { journalNumber: { contains: filters.search } },
              { referenceNumber: { contains: filters.search } },
              { description: { contains: filters.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.journalEntry.findMany({
        where,
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, companyId: string) {
    const item = await prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          include: {
            account: true,
            department: true,
            subDepartment: true,
          },
        },
      },
    });

    if (!item) {
      throw Object.assign(new Error('Journal entry not found'), { statusCode: 404, isOperational: true });
    }

    return item;
  }

  async create(companyId: string, payload: Record<string, any>, currentUserId?: string) {
    const validated = await validateJournalPayload(companyId, payload);
    const referenceNumber = payload.referenceNumber ? String(payload.referenceNumber).trim() : undefined;
    const journalNumber = payload.journalNumber ? String(payload.journalNumber).trim() : generateJournalNumber();

    const existingReference = referenceNumber
      ? await prisma.journalEntry.findFirst({ where: { companyId, referenceNumber } })
      : null;
    if (existingReference) {
      throw new Error('Reference number already exists');
    }

    const existingJournalNumber = await prisma.journalEntry.findFirst({ where: { companyId, journalNumber } });
    if (existingJournalNumber) {
      throw new Error('Journal number already exists');
    }

    const data = {
      companyId,
      branchId: payload.branchId ? String(payload.branchId).trim() : undefined,
      journalNumber,
      referenceNumber,
      journalDate: new Date(payload.journalDate ?? new Date()),
      financialYearId: payload.financialYearId ? String(payload.financialYearId) : validated.accountingPeriod.financialYearId,
      accountingPeriodId: validated.accountingPeriod.id,
      description: payload.description ? String(payload.description).trim() : null,
      status: payload.status ? String(payload.status).toUpperCase() : 'DRAFT',
      totalDebit: validated.totals.debit.toString(),
      totalCredit: validated.totals.credit.toString(),
      sourceType: payload.sourceType ? String(payload.sourceType).trim() : null,
      sourceReferenceId: payload.sourceReferenceId ? String(payload.sourceReferenceId).trim() : null,
      createdBy: currentUserId,
      submittedBy: payload.submittedBy ? String(payload.submittedBy) : null,
    };

    return prisma.$transaction(async (tx) => {
      const created = await tx.journalEntry.create({
        data,
      });

      await tx.journalEntryLine.createMany({
        data: validated.lines.map((line, index) => ({
          journalEntryId: created.id,
          lineNumber: index + 1,
          accountId: line.accountId,
          departmentId: line.departmentId,
          subDepartmentId: line.subDepartmentId,
          description: line.description,
          debitAmount: line.debitAmount.toFixed(2),
          creditAmount: line.creditAmount.toFixed(2),
          currencyCode: line.currencyCode,
          exchangeRate: line.exchangeRate ? line.exchangeRate.toString() : undefined,
          baseDebitAmount: line.debitAmount.toFixed(2),
          baseCreditAmount: line.creditAmount.toFixed(2),
        })),
      });

      return tx.journalEntry.findUnique({
        where: { id: created.id },
        include: { lines: true },
      });
    });
  }

  async update(id: string, companyId: string, payload: Record<string, any>, currentUserId?: string) {
    const existing = await this.findById(id, companyId);
    if (existing.status !== 'DRAFT') {
      throw new Error('Only draft journal entries can be edited');
    }

    const validated = await validateJournalPayload(companyId, payload);
    const journalData = {
      branchId: payload.branchId ? String(payload.branchId).trim() : existing.branchId,
      referenceNumber: payload.referenceNumber ? String(payload.referenceNumber).trim() : existing.referenceNumber,
      journalDate: new Date(payload.journalDate ?? existing.journalDate),
      accountingPeriodId: payload.accountingPeriodId ? String(payload.accountingPeriodId) : existing.accountingPeriodId,
      description: payload.description ? String(payload.description).trim() : existing.description,
      totalDebit: validated.totals.debit.toString(),
      totalCredit: validated.totals.credit.toString(),
      updatedAt: new Date(),
      sourceType: payload.sourceType ? String(payload.sourceType).trim() : existing.sourceType,
      sourceReferenceId: payload.sourceReferenceId ? String(payload.sourceReferenceId).trim() : existing.sourceReferenceId,
      createdBy: currentUserId ?? existing.createdBy,
    };

    return prisma.$transaction(async (tx) => {
      await tx.journalEntryLine.deleteMany({ where: { journalEntryId: existing.id } });
      const updated = await tx.journalEntry.update({
        where: { id },
        data: journalData,
      });

      await tx.journalEntryLine.createMany({
        data: validated.lines.map((line, index) => ({
          journalEntryId: updated.id,
          lineNumber: index + 1,
          accountId: line.accountId,
          departmentId: line.departmentId,
          subDepartmentId: line.subDepartmentId,
          description: line.description,
          debitAmount: line.debitAmount.toFixed(2),
          creditAmount: line.creditAmount.toFixed(2),
          currencyCode: line.currencyCode,
          exchangeRate: line.exchangeRate ? line.exchangeRate.toString() : undefined,
          baseDebitAmount: line.debitAmount.toFixed(2),
          baseCreditAmount: line.creditAmount.toFixed(2),
        })),
      });

      return tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      });
    });
  }

  async submit(id: string, companyId: string, currentUserId?: string) {
    const entry = await this.findById(id, companyId);
    if (entry.status !== 'DRAFT') {
      throw new Error('Only draft entries can be submitted');
    }

    return prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedBy: currentUserId,
        submittedAt: new Date(),
      },
      include: { lines: true },
    });
  }

  async approve(id: string, companyId: string, currentUserId?: string) {
    const entry = await this.findById(id, companyId);
    if (entry.status !== 'SUBMITTED') {
      throw new Error('Only submitted entries can be approved');
    }

    return prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: currentUserId,
        approvedAt: new Date(),
      },
      include: { lines: true },
    });
  }

  async reject(id: string, companyId: string, currentUserId?: string) {
    const entry = await this.findById(id, companyId);
    if (entry.status !== 'SUBMITTED') {
      throw new Error('Only submitted entries can be rejected');
    }

    return prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: currentUserId,
        approvedAt: new Date(),
      },
      include: { lines: true },
    });
  }

  async post(id: string, companyId: string, currentUserId?: string) {
    const journal = await this.findById(id, companyId);
    if (journal.status === 'POSTED') {
      throw new Error('Journal entry has already been posted');
    }

    const noDraft = journal.status === 'DRAFT' || journal.status === 'SUBMITTED' || journal.status === 'APPROVED';
    if (!noDraft) {
      throw new Error('Only draft, submitted, or approved entries can be posted');
    }

    const validated = await validateJournalPayload(companyId, {
      ...journal,
      lines: journal.lines.map((line) => ({
        accountId: line.accountId,
        departmentId: line.departmentId,
        subDepartmentId: line.subDepartmentId,
        description: line.description,
        debitAmount: line.debitAmount.toString(),
        creditAmount: line.creditAmount.toString(),
        currencyCode: line.currencyCode,
        exchangeRate: line.exchangeRate ? line.exchangeRate.toString() : null,
      })),
      accountingPeriodId: journal.accountingPeriodId,
      financialYearId: journal.financialYearId,
      journalDate: journal.journalDate,
    }, { allowPosting: true });

    return prisma.$transaction(async (tx) => {
      const updatedJournal = await tx.journalEntry.update({
        where: { id },
        data: {
          status: 'POSTED',
          postedBy: currentUserId,
          postedAt: new Date(),
          totalDebit: validated.totals.debit.toString(),
          totalCredit: validated.totals.credit.toString(),
        },
        include: { lines: true },
      });

      const postingData = updatedJournal.lines.map((line) => ({
        companyId,
        branchId: updatedJournal.branchId,
        journalEntryId: updatedJournal.id,
        journalEntryLineId: line.id,
        accountId: line.accountId,
        accountingPeriodId: updatedJournal.accountingPeriodId,
        financialYearId: updatedJournal.financialYearId,
        postingDate: updatedJournal.journalDate,
        referenceNumber: updatedJournal.referenceNumber ?? updatedJournal.journalNumber,
        description: line.description ?? updatedJournal.description,
        debitAmount: line.debitAmount.toString(),
        creditAmount: line.creditAmount.toString(),
        currencyCode: line.currencyCode,
        exchangeRate: line.exchangeRate ? line.exchangeRate.toString() : null,
        baseDebitAmount: line.baseDebitAmount.toString(),
        baseCreditAmount: line.baseCreditAmount.toString(),
        departmentId: line.departmentId,
        subDepartmentId: line.subDepartmentId,
      }));

      await tx.ledgerPosting.createMany({ data: postingData });

      await tx.auditLog.create({
        data: {
          userId: currentUserId ?? null,
          action: 'POSTED',
          module: 'JOURNAL',
          entityType: 'JournalEntry',
          entityId: updatedJournal.id,
          newValues: { status: 'POSTED', journalNumber: updatedJournal.journalNumber },
        },
      });

      return updatedJournal;
    });
  }

  async reverse(id: string, companyId: string, payload: Record<string, any>, currentUserId?: string) {
    const original = await this.findById(id, companyId);
    if (original.status !== 'POSTED') {
      throw new Error('Only posted entries can be reversed');
    }

    const reversalJournal = await prisma.journalEntry.findFirst({
      where: {
        companyId,
        reversalOfJournalId: original.id,
      },
    });

    if (reversalJournal) {
      throw new Error('Duplicate reversal not allowed');
    }

    const reversalReference =
      payload.referenceNumber && String(payload.referenceNumber).trim().length > 0
        ? String(payload.referenceNumber).trim()
        : original.referenceNumber
          ? `REV-${original.referenceNumber}`
          : `REV-${original.journalNumber}`;

    const reversalPayload = {
      ...payload,
      journalDate: payload.journalDate ?? new Date().toISOString(),
      referenceNumber: reversalReference,
      status: 'DRAFT',
      sourceType: 'REVERSAL',
      sourceReferenceId: original.id,
      branchId: payload.branchId ?? original.branchId,
      financialYearId: payload.financialYearId ?? original.financialYearId,
      accountingPeriodId: payload.accountingPeriodId ?? original.accountingPeriodId,
      description: payload.description ?? `Reversal of ${original.journalNumber}`,
      lines: original.lines.map((line) => ({
        accountId: line.accountId,
        departmentId: line.departmentId,
        subDepartmentId: line.subDepartmentId,
        description: `Reversal: ${line.description ?? original.description ?? 'Journal reversal'}`,
        debitAmount: line.creditAmount.toString(),
        creditAmount: line.debitAmount.toString(),
        currencyCode: line.currencyCode,
        exchangeRate: line.exchangeRate ? line.exchangeRate.toString() : undefined,
      })),
    };

    const created = await this.create(companyId, reversalPayload, currentUserId);
    const posted = await this.post(String(created?.id ?? ''), companyId, currentUserId);

    await prisma.journalEntry.update({
      where: { id: original.id },
      data: { status: 'REVERSED' },
    });

    return posted;
  }
}

export const journalEntriesService = new JournalEntriesService();

export async function getJournalEntriesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const items = await journalEntriesService.findAll(
      req.user.companyId,
      {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      },
      Number(req.query.page ?? 1),
      Number(req.query.limit ?? 20),
    );

    sendSuccess(res, items.items, 'Journal entries retrieved successfully', 200, items.meta);
  } catch (error) {
    next(error);
  }
}

export async function getJournalEntryByIdController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const itemId = getParamValue(req.params.id);
    const item = await journalEntriesService.findById(itemId, req.user.companyId);
    sendSuccess(res, item, 'Journal entry retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createJournalEntryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const item = await journalEntriesService.create(req.user.companyId, req.body, req.user.id);
    sendCreated(res, item, 'Journal entry created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create journal entry';
    sendError(res, message, 400);
  }
}

export async function updateJournalEntryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const itemId = getParamValue(req.params.id);
    const item = await journalEntriesService.update(itemId, req.user.companyId, req.body, req.user.id);
    sendSuccess(res, item, 'Journal entry updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update journal entry';
    sendError(res, message, 400);
  }
}

export async function submitJournalEntryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const itemId = getParamValue(req.params.id);
    const item = await journalEntriesService.submit(itemId, req.user.companyId, req.user.id);
    sendSuccess(res, item, 'Journal entry submitted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit journal entry';
    sendError(res, message, 400);
  }
}

export async function approveJournalEntryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const itemId = getParamValue(req.params.id);
    const item = await journalEntriesService.approve(itemId, req.user.companyId, req.user.id);
    sendSuccess(res, item, 'Journal entry approved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve journal entry';
    sendError(res, message, 400);
  }
}

export async function rejectJournalEntryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const itemId = getParamValue(req.params.id);
    const item = await journalEntriesService.reject(itemId, req.user.companyId, req.user.id);
    sendSuccess(res, item, 'Journal entry rejected successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject journal entry';
    sendError(res, message, 400);
  }
}

export async function postJournalEntryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const itemId = getParamValue(req.params.id);
    const item = await journalEntriesService.post(itemId, req.user.companyId, req.user.id);
    sendSuccess(res, item, 'Journal entry posted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to post journal entry';
    sendError(res, message, 400);
  }
}

export async function reverseJournalEntryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const itemId = getParamValue(req.params.id);
    const item = await journalEntriesService.reverse(itemId, req.user.companyId, req.body, req.user.id);
    sendSuccess(res, item, 'Journal entry reversed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reverse journal entry';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('JOURNAL_VIEW'), getJournalEntriesController);
router.post('/', authorize('JOURNAL_CREATE'), createJournalEntryController);
router.get('/:id', authorize('JOURNAL_VIEW'), getJournalEntryByIdController);
router.put('/:id', authorize('JOURNAL_UPDATE'), updateJournalEntryController);
router.patch('/:id/submit', authorize('JOURNAL_SUBMIT'), submitJournalEntryController);
router.patch('/:id/approve', authorize('JOURNAL_APPROVE'), approveJournalEntryController);
router.patch('/:id/reject', authorize('JOURNAL_REJECT'), rejectJournalEntryController);
router.post('/:id/post', authorize('JOURNAL_POST'), postJournalEntryController);
router.post('/:id/reverse', authorize('JOURNAL_REVERSE'), reverseJournalEntryController);

export default router;
