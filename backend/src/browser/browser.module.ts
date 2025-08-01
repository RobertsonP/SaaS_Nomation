import { Module } from '@nestjs/common';
import { LiveBrowserService } from './live-browser.service';
import { BrowserController } from './browser.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BrowserController],
  providers: [LiveBrowserService],
  exports: [LiveBrowserService],
})
export class BrowserModule {}