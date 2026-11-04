import request from 'supertest';
import { prisma } from '../src/database/prisma';
import app from '../src/app';

describe('Chart of Accounts API', () => {
  let token: string;
  let uniqueRunId: number;

  beforeAll(async () => {
    uniqueRunId = Date.now();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: '123' });

    token = loginRes.body.data.accessToken;
  });

  beforeEach(async () => {
    await prisma.accountDepartment.deleteMany();
    await prisma.chartOfAccount.deleteMany();
    await prisma.accountSubcategory.deleteMany();
    await prisma.accountType.deleteMany();
    await prisma.accountCategory.deleteMany();
  });

  it('creates a valid account category', async () => {
    const categoryCode = `REV${String(uniqueRunId).slice(-8)}`;
    const categoryName = `Revenue ${uniqueRunId}`;
    const res = await request(app)
      .post('/api/v1/account-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryCode,
        categoryName,
        accountNumberStart: 800000,
        accountNumberEnd: 899999,
        description: 'Revenue accounts',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.categoryName).toBe(categoryName);
  });

  it('rejects overlapping category ranges', async () => {
    const firstCategoryCode = `REV1${String(uniqueRunId).slice(-8)}`;
    const firstCreate = await request(app)
      .post('/api/v1/account-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryCode: firstCategoryCode,
        categoryName: `Revenue Primary ${uniqueRunId}`,
        accountNumberStart: 800000,
        accountNumberEnd: 890000,
        description: 'First category for overlap validation',
      });

    expect(firstCreate.status).toBe(201);

    const overlappingCategoryCode = `REV2${String(uniqueRunId).slice(-8)}`;
    const res = await request(app)
      .post('/api/v1/account-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryCode: overlappingCategoryCode,
        categoryName: `Revenue Secondary ${uniqueRunId}`,
        accountNumberStart: 850000,
        accountNumberEnd: 930000,
        description: 'Overlap test',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('creates a valid numeric account within category range', async () => {
    const categoryCode = `REV${String(uniqueRunId).slice(-8)}`;
    const categoryRes = await request(app)
      .post('/api/v1/account-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryCode,
        categoryName: `Revenue Account ${uniqueRunId}`,
        accountNumberStart: 700000,
        accountNumberEnd: 799999,
        description: 'Revenue accounts for account creation',
      });

    const revenueCategory = categoryRes.body.data;
    expect(revenueCategory).toBeDefined();

    const accountCode = String(700001 + (uniqueRunId % 5000));
    const res = await request(app)
      .post('/api/v1/chart-of-accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountCode,
        accountName: 'Food Revenue',
        categoryId: revenueCategory.id,
        subcategoryName: 'Food Revenue',
        accountType: 'P & L',
        description: 'Primary revenue account',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accountCode).toBe(accountCode);
  });

  it('rejects account code outside category range', async () => {
    const categoryCode = `OUT${String(uniqueRunId).slice(-8)}`;
    const categoryRes = await request(app)
      .post('/api/v1/account-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryCode,
        categoryName: `Outside Revenue ${uniqueRunId}`,
        accountNumberStart: 600000,
        accountNumberEnd: 699999,
        description: 'Revenue category for range validation',
      });

    const revenueCategory = categoryRes.body.data;

    const res = await request(app)
      .post('/api/v1/chart-of-accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountCode: '200001',
        accountName: 'Outside Revenue Range',
        categoryId: revenueCategory.id,
        subcategoryName: 'Food Revenue',
        accountType: 'P & L',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
