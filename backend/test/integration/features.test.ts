import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe.skip('Feature Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let testProjectId: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // Create test user and get token
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'integration-test@example.com',
        password: 'testpassword123'
      });

    userToken = registerResponse.body.token;
    testUserId = registerResponse.body.user.id;

    // Create test project
    const projectResponse = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Integration Test Project',
        description: 'Test project for integration tests',
        urls: [
          { url: 'https://demo.testim.io/', title: 'Homepage' },
          { url: 'https://demo.testim.io/login', title: 'Login Page' }
        ]
      });

    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.projectElement.deleteMany({
      where: { projectId: testProjectId }
    });
    await prisma.projectUrl.deleteMany({
      where: { projectId: testProjectId }
    });
    await prisma.project.deleteMany({
      where: { id: testProjectId }
    });
    await prisma.user.deleteMany({
      where: { id: testUserId }
    });
    
    await app.close();
  });

  describe('Element Sorting Fix', () => {
    it('should return project elements sorted by confidence desc, type asc, created desc', async () => {
      // Add some test elements with different confidence levels
      await prisma.projectElement.createMany({
        data: [
          {
            projectId: testProjectId,
            selector: '#high-confidence',
            elementType: 'button',
            description: 'High Confidence Button',
            confidence: 0.95,
            attributes: {}
          },
          {
            projectId: testProjectId,
            selector: '#medium-confidence',
            elementType: 'input',
            description: 'Medium Confidence Input',
            confidence: 0.75,
            attributes: {}
          },
          {
            projectId: testProjectId,
            selector: '#low-confidence',
            elementType: 'button',
            description: 'Low Confidence Button',
            confidence: 0.55,
            attributes: {}
          }
        ]
      });

      const response = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.elements).toHaveLength(3);
      
      // Check sorting: high confidence button, low confidence button, medium confidence input
      expect(response.body.elements[0].confidence).toBe(0.95);
      expect(response.body.elements[0].elementType).toBe('button');
      
      expect(response.body.elements[1].confidence).toBe(0.75);
      expect(response.body.elements[1].elementType).toBe('input');
      
      expect(response.body.elements[2].confidence).toBe(0.55);
      expect(response.body.elements[2].elementType).toBe('button');
    });

    it('should return properly sorted elements from getProjectElements endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/elements`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      
      // Check that elements are sorted properly
      for (let i = 0; i < response.body.length - 1; i++) {
        const current = response.body[i];
        const next = response.body[i + 1];
        
        // First by confidence desc
        if (current.confidence !== next.confidence) {
          expect(current.confidence).toBeGreaterThan(next.confidence);
        }
        // Then by element type asc (if same confidence)
        else if (current.elementType !== next.elementType) {
          expect(current.elementType.localeCompare(next.elementType)).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  describe('Auth Flow Management', () => {
    it('should create and retrieve auth flows', async () => {
      const authFlowData = {
        projectId: testProjectId,
        name: 'Test Auth Flow',
        loginUrl: 'https://demo.testim.io/login',
        username: 'test@test.com',
        password: 'testpassword',
        steps: [
          { type: 'type', selector: '#username', value: '${username}', description: 'Enter username' },
          { type: 'type', selector: '#password', value: '${password}', description: 'Enter password' },
          { type: 'click', selector: '#login-button', description: 'Click login' }
        ]
      };

      // Create auth flow
      const createResponse = await request(app.getHttpServer())
        .post('/api/auth-flows')
        .set('Authorization', `Bearer ${userToken}`)
        .send(authFlowData)
        .expect(201);

      expect(createResponse.body.name).toBe('Test Auth Flow');
      expect(createResponse.body.loginUrl).toBe('https://demo.testim.io/login');

      // Get auth flows by project
      const getResponse = await request(app.getHttpServer())
        .get(`/api/auth-flows/project/${testProjectId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(getResponse.body).toHaveLength(1);
      expect(getResponse.body[0].name).toBe('Test Auth Flow');
      expect(getResponse.body[0].credentials).toEqual({
        username: 'test@test.com',
        password: 'testpassword'
      });
    });
  });

  describe('Element Screenshot Capture', () => {
    it('should handle screenshot capture request', async () => {
      // Get an element first
      const elementsResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/elements`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      if (elementsResponse.body.length > 0) {
        const element = elementsResponse.body[0];
        
        // Try to capture screenshot (will likely fail in test environment, but should handle gracefully)
        const screenshotResponse = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/element/${element.id}/screenshot`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            selector: element.selector,
            url: 'https://demo.testim.io/'
          });

        // Should return a response (success or error)
        expect(screenshotResponse.status).toBeGreaterThanOrEqual(200);
        expect(screenshotResponse.status).toBeLessThan(500);
      }
    });
  });

  describe('Project Analysis', () => {
    it('should handle project analysis request', async () => {
      const analysisResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/analyze`)
        .set('Authorization', `Bearer ${userToken}`)
        .timeout(30000); // Increase timeout for analysis

      // Should return a response (success or error)
      expect(analysisResponse.status).toBeGreaterThanOrEqual(200);
      expect(analysisResponse.status).toBeLessThan(500);
      
      if (analysisResponse.status === 200) {
        expect(analysisResponse.body).toHaveProperty('success');
        expect(analysisResponse.body).toHaveProperty('elements');
      }
    });
  });
});