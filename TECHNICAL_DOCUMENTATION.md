# 🔧 SaaS Nomation - Technical Documentation & Testing Guide
**Version**: Phase 3 Complete
**Last Updated**: 2026-01-06
**Status**: Production Ready

---

## 📊 EXECUTIVE SUMMARY

### What You Have Built
- **Visual Test Automation Platform** - Create browser tests without writing code
- **Element Auto-Discovery** - AI-powered element analyzer finds interactive elements
- **Professional Reporting** - PDF reports + email notifications
- **User Settings** - Profile customization, theme toggle, notification preferences

### Current Status
- **Phase 0-2**: ✅ Complete (Foundation + Core Features)
- **Phase 3**: ✅ Complete (Professional Features - Reporting + Settings)
- **Phase 4**: ⏳ Planned (Multi-Tenancy + Billing - NOT built yet)

---

## 🏗️ SYSTEM ARCHITECTURE

### Technology Stack

**Frontend**:
- **Framework**: React 18 + TypeScript
- **Routing**: React Router v6
- **State**: Context API
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **Build**: Vite
- **Port**: `http://localhost:3001`

**Backend**:
- **Framework**: NestJS (Node.js + TypeScript)
- **Database**: PostgreSQL 15 + Prisma ORM
- **Queue**: Bull (Redis-based)
- **Authentication**: JWT + bcrypt
- **Browser Automation**: Playwright
- **PDF Generation**: Puppeteer + Handlebars
- **Email**: Nodemailer
- **Port**: `http://localhost:3002`

**Infrastructure**:
- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL in Docker
- **Cache/Queue**: Redis in Docker
- **AI**: Ollama (local LLM for element analysis)
- **Browser**: Chromium (via Playwright)

---

## 🎯 FEATURE MATRIX (What's Built vs Planned)

### ✅ IMPLEMENTED FEATURES (Ready for Testing)

#### 1. **Authentication & User Management**
- **Registration**: Email + password signup
- **Login/Logout**: JWT token-based sessions
- **Password Security**: bcrypt hashing (10 rounds)
- **Profile Settings**: Name, email, timezone, theme (NEW - Phase 3)
- **Password Change**: Secure password update with current password verification (NEW - Phase 3)

**Files**:
- Backend: `backend/src/auth/`
- Frontend: `frontend/src/pages/auth/`, `frontend/src/pages/settings/ProfileSettingsPage.tsx`

**Testing**:
```bash
# Register new user
POST http://localhost:3002/auth/register
Body: { "name": "John Doe", "email": "john@test.com", "password": "test123" }

# Login
POST http://localhost:3002/auth/login
Body: { "email": "john@test.com", "password": "test123" }

# Update profile
PATCH http://localhost:3002/auth/profile
Headers: { "Authorization": "Bearer <token>" }
Body: { "name": "John Updated", "theme": "dark", "timezone": "America/New_York" }
```

---

#### 2. **Project Management**
- **Create Projects**: Organize tests by project
- **Project URLs**: Add multiple URLs to analyze
- **Project Settings**: Configure auth flows
- **Project Deletion**: Cascade delete (all tests + data)

**Database Schema**:
```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String
  createdAt   DateTime
  tests       Test[]
  urls        ProjectUrl[]
  elements    ProjectElement[]
}
```

**Testing**:
```bash
# Create project
POST http://localhost:3002/api/projects
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "name": "My Test Project",
  "description": "Testing my website",
  "startingUrl": "https://example.com"
}

# List projects
GET http://localhost:3002/api/projects
```

---

#### 3. **Element Auto-Discovery & Analysis** ⭐

**This is your CORE FEATURE - let me explain in detail:**

##### How It Works:

**Step 1: URL Analysis Request**
User adds a URL to their project → Backend receives analysis request

**Step 2: Browser Launch**
```typescript
// backend/src/ai/element-analyzer.service.ts
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0...' // Real browser UA
});
const page = await context.newPage();
```

**Step 3: Page Load with Smart Waiting**
```typescript
// Progressive loading strategy
try {
  // Fast sites: wait for networkidle (15s timeout)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
} catch {
  // Slow sites: wait for domcontentloaded (45s timeout)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
}
```

**Step 4: Element Discovery**
The analyzer searches for ALL interactive elements:

```typescript
// Comprehensive element selector
const elements = await page.$$eval('*', (nodes) => {
  return nodes
    .filter(node => {
      // Include:
      // - Buttons, links, inputs
      // - Elements with click handlers
      // - Interactive ARIA roles
      // - Clickable divs (React apps)
      // - Form elements
      // - Navigation elements

      const tagName = node.tagName.toLowerCase();
      const role = node.getAttribute('role');
      const clickable = node.onclick || node.hasAttribute('ng-click');

      return (
        ['button', 'a', 'input', 'select', 'textarea'].includes(tagName) ||
        ['button', 'link', 'menuitem', 'tab'].includes(role) ||
        clickable ||
        (tagName === 'div' && node.classList.contains('clickable'))
      );
    })
    .map(node => ({
      selector: generateSelector(node),
      type: node.tagName,
      text: node.innerText,
      attributes: getAttributes(node),
      boundingRect: node.getBoundingClientRect()
    }));
});
```

**Step 5: Smart Selector Generation**
For each element, generates MULTIPLE selectors with priority:

```typescript
function generateSelector(element) {
  // Priority 1: Unique ID
  if (element.id) return `#${element.id}`;

  // Priority 2: data-testid (best practice)
  if (element.dataset.testid) return `[data-testid="${element.dataset.testid}"]`;

  // Priority 3: name attribute (forms)
  if (element.name) return `[name="${element.name}"]`;

  // Priority 4: Unique class combination
  const classes = Array.from(element.classList);
  if (isUniqueOnPage(classes)) return `.${classes.join('.')}`;

  // Priority 5: XPath with text (buttons/links)
  if (element.innerText) {
    return `//button[text()="${element.innerText}"]`;
  }

  // Priority 6: CSS path (fallback)
  return getCssPath(element);
}
```

**Step 6: Fallback Selectors**
Generates backup selectors for robustness:

```typescript
{
  selector: "#login-button",           // Primary
  fallbackSelectors: [
    "[data-testid='login-btn']",      // Backup 1
    "button.btn-primary",              // Backup 2
    "//button[text()='Login']"         // Backup 3 (XPath)
  ]
}
```

**Step 7: Element Categorization**
```typescript
const category = categorizeElement(element);
// Returns: 'button', 'input', 'link', 'form', 'navigation', 'media', etc.
```

**Step 8: Quality Scoring**
```typescript
{
  uniquenessScore: 0.95,      // How unique is this selector? (0-1)
  stabilityScore: 0.85,       // Will it survive code changes? (0-1)
  accessibilityScore: 0.90,   // Uses semantic HTML/ARIA? (0-1)
  specificityScore: 0.80,     // Not too broad, not too narrow? (0-1)
  overallQuality: 0.875       // Average of above
}
```

**Step 9: Database Storage**
```prisma
model ProjectElement {
  id                 String
  projectId          String
  selector           String    // Primary selector
  fallbackSelectors  String[]  // Backup selectors
  elementType        String    // button, input, link, etc.
  description        String    // Human-readable description
  confidence         Float     // Overall quality score
  attributes         Json      // All element attributes
  boundingRect       Json      // Position on page
  category           String?   // Categorization
  sourceUrlId        String?   // Which URL it came from

  // Quality metrics
  uniquenessScore    Float?
  stabilityScore     Float?
  accessibilityScore Float?
  specificityScore   Float?
  overallQuality     Float?

  // Validation
  isValidated        Boolean   // Has been tested?
  lastValidated      DateTime?
  validationErrors   String[]
}
```

##### Element Analyzer Features:

✅ **Auto-Discovery**: Finds all interactive elements automatically
✅ **Smart Selectors**: Multiple strategies (ID, data-testid, XPath, CSS)
✅ **Fallback System**: 3-4 backup selectors per element
✅ **Quality Scoring**: Rates selector reliability
✅ **Framework Support**: React, Vue, Angular, vanilla JS
✅ **ARIA Support**: Uses accessibility attributes
✅ **Dynamic Content**: Handles SPAs and lazy-loaded elements
✅ **Categorization**: Groups elements by type

##### Testing the Element Analyzer:

**Method 1: Via Frontend**
1. Create a project
2. Go to Project Settings → URLs
3. Add URL: `https://demo.testim.io`
4. Click "Analyze URL"
5. Wait for analysis (10-60 seconds)
6. Go to Test Builder
7. Open "Element Library" panel
8. You should see discovered elements

**Method 2: Via API**
```bash
# Trigger analysis
POST http://localhost:3002/ai/analyze
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "projectId": "clx...",
  "url": "https://demo.testim.io"
}

# Check discovered elements
GET http://localhost:3002/api/projects/{projectId}/elements
```

**Expected Output**:
```json
{
  "elements": [
    {
      "id": "clx123...",
      "selector": "#login-button",
      "fallbackSelectors": [
        "[data-testid='login']",
        "button.btn-primary",
        "//button[text()='Login']"
      ],
      "elementType": "button",
      "description": "Login Button",
      "confidence": 0.95,
      "category": "button",
      "attributes": {
        "id": "login-button",
        "class": "btn btn-primary",
        "type": "submit"
      },
      "overallQuality": 0.92
    }
  ],
  "totalFound": 47,
  "analyzed": true
}
```

**Troubleshooting Element Discovery**:

❌ **Problem**: No elements found
✅ **Solution**:
- Check if URL is accessible
- Increase timeout in element-analyzer.service.ts
- Check Playwright browser logs

❌ **Problem**: Elements found but selectors don't work
✅ **Solution**:
- Use fallback selectors
- Check if page is dynamic (SPA)
- Regenerate selectors after code changes

❌ **Problem**: Analysis times out
✅ **Solution**:
- Site might be too slow
- Check network connectivity
- Use `waitUntil: 'domcontentloaded'` instead of 'networkidle'

---

#### 4. **Test Builder (Visual Test Creation)**

**UI Components**:
- **Test Steps Panel**: Add/edit/reorder test steps
- **Element Library Panel**: Browse discovered elements
- **Live Element Picker**: Click elements on live page
- **Step Types**: Navigate, Click, Type, Assert, Wait

**Step Configuration**:
```typescript
{
  type: 'click',
  elementId: 'clx123...',  // Links to ProjectElement
  selector: '#login-button',
  description: 'Click Login Button',
  waitBefore: 0,           // Wait before executing
  timeout: 5000            // Max wait for element
}
```

**Testing**:
1. Open project
2. Click "Create Test"
3. Add steps:
   - Navigate to URL
   - Click element (pick from library)
   - Type text in field
   - Assert text exists
4. Save test
5. Run test

---

#### 5. **Test Execution Engine** ⭐

**Execution Flow**:

```typescript
// 1. Queue test execution
POST /api/tests/{testId}/execute

// 2. Bull queue processes job
@Processor('execution-queue')
export class ExecutionQueueProcessor {
  async process(job: Job<{ testId: string }>) {
    // 3. Launch real browser
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });

    // 4. Enable video recording
    const context = await browser.newContext({
      recordVideo: {
        dir: './test-videos',
        size: { width: 1920, height: 1080 }
      }
    });

    // 5. Execute each step
    for (const step of test.steps) {
      await executeStep(page, step);
      await captureScreenshot(page, step);
    }

    // 6. Save results
    await saveExecution({
      status: 'passed|failed',
      duration: elapsed,
      videoPath: videoPath,
      screenshots: screenshots,
      logs: logs
    });
  }
}
```

**Execution Features**:
- ✅ Real Chromium browser (1920×1080)
- ✅ Video recording (full execution)
- ✅ Screenshot on each step
- ✅ Live progress updates (WebSocket)
- ✅ Detailed error messages
- ✅ Step-by-step logs
- ✅ Automatic retries (configurable)

**Testing**:
```bash
# Execute test
POST http://localhost:3002/api/tests/{testId}/execute

# Check execution status
GET http://localhost:3002/api/tests/executions/{executionId}

# Watch live progress (WebSocket)
ws://localhost:3002
Event: 'execution-progress'
Data: { executionId, currentStep, status }
```

---

#### 6. **PDF Report Generation** (NEW - Phase 3)

**Technical Implementation**:

```typescript
// backend/src/reporting/reporting.service.ts
async generateExecutionReport(executionId: string): Promise<Buffer> {
  // 1. Load execution data
  const execution = await prisma.testExecution.findUnique({
    include: {
      test: { include: { project: true } }
    }
  });

  // 2. Load Handlebars template
  const template = handlebars.compile(htmlTemplate);
  const html = template(execution);

  // 3. Generate PDF with Puppeteer
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html);

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm' }
  });

  await browser.close();
  return pdf;
}
```

**PDF Contents**:
- Test name and project
- Execution metadata (date, duration, status)
- Summary statistics (total steps, passed, failed)
- Detailed step breakdown with status badges
- Error messages (if failed)
- Professional SaaS Nomation branding
- Page numbers and footer

**Testing**:
```bash
# Generate PDF
GET http://localhost:3002/reporting/execution/{executionId}/pdf
Headers: { "Authorization": "Bearer <token>" }

# Response: PDF file download
Content-Type: application/pdf
Content-Disposition: attachment; filename="test-report-{id}.pdf"
```

**Frontend Integration**:
```typescript
// frontend/src/pages/tests/TestResultsPage.tsx
const downloadPDF = async (executionId: string) => {
  const response = await reportingAPI.downloadPdf(executionId);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-report-${executionId}.pdf`;
  a.click();
};
```

---

#### 7. **Email Notifications** (NEW - Phase 3)

**Configuration**:
```env
# backend/.env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=SaaS Nomation <noreply@saasnomation.com>
FRONTEND_URL=http://localhost:3001
```

**Email Triggers**:
- ✅ Test Failure (immediate)
- ✅ Test Success (optional)
- ✅ Weekly Digest (every Monday)

**Email Template**:
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .header { background: #dc2626; color: white; padding: 20px; }
    .content { padding: 20px; }
    .button { background: #3b82f6; color: white; padding: 12px 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>❌ Test Failed: {{testName}}</h1>
  </div>
  <div class="content">
    <p><strong>Project:</strong> {{projectName}}</p>
    <p><strong>Error:</strong> {{errorMessage}}</p>
    <a href="{{frontendUrl}}/executions/{{executionId}}" class="button">
      View Full Results →
    </a>
  </div>
</body>
</html>
```

**Testing**:
```bash
# Send test failure email
# (Automatically triggered when test fails)

# Verify email configuration
POST http://localhost:3002/api/notifications/test-email-config
Response: { "configured": true, "message": "SMTP ready" }
```

**User Configuration**:
```typescript
// User notification preferences (in database)
{
  userId: "clx123...",
  emailFailures: true,        // Send on failures
  emailSuccess: false,        // Don't send on success
  emailWeeklyDigest: true,    // Send weekly summary
  notificationEmails: [
    "user@example.com",
    "manager@example.com"
  ],
  quietHoursStart: "22:00",   // No emails 10 PM - 8 AM UTC
  quietHoursEnd: "08:00"
}
```

**Frontend Settings** (`/settings/notifications`):
- Toggle email alerts on/off
- Add/remove recipient emails
- Set quiet hours (UTC timezone)
- Configure weekly digest

---

#### 8. **User Settings Pages** (NEW - Phase 3)

**Profile Settings** (`/settings/profile`):

**Features**:
- ✅ Update name
- ✅ View email (read-only)
- ✅ Choose timezone (for date display)
- ✅ Toggle theme (Light/Dark mode)
- ✅ Change password (with current password verification)

**Database Schema**:
```prisma
model User {
  id        String   @id
  name      String
  email     String   @unique
  password  String   // bcrypt hashed
  theme     String?  @default("light")    // NEW
  timezone  String?  @default("UTC")      // NEW

  notificationPreferences UserNotificationPreferences?
}
```

**Testing**:
```bash
# Update profile
PATCH http://localhost:3002/auth/profile
Body: {
  "name": "John Updated",
  "theme": "dark",
  "timezone": "America/New_York"
}

# Change password
POST http://localhost:3002/auth/change-password
Body: {
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

---

**Notification Settings** (`/settings/notifications`):

**Features**:
- ✅ Toggle failure alerts
- ✅ Toggle success notifications
- ✅ Toggle weekly digest
- ✅ Add multiple recipient emails
- ✅ Set quiet hours (start/end time in UTC)

**Database Schema**:
```prisma
model UserNotificationPreferences {
  id                  String   @id
  userId              String   @unique
  emailFailures       Boolean  @default(true)
  emailSuccess        Boolean  @default(false)
  emailWeeklyDigest   Boolean  @default(true)
  notificationEmails  String[] // Array of emails
  quietHoursStart     String?  // "22:00" UTC
  quietHoursEnd       String?  // "08:00" UTC

  user User @relation(...)
}
```

**Testing**:
```bash
# Get notification preferences
GET http://localhost:3002/auth/notifications
Response: {
  "emailFailures": true,
  "emailSuccess": false,
  "emailWeeklyDigest": true,
  "notificationEmails": ["user@example.com"],
  "quietHoursStart": null,
  "quietHoursEnd": null
}

# Update preferences
PATCH http://localhost:3002/auth/notifications
Body: {
  "emailFailures": true,
  "notificationEmails": ["user@example.com", "team@example.com"],
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00"
}
```

---

### ⏳ PLANNED FEATURES (Phase 4 - NOT Built Yet)

#### C3.1: Multi-Tenancy & Organizations
**Status**: 30% complete (database models exist, no UI/API)

**What Exists**:
- ✅ Database schema (Organization, OrganizationMember, OrganizationInvite models)
- ✅ OrganizationGuard with RBAC
- ❌ No backend API (service + controller)
- ❌ No frontend UI

**What Would Enable**:
- Multiple users collaborating on tests
- Organization switching
- Role-based permissions (Owner, Admin, Member, Viewer)
- Team member invitations

**DO NOT TEST**: This is not functional yet

---

#### C3.2: Stripe Billing
**Status**: 0% complete (Stripe package installed but no implementation)

**What Would Enable**:
- Pro plan subscription ($99/month)
- Usage limits (executions, projects, users)
- Payment method management
- Stripe webhooks

**DO NOT TEST**: This is not functional yet

---

## 🧪 COMPREHENSIVE TESTING GUIDE

### Test Scenario 1: User Registration & Login

**Steps**:
1. Open `http://localhost:3001/register`
2. Fill form:
   - Name: "Test User"
   - Email: "test123@example.com"
   - Password: "password123"
3. Click "Register"
4. Should redirect to dashboard
5. Logout
6. Login at `/login` with same credentials

**Expected Results**:
- ✅ Registration succeeds
- ✅ JWT token stored in localStorage
- ✅ Redirect to dashboard
- ✅ Can logout and login again

**API Verification**:
```bash
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test123@example.com","password":"password123"}'
```

---

### Test Scenario 2: Element Discovery & Analysis

**Steps**:
1. Login as test user
2. Create new project:
   - Name: "Demo Site Test"
   - Starting URL: "https://demo.testim.io"
3. Go to Project Settings → URLs
4. Add URL: "https://demo.testim.io"
5. Click "Analyze URL" button
6. Wait 30-60 seconds
7. Go to Test Builder
8. Open "Element Library" panel

**Expected Results**:
- ✅ URL analysis completes
- ✅ Element Library shows 30-100+ discovered elements
- ✅ Elements categorized (buttons, inputs, links, etc.)
- ✅ Each element has:
  - Selector (CSS or XPath)
  - Fallback selectors (2-4 backups)
  - Element type
  - Confidence score (0-1)
  - Quality metrics

**Verification**:
```bash
# Check discovered elements
GET http://localhost:3002/api/projects/{projectId}/elements
Headers: { "Authorization": "Bearer <token>" }

# Should return array of elements
{
  "elements": [
    {
      "selector": "#login-button",
      "fallbackSelectors": ["[data-testid='login']", "button.btn-primary"],
      "elementType": "button",
      "confidence": 0.95,
      "overallQuality": 0.90
    }
  ]
}
```

**Troubleshooting**:
- If no elements found, check backend logs: `docker-compose logs backend`
- Look for Playwright errors
- Verify URL is accessible from Docker container

---

### Test Scenario 3: Create & Run Test

**Steps**:
1. In project, click "Create Test"
2. Test name: "Login Flow Test"
3. Add steps:
   - **Step 1**: Navigate to "https://demo.testim.io"
   - **Step 2**: Click element (find "Login" button in Element Library)
   - **Step 3**: Type "user@test.com" in email field
   - **Step 4**: Type "password123" in password field
   - **Step 5**: Click "Submit" button
   - **Step 6**: Assert "Welcome" text exists
4. Click "Save Test"
5. Click "Run Test"
6. Watch live browser execution
7. Wait for completion

**Expected Results**:
- ✅ Test saves successfully
- ✅ Execution starts within 5 seconds
- ✅ Live browser view shows actual page loading
- ✅ Each step executes visibly
- ✅ Status updates in real-time (WebSocket)
- ✅ Execution completes (pass or fail)
- ✅ Results page shows:
  - Duration
  - Status (passed/failed)
  - Step breakdown
  - Video recording
  - Screenshots

---

### Test Scenario 4: PDF Report Generation

**Steps**:
1. After running a test (Scenario 3)
2. Go to Test Results page
3. Click on test execution
4. Click "Download PDF Report" button
5. PDF downloads automatically
6. Open PDF

**Expected Results**:
- ✅ PDF downloads instantly
- ✅ Filename: `test-report-{testName}-{executionId}.pdf`
- ✅ PDF contains:
  - Test name and project
  - Execution date and duration
  - Overall status badge
  - Summary stats (total steps, passed, failed)
  - Step-by-step breakdown
  - Error messages (if failed)
  - Professional branding
  - Page numbers

**Troubleshooting**:
- If PDF doesn't download, check browser console
- If PDF is blank, check backend logs for Puppeteer errors
- If PDF generation times out, increase timeout in reporting