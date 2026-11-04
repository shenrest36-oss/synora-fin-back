import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Sprint 6 PMS Integration', () => {
  let token: string;
  let companyId: string;
  let accountId: string;
  let departmentId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: '123' });

    token = loginRes.body.data.accessToken;
    const company = await prisma.company.findFirst({ where: { code: 'HQ' } });
    companyId = company!.id;

    const account = await prisma.chartOfAccount.findFirst({
      where: { companyId },
    });
    accountId = account!.id;

    const department = await prisma.department.findFirst({ where: { companyId } });
    departmentId = department!.id;
  });

  it('creates a PMS connection', async () => {
    const res = await request(app)
      .post('/api/v1/pms-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Opera PMS',
        connectionType: 'API',
        host: 'https://pms.example.com',
        port: 443,
        databaseName: 'opera',
        username: 'ops',
        password: 'secret',
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Opera PMS');
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('creates a PMS account mapping', async () => {
    const res = await request(app)
      .post('/api/v1/pms-mappings/account-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'ROOM_REVENUE',
        sourceCode: 'ROOM_REVENUE',
        accountId,
        departmentId,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sourceType).toBe('ROOM_REVENUE');
  });

  it('creates a valid import batch preview', async () => {
    const res = await request(app)
      .post('/api/v1/pms-imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        connectionName: 'Opera PMS',
        sourceSystem: 'PMS',
        businessDate: '2026-11-04',
        transactions: [
          {
            sourceTransactionId: 'RM-1001',
            sourceType: 'ROOM_REVENUE',
            businessDate: '2026-11-04',
            guestReference: 'G-001',
            department: 'ROOMS',
            currency: 'USD',
            grossAmount: '1500.00',
            taxAmount: '120.00',
            serviceCharge: '0.00',
            discount: '0.00',
            netAmount: '1500.00',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.preview).toBeDefined();
    expect(res.body.data.preview.totalRecords).toBe(1);
  });

  it('rejects a duplicate source transaction import', async () => {
    const res = await request(app)
      .post('/api/v1/pms-imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        connectionName: 'Opera PMS',
        sourceSystem: 'PMS',
        businessDate: '2026-11-04',
        transactions: [
          {
            sourceTransactionId: 'RM-1001',
            sourceType: 'ROOM_REVENUE',
            businessDate: '2026-11-04',
            guestReference: 'G-001',
            department: 'ROOMS',
            currency: 'USD',
            grossAmount: '1500.00',
            taxAmount: '120.00',
            serviceCharge: '0.00',
            discount: '0.00',
            netAmount: '1500.00',
          },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});
