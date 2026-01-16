import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { BrowserManagerService } from './browser-manager.service';

@Injectable()
export class ScreenshotService {
  constructor(private browserManager: BrowserManagerService) {}

  async captureElementScreenshot(url: string, selector: string): Promise<string | null> {
    console.log(`📸 Capturing screenshot for element: ${selector} on ${url}`);

    const browser = await this.browserManager.setupBrowser();
    const page = await this.browserManager.createPage(browser);

    try {
      await this.browserManager.navigateToPage(page, url);

      const element = page.locator(selector).first();
      const screenshot = await element.screenshot({ type: 'png' });

      await this.browserManager.closeBrowser(browser);

      return `data:image/png;base64,${screenshot.toString('base64')}`;

    } catch (error) {
      console.error(`❌ Failed to capture screenshot: ${error.message}`);
      await this.browserManager.closeBrowser(browser);
      return null;
    }
  }

  async captureElementScreenshotFromPage(page: Page, selector: string, thumbnail = false): Promise<string | null> {
    try {
      const element = page.locator(selector).first();

      if (thumbnail) {
        const screenshot = await element.screenshot({
          type: 'jpeg',
          quality: 70
        });
        return `data:image/jpeg;base64,${screenshot.toString('base64')}`;
      } else {
        const screenshot = await element.screenshot({ type: 'png' });
        return `data:image/png;base64,${screenshot.toString('base64')}`;
      }
    } catch (error) {
      console.error(`❌ Failed to capture screenshot from page: ${error.message}`);
      return null;
    }
  }

  async capturePageScreenshot(page: Page, fullPage = false): Promise<string | null> {
    try {
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage
      });
      return `data:image/png;base64,${screenshot.toString('base64')}`;
    } catch (error) {
      console.error(`❌ Failed to capture page screenshot: ${error.message}`);
      return null;
    }
  }
}
