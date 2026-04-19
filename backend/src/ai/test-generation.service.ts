import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaudeAiService } from './claude-ai.service';

@Injectable()
export class TestGenerationService {
  private readonly logger = new Logger(TestGenerationService.name);

  constructor(
    private prisma: PrismaService,
    private claudeAi: ClaudeAiService,
  ) {}

  async generateTestsForProject(projectId: string, userPrompt?: string): Promise<{
    tests: any[];
    playwrightFiles: Array<{ filename: string; content: string }>;
    warnings?: string[];
    summary: { total: number; byCategory: Record<string, number> };
  }> {
    // 1. Collect project context
    const context = await this.buildProjectContext(projectId);

    // 2. Generate tests with Claude
    const generatedTests = await this.claudeAi.generateTestSuite(context);

    // 3. Validate selectors against element library
    const validatedTests = await this.validateSelectors(projectId, generatedTests);

    // 4. Store as draft tests
    const storedTests: any[] = [];
    const storeErrors: string[] = [];
    for (const test of validatedTests) {
      try {
        const created = await this.prisma.test.create({
          data: {
            name: test.name,
            description: test.description,
            startingUrl: test.startingUrl,
            status: 'draft',
            steps: test.steps,
            project: { connect: { id: projectId } },
          },
        });
        storedTests.push({ ...created, category: test.category, needsAuth: test.needsAuth });
      } catch (error) {
        this.logger.warn(`Failed to store test "${test.name}": ${error.message}`);
        storeErrors.push(`"${test.name}": ${error.message}`);
      }
    }

    // If Claude generated tests but none could be persisted, that's a real error.
    if (validatedTests.length > 0 && storedTests.length === 0) {
      throw new Error(
        `AI generated ${validatedTests.length} tests but none could be saved. First error: ${storeErrors[0]}`
      );
    }

    // 5. Generate Playwright files
    const playwrightFiles = this.generatePlaywrightFiles(validatedTests, context);

    // 6. Summary
    const byCategory: Record<string, number> = {};
    validatedTests.forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    });

    return {
      tests: storedTests,
      playwrightFiles,
      warnings: storeErrors.length > 0 ? storeErrors : undefined,
      summary: { total: storedTests.length, byCategory },
    };
  }

  private async buildProjectContext(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        urls: {
          include: {
            elements: {
              select: { elementType: true, selector: true, description: true, confidence: true },
              orderBy: { confidence: 'desc' },
            },
            outgoingLinks: {
              include: { targetUrl: { select: { url: true } } },
            },
          },
        },
        authFlows: true,
      },
    });

    if (!project) throw new Error('Project not found');

    const pages = project.urls.map(url => ({
      url: url.url,
      pageType: url.pageType || 'unknown',
      requiresAuth: url.requiresAuth,
      elements: url.elements.map(el => ({
        elementType: el.elementType,
        selector: el.selector,
        description: el.description,
        confidence: el.confidence,
      })),
    }));

    const navigationPaths = project.urls.flatMap(url =>
      (url.outgoingLinks || []).map(link => ({
        from: url.url,
        to: link.targetUrl?.url || '',
        linkText: link.linkText || '',
      }))
    ).filter(p => p.to);

    const authFlow = project.authFlows?.[0] ? {
      loginUrl: project.authFlows[0].loginUrl,
      steps: project.authFlows[0].steps as any[] || [],
    } : undefined;

    return {
      projectName: project.name,
      projectUrl: project.urls[0]?.url || '',
      pages,
      navigationPaths,
      authFlow,
    };
  }

  private async validateSelectors(projectId: string, tests: any[]): Promise<any[]> {
    const elements = await this.prisma.projectElement.findMany({
      where: { projectId },
      select: { selector: true, fallbackSelectors: true, confidence: true },
    });

    const selectorSet = new Set(elements.map(e => e.selector));
    const selectorMap = new Map(elements.map(e => [e.selector, e]));

    return tests.map(test => ({
      ...test,
      steps: (test.steps || []).map((step: any) => {
        const match = selectorMap.get(step.selector);
        return {
          ...step,
          validated: selectorSet.has(step.selector),
          confidence: match?.confidence || 0,
          fallbackSelectors: match?.fallbackSelectors || [],
        };
      }),
    }));
  }

  private generatePlaywrightFiles(tests: any[], context: any): Array<{ filename: string; content: string }> {
    const byCategory = new Map<string, any[]>();
    tests.forEach(t => {
      const cat = t.category || 'general';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(t);
    });

    const files: Array<{ filename: string; content: string }> = [];

    for (const [category, categoryTests] of byCategory) {
      const hasAuth = categoryTests.some((t: any) => t.needsAuth);

      let content = `import { test, expect } from '@playwright/test';\n\n`;

      if (hasAuth && context.authFlow) {
        content += `// Helper: Login\n`;
        content += `async function login(page: any) {\n`;
        content += `  await page.goto('${context.authFlow.loginUrl}');\n`;
        for (const step of context.authFlow.steps) {
          if (step.type === 'type') {
            content += `  await page.locator('${step.selector}').fill('${step.value || ''}');\n`;
          } else if (step.type === 'click') {
            content += `  await page.locator('${step.selector}').click();\n`;
          }
        }
        content += `  await page.waitForTimeout(2000);\n`;
        content += `}\n\n`;
      }

      content += `test.describe('${category.charAt(0).toUpperCase() + category.slice(1)} Tests', () => {\n`;

      if (hasAuth) {
        content += `  test.beforeEach(async ({ page }) => {\n`;
        content += `    await login(page);\n`;
        content += `  });\n\n`;
      }

      for (const t of categoryTests) {
        content += `  test('${t.name.replace(/'/g, "\\'")}', async ({ page }) => {\n`;
        content += `    await page.goto('${t.startingUrl}');\n`;

        for (const step of t.steps || []) {
          content += `    ${this.stepToPlaywright(step)}\n`;
        }

        content += `  });\n\n`;
      }

      content += `});\n`;

      files.push({ filename: `${category}.spec.ts`, content });
    }

    return files;
  }

  private stepToPlaywright(step: any): string {
    const sel = step.selector || '';
    const val = step.value || '';
    const isNativeLocator = sel.startsWith('getBy');

    const locator = isNativeLocator ? `page.${sel}` : `page.locator('${sel.replace(/'/g, "\\'")}')`;

    switch (step.type) {
      case 'click': return `await ${locator}.click(); // ${step.description || ''}`;
      case 'type': return `await ${locator}.fill('${val.replace(/'/g, "\\'")}'); // ${step.description || ''}`;
      case 'assert': return `await expect(${locator}).toBeVisible(); // ${step.description || ''}`;
      case 'navigate': return `await page.goto('${val}'); // ${step.description || ''}`;
      case 'hover': return `await ${locator}.hover(); // ${step.description || ''}`;
      case 'select': return `await ${locator}.selectOption('${val}'); // ${step.description || ''}`;
      case 'wait': return `await page.waitForTimeout(${parseInt(val) || 1000}); // ${step.description || ''}`;
      case 'screenshot': return `await page.screenshot({ path: 'screenshot.png' }); // ${step.description || ''}`;
      case 'check': return `await ${locator}.check(); // ${step.description || ''}`;
      case 'uncheck': return `await ${locator}.uncheck(); // ${step.description || ''}`;
      case 'press': return `await page.keyboard.press('${val || 'Enter'}'); // ${step.description || ''}`;
      case 'scroll': return `await ${locator}.scrollIntoViewIfNeeded(); // ${step.description || ''}`;
      default: return `// Unknown step type: ${step.type} — ${step.description || ''}`;
    }
  }
}
