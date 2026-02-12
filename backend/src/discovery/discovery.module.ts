import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { SitemapParserService } from './sitemap-parser.service';
import { PageCrawlerService } from './page-crawler.service';
import { LinkDiscoveryService } from './link-discovery.service';
import { MenuInteractionService } from './menu-interaction.service';
import { UrlNormalizationService } from './url-normalization.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UnifiedAuthService } from '../auth/unified-auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    SitemapParserService,
    PageCrawlerService,
    LinkDiscoveryService,
    MenuInteractionService,
    UrlNormalizationService,
    UnifiedAuthService,  // Required for authenticated page discovery
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
