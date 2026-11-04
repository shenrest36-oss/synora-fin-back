import request from 'supertest';
import app from '../src/app';

describe('GET /api/v1/health', () => {
  it('returns 200 with healthy status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.version).toBeDefined();
    expect(res.body.data.timestamp).toBeDefined();
  });
});
