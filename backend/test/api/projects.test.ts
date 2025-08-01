import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from '../../src/projects/projects.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ElementAnalyzerService } from '../../src/ai/element-analyzer.service';
import { AuthFlowsService } from '../../src/auth-flows/auth-flows.service';

describe('ProjectsService - Element Sorting', () => {
  let service: ProjectsService;
  let mockPrisma: Partial<PrismaService>;
  let mockElementAnalyzer: Partial<ElementAnalyzerService>;
  let mockAuthFlowsService: Partial<AuthFlowsService>;

  beforeEach(async () => {
    mockPrisma = {
      project: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      projectElement: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      projectUrl: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    mockElementAnalyzer = {
      getPageMetadata: jest.fn().mockResolvedValue({ title: 'Test Page' }),
      captureElementScreenshot: jest.fn().mockResolvedValue('base64-screenshot'),
    };

    mockAuthFlowsService = {
      getByProject: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ElementAnalyzerService, useValue: mockElementAnalyzer },
        { provide: AuthFlowsService, useValue: mockAuthFlowsService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('findById', () => {
    it('should return project with properly sorted elements', async () => {
      const mockProject = {
        id: 'test-project',
        name: 'Test Project',
        userId: 'test-user',
        elements: [
          { id: '1', confidence: 0.7, elementType: 'button', createdAt: new Date('2023-01-01') },
          { id: '2', confidence: 0.9, elementType: 'input', createdAt: new Date('2023-01-02') },
          { id: '3', confidence: 0.8, elementType: 'button', createdAt: new Date('2023-01-03') },
        ],
        urls: [],
        _count: { tests: 0, elements: 3, urls: 0 },
      };

      (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);

      const result = await service.findById('test-user', 'test-project');

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'test-project', userId: 'test-user' },
        include: {
          urls: true,
          elements: {
            include: { sourceUrl: true },
            orderBy: [
              { confidence: 'desc' },
              { elementType: 'asc' },
              { createdAt: 'desc' }
            ]
          },
          _count: {
            select: {
              tests: true,
              elements: true,
              urls: true
            }
          }
        },
      });

      expect(result).toEqual(mockProject);
    });
  });

  describe('getProjectElements', () => {
    it('should return elements sorted by confidence desc, type asc, created desc', async () => {
      const mockProject = { id: 'test-project', userId: 'test-user' };
      const mockElements = [
        { id: '1', confidence: 0.9, elementType: 'button' },
        { id: '2', confidence: 0.8, elementType: 'input' },
        { id: '3', confidence: 0.7, elementType: 'link' },
      ];

      (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (mockPrisma.projectElement.findMany as jest.Mock).mockResolvedValue(mockElements);

      const result = await service.getProjectElements('test-user', 'test-project');

      expect(mockPrisma.projectElement.findMany).toHaveBeenCalledWith({
        where: { projectId: 'test-project' },
        include: { sourceUrl: true },
        orderBy: [
          { confidence: 'desc' },
          { elementType: 'asc' },
          { createdAt: 'desc' }
        ]
      });

      expect(result).toEqual(mockElements);
    });
  });

  describe('captureElementScreenshot', () => {
    it('should capture element screenshot and update database', async () => {
      const mockProject = { id: 'test-project', userId: 'test-user' };
      const mockElement = { 
        id: 'test-element', 
        attributes: { existingData: 'test' } 
      };

      (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (mockPrisma.projectElement.findUnique as jest.Mock).mockResolvedValue(mockElement);
      (mockPrisma.projectElement.update as jest.Mock).mockResolvedValue(mockElement);

      const result = await service.captureElementScreenshot(
        'test-user',
        'test-project',
        'test-element',
        '#test-selector',
        'https://example.com'
      );

      expect(mockElementAnalyzer.captureElementScreenshot).toHaveBeenCalledWith(
        'https://example.com',
        '#test-selector'
      );

      expect(mockPrisma.projectElement.update).toHaveBeenCalledWith({
        where: { id: 'test-element' },
        data: {
          attributes: {
            existingData: 'test',
            screenshot: 'base64-screenshot',
            screenshotCapturedAt: expect.any(String)
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBe('base64-screenshot');
    });
  });
});