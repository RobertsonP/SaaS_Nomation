# 🎨 SaaS Nomation - Design Specifications for Gemini AI

## 📐 Design System Reference

### **Color Palette (CSS Variables)**
```css
--bg-primary: #1A202C;      /* Main background - dark blue-black */
--bg-secondary: #2D3748;    /* Secondary background - dark blue-gray */
--bg-tertiary: #4A5568;     /* Tertiary background - lighter blue-gray */
--border-color: #4A5568;    /* Border color */
--text-primary: #E2E8F0;    /* Primary text - light gray */
--text-secondary: #A0AEC0;  /* Secondary text - medium gray */
--accent-primary: #38B2AC;  /* Teal - primary actions */
--accent-primary-hover: #4FD1C5; /* Teal hover state */
--accent-success: #48BB78;  /* Green - success states */
--accent-danger: #F56565;   /* Red - danger/error states */
--accent-warning: #ED8936;  /* Orange - warning states */
```

### **Typography**
- **Font Family**: 'Inter' (400, 500, 600, 700 weights) from Google Fonts
- **Monospace**: 'Fira Code' for code/selectors
- **Sizes**:
  - Page Title (h1): 2rem (32px), weight 700
  - Section Title (h2): 1.5rem (24px), weight 600
  - Card Title (h3): 1.25rem (20px), weight 600
  - Body: 1rem (16px), weight 400
  - Small: 0.875rem (14px), weight 400
  - Label: 0.875rem (14px), weight 500

### **Spacing**
- Small: 8px
- Medium: 16px
- Large: 24px
- XL: 32px

### **Border Radius**
- Small: 4px
- Medium: 6px
- Large: 8px

### **Component Library**

#### **Button Variants**
```css
/* Primary Button */
.btn-primary {
  background-color: var(--accent-primary);
  color: #1A202C;
  border: 1px solid var(--accent-primary);
  padding: 12px 20px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background-color: var(--accent-primary-hover);
}

/* Secondary Button */
.btn-secondary {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  /* same padding/radius as primary */
}

/* Danger Button */
.btn-danger {
  background-color: var(--accent-danger);
  color: white;
  border: 1px solid var(--accent-danger);
  /* same padding/radius as primary */
}
```

#### **Form Inputs**
```css
.form-input {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 12px;
  font-size: 1rem;
  width: 100%;
}
.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
  display: block;
}
```

#### **Status Badges**
```css
.badge-success {
  background-color: rgba(72, 187, 120, 0.1);
  color: var(--accent-success);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-danger {
  background-color: rgba(245, 101, 101, 0.1);
  color: var(--accent-danger);
  /* same structure */
}
.badge-warning {
  background-color: rgba(237, 137, 54, 0.1);
  color: var(--accent-warning);
  /* same structure */
}
```

#### **Cards**
```css
.card {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 24px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
```

#### **Global Layout**
```css
.global-layout {
  display: flex;
  min-height: 100vh;
}
.sidebar {
  width: 260px;
  background-color: var(--bg-primary);
  border-right: 1px solid var(--border-color);
}
.page-container {
  flex-grow: 1;
  background-color: var(--bg-secondary);
}
.main-content {
  padding: 24px;
}
```

---

# 🔴 CRITICAL PAGES (Priority 1)

## 1. Registration Page

### **File Name**: `registration.html`

### **Purpose**
User sign-up page for creating new SaaS Nomation accounts.

### **Layout**
- **Centered card** on full-screen background
- Same structure as `login.html` but with additional fields

### **Components**

#### **Card Structure**
```
┌─────────────────────────────┐
│  Create Your Account        │ ← h3, centered
│                             │
│  [Name input]               │ ← Full name
│  [Email input]              │
│  [Password input]           │
│  [Confirm Password input]   │
│  [Password strength bar]    │ ← Visual indicator
│  □ I agree to Terms         │ ← Checkbox with link
│                             │
│  [Create Account button]    │ ← btn-primary, full width
│                             │
│  Already have account?      │
│  [Sign in]                  │ ← Link to login
└─────────────────────────────┘
```

### **Exact HTML Structure**
```html
<div class="login-card"> <!-- Reuse class from login.html -->
    <h3>Create Your Account</h3>

    <div class="form-group">
        <label class="form-label" for="reg-name">Full Name</label>
        <input class="form-input" type="text" id="reg-name" placeholder="John Doe">
    </div>

    <div class="form-group">
        <label class="form-label" for="reg-email">Email Address</label>
        <input class="form-input" type="email" id="reg-email" placeholder="you@example.com">
    </div>

    <div class="form-group">
        <label class="form-label" for="reg-password">Password</label>
        <input class="form-input" type="password" id="reg-password" placeholder="••••••••">
    </div>

    <div class="form-group">
        <label class="form-label" for="reg-confirm">Confirm Password</label>
        <input class="form-input" type="password" id="reg-confirm" placeholder="••••••••">
    </div>

    <!-- Password Strength Indicator -->
    <div class="password-strength" style="margin-bottom: 20px;">
        <div class="strength-bar" style="height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden;">
            <div class="strength-fill" style="width: 60%; height: 100%; background: var(--accent-warning); transition: all 0.3s;"></div>
        </div>
        <div class="strength-text" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
            Password strength: Medium
        </div>
    </div>

    <!-- Terms Checkbox -->
    <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="reg-terms" style="width: auto;">
        <label for="reg-terms" style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">
            I agree to the <a href="#" style="color: var(--accent-primary); text-decoration: none;">Terms of Service</a>
        </label>
    </div>

    <button class="btn-primary">Create Account</button>

    <!-- Sign In Link -->
    <div style="text-align: center; margin-top: 16px;">
        <span style="color: var(--text-secondary); font-size: 0.875rem;">Already have an account?</span>
        <a href="login.html" style="color: var(--accent-primary); font-weight: 600; text-decoration: none; margin-left: 4px;">Sign In</a>
    </div>
</div>
```

### **States**
1. **Default**: All fields empty, Create Account button enabled
2. **Password Strength Colors**:
   - Weak (0-40%): Red (#F56565)
   - Medium (41-70%): Orange (#ED8936)
   - Strong (71-100%): Green (#48BB78)
3. **Validation Errors**: Red border on invalid inputs

### **Responsive**
- Max width: 400px (same as login.html)
- Centers vertically and horizontally on all screen sizes

---

## 2. Project Analysis Page

### **File Name**: `project_analysis.html`

### **Purpose**
Page where users input URLs to analyze and discover elements on web pages.

### **Layout**
- **Global Layout**: Sidebar + Main content (like dashboard.html)
- **Header**: Page title + breadcrumb
- **Main**: Input section + Progress section + Results section

### **Components**

#### **Page Structure**
```
┌─[Sidebar]─┬────────────────────────────────────────┐
│           │ < Projects / Project Name / Analyze    │ ← Breadcrumb
│ Dashboard │                                        │
│ Projects  │ Analyze Project URL                    │ ← h1
│           │                                        │
│           │ ┌────────────────────────────────────┐│
│           │ │ Enter URL to Analyze              ││ ← Card
│           │ │ [https://example.com          ] [▶]││ ← Input + Analyze button
│           │ │                                    ││
│           │ │ 💡 Tip: Make sure site is publicly ││
│           │ │    accessible or auth is configured││
│           │ └────────────────────────────────────┘│
│           │                                        │
│           │ ┌────────────────────────────────────┐│
│           │ │ Analysis Progress           [75%] ││ ← Card (shown when analyzing)
│           │ │ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░                ││ ← Progress bar
│           │ │ Current: Discovering elements...   ││ ← Status text
│           │ │                                    ││
│           │ │ ✓ Page loaded (2.3s)               ││ ← Step list
│           │ │ ✓ Waiting for content (1.5s)       ││
│           │ │ ⟳ Discovering elements...          ││ ← In progress
│           │ │   Analyzing selectors...           ││ ← Pending
│           │ └────────────────────────────────────┘│
│           │                                        │
│           │ ┌────────────────────────────────────┐│
│           │ │ Discovered Elements        [187]   ││ ← Results card
│           │ │                                    ││
│           │ │ Filter: [All ▼] Search: [     🔍] ││
│           │ │                                    ││
│           │ │ ┌──────────────────────────────┐  ││
│           │ │ │ 🔘 Submit Button             │  ││ ← Element card
│           │ │ │ button                       │  ││
│           │ │ │ Selector: button[type="sub...│  ││
│           │ │ │ [Add to Library]             │  ││
│           │ │ └──────────────────────────────┘  ││
│           │ │ ... (more elements)              ││
│           │ └────────────────────────────────────┘│
└───────────┴────────────────────────────────────────┘
```

### **Exact HTML Structure**

```html
<body>
  <div class="global-layout">
    <aside class="sidebar">
      <!-- Same sidebar as dashboard.html -->
    </aside>

    <div class="page-container">
      <header class="top-header">
        <div class="breadcrumb">
          <a href="projects_list.html">Projects</a> /
          <a href="project_details.html">My Test Project</a> /
          <span>Analyze</span>
        </div>
      </header>

      <main class="main-content">
        <h1>Analyze Project URL</h1>

        <!-- Input Card -->
        <div class="card" style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 16px 0;">Enter URL to Analyze</h3>
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <input class="form-input" type="url" placeholder="https://example.com" style="flex-grow: 1;">
            <button class="btn-primary" style="width: auto; padding: 12px 24px;">
              <span style="font-size: 1.25rem;">▶</span> Analyze
            </button>
          </div>
          <div class="info-box" style="background: rgba(56, 178, 172, 0.1); border-left: 3px solid var(--accent-primary); padding: 12px; border-radius: 4px;">
            <span style="font-size: 1.25rem;">💡</span>
            <span style="color: var(--text-secondary); font-size: 0.875rem;">
              Tip: Make sure the site is publicly accessible or authentication is configured
            </span>
          </div>
        </div>

        <!-- Progress Card (shown during analysis) -->
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 style="margin: 0;">Analysis Progress</h3>
            <span style="font-size: 1.5rem; font-weight: 700; color: var(--accent-primary);">75%</span>
          </div>

          <!-- Progress Bar -->
          <div class="progress-bar" style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
            <div class="progress-fill" style="width: 75%; height: 100%; background: var(--accent-primary); transition: width 0.3s ease;"></div>
          </div>

          <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 16px;">
            Current: <span style="color: var(--text-primary); font-weight: 500;">Discovering elements...</span>
          </div>

          <!-- Step List -->
          <div class="step-list">
            <div class="step-item" style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
              <span style="color: var(--accent-success); font-size: 1.25rem;">✓</span>
              <span>Page loaded</span>
              <span style="color: var(--text-secondary); font-size: 0.875rem; margin-left: auto;">(2.3s)</span>
            </div>
            <div class="step-item" style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
              <span style="color: var(--accent-success); font-size: 1.25rem;">✓</span>
              <span>Waiting for content</span>
              <span style="color: var(--text-secondary); font-size: 0.875rem; margin-left: auto;">(1.5s)</span>
            </div>
            <div class="step-item" style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
              <span style="color: var(--accent-primary); font-size: 1.25rem;">⟳</span>
              <span style="color: var(--text-primary); font-weight: 500;">Discovering elements...</span>
            </div>
            <div class="step-item" style="display: flex; align-items: center; gap: 12px; padding: 8px 0; opacity: 0.5;">
              <span style="color: var(--text-secondary); font-size: 1.25rem;">○</span>
              <span style="color: var(--text-secondary);">Analyzing selectors...</span>
            </div>
          </div>
        </div>

        <!-- Results Card (shown after analysis) -->
        <div class="card">
          <div class="card-header">
            <h3 style="margin: 0;">Discovered Elements</h3>
            <span class="badge-success" style="padding: 6px 16px; font-size: 1rem;">187</span>
          </div>

          <!-- Filters -->
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <select class="form-input" style="width: auto; min-width: 150px;">
              <option>All Elements</option>
              <option>Buttons</option>
              <option>Inputs</option>
              <option>Links</option>
            </select>
            <input class="form-input" type="search" placeholder="Search elements..." style="flex-grow: 1;">
          </div>

          <!-- Elements Grid -->
          <div class="elements-grid" style="display: grid; gap: 16px;">
            <!-- Element Card -->
            <div class="element-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div>
                  <div style="font-weight: 600; margin-bottom: 4px;">🔘 Submit Button</div>
                  <span class="badge-success" style="font-size: 0.75rem;">button</span>
                </div>
                <button class="btn-primary" style="padding: 6px 12px; font-size: 0.875rem;">Add to Library</button>
              </div>
              <div style="font-family: 'Fira Code', monospace; font-size: 0.75rem; color: var(--text-secondary); background: var(--bg-primary); padding: 8px; border-radius: 4px; overflow-x: auto;">
                button[type="submit"]:visible
              </div>
            </div>

            <!-- More element cards... -->
          </div>
        </div>

      </main>
    </div>
  </div>
</body>
```

### **States**
1. **Initial**: Only input card visible
2. **Analyzing**: Progress card visible with animated progress bar
3. **Complete**: Results card visible with all discovered elements
4. **Error**: Error message in red banner above input

### **Interactions**
- **Analyze button**: Triggers analysis, shows progress card
- **Add to Library**: Adds element to project element library
- **Filter dropdown**: Filters elements by type
- **Search**: Real-time search through element names/selectors

---

## 3. Test Suites List Page

### **File Name**: `test_suites_list.html`

### **Purpose**
Display all test suites for a project, showing suite status and metrics.

### **Layout**
- **Global Layout**: Sidebar + Main content
- **Header**: Page title + "Create Suite" button
- **Main**: Suite cards in grid layout

### **Components**

#### **Page Structure**
```
┌─[Sidebar]─┬────────────────────────────────────────┐
│           │ < Projects / Project Name / Suites     │
│           │                                        │
│ Dashboard │ Test Suites            [+ New Suite]   │ ← h1 + button
│ Projects  │                                        │
│           │ ┌───────────┐ ┌───────────┐           │
│           │ │ Smoke Test│ │ Regression│           │ ← Suite cards
│           │ │ 12 tests  │ │ 45 tests  │           │
│           │ │ 98% ✓     │ │ 87% ✓     │           │
│           │ │ [Run] [⋮] │ │ [Run] [⋮] │           │
│           │ └───────────┘ └───────────┘           │
│           │                                        │
│           │ ┌───────────┐ [+ Create Suite]         │
│           │ │ E2E Tests │                          │
│           │ │ 23 tests  │                          │
│           │ │ 91% ✓     │                          │
│           │ │ [Run] [⋮] │                          │
│           │ └───────────┘                          │
└───────────┴────────────────────────────────────────┘
```

### **Exact HTML Structure**

```html
<main class="main-content">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
    <h1 style="margin: 0;">Test Suites</h1>
    <button class="btn-primary">
      <span style="font-size: 1.25rem; margin-right: 4px;">+</span> New Suite
    </button>
  </div>

  <!-- Empty State (show when no suites) -->
  <div class="empty-state" style="text-align: center; padding: 64px 24px; background: var(--bg-primary); border: 1px dashed var(--border-color); border-radius: 8px;">
    <div style="font-size: 4rem; margin-bottom: 16px; opacity: 0.5;">📦</div>
    <h3 style="color: var(--text-secondary); margin-bottom: 8px;">No test suites yet</h3>
    <p style="color: var(--text-secondary); margin-bottom: 24px;">Create your first test suite to organize and run multiple tests together</p>
    <button class="btn-primary">
      <span style="font-size: 1.25rem; margin-right: 4px;">+</span> Create First Suite
    </button>
  </div>

  <!-- Suites Grid (show when suites exist) -->
  <div class="suites-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;">

    <!-- Suite Card -->
    <div class="suite-card card" style="cursor: pointer; transition: transform 0.2s, border-color 0.2s;">
      <div class="card-header" style="margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 1.25rem;">Smoke Tests</h3>
        <button class="btn-menu" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; padding: 0; width: 32px; height: 32px;">⋮</button>
      </div>

      <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 16px; min-height: 40px;">
        Quick sanity checks for critical functionality
      </p>

      <div class="suite-stats" style="display: flex; gap: 24px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">Tests</div>
          <div style="font-size: 1.5rem; font-weight: 700;">12</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">Success Rate</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-success);">98%</div>
        </div>
      </div>

      <div style="display: flex; gap: 12px;">
        <button class="btn-primary" style="flex-grow: 1;">
          <span style="font-size: 1.25rem;">▶</span> Run
        </button>
        <button class="btn-secondary" style="width: auto; padding: 12px 20px;">
          Details
        </button>
      </div>

      <div style="margin-top: 12px; font-size: 0.75rem; color: var(--text-secondary);">
        Last run: 2 hours ago
      </div>
    </div>

    <!-- More suite cards... -->

    <!-- Create Suite Card -->
    <div class="create-suite-card" style="background: var(--bg-primary); border: 2px dashed var(--border-color); border-radius: 8px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 280px; cursor: pointer; transition: border-color 0.2s;">
      <div style="font-size: 3rem; color: var(--accent-primary); margin-bottom: 12px;">+</div>
      <div style="font-weight: 600; color: var(--accent-primary);">Create New Suite</div>
    </div>

  </div>
</main>
```

### **Interactions**
- **Suite card click**: Navigate to suite details
- **Run button**: Start suite execution
- **Menu button (⋮)**: Show dropdown (Edit, Duplicate, Delete)
- **Create Suite card**: Open create suite modal

---

*[CONTINUED - This is page 1 of 7. Document includes 22 total pages with this level of detail for each.]*

---

## 📄 **DOCUMENT STRUCTURE**

This specification covers **22 screens** total:

### **🔴 Critical (8 pages)**
1. ✅ Registration Page (above)
2. ✅ Project Analysis Page (above)
3. ✅ Test Suites List (above)
4. Suite Details Page
5. Suite Results Page
6. Individual Tests List
7. Authentication Setup Page
8. Project Settings (Complete)

### **🟡 Important (4 pages)**
9. Password Reset Request
10. Password Reset Form
11. User Profile/Settings
12. Element Library View (Complete)

### **🟢 Nice-to-Have (5 pages)**
13. Onboarding Wizard
14. 404 Error Page
15. 500 Error Page
16. Network Error Page
17. Test History Page

### **🔵 Modals/Windows (5 components)**
18. Delete Confirmation Modal
19. Create Project Modal
20. Add Element to Test Modal
21. Run Test/Suite Progress Modal
22. Element Picker Overlay

---

## 💬 **INSTRUCTIONS FOR USING THIS DOCUMENT**

**For Gemini AI:**
1. Read the Design System Reference section first
2. Use exact CSS variables and component structures
3. Maintain visual consistency across all designs
4. Each page specification includes:
   - Purpose & context
   - Exact layout structure (ASCII diagram)
   - Complete HTML/CSS implementation
   - All states (loading, empty, error, success)
   - Interaction behaviors

**Implementation Notes:**
- All designs use the same global layout (sidebar + main content)
- Reuse component classes across pages for consistency
- Dark theme throughout - never use light backgrounds
- All interactive elements have hover states with 0.2s transitions
- Form inputs always have validation states (border color changes)

---

**This is a working document. Each remaining page (4-22) follows the same detailed structure as the examples above.**

**Next Steps:**
1. Share sections 4-8 (Critical pages) with Gemini first
2. Review and iterate on designs
3. Then proceed to Important pages (9-12)
4. Finally Nice-to-Have and Modals (13-22)

Would you like me to continue with the remaining 19 page specifications in the same detail?
