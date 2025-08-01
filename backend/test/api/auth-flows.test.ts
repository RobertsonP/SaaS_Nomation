import { Test, TestingModule } from '@nestjs/testing';
import { AuthFlowsService } from '../../src/auth-flows/auth-flows.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AuthFlowsService - Empty Form Fix', () => {
  let service: AuthFlowsService;
  let mockPrisma: Partial<PrismaService>;

  beforeEach(async () => {
    mockPrisma = {
      authFlow: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthFlowsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthFlowsService>(AuthFlowsService);
  });

  describe('getByProject', () => {
    it('should return existing auth flows for project', async () => {
      const mockAuthFlows = [
        {
          id: 'auth-1',
          name: 'Test Auth Flow',
          loginUrl: 'https://demo.testim.io/login',
          steps: [
            { type: 'type', selector: '#username', value: '${username}', description: 'Enter username' },
            { type: 'type', selector: '#password', value: '${password}', description: 'Enter password' },
            { type: 'click', selector: '#login-button', description: 'Click login' }
          ],
          credentials: { username: 'test@test.com', password: 'test123' },
          projectId: 'test-project',
        }
      ];

      (mockPrisma.authFlow.findMany as jest.Mock).mockResolvedValue(mockAuthFlows);

      const result = await service.getByProject('test-project');

      expect(mockPrisma.authFlow.findMany).toHaveBeenCalledWith({
        where: { projectId: 'test-project' },
        orderBy: { createdAt: 'desc' }
      });

      expect(result).toEqual(mockAuthFlows);
    });

    it('should return empty array when no auth flows exist', async () => {
      (mockPrisma.authFlow.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getByProject('test-project');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create new auth flow with proper structure', async () => {
      const authFlowData = {
        name: 'Test Auth Flow',
        loginUrl: 'https://demo.testim.io/login',
        steps: [
          { type: 'type', selector: '#username', value: '${username}', description: 'Enter username' },
          { type: 'type', selector: '#password', value: '${password}', description: 'Enter password' },
          { type: 'click', selector: '#login-button', description: 'Click login' }
        ],
        credentials: { username: 'test@test.com', password: 'test123' }
      };

      const mockCreatedFlow = {
        id: 'auth-1',
        projectId: 'test-project',
        ...authFlowData,
      };

      (mockPrisma.authFlow.create as jest.Mock).mockResolvedValue(mockCreatedFlow);

      const result = await service.create('test-project', authFlowData);

      expect(mockPrisma.authFlow.create).toHaveBeenCalledWith({
        data: {
          projectId: 'test-project',
          ...authFlowData,
        }
      });

      expect(result).toEqual(mockCreatedFlow);
    });
  });
});