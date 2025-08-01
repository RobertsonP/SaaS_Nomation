import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthFlowsService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, authFlowData: {
    name: string;
    loginUrl: string;
    steps: any[];
    credentials: { username: string; password: string };
  }) {
    return this.prisma.authFlow.create({
      data: {
        projectId,
        name: authFlowData.name,
        loginUrl: authFlowData.loginUrl,
        steps: authFlowData.steps,
        credentials: authFlowData.credentials,
      },
    });
  }

  async getByProject(projectId: string) {
    return this.prisma.authFlow.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string) {
    return this.prisma.authFlow.delete({
      where: { id },
    });
  }

  async getById(id: string) {
    return this.prisma.authFlow.findUnique({
      where: { id },
    });
  }
}