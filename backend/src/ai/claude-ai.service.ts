import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

interface ProjectContext {
  projectName: string;
  projectUrl: string;
  pages: Array<{
    url: string;
    pageType: string;
    requiresAuth: boolean;
    elements: Array<{
      elementType: string;
      selector: string;
      description: string;
      confidence: number;
    }>;
  }>;
  authFlow?: {
    loginUrl: string;
    steps: any[];
  };
  navigationPaths: Array<{
    from: string;
    to: string;
    linkText: string;
  }>;
}

interface GeneratedTest {
  name: string;
  description: string;
  startingUrl: string;
  category: string;
  needsAuth: boolean;
  steps: Array<{
    type: string;
    selector: string;
    value?: string;
    description: string;
  }>;
}

@Injectable()
export class ClaudeAiService {
  private readonly logger = new Logger(ClaudeAiService.name);
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('Claude AI service initialized');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — AI test generation disabled');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generateTestSuite(context: ProjectContext): Promise<GeneratedTest[]> {
    if (!this.client) {
      throw new Error('Claude AI not configured. Set ANTHROPIC_API_KEY environment variable.');
    }

    const allTests: GeneratedTest[] = [];
    const errors: string[] = [];

    // Generate tests by category for comprehensive coverage
    const categories = [
      { name: 'authentication', generator: () => this.generateAuthTests(context) },
      { name: 'navigation', generator: () => this.generateNavigationTests(context) },
      { name: 'forms', generator: () => this.generateFormTests(context) },
      { name: 'tables', generator: () => this.generateTableTests(context) },
      { name: 'e2e', generator: () => this.generateE2ETests(context) },
    ];

    for (const cat of categories) {
      try {
        this.logger.log(`Generating ${cat.name} tests...`);
        const tests = await cat.generator();
        allTests.push(...tests);
        this.logger.log(`Generated ${tests.length} ${cat.name} tests`);
      } catch (error) {
        this.logger.error(`Failed to generate ${cat.name} tests: ${error.message}`);
        errors.push(`${cat.name}: ${error.message}`);
      }
    }

    // Zero tests is always a failure — generateNavigationTests and generateE2ETests
    // always call Claude, so a zero result means something real went wrong.
    if (allTests.length === 0) {
      const detail = errors.length > 0
        ? errors.join('; ')
        : 'All 5 categories returned zero tests. Check project has analyzed pages and elements.';
      throw new Error(`AI generation produced no tests. ${detail}`);
    }

    return allTests;
  }

  private async callClaude(systemPrompt: string, userPrompt: string): Promise<GeneratedTest[]> {
    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('');

    return this.parseTestsJson(text);
  }

  private parseTestsJson(text: string): GeneratedTest[] {
    // Strip ```json ... ``` or ``` ... ``` fences if present
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = (fenceMatch ? fenceMatch[1] : text).trim();

    // Try direct parse first (cleanest path)
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to bracket extraction
    }

    // Fallback: greedy match of the outermost array
    const arrayMatch = candidate.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // fall through to logging
      }
    }

    const preview = text.slice(0, 500).replace(/\s+/g, ' ');
    this.logger.error(`Failed to parse Claude response as JSON. Raw (first 500 chars): ${preview}`);
    throw new Error(`Claude returned non-array JSON. Preview: ${preview.slice(0, 200)}`);
  }

  private getSystemPrompt(): string {
    return `You are an expert E2E test automation engineer using Playwright.

RULES:
1. ONLY use selectors provided in the AVAILABLE ELEMENTS section. Never invent selectors.
2. Every test MUST have at least one assertion (assert step or navigate with URL check).
3. Use Playwright native locators: getByRole, getByText, getByLabel, getByPlaceholder, getByTestId.
4. For authenticated pages, include login steps at the beginning.
5. Generate detailed, realistic test scenarios — not trivial ones.
6. Each test should have 3-10 steps.
7. Include both happy path AND error handling tests.

OUTPUT FORMAT:
Return a JSON array of test objects. Each test has:
{
  "name": "Test name",
  "description": "What this test verifies",
  "startingUrl": "https://...",
  "category": "authentication|navigation|forms|tables|e2e",
  "needsAuth": true/false,
  "steps": [
    { "type": "navigate|click|type|assert|hover|select|wait|screenshot", "selector": "...", "value": "...", "description": "..." }
  ]
}`;
  }

  private formatPageElements(context: ProjectContext): string {
    return context.pages.map(page => {
      const elements = page.elements.map(el =>
        `  [${el.elementType}] ${el.selector} — ${el.description} (confidence: ${el.confidence})`
      ).join('\n');
      return `\nPAGE: ${page.url} (type: ${page.pageType}, auth: ${page.requiresAuth})\n${elements}`;
    }).join('\n');
  }

  private formatNavPaths(context: ProjectContext): string {
    return context.navigationPaths.map(p =>
      `  ${p.from} → ${p.to} (link: "${p.linkText}")`
    ).join('\n');
  }

  private formatAuthFlow(context: ProjectContext): string {
    if (!context.authFlow) return 'No authentication flow configured.';
    return `LOGIN URL: ${context.authFlow.loginUrl}\nSTEPS:\n${
      context.authFlow.steps.map((s: any) =>
        `  ${s.type}: ${s.selector} ${s.value ? '= "' + s.value + '"' : ''}`
      ).join('\n')
    }`;
  }

  private async generateAuthTests(context: ProjectContext): Promise<GeneratedTest[]> {
    if (!context.authFlow) return [];
    const prompt = `PROJECT: ${context.projectName} (${context.projectUrl})

AUTHENTICATION FLOW:
${this.formatAuthFlow(context)}

AVAILABLE ELEMENTS:
${this.formatPageElements(context)}

Generate 5-8 authentication test scenarios:
1. Login with valid credentials → verify dashboard/home
2. Login with invalid password → verify error shown
3. Login with empty fields → verify validation
4. Logout → verify session cleared
5. Session persistence across page navigation
6. Unauthorized access to protected page → redirect to login
7. Remember me functionality (if available)
8. Password field masking verification`;
    return this.callClaude(this.getSystemPrompt(), prompt);
  }

  private async generateNavigationTests(context: ProjectContext): Promise<GeneratedTest[]> {
    const prompt = `PROJECT: ${context.projectName} (${context.projectUrl})

NAVIGATION PATHS:
${this.formatNavPaths(context)}

AVAILABLE ELEMENTS:
${this.formatPageElements(context)}

AUTHENTICATION:
${this.formatAuthFlow(context)}

Generate 10-15 navigation test scenarios covering:
1. One test per major navigation path (use the NAVIGATION PATHS above)
2. Verify correct page loads after each navigation
3. Verify page title or heading changes
4. Verify URL changes correctly
5. Back/forward browser navigation
6. Menu/navbar consistency across pages
7. Footer link navigation (if footer links detected)
8. Deep link access (go directly to authenticated page)`;
    return this.callClaude(this.getSystemPrompt(), prompt);
  }

  private async generateFormTests(context: ProjectContext): Promise<GeneratedTest[]> {
    const formPages = context.pages.filter(p =>
      p.elements.some(e => e.elementType === 'input' || e.elementType === 'form' || e.elementType === 'dropdown')
    );
    if (formPages.length === 0) return [];

    const prompt = `PROJECT: ${context.projectName} (${context.projectUrl})

PAGES WITH FORMS:
${formPages.map(p => `${p.url}:\n${p.elements
  .filter(e => ['input', 'form', 'dropdown', 'button'].includes(e.elementType))
  .map(e => `  [${e.elementType}] ${e.selector} — ${e.description}`)
  .join('\n')}`).join('\n\n')}

AUTHENTICATION:
${this.formatAuthFlow(context)}

Generate 8-12 form interaction test scenarios:
1. Fill all fields and submit
2. Submit with empty required fields → validation errors
3. Fill with invalid data → format validation
4. Dropdown selection and verification
5. Multi-step form navigation (Previous/Next)
6. Form data persistence after navigation
7. Clear form and re-fill
8. Special characters in text fields
9. Maximum length field validation`;
    return this.callClaude(this.getSystemPrompt(), prompt);
  }

  private async generateTableTests(context: ProjectContext): Promise<GeneratedTest[]> {
    const tablePages = context.pages.filter(p =>
      p.elements.some(e => e.elementType === 'table')
    );
    if (tablePages.length === 0) return [];

    const prompt = `PROJECT: ${context.projectName} (${context.projectUrl})

PAGES WITH TABLES:
${tablePages.map(p => `${p.url}:\n${p.elements
  .map(e => `  [${e.elementType}] ${e.selector} — ${e.description}`)
  .join('\n')}`).join('\n\n')}

AUTHENTICATION:
${this.formatAuthFlow(context)}

Generate 8-10 data table test scenarios:
1. Table renders with headers visible
2. Table has data rows (count > 0)
3. Search/filter functionality
4. Export to Excel button clickable
5. Sort by column (if available)
6. Pagination navigation (if available)
7. Row action buttons (Edit/Delete) clickable
8. Table data matches expected format
9. Empty table state (search with no results)
10. Table responsive behavior`;
    return this.callClaude(this.getSystemPrompt(), prompt);
  }

  private async generateE2ETests(context: ProjectContext): Promise<GeneratedTest[]> {
    const prompt = `PROJECT: ${context.projectName} (${context.projectUrl})

ALL PAGES:
${this.formatPageElements(context)}

NAVIGATION PATHS:
${this.formatNavPaths(context)}

AUTHENTICATION:
${this.formatAuthFlow(context)}

Generate 5-8 end-to-end integration test scenarios that cover COMPLETE user workflows:
1. Full user journey: login → navigate to main feature → perform action → verify result → logout
2. Data creation flow: navigate to form → fill → submit → verify in table/list
3. Cross-page data consistency: create on page A → verify on page B
4. Multi-step process completion: form step 1 → step 2 → step 3 → confirmation
5. Search workflow: login → navigate → search → verify results → click result
6. Export workflow: login → navigate to data → export → verify download initiated
7. Error recovery: trigger error → verify message → retry successfully
8. Full regression: visit every page → verify each loads correctly`;
    return this.callClaude(this.getSystemPrompt(), prompt);
  }
}
