import { prisma } from '../../database/prisma';
import { verifyPassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { logger } from '../../config/logger';

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    companyId: string;
    roles: string[];
    permissions: string[];
  };
}

export class AuthService {
  async login(input: LoginInput, ipAddress?: string): Promise<LoginResult> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: input.username }, { email: input.username }],
        isActive: true,
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    ];

    const accessToken = signToken({
      sub: user.id,
      username: user.username,
      email: user.email,
      companyId: user.companyId,
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        module: 'AUTH',
        ipAddress,
      },
    });

    logger.info(`User ${user.username} logged in successfully`);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        roles,
        permissions,
      },
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyId: true,
        branchId: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404, isOperational: true });
    }

    const roles = user.userRoles.map((ur) => ({
      id: ur.role.id,
      code: ur.role.code,
      name: ur.role.name,
    }));

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    ];

    return {
      ...user,
      roles,
      permissions,
      userRoles: undefined,
    };
  }

  async logout(userId: string, ipAddress?: string): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        module: 'AUTH',
        ipAddress,
      },
    });
  }
}

export const authService = new AuthService();
