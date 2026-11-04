import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
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
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  },
  bcrypt: {
    rounds: parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10),
  },
  isDevelopment: process.env['NODE_ENV'] === 'development',
  isProduction: process.env['NODE_ENV'] === 'production',
} as const;
