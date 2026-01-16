import { Controller, Post, Param, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ElementAnalyzerService } from './element-analyzer.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/elements')
export class ElementsController {
  constructor(
    private elementAnalyzer: ElementAnalyzerService,
    private prisma: PrismaService
  ) {}

  @Post(':id/screenshot')
  async captureScreenshot(@Param('id') id: string) {
    try {
      // 1. Find the element
      const element = await this.prisma.projectElement.findUnique({
        where: { id },
        include: {
          sourceUrl: true
        }
      });

      if (!element) {
        throw new NotFoundException(`Element with ID ${id} not found`);
      }

      if (!element.sourceUrl?.url) {
        throw new NotFoundException(`Source URL not found for element ${id}`);
      }

      // 2. Capture screenshot
      const screenshotBase64 = await this.elementAnalyzer.captureElementScreenshot(
        element.sourceUrl.url,
        element.selector
      );

      if (!screenshotBase64) {
        throw new InternalServerErrorException('Failed to capture screenshot');
      }

      // 3. Update the element with the new screenshot (optional but recommended)
      // Also update visualData to be of type 'image'
      const visualData = (element.attributes as any)?.visualData || {};
      visualData.type = 'image';
      visualData.thumbnailBase64 = screenshotBase64;

      await this.prisma.projectElement.update({
        where: { id },
        data: {
          screenshot: screenshotBase64,
          attributes: {
            ...element.attributes as any,
            visualData
          }
        }
      });

      return { screenshot: screenshotBase64 };

    } catch (error) {
      console.error('Screenshot capture failed:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error.message || 'Failed to capture screenshot');
    }
  }
}
