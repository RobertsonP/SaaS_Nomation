import { Module } from '@nestjs/common';
import { LiveBrowserService } from './live-browser.service';
import { BrowserController } from './browser.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [PrismaModule, AuthModule, AnalysisModule],
  controllers: [BrowserController],
  providers: [LiveBrowserService],
  exports: [LiveBrowserService],
})
export class BrowserModule {}