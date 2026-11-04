import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractBearerToken } from '../utils/jwt';
import { prisma } from '../database/prisma';
import { sendError } from '../utils/response';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const payload = verifyToken(token);

    // Fetch user with permissions
    const user = await prisma.user.findUnique({
      where: { id: payload.sub, isActive: true },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      sendError(res, 'User not found or inactive', 401);
      return;
    }

    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    (req as Request & { user?: {
      id: string;
      username: string;
      email: string;
      companyId: string;
      permissions: string[];
    } }).user = {
      id: user.id,
      username: user.username,
      email: user.email,
      companyId: user.companyId,
      permissions,
    };

    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401);
  }
}
