import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Accounting API', () => {
  let accessToken: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: '123' });

    accessToken = loginRes.body.data.accessToken as string;
  });

  it('returns 200 on journal entries list with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/journal-entries')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 200 on general ledger list with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/general-ledger')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 200 on account balances with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/account-balances')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
