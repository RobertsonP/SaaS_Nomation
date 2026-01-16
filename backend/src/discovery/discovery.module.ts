import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { SitemapParserService } from './sitemap-parser.service';
import { PageCrawlerService } from './page-crawler.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    SitemapParserService,
    PageCrawlerService,
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
