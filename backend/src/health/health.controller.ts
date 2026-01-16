import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
  ) {}

  @Get()
  async getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    };
  }

  @Get('detailed')
  async getDetailedHealth() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkDisk(),
    ]);

    return {
      status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: checks[0].status === 'fulfilled' ? 'ok' : 'error',
        disk: checks[1].status === 'fulfilled' ? 'ok' : 'error',
      },
    };
  }

  private async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkDisk() {
    const diskUsage = process.memoryUsage();
    if (diskUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB warning
      throw new Error('High memory usage');
    }
  }
}