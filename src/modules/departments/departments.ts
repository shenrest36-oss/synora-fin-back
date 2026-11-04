import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendCreated, sendError, sendSuccess } from '../../utils/response';

export class DepartmentsService {
  async findAll(companyId: string) {
    return prisma.department.findMany({
      where: { companyId },
      include: { subDepartments: true },
      orderBy: { departmentName: 'asc' },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>) {
    const departmentCode = String(payload.departmentCode ?? '').trim();
    const departmentName = String(payload.departmentName ?? '').trim();

    if (!departmentCode) throw new Error('Department code is required');
    if (!departmentName) throw new Error('Department name is required');

    const existing = await prisma.department.findFirst({
      where: { companyId, departmentCode },
    });
    if (existing) throw new Error('Department code already exists');

    return prisma.department.create({
      data: {
        companyId,
        departmentCode,
        departmentName,
        description: payload.description ? String(payload.description).trim() : null,
      },
    });
  }
}

export const departmentsService = new DepartmentsService();

export async function getDepartmentsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const items = await departmentsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'Departments retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createDepartmentController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const item = await departmentsService.create(req.user.companyId, req.body);
    sendCreated(res, item, 'Department created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create department';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('DEPARTMENT_VIEW'), getDepartmentsController);
router.post('/', authorize('DEPARTMENT_CREATE'), createDepartmentController);

export default router;
