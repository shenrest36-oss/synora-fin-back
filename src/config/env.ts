import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function parseCorsOrigins(rawValue: string | undefined): string[] {
  const defaultOrigins = ['http://localhost:5173'];
  const value = rawValue?.trim();

  if (!value) {
    return defaultOrigins;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedCorsOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    return isLocalhost && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '5001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
  },
  cors: {
    origin: parseCorsOrigins(process.env['CORS_ORIGIN']),
  },
  bcrypt: {
    rounds: parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10),
  },
  isDevelopment: process.env['NODE_ENV'] === 'development',
  isProduction: process.env['NODE_ENV'] === 'production',
} as const;
