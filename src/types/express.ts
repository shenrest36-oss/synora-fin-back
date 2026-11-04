import type { Request as ExpressRequest } from 'express';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  companyId: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export type AuthenticatedRequest = ExpressRequest & {
  user?: AuthenticatedUser;
};

export {};
