import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/database/prisma';
import { seedDefaultData } from '../src/database/seed';

jest.setTimeout(120000);

describe('Sprint 4 debtor and creditor reporting', () => {
  let companyId: string;
  let adminToken: string;

  beforeAll(async () => {
    await seedDefaultData();

    const company = await prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!company) {
      throw new Error('No company found for Sprint 4 tests');
    }

    companyId = company.id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: '123' });

    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.data.accessToken as string;
  });

  it('returns debtor aging summary with outstanding balances', async () => {
    const debtorCode = `D-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const debtor = await prisma.debtor.create({
      data: {
        companyId,
        debtorCode,
        debtorName: 'Aging Test Debtor',
        debtorType: 'CUSTOMER',
        creditLimit: 5000,
        creditPeriodDays: 30,
        currencyCode: 'USD',
        isActive: true,
      },
    });

    await prisma.debtorInvoice.create({
      data: {
        companyId,
        debtorId: debtor.id,
        invoiceNumber: `INV-${Date.now()}-A`,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        subtotal: 300,
        taxAmount: 30,
        totalAmount: 330,
        allocatedAmount: 0,
        outstandingAmount: 330,
        currencyCode: 'USD',
        status: 'POSTED',
      },
    });

    const res = await request(app)
      .get('/api/v1/debtors/aging')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((item: { debtorId: string }) => item.debtorId === debtor.id)).toBe(true);
  });

  it('returns a debtor statement with invoice and payment entries', async () => {
    const debtorCode = `D-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const debtor = await prisma.debtor.create({
      data: {
        companyId,
        debtorCode,
        debtorName: 'Statement Test Debtor',
        debtorType: 'CUSTOMER',
        creditLimit: 10000,
        creditPeriodDays: 30,
        currencyCode: 'USD',
        isActive: true,
      },
    });

    const invoice = await prisma.debtorInvoice.create({
      data: {
        companyId,
        debtorId: debtor.id,
        invoiceNumber: `INV-${Date.now()}-S`,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        subtotal: 500,
        taxAmount: 50,
        totalAmount: 550,
        allocatedAmount: 0,
        outstandingAmount: 550,
        currencyCode: 'USD',
        status: 'POSTED',
      },
    });

    await prisma.receipt.create({
      data: {
        companyId,
        debtorId: debtor.id,
        receiptNumber: `RCPT-${Date.now()}`,
        receiptDate: new Date(),
        amount: 200,
        currencyCode: 'USD',
        paymentMethod: 'CASH',
        description: 'Customer payment',
        status: 'POSTED',
      },
    });

    const res = await request(app)
      .get(`/api/v1/debtors/${debtor.id}/statement`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.debtorId).toBe(debtor.id);
    expect(res.body.data.entries.some((entry: { type: string; referenceId: string }) => entry.type === 'INVOICE' && entry.referenceId === invoice.id)).toBe(true);
    expect(res.body.data.outstandingBalance).toBeGreaterThanOrEqual(0);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
