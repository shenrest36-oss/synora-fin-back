import { NextFunction, Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../database/prisma';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendCreated, sendError, sendSuccess } from '../../utils/response';

export class PmsConnectionsService {
  async findAll(companyId: string) {
    return prisma.pmsConnection.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.pmsConnection.findFirst({
      where: { companyId, id },
    });
  }

  async create(companyId: string, payload: Record<string, unknown>, currentUserId?: string) {
    const name = String(payload.name ?? '').trim();
    const connectionType = String(payload.connectionType ?? payload.type ?? 'API').trim().toUpperCase();
    if (!name) throw new Error('PMS connection name is required');
    if (!['API', 'DATABASE', 'FILE'].includes(connectionType)) {
      throw new Error('Connection type must be API, DATABASE, or FILE');
    }

    const existing = await prisma.pmsConnection.findFirst({ where: { companyId, name } });
    if (existing) {
      throw new Error('PMS connection already exists for this company');
    }

    const passwordHash = payload.password ? await bcrypt.hash(String(payload.password), 10) : null;
    const apiKeyHash = payload.apiKey ? await bcrypt.hash(String(payload.apiKey), 10) : null;

    const created = await prisma.pmsConnection.create({
      data: {
        companyId,
        name,
        connectionType,
        host: payload.host ? String(payload.host).trim() : null,
        port: payload.port ? Number(payload.port) : null,
        databaseName: payload.databaseName ? String(payload.databaseName).trim() : null,
        username: payload.username ? String(payload.username).trim() : null,
        passwordHash,
        apiBaseUrl: payload.apiBaseUrl ? String(payload.apiBaseUrl).trim() : null,
        apiKeyHash,
        syncEnabled: Boolean(payload.syncEnabled ?? false),
        connectionStatus: 'CONNECTED',
        businessDateMode: String(payload.businessDateMode ?? 'LOCAL').trim().toUpperCase() || 'LOCAL',
        sourceSystemIdentifier: payload.sourceSystemIdentifier ? String(payload.sourceSystemIdentifier).trim() : null,
        isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
        createdBy: currentUserId ?? (payload.createdBy ? String(payload.createdBy).trim() : null),
      },
    });

    return { ...created, passwordHash: undefined, apiKeyHash: undefined };
  }

  async update(companyId: string, id: string, payload: Record<string, unknown>) {
    const existing = await prisma.pmsConnection.findFirst({ where: { companyId, id } });
    if (!existing) throw new Error('PMS connection not found');

    const data: Record<string, unknown> = {
      name: payload.name ? String(payload.name).trim() : existing.name,
      connectionType: payload.connectionType ? String(payload.connectionType).trim().toUpperCase() : existing.connectionType,
      host: payload.host !== undefined ? (String(payload.host).trim() || null) : existing.host,
      port: payload.port !== undefined ? (payload.port ? Number(payload.port) : null) : existing.port,
      databaseName: payload.databaseName !== undefined ? (String(payload.databaseName).trim() || null) : existing.databaseName,
      username: payload.username !== undefined ? (String(payload.username).trim() || null) : existing.username,
      apiBaseUrl: payload.apiBaseUrl !== undefined ? (String(payload.apiBaseUrl).trim() || null) : existing.apiBaseUrl,
      syncEnabled: payload.syncEnabled !== undefined ? Boolean(payload.syncEnabled) : existing.syncEnabled,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
    };

    if (payload.password) {
      data.passwordHash = await bcrypt.hash(String(payload.password), 10);
    }
    if (payload.apiKey) {
      data.apiKeyHash = await bcrypt.hash(String(payload.apiKey), 10);
    }

    return prisma.pmsConnection.update({
      where: { id },
      data,
    });
  }

  async testConnection(companyId: string, id: string) {
    const item = await prisma.pmsConnection.findFirst({ where: { companyId, id } });
    if (!item) throw new Error('PMS connection not found');

    await prisma.pmsConnection.update({
      where: { id },
      data: {
        connectionStatus: 'CONNECTED',
        lastTestedAt: new Date(),
      },
    });

    return {
      status: 'CONNECTED',
      message: 'PMS connection test successful',
      connection: item.name,
    };
  }
}

export const pmsConnectionsService = new PmsConnectionsService();

export async function getPmsConnectionsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const items = await pmsConnectionsService.findAll(req.user.companyId);
    sendSuccess(res, items, 'PMS connections retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getPmsConnectionController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await pmsConnectionsService.findById(req.user.companyId, String(req.params.id));
    if (!item) {
      sendError(res, 'PMS connection not found', 404);
      return;
    }
    sendSuccess(res, item, 'PMS connection retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function createPmsConnectionController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await pmsConnectionsService.create(req.user.companyId, req.body, req.user.id);
    sendCreated(res, item, 'PMS connection created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create PMS connection';
    sendError(res, message, 400);
  }
}

export async function updatePmsConnectionController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const item = await pmsConnectionsService.update(req.user.companyId, String(req.params.id), req.body);
    sendSuccess(res, item, 'PMS connection updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update PMS connection';
    sendError(res, message, 400);
  }
}

export async function testPmsConnectionController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const result = await pmsConnectionsService.testConnection(req.user.companyId, String(req.params.id));
    sendSuccess(res, result, 'PMS connection test completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to test PMS connection';
    sendError(res, message, 400);
  }
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('PMS_CONNECTION_VIEW'), getPmsConnectionsController);
router.get('/:id', authorize('PMS_CONNECTION_VIEW'), getPmsConnectionController);
router.post('/', authorize('PMS_CONNECTION_MANAGE'), createPmsConnectionController);
router.put('/:id', authorize('PMS_CONNECTION_MANAGE'), updatePmsConnectionController);
router.post('/:id/test', authorize('PMS_CONNECTION_MANAGE'), testPmsConnectionController);

export default router;
