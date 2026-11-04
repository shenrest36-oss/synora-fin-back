import bcrypt from 'bcryptjs';
import { config } from '../config/env';

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, config.bcrypt.rounds);
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
