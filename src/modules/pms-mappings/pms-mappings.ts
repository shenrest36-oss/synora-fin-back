import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendCreated, sendError, sendSuccess } from '../../utils/response';

export class PmsMappingsService {
  async findAccountMappings(companyId: string) {
    return prisma.pmsAccountMapping.findMany({
      where: { companyId },
      include: { account: true, department: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAccountMapping(companyId: string, payload: Record<string, unknown>) {
    const sourceType = String(payload.sourceType ?? '').trim().toUpperCase();
    const sourceCode = String(payload.sourceCode ?? '').trim();
    const accountId = String(payload.accountId ?? '').trim();
    const departmentId = payload.departmentId ? String(payload.departmentId).trim() : null;

    if (!sourceType || !sourceCode || !accountId) {
      throw new Error('Source type, source code, and account are required');
    }

    const account = await prisma.chartOfAccount.findFirst({
      where: { id: accountId, companyId, isActive: true },
    });
    if (!account) throw new Error('Account not found or inactive');

    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, companyId, isActive: true },
      });
      if (!department) throw new Error('Department not found or inactive');
    }

    const existing = await prisma.pmsAccountMapping.findFirst({
      where: { companyId, sourceType, sourceCode },
    });
    if (existing) throw new Error('Duplicate PMS account mapping for this source type and code');

    return prisma.pmsAccountMapping.create({
      data: {
        companyId,
        sourceType,
        sourceCode,
        accountId,
        departmentId,
        taxAccountId: payload.taxAccountId ? String(payload.taxAccountId).trim() : null,
        serviceChargeAccountId: payload.serviceChargeAccountId ? String(payload.serviceChargeAccountId).trim() : null,
        advanceAccountId: payload.advanceAccountId ? String(payload.advanceAccountId).trim() : null,
        debtorControlAccountId: payload.debtorControlAccountId ? String(payload.debtorControlAccountId).trim() : null,
        bankAccountId: payload.bankAccountId ? String(payload.bankAccountId).trim() : null,
        isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
        notes: payload.notes ? String(payload.notes).trim() : null,
        createdBy: payload.createdBy ? String(payload.createdBy).trim() : null,
      },
      include: { account: true, department: true },
    });
  }

  async findDepartmentMappings(companyId: string) {
    return prisma.pmsDepartmentMapping.findMany({
      where: { companyId },
      include: { department: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDepartmentMapping(companyId: string, payload: Record<string, unknown>) {
    const sourceDepartmentCode = String(payload.sourceDepartmentCode ?? '').trim();
    const departmentId = String(payload.departmentId ?? '').trim();

    if (!sourceDepartmentCode || !departmentId) {
      throw new Error('Source department code and department are required');
    }

    const department = await prisma.department.findFirst({
      where: { id: departmentId, companyId, isActive: true },
    });
    if (!department) throw new Error('Department not found or inactive');

    const existing = await prisma.pmsDepartmentMapping.findFirst({
      where: { companyId, sourceDepartmentCode },
    });
    if (existing) throw new Error('Duplicate PMS department mapping');

    return prisma.pmsDepartmentMapping.create({
      data: {
        companyId,
        sourceDepartmentCode,
        departmentId,
        subDepartmentId: payload.subDepartmentId ? String(payload.subDepartmentId).trim() : null,
        isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
        notes: payload.notes ? String(payload.notes).trim() : null,
        createdBy: payload.createdBy ? String(payload.createdBy).trim() : null,
      },
      include: { department: true },
    });
  }
}

export const pmsMappingsService = new PmsMappingsService();

export async function getPmsAccountMappingsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await pmsMappingsService.findAccountMappings(req.user.companyId);
    sendSuccess(res, items, 'PMS account mappings retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createPmsAccountMappingController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await pmsMappingsService.createAccountMapping(req.user.companyId, req.body);
    sendCreated(res, item, 'PMS account mapping created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create PMS account mapping';
    sendError(res, message, 400);
  }
}

export async function getPmsDepartmentMappingsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await pmsMappingsService.findDepartmentMappings(req.user.companyId);
    sendSuccess(res, items, 'PMS department mappings retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createPmsDepartmentMappingController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await pmsMappingsService.createDepartmentMapping(req.user.companyId, req.body);
    sendCreated(res, item, 'PMS department mapping created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create PMS department mapping';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/account-mappings', authorize('PMS_MAPPING_VIEW'), getPmsAccountMappingsController);
router.post('/account-mappings', authorize('PMS_MAPPING_MANAGE'), createPmsAccountMappingController);
router.get('/department-mappings', authorize('PMS_MAPPING_VIEW'), getPmsDepartmentMappingsController);
router.post('/department-mappings', authorize('PMS_MAPPING_MANAGE'), createPmsDepartmentMappingController);

export default router;
