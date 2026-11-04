import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { JwtPayload } from '../types/api.types';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwt.secret);
  return decoded as JwtPayload;
}

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
