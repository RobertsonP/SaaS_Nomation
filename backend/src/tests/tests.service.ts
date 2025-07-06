import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TestsService {
  constructor(private prisma: PrismaService) {}

  async findByProject(projectId: string) {
    return this.prisma.test.findMany({
      where: { projectId },
      include: { 
        _count: { select: { executions: true } },
        executions: { 
          orderBy: { startedAt: 'desc' },
          take: 1 
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(testId: string) {
    return this.prisma.test.findUnique({
      where: { id: testId },
      include: { 
        project: true,
        _count: { select: { executions: true } },
        executions: { 
          orderBy: { startedAt: 'desc' },
          take: 5
        }
      },
    });
  }

  async create(data: { name: string; description?: string; projectId: string; startingUrl: string; steps: any[] }) {
    return this.prisma.test.create({
      data: {
        name: data.name,
        description: data.description,
        projectId: data.projectId,
        startingUrl: data.startingUrl,
        steps: data.steps,
        status: 'draft',
      },
    });
  }

  async updateSteps(testId: string, steps: any[]) {
    return this.prisma.test.update({
      where: { id: testId },
      data: {
        steps,
        status: 'active',
      },
    });
  }

}