import { Module } from '@nestjs/common';
import { AuthFlowsController } from './auth-flows.controller';
import { PublicTemplatesController } from './public-templates.controller';
import { AuthFlowsService } from './auth-flows.service';
import { AuthFlowTemplatesService } from './auth-flow-templates.service';
import { SimplifiedAuthService } from './simplified-auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UnifiedAuthService } from '../auth/unified-auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthFlowsController, PublicTemplatesController],
  providers: [AuthFlowsService, AuthFlowTemplatesService, SimplifiedAuthService, UnifiedAuthService],
  exports: [AuthFlowsService, AuthFlowTemplatesService, SimplifiedAuthService],
})
export class AuthFlowsModule {}