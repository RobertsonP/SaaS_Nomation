/**
 * Task 1.13: NotionBugCreatorService
 *
 * Automatically creates bug reports in Notion when automated tests fail.
 * Includes deduplication to prevent duplicate bugs for the same failure.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export interface BugReport {
  testName: string;
  testSuiteId: string;
  executionId: string;
  errorMessage: string;
  errorStack?: string;
  screenshotUrl?: string;
  pageUrl?: string;
  stepNumber?: number;
  stepAction?: string;
  stepSelector?: string;
}

export interface BugCreationResult {
  success: boolean;
  notionPageId?: string;
  isDuplicate?: boolean;
  error?: string;
  localBugId?: string;
}

@Injectable()
export class NotionBugCreatorService {
  private readonly logger = new Logger(NotionBugCreatorService.name);
  private databaseId: string;

  constructor(
    private notionClient: any,
    private prisma: any,
  ) {
    // Database ID should be configured via environment variable
    this.databaseId = process.env.NOTION_BUG_DATABASE_ID || '';
  }

  /**
   * Create a bug report in Notion from a test failure
   */
  async createBugFromFailure(data: BugReport): Promise<BugCreationResult> {
    try {
      // Generate fingerprint for deduplication
      const fingerprint = this.generateFingerprint(data);

      // Check for existing bug with same fingerprint
      const existingBug = await this.prisma.bugReport.findFirst({
        where: {
          fingerprint,
          status: { not: 'resolved' },
        },
      });

      if (existingBug) {
        this.logger.log(`Duplicate bug found for fingerprint: ${fingerprint}`);
        return {
          success: true,
          isDuplicate: true,
          notionPageId: existingBug.notionPageId,
          localBugId: existingBug.id,
        };
      }

      // Create Notion page
      let notionPageId: string | undefined;
      try {
        const notionPage = await this.createNotionPage(data);
        notionPageId = notionPage.id;
        this.logger.log(`Created Notion bug page: ${notionPageId}`);
      } catch (notionError) {
        this.logger.error(`Failed to create Notion page: ${notionError.message}`);
        // Continue to create local record
      }

      // Create local bug record
      const localBug = await this.prisma.bugReport.create({
        data: {
          fingerprint,
          testName: data.testName,
          testSuiteId: data.testSuiteId,
          executionId: data.executionId,
          errorMessage: data.errorMessage,
          errorStack: data.errorStack,
          screenshotUrl: data.screenshotUrl,
          pageUrl: data.pageUrl,
          stepNumber: data.stepNumber,
          stepAction: data.stepAction,
          stepSelector: data.stepSelector,
          notionPageId,
          status: 'open',
        },
      });

      if (!notionPageId) {
        return {
          success: false,
          error: 'Failed to create Notion page',
          localBugId: localBug.id,
        };
      }

      return {
        success: true,
        notionPageId,
        localBugId: localBug.id,
      };
    } catch (error) {
      this.logger.error(`Bug creation failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate a fingerprint for deduplication
   * Same test + same selector + same error type = same fingerprint
   */
  generateFingerprint(data: BugReport): string {
    const parts = [
      data.testSuiteId,
      data.stepSelector || '',
      this.normalizeErrorMessage(data.errorMessage),
    ];

    const hash = createHash('sha256')
      .update(parts.join('|'))
      .digest('hex')
      .substring(0, 16);

    return hash;
  }

  /**
   * Normalize error message for fingerprinting
   * Removes timestamps, IDs, and other variable parts
   */
  private normalizeErrorMessage(message: string): string {
    return message
      .replace(/\d{4}-\d{2}-\d{2}/g, 'DATE') // Dates
      .replace(/\d{2}:\d{2}:\d{2}/g, 'TIME') // Times
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID') // UUIDs
      .replace(/\d+ms/g, 'Xms') // Durations
      .replace(/timeout \d+/gi, 'timeout X') // Timeout values
      .trim()
      .toLowerCase();
  }

  /**
   * Create a Notion page with bug details
   */
  private async createNotionPage(data: BugReport) {
    const title = `[Bug] ${data.testName} - Step ${data.stepNumber || '?'} failed`;

    const children: any[] = [
      // Error message
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Error Details' } }],
        },
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: data.errorMessage },
              annotations: { code: true },
            },
          ],
        },
      },
    ];

    // Step details
    if (data.stepNumber !== undefined) {
      children.push({
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Step Information' } }],
        },
      });

      children.push({
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `Step ${data.stepNumber}: ${data.stepAction || 'unknown'} on "${data.stepSelector || 'unknown'}"`,
              },
            },
          ],
        },
      });
    }

    // Page URL
    if (data.pageUrl) {
      children.push({
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: 'Page URL: ' } },
            {
              type: 'text',
              text: { content: data.pageUrl, link: { url: data.pageUrl } },
            },
          ],
        },
      });
    }

    // Error stack
    if (data.errorStack) {
      children.push({
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Stack Trace' } }],
        },
      });

      children.push({
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: data.errorStack } }],
          language: 'plain text',
        },
      });
    }

    // Screenshot
    if (data.screenshotUrl) {
      children.push({
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Screenshot' } }],
        },
      });

      children.push({
        type: 'image',
        image: {
          type: 'external',
          external: { url: data.screenshotUrl },
        },
      });
    }

    // Metadata
    children.push({
      type: 'divider',
      divider: {},
    });

    children.push({
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: `Test Suite ID: ${data.testSuiteId}\nExecution ID: ${data.executionId}`,
            },
            annotations: { color: 'gray' },
          },
        ],
      },
    });

    return this.notionClient.pages.create({
      parent: { database_id: this.databaseId },
      properties: {
        Name: {
          title: [{ type: 'text', text: { content: title } }],
        },
        Status: {
          status: { name: 'Not started' },
        },
      },
      children,
    });
  }
}
