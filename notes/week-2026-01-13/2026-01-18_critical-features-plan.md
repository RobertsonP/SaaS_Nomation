# Nomation - 3 Critical Features for Launch

## Overview

These 3 features address the **usability gap** - making your solid technical foundation accessible to non-technical users.

| Feature | User Problem | Solution |
|---------|--------------|----------|
| **Test Templates** | "I don't know where to start" | Pre-built tests users can apply instantly |
| **Plain English Descriptions** | "What does `#btn-submit` mean?" | Human-readable step labels |
| **Smart Failure Diagnosis** | "Why did my test fail?" | Clear explanations, not error codes |

---

# Feature 1: Test Templates / Quick Start

## What Users See Today
- Empty test builder
- "Add a step" button
- No guidance on what to test first

## What Users Should See
- "Quick Start" panel with common test templates
- One-click to create a working test
- Templates adapted to their specific website

---

## User Experience Flow

```
User lands on Test Builder
         ↓
┌─────────────────────────────────────┐
│  QUICK START                        │
│                                     │
│  ✓ Test Login Works                 │
│    "Verify users can log in"        │
│    [Use This Template]              │
│                                     │
│  ✓ Test Homepage Loads              │
│    "Check main page loads correctly"│
│    [Use This Template]              │
│                                     │
│  ✓ Test Navigation Links            │
│    "Verify menu links work"         │
│    [Use This Template]              │
│                                     │
│  [+ Create Blank Test]              │
└─────────────────────────────────────┘
         ↓
User clicks "Test Login Works"
         ↓
Template applied with placeholder selectors
         ↓
System: "Let's find your login form"
         ↓
AI scans page → auto-fills real selectors
         ↓
User has a WORKING test in 30 seconds
```

---

## Template Library

### Tier 1: Universal Templates (Work on Any Site)

| Template | Steps | Description |
|----------|-------|-------------|
| **Page Load Check** | 2 | Navigate → Assert title exists |
| **Click Navigation** | 3 | Navigate → Click menu → Assert page changed |
| **Form Submission** | 4 | Navigate → Fill form → Submit → Assert success |
| **Search Test** | 4 | Navigate → Type search → Submit → Assert results |

### Tier 2: E-commerce Templates

| Template | Steps | Description |
|----------|-------|-------------|
| **Add to Cart** | 5 | Navigate → Find product → Add to cart → Assert cart updated |
| **Checkout Flow** | 8 | Cart → Checkout → Fill details → Assert confirmation |
| **Product Filter** | 4 | Navigate → Apply filter → Assert products filtered |

### Tier 3: Authentication Templates

| Template | Steps | Description |
|----------|-------|-------------|
| **Login Success** | 4 | Navigate to login → Enter creds → Submit → Assert dashboard |
| **Login Failure** | 4 | Navigate to login → Wrong password → Assert error shown |
| **Logout** | 3 | (Requires auth) → Click logout → Assert logged out |
| **Password Reset** | 3 | Navigate → Enter email → Assert "email sent" message |

---

## Technical Implementation

### Data Structure (extends existing system)

```typescript
// New file: frontend/src/data/test-templates.ts

interface TestTemplate {
  id: string;
  name: string;
  description: string;
  category: 'universal' | 'ecommerce' | 'auth' | 'forms';
  difficulty: 'beginner' | 'intermediate';
  estimatedSteps: number;

  // Step definitions with placeholder selectors
  steps: TemplateStep[];

  // What to look for when auto-detecting selectors
  selectorHints: SelectorHint[];
}

interface TemplateStep {
  type: TestStep['type'];
  description: string;           // Human readable
  selectorPlaceholder: string;   // e.g., "LOGIN_BUTTON"
  selectorHint: string;          // e.g., "button containing 'login' or 'sign in'"
  value?: string;
  valueHint?: string;            // e.g., "test email address"
}

interface SelectorHint {
  placeholder: string;           // "LOGIN_BUTTON"
  patterns: string[];            // CSS patterns to try
  textPatterns: string[];        // Text content to match
  roleHints: string[];           // ARIA roles to look for
}
```

### Example Template Definition

```typescript
const loginTemplate: TestTemplate = {
  id: 'login-success',
  name: 'Test Login Works',
  description: 'Verify users can log in with valid credentials',
  category: 'auth',
  difficulty: 'beginner',
  estimatedSteps: 4,

  steps: [
    {
      type: 'navigate',
      description: 'Go to login page',
      selectorPlaceholder: 'LOGIN_PAGE_URL',
      selectorHint: 'URL ending in /login, /signin, or /auth'
    },
    {
      type: 'type',
      description: 'Enter email address',
      selectorPlaceholder: 'EMAIL_INPUT',
      selectorHint: 'Input field for email or username',
      valueHint: 'Test user email'
    },
    {
      type: 'type',
      description: 'Enter password',
      selectorPlaceholder: 'PASSWORD_INPUT',
      selectorHint: 'Password input field',
      valueHint: 'Test user password'
    },
    {
      type: 'click',
      description: 'Click login button',
      selectorPlaceholder: 'LOGIN_BUTTON',
      selectorHint: 'Button with text like "Login", "Sign In", "Submit"'
    },
    {
      type: 'assert',
      description: 'Verify login succeeded',
      selectorPlaceholder: 'SUCCESS_INDICATOR',
      selectorHint: 'Dashboard element, welcome message, or logout button'
    }
  ],

  selectorHints: [
    {
      placeholder: 'EMAIL_INPUT',
      patterns: ['input[type="email"]', 'input[name*="email"]', 'input[name*="user"]'],
      textPatterns: [],
      roleHints: ['textbox']
    },
    {
      placeholder: 'PASSWORD_INPUT',
      patterns: ['input[type="password"]'],
      textPatterns: [],
      roleHints: ['textbox']
    },
    {
      placeholder: 'LOGIN_BUTTON',
      patterns: ['button[type="submit"]', 'input[type="submit"]'],
      textPatterns: ['login', 'sign in', 'log in', 'submit'],
      roleHints: ['button']
    }
  ]
};
```

---

## UI Components to Build

### 1. TemplateGallery Component
**Location:** `frontend/src/components/test-builder/TemplateGallery.tsx`

- Grid of template cards
- Category filters (tabs)
- Search/filter
- Preview on hover

### 2. TemplateApplyModal Component
**Location:** `frontend/src/components/test-builder/TemplateApplyModal.tsx`

- Shows template steps
- "Auto-detect selectors" button
- Manual selector override fields
- "Create Test" action

### 3. Backend: Template Selector Detection
**Location:** `backend/src/ai/template-selector.service.ts`

- Takes page URL + template hints
- Uses existing element analysis
- Returns matched selectors
- Falls back to placeholders if not found

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/data/test-templates.ts` | CREATE | Template definitions |
| `frontend/src/components/test-builder/TemplateGallery.tsx` | CREATE | Template selection UI |
| `frontend/src/components/test-builder/TemplateApplyModal.tsx` | CREATE | Apply template flow |
| `frontend/src/pages/tests/TestBuilderPage.tsx` | MODIFY | Add Quick Start section |
| `backend/src/templates/templates.controller.ts` | CREATE | Template API |
| `backend/src/templates/template-selector.service.ts` | CREATE | AI selector matching |

---

# Feature 2: Plain English Test Descriptions

## Current State
**Good news:** `TestStep.description` field already exists and is displayed!

**Problem:** Descriptions are often technical or missing:
- "Click #main-nav > ul > li:nth-child(3) > a"
- "Type value in input"
- "" (empty)

---

## The Goal

| Current | Improved |
|---------|----------|
| Click `#btn-submit` | Click the "Submit Order" button |
| Type in `input[name="email"]` | Enter email address in the login form |
| Assert `div.success` exists | Verify success message is displayed |
| Wait 3000ms | Wait for page to load |

---

## Implementation: AI Description Generator

### When Descriptions Are Generated

1. **On element pick** - User clicks element in live browser
2. **On step add** - User manually adds step
3. **On template apply** - Steps from templates
4. **On import** - If importing tests without descriptions

### Backend Service

**File:** `backend/src/ai/description-generator.service.ts`

```typescript
@Injectable()
export class DescriptionGeneratorService {

  async generateStepDescription(
    stepType: string,
    selector: string,
    value?: string,
    pageContext?: PageContext
  ): Promise<string> {

    // Strategy 1: Use element metadata if available
    if (pageContext?.elementInfo) {
      return this.describeFromElement(stepType, pageContext.elementInfo, value);
    }

    // Strategy 2: Parse selector for hints
    return this.describeFromSelector(stepType, selector, value);
  }

  private describeFromElement(
    stepType: string,
    element: ElementInfo,
    value?: string
  ): string {
    const elementName = element.text || element.ariaLabel || element.name || 'element';
    const elementType = element.tagName.toLowerCase();

    switch (stepType) {
      case 'click':
        if (elementType === 'button') return `Click the "${elementName}" button`;
        if (elementType === 'a') return `Click the "${elementName}" link`;
        return `Click on "${elementName}"`;

      case 'type':
        const fieldName = element.placeholder || element.label || 'field';
        return `Enter "${value}" in the ${fieldName}`;

      case 'assert':
        return `Verify "${elementName}" is visible`;

      case 'hover':
        return `Hover over "${elementName}"`;

      case 'select':
        return `Select "${value}" from ${elementName} dropdown`;

      // ... other step types
    }
  }

  private describeFromSelector(
    stepType: string,
    selector: string,
    value?: string
  ): string {
    // Extract meaningful parts from selector
    const parts = this.parseSelector(selector);

    // Generate description based on parsed parts
    const target = parts.id || parts.text || parts.class || 'element';

    switch (stepType) {
      case 'click':
        return `Click the ${target}`;
      case 'type':
        return `Type "${value}" into ${target}`;
      case 'assert':
        return `Verify ${target} exists`;
      case 'wait':
        return `Wait for ${target} to appear`;
      // ... etc
    }
  }

  private parseSelector(selector: string): SelectorParts {
    return {
      id: selector.match(/#([\w-]+)/)?.[1],
      class: selector.match(/\.([\w-]+)/)?.[1],
      text: selector.match(/text=["']([^"']+)["']/)?.[1],
      role: selector.match(/role=["']([^"']+)["']/)?.[1],
    };
  }
}
```

---

## Frontend Integration

### Modify Element Picker

**File:** `frontend/src/components/test-builder/ElementPicker.tsx`

When user clicks an element:

```typescript
const handleElementSelected = async (element: PickedElement) => {
  // Get AI-generated description
  const description = await api.post('/api/ai/describe-step', {
    stepType: selectedAction,  // click, type, etc.
    selector: element.selector,
    value: inputValue,
    elementInfo: {
      tagName: element.tagName,
      text: element.innerText,
      ariaLabel: element.ariaLabel,
      placeholder: element.placeholder,
      name: element.name,
    }
  });

  // Add step with good description
  addStep({
    type: selectedAction,
    selector: element.selector,
    value: inputValue,
    description: description.data.description  // AI-generated!
  });
};
```

### Modify Manual Step Form

**File:** `frontend/src/components/test-builder/TestBuilderPanel.tsx`

Add "Generate Description" button:

```tsx
<div className="flex gap-2">
  <input
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Step description"
    className="flex-1"
  />
  <button
    onClick={generateDescription}
    className="text-blue-600 text-sm"
  >
    ✨ Auto-generate
  </button>
</div>
```

---

## Fallback Rules (No AI Needed)

For simple cases, use rule-based generation:

```typescript
const SIMPLE_DESCRIPTIONS: Record<string, (s: string, v?: string) => string> = {
  'navigate': (_, v) => `Navigate to ${v}`,
  'wait': (_, v) => `Wait ${v}ms`,
  'screenshot': () => 'Take a screenshot',
  'scroll': (s) => s.includes('bottom') ? 'Scroll to bottom of page' : 'Scroll the page',
  'clear': (s) => `Clear the input field`,
  'check': (s) => `Check the checkbox`,
  'uncheck': (s) => `Uncheck the checkbox`,
};
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/ai/description-generator.service.ts` | CREATE | AI description generation |
| `backend/src/ai/ai.controller.ts` | MODIFY | Add `/describe-step` endpoint |
| `frontend/src/components/test-builder/ElementPicker.tsx` | MODIFY | Auto-describe on pick |
| `frontend/src/components/test-builder/TestBuilderPanel.tsx` | MODIFY | Add generate button |

---

# Feature 3: Smart Failure Diagnosis

## Current State
When a test fails, users see:
```
Step "Click #submit-btn" failed:
Timeout waiting for selector "#submit-btn"
```

**Problem:** Users don't know:
- WHY it failed
- How to FIX it
- If it's their fault or a real bug

---

## The Goal

Transform error messages into actionable guidance:

```
❌ Step 3 Failed: Click the "Submit" button

WHAT HAPPENED:
The button wasn't found on the page after 30 seconds.

LIKELY CAUSE:
🔄 Page Loading Issue - The page might still be loading when the test
   tried to click. The button may appear after dynamic content loads.

SUGGESTED FIXES:
1. Add a wait step before this action
2. Check if the button requires scrolling to view
3. Verify the page URL is correct

EVIDENCE:
📷 Screenshot shows a loading spinner still visible
🎬 Video timestamp: 0:45 - click here to view
```

---

## Failure Categories

| Category | Detection | User Message |
|----------|-----------|--------------|
| **Element Not Found** | Selector timeout | "The element wasn't found on the page" |
| **Page Still Loading** | Screenshot shows loader | "The page was still loading" |
| **Wrong Page** | URL mismatch | "The test is on the wrong page" |
| **Element Hidden** | Element exists but hidden | "The element exists but is hidden/covered" |
| **Auth Required** | Login page detected | "The page requires login" |
| **Network Error** | Page failed to load | "The page didn't load properly" |
| **Timing Issue** | Flaky (passes sometimes) | "The test is timing-sensitive" |
| **Selector Changed** | Similar element found | "The element may have moved or changed" |

---

## Technical Implementation

### Backend: Failure Analyzer Service

**File:** `backend/src/execution/failure-analyzer.service.ts`

```typescript
@Injectable()
export class FailureAnalyzerService {

  async analyzeFailed(
    execution: TestExecution,
    failedStepIndex: number
  ): Promise<FailureDiagnosis> {

    const step = execution.test.steps[failedStepIndex];
    const stepResult = execution.results[failedStepIndex];
    const screenshot = execution.screenshots[failedStepIndex];

    // Gather context
    const context: FailureContext = {
      error: stepResult.error,
      stepType: step.type,
      selector: step.selector,
      expectedUrl: step.value,  // for navigate steps
      screenshot: screenshot,
      previousSteps: execution.results.slice(0, failedStepIndex),
      pageState: await this.analyzeScreenshot(screenshot),
    };

    // Classify the failure
    const category = this.classifyFailure(context);

    // Generate diagnosis
    return {
      category,
      summary: this.getSummary(category, context),
      likelyCause: this.getLikelyCause(category, context),
      suggestedFixes: this.getSuggestedFixes(category, context),
      evidence: this.gatherEvidence(context),
      confidence: this.calculateConfidence(category, context),
    };
  }

  private classifyFailure(context: FailureContext): FailureCategory {
    const { error, pageState } = context;

    // Check for timeout errors
    if (error.includes('timeout') || error.includes('Timeout')) {
      if (pageState.hasLoader) return 'PAGE_LOADING';
      if (pageState.hasLoginForm) return 'AUTH_REQUIRED';
      return 'ELEMENT_NOT_FOUND';
    }

    // Check for visibility issues
    if (error.includes('not visible') || error.includes('hidden')) {
      return 'ELEMENT_HIDDEN';
    }

    // Check for navigation issues
    if (error.includes('net::') || error.includes('failed to load')) {
      return 'NETWORK_ERROR';
    }

    // Check page state for more context
    if (pageState.currentUrl !== context.expectedUrl) {
      return 'WRONG_PAGE';
    }

    return 'UNKNOWN';
  }

  private getSuggestedFixes(
    category: FailureCategory,
    context: FailureContext
  ): SuggestedFix[] {

    const fixes: Record<FailureCategory, SuggestedFix[]> = {
      'ELEMENT_NOT_FOUND': [
        { action: 'add_wait', description: 'Add a wait step before this action' },
        { action: 'check_selector', description: 'Verify the selector is correct' },
        { action: 'use_fallback', description: 'Add fallback selectors' },
      ],
      'PAGE_LOADING': [
        { action: 'add_wait', description: 'Wait for page to fully load' },
        { action: 'increase_timeout', description: 'Increase step timeout' },
      ],
      'AUTH_REQUIRED': [
        { action: 'add_auth_flow', description: 'Add authentication flow to test' },
        { action: 'check_credentials', description: 'Verify login credentials' },
      ],
      'ELEMENT_HIDDEN': [
        { action: 'add_scroll', description: 'Scroll element into view' },
        { action: 'close_modal', description: 'Close any overlaying modals' },
      ],
      // ... other categories
    };

    return fixes[category] || [];
  }

  private async analyzeScreenshot(
    screenshot: string
  ): Promise<ScreenshotAnalysis> {
    // Use AI to analyze screenshot for:
    // - Loading indicators (spinners, progress bars)
    // - Login forms
    // - Error messages
    // - Modal overlays

    // Can use Ollama for this analysis
    const analysis = await this.aiService.analyzeImage(screenshot, {
      questions: [
        'Is there a loading spinner or progress indicator visible?',
        'Is there a login form visible?',
        'Are there any error messages visible?',
        'Is there a modal or popup covering content?',
      ]
    });

    return {
      hasLoader: analysis.hasLoader,
      hasLoginForm: analysis.hasLoginForm,
      hasErrorMessage: analysis.hasErrorMessage,
      hasModal: analysis.hasModal,
      errorText: analysis.errorText,
    };
  }
}
```

---

## Frontend: Diagnosis Display

### Modify Test Results Page

**File:** `frontend/src/components/test-results/FailureDiagnosis.tsx`

```tsx
interface FailureDiagnosisProps {
  diagnosis: FailureDiagnosis;
  onApplyFix: (fix: SuggestedFix) => void;
}

export function FailureDiagnosis({ diagnosis, onApplyFix }: FailureDiagnosisProps) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 space-y-4">
      {/* Summary */}
      <div className="flex items-start gap-3">
        <AlertCircle className="text-red-500 mt-1" />
        <div>
          <h4 className="font-medium text-red-800 dark:text-red-200">
            {diagnosis.summary}
          </h4>
        </div>
      </div>

      {/* Likely Cause */}
      <div className="bg-white dark:bg-gray-800 rounded p-3">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Likely Cause
        </h5>
        <p className="text-gray-600 dark:text-gray-400">
          {getCauseIcon(diagnosis.category)} {diagnosis.likelyCause}
        </p>
      </div>

      {/* Suggested Fixes */}
      <div>
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Suggested Fixes
        </h5>
        <div className="space-y-2">
          {diagnosis.suggestedFixes.map((fix, i) => (
            <button
              key={i}
              onClick={() => onApplyFix(fix)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <Wrench size={14} />
              {fix.description}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence */}
      {diagnosis.evidence && (
        <div className="text-xs text-gray-500 space-y-1">
          {diagnosis.evidence.screenshotNote && (
            <p>📷 {diagnosis.evidence.screenshotNote}</p>
          )}
          {diagnosis.evidence.videoTimestamp && (
            <p>🎬 Video at {diagnosis.evidence.videoTimestamp}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Data Flow

```
Test Fails
    ↓
execution.service.ts captures error + screenshot
    ↓
failure-analyzer.service.ts classifies failure
    ↓
AI analyzes screenshot (optional, for better diagnosis)
    ↓
Diagnosis stored in TestExecution.diagnosis (new JSON field)
    ↓
Frontend renders FailureDiagnosis component
    ↓
User clicks "Apply Fix" → guided fix workflow
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/execution/failure-analyzer.service.ts` | CREATE | Core diagnosis logic |
| `backend/src/execution/execution.service.ts` | MODIFY | Call analyzer on failure |
| `backend/prisma/schema.prisma` | MODIFY | Add `diagnosis` field to TestExecution |
| `frontend/src/components/test-results/FailureDiagnosis.tsx` | CREATE | Diagnosis UI |
| `frontend/src/pages/tests/TestResultsPage.tsx` | MODIFY | Show diagnosis |

---

# Implementation Priority

## Phase 1: Quick Wins (1-2 days each)

1. **Plain English Descriptions** - Already have the field, just need generator
2. **Simple Failure Messages** - Rule-based, no AI needed

## Phase 2: High Impact (3-5 days each)

3. **Test Templates** - 5 universal templates first
4. **Smart Diagnosis** - Basic category detection

## Phase 3: Polish

5. **AI Screenshot Analysis** - Enhanced diagnosis
6. **Template Auto-Detection** - AI selector matching
7. **One-Click Fixes** - Apply suggested fixes automatically

---

# Summary

| Feature | Effort | Impact | Dependencies |
|---------|--------|--------|--------------|
| **Test Templates** | Medium | HIGH | Template data + UI |
| **Plain English** | Low | HIGH | AI service (optional) |
| **Smart Diagnosis** | Medium | HIGH | Analyzer service |

All three features build on existing infrastructure. No major architecture changes needed.
