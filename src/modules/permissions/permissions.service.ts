import { prisma } from '../../database/prisma';

export class PermissionsService {
  async findAll() {
    return prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }
}
export const permissionsService = new PermissionsService();
