import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Authentication API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    global.app = app;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', () => {
      const registerDto = {
        email: `test-${Date.now()}@example.com`,
        password: 'testpass123',
        name: 'Test User'
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
          if (res.status === 200 || res.status === 201) {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.email).toBe(registerDto.email);
          }
        });
    });

    it('should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'testpass123',
          name: 'Test User'
        })
        .expect((res) => {
          expect([400, 422]).toContain(res.status);
        });
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      // First register a user
      const registerDto = {
        email: `login-test-${Date.now()}@example.com`,
        password: 'testpass123',
        name: 'Login Test User'
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto);

      // Then try to login
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: registerDto.email,
          password: registerDto.password
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
          if (res.status === 200 || res.status === 201) {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('user');
          }
        });
    });

    it('should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        })
        .expect((res) => {
          expect([400, 401, 404]).toContain(res.status);
        });
    });
  });
});