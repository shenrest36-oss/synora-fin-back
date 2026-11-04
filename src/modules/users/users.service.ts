import { prisma } from '../../database/prisma';
import { hashPassword } from '../../utils/password';
import { PaginationQuery } from '../../types/api.types';
import { Prisma } from '@prisma/client';

export interface CreateUserInput {
  companyId: string;
  branchId?: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleIds?: string[];
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  branchId?: string;
  isActive?: boolean;
  roleIds?: string[];
}

const userSelect = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  companyId: true,
  branchId: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    include: {
      role: { select: { id: true, code: true, name: true } },
    },
  },
} as const;

export class UsersService {
  async findAll(query: PaginationQuery & { companyId: string }) {
    const { page = 1, limit = 20, search, companyId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      companyId,
      ...(search && {
        OR: [
          { username: { contains: search } },
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      }),
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({ where, skip, take: limit, select: userSelect, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404, isOperational: true });
    return user;
  }

  async create(input: CreateUserInput, createdBy?: string) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: input.username }, { email: input.email }] },
    });
    if (existing) {
      throw Object.assign(new Error('Username or email already exists'), { statusCode: 409, isOperational: true });
    }

    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId,
          username: input.username,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          createdBy,
        },
        select: userSelect,
      });

      if (input.roleIds?.length) {
        await tx.userRole.createMany({
          data: input.roleIds.map((roleId) => ({
            userId: user.id,
            roleId,
            createdBy,
          })),
        });
      }

      return user;
    });
  }

  async update(id: string, input: UpdateUserInput, updatedBy?: string) {
    await this.findById(id);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          branchId: input.branchId,
          isActive: input.isActive,
          updatedBy,
        },
        select: userSelect,
      });

      if (input.roleIds !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (input.roleIds.length) {
          await tx.userRole.createMany({
            data: input.roleIds.map((roleId) => ({ userId: id, roleId, createdBy: updatedBy })),
          });
        }
      }

      return user;
    });
  }
}

export const usersService = new UsersService();
