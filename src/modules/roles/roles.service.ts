import { prisma } from '../../database/prisma';

export class RolesService {
  async findAll() {
    return prisma.role.findMany({
      where: { isActive: true },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    if (!role) throw Object.assign(new Error('Role not found'), { statusCode: 404, isOperational: true });
    return role;
  }
}

export const rolesService = new RolesService();
