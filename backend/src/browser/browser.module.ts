import { Module } from '@nestjs/common';
import { LiveBrowserService } from './live-browser.service';
import { BrowserController } from './browser.controller';
import { PublicBrowserController } from './public-browser.controller';
import { AdvancedSelectorGeneratorService } from './advanced-selector-generator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [PrismaModule, AuthModule, AnalysisModule],
  controllers: [BrowserController, PublicBrowserController],
  providers: [LiveBrowserService, AdvancedSelectorGeneratorService],
  exports: [LiveBrowserService, AdvancedSelectorGeneratorService],
})
export class BrowserModule {}