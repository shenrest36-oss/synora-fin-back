import { signToken, verifyToken, extractBearerToken } from '../src/utils/jwt';

describe('JWT Utilities', () => {
  const payload = {
    sub: 'test-user-id-123',
    username: 'testuser',
    email: 'test@example.com',
    companyId: 'company-id-456',
  };

  it('signs a token and verifies it successfully', () => {
    const token = signToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('decoded payload matches original payload', () => {
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.username).toBe(payload.username);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.companyId).toBe(payload.companyId);
  });

  it('throws on an invalid token', () => {
    expect(() => verifyToken('invalid.token.value')).toThrow();
  });

  it('throws on a tampered token', () => {
    const token = signToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('extractBearerToken extracts token from Authorization header', () => {
    const token = 'mytoken123';
    const result = extractBearerToken(`Bearer ${token}`);
    expect(result).toBe(token);
  });

  it('extractBearerToken returns null for missing header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('extractBearerToken returns null for non-Bearer scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });
});
