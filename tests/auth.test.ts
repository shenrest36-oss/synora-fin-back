import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Auth API', () => {
  let accessToken: string;

  describe('POST /api/v1/auth/login', () => {
    it('returns 200 with token on valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: '123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.username).toBe('admin');
      expect(res.body.data.user.permissions).toBeInstanceOf(Array);
      expect(res.body.data.user.permissions.length).toBeGreaterThan(0);
      // passwordHash must never appear in response
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      accessToken = res.body.data.accessToken as string;
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 on non-existent user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nobody', password: 'anything' });

      expect(res.status).toBe(401);
    });

    it('returns 422 when username is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: '123' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer notavalidtoken');
      expect(res.status).toBe(401);
    });

    it('returns 200 with user profile on valid token', async () => {
      // Get fresh token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: '123' });
      const token = loginRes.body.data.accessToken as string;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe('admin');
      expect(res.body.data.roles).toBeInstanceOf(Array);
      expect(res.body.data.permissions).toBeInstanceOf(Array);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });
  });

  describe('GET /api/v1/users (permission check)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });

    it('returns 200 with valid admin token (USER_VIEW permission)', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: '123' });
      const token = loginRes.body.data.accessToken as string;

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(401);
    });

    it('returns 200 with valid token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: '123' });
      const token = loginRes.body.data.accessToken as string;

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
