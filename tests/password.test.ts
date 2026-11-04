import { hashPassword, verifyPassword } from '../src/utils/password';

describe('Password Utilities', () => {
  it('hashes a password to a bcrypt string', async () => {
    const hash = await hashPassword('TestPassword123!');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('TestPassword123!');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('TestPassword123!');
    const result = await verifyPassword('TestPassword123!', hash);
    expect(result).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('TestPassword123!');
    const result = await verifyPassword('WrongPassword!', hash);
    expect(result).toBe(false);
  });

  it('produces different hashes for the same plaintext (salting)', async () => {
    const hash1 = await hashPassword('SamePassword');
    const hash2 = await hashPassword('SamePassword');
    expect(hash1).not.toBe(hash2);
  });
});
