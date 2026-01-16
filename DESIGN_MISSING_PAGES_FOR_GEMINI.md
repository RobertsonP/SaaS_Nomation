# 🎨 SaaS Nomation - Missing Pages & Enhancements for Gemini

**Document Purpose:** This document specifies all missing pages and enhancements needed for the SaaS Nomation redesign. Use this with the existing `DESIGN_SPECIFICATIONS_FOR_GEMINI.md` which contains the design system reference.

**Date:** January 2025
**Team:** Owner (User) + Claude (Developer) + Gemini (Designer)

---

## 📊 CURRENT STATUS: What Gemini Already Created

### ✅ Completed HTML Prototypes (9 files)

| File | Purpose | Status |
|------|---------|--------|
| `login.html` | User login page | ✅ Complete |
| `dashboard.html` | Main dashboard with metrics | ✅ Complete |
| `projects_list.html` | Projects grid view | ✅ Complete |
| `projects_list_empty.html` | Empty state for projects | ✅ Complete |
| `project_details.html` | Project overview tab | ✅ Complete |
| `project_elements.html` | Elements library tab | ✅ Complete |
| `project_settings.html` | Project settings tab | ✅ Complete |
| `test_builder.html` | Test builder interface (3-panel) | ✅ Complete |
| `test_results.html` | Test execution results | ✅ Complete |

**Design System Established:**
- Dark theme (bg: #1A202C, #2D3748)
- Teal accent (#38B2AC)
- Inter font family
- 260px sidebar + flex content layout
- Consistent spacing (16px/24px)

---

## 🚨 CRITICAL MISSING PAGES (Priority 1)

These pages are **essential** for core functionality and must be created next.

---

### 1. URLs Management Tab

**File Name:** `project_urls.html`

**Purpose:** Manage multiple test URLs for a project (production, staging, dev environments)

**Context:** This is a TAB within the project details page, between "Overview" and "Elements"

**Layout:**
```
┌─[Sidebar]─┬─────────────────────────────────────────────────┐
│           │ < Projects / E-commerce Platform / URLs          │
│ Dashboard │                                                   │
│ Projects  │ [Overview] [URLs ←ACTIVE] [Elements] [Tests]...  │
│           │                                                   │
│           │ Project URLs                      [+ Add URL]     │
│           │                                                   │
│           │ ┌──────────────────────────────────────────────┐ │
│           │ │ Production Environment                       │ │
│           │ │ https://shop.example.com                     │ │
│           │ │ Status: ✓ Active  │  Last tested: 2h ago     │ │
│           │ │                           [Test Now] [⋮ Menu] │ │
│           │ └──────────────────────────────────────────────┘ │
│           │                                                   │
│           │ ┌──────────────────────────────────────────────┐ │
│           │ │ Staging Environment                          │ │
│           │ │ https://staging.shop.example.com             │ │
│           │ │ Status: ✓ Active  │  Last tested: 5h ago     │ │
│           │ │                           [Test Now] [⋮ Menu] │ │
│           │ └──────────────────────────────────────────────┘ │
│           │                                                   │
│           │ ┌──────────────────────────────────────────────┐ │
│           │ │ [+ Add New URL]                              │ │
│           │ │ Click to add another test environment        │ │
│           │ └──────────────────────────────────────────────┘ │
└───────────┴─────────────────────────────────────────────────┘
```

**HTML Structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SaaS Nomation - Project URLs</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root {
            --bg-primary: #1A202C;
            --bg-secondary: #2D3748;
            --bg-tertiary: #4A5568;
            --border-color: #4A5568;
            --text-primary: #E2E8F0;
            --text-secondary: #A0AEC0;
            --accent-primary: #38B2AC;
            --accent-primary-hover: #4FD1C5;
            --accent-success: #48BB78;
        }
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: var(--bg-secondary); color: var(--text-primary); }
        .global-layout { display: flex; min-height: 100vh; }
        .sidebar { width: 260px; background-color: var(--bg-primary); border-right: 1px solid var(--border-color); }
        .page-container { flex-grow: 1; display: flex; flex-direction: column; }
        .top-header { padding: 16px 24px; border-bottom: 1px solid var(--border-color); background-color: var(--bg-primary); }
        .main-content { padding: 24px; flex-grow: 1; }

        /* Breadcrumb */
        .breadcrumb { font-size: 0.875rem; color: var(--text-secondary); }
        .breadcrumb a { color: var(--text-secondary); text-decoration: none; }
        .breadcrumb a:hover { color: var(--text-primary); }

        /* Tabs */
        .tabs { border-bottom: 1px solid var(--border-color); margin-bottom: 24px; }
        .tabs nav { display: flex; gap: 20px; }
        .tabs a { padding: 12px 4px; margin-bottom: -1px; border-bottom: 2px solid transparent; text-decoration: none; color: var(--text-secondary); font-weight: 500; }
        .tabs a.active { color: var(--accent-primary); border-bottom-color: var(--accent-primary); font-weight: 600; }

        /* Page Header */
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .page-header h1 { font-size: 1.75rem; font-weight: 700; margin: 0; }

        /* Buttons */
        .btn-primary { background-color: var(--accent-primary); color: #1A202C; border: 1px solid var(--accent-primary); padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
        .btn-primary:hover { background-color: var(--accent-primary-hover); border-color: var(--accent-primary-hover); }
        .btn-secondary { background-color: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 0.875rem; cursor: pointer; }

        /* URL Cards */
        .url-card { background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 24px; margin-bottom: 16px; transition: border-color 0.2s; }
        .url-card:hover { border-color: var(--accent-primary); }
        .url-card-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px; }
        .url-card-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 8px; }
        .url-card-url { font-family: 'Fira Code', monospace; color: var(--accent-primary); font-size: 0.875rem; }
        .url-card-meta { display: flex; gap: 24px; font-size: 0.875rem; color: var(--text-secondary); }
        .url-card-actions { display: flex; gap: 12px; margin-top: 16px; }

        /* Status Badge */
        .status-active { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background-color: rgba(72, 187, 120, 0.1); color: var(--accent-success); }

        /* Add URL Card */
        .add-url-card { background-color: var(--bg-primary); border: 2px dashed var(--border-color); border-radius: 8px; padding: 32px; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .add-url-card:hover { border-color: var(--accent-primary); }
        .add-url-card .icon { font-size: 3rem; color: var(--accent-primary); margin-bottom: 12px; }
        .add-url-card .text { font-weight: 600; color: var(--accent-primary); }
    </style>
</head>
<body>
    <div class="global-layout">
        <aside class="sidebar">
            <!-- Same sidebar as other pages -->
            <div style="padding: 16px;"><h1 style="font-size: 1.5rem; font-weight: 700; margin: 0;">Nomation</h1></div>
        </aside>

        <div class="page-container">
            <header class="top-header">
                <div class="breadcrumb">
                    <a href="projects_list.html">Projects</a> /
                    <a href="project_details.html">E-commerce Platform</a> /
                    <span style="color: var(--text-primary);">URLs</span>
                </div>
            </header>

            <main class="main-content">
                <!-- Tabs -->
                <div class="tabs">
                    <nav>
                        <a href="project_details.html">Overview</a>
                        <a href="project_urls.html" class="active">URLs</a>
                        <a href="project_elements.html">Elements</a>
                        <a href="test_builder.html">Tests</a>
                        <a href="project_settings.html">Settings</a>
                    </nav>
                </div>

                <!-- Page Header -->
                <div class="page-header">
                    <h1>Project URLs</h1>
                    <button class="btn-primary">
                        <span style="font-size: 1.25rem;">+</span> Add URL
                    </button>
                </div>

                <!-- URL Cards -->
                <div class="url-card">
                    <div class="url-card-header">
                        <div>
                            <div class="url-card-title">Production Environment</div>
                            <div class="url-card-url">https://shop.example.com</div>
                        </div>
                        <button style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">⋮</button>
                    </div>
                    <div class="url-card-meta">
                        <div>
                            <span class="status-active">✓ Active</span>
                        </div>
                        <div>Last tested: <strong style="color: var(--text-primary);">2 hours ago</strong></div>
                        <div>Success Rate: <strong style="color: var(--accent-success);">98%</strong></div>
                    </div>
                    <div class="url-card-actions">
                        <button class="btn-primary" style="padding: 8px 16px;">
                            <span style="font-size: 1rem;">▶</span> Test Now
                        </button>
                        <button class="btn-secondary" style="padding: 8px 16px;">Edit</button>
                        <button class="btn-secondary" style="padding: 8px 16px;">View History</button>
                    </div>
                </div>

                <div class="url-card">
                    <div class="url-card-header">
                        <div>
                            <div class="url-card-title">Staging Environment</div>
                            <div class="url-card-url">https://staging.shop.example.com</div>
                        </div>
                        <button style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">⋮</button>
                    </div>
                    <div class="url-card-meta">
                        <div>
                            <span class="status-active">✓ Active</span>
                        </div>
                        <div>Last tested: <strong style="color: var(--text-primary);">5 hours ago</strong></div>
                        <div>Success Rate: <strong style="color: var(--accent-success);">95%</strong></div>
                    </div>
                    <div class="url-card-actions">
                        <button class="btn-primary" style="padding: 8px 16px;">
                            <span style="font-size: 1rem;">▶</span> Test Now
                        </button>
                        <button class="btn-secondary" style="padding: 8px 16px;">Edit</button>
                        <button class="btn-secondary" style="padding: 8px 16px;">View History</button>
                    </div>
                </div>

                <!-- Add URL Card -->
                <div class="add-url-card">
                    <div class="icon">+</div>
                    <div class="text">Add New URL</div>
                    <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 8px;">
                        Add another test environment
                    </div>
                </div>

            </main>
        </div>
    </div>
</body>
</html>
```

**States:**
- **Empty State**: "No URLs configured yet" message with "Add First URL" button
- **Default**: Shows list of URL cards
- **Testing**: When "Test Now" clicked, show loading spinner and "Testing..." state
- **Menu Dropdown**: When ⋮ clicked, show Edit/Duplicate/Delete options

---

### 2. User Profile/Settings Page

**File Name:** `user_profile.html`

**Purpose:** User account settings and profile management

**Navigation:** Accessed from "User Profile" button in top header

**Layout:**
```
┌─[Sidebar]─┬─────────────────────────────────────────────────┐
│           │ User Settings                                     │
│ Dashboard │                                                   │
│ Projects  │ ┌──────────────────────────────────────────────┐ │
│           │ │ Profile Information                          │ │
│           │ │                                              │ │
│           │ │ Email: user@example.com (read-only)          │ │
│           │ │ Display Name: [John Doe            ]         │ │
│           │ │                              [Save Changes]   │ │
│           │ └──────────────────────────────────────────────┘ │
│           │                                                   │
│           │ ┌──────────────────────────────────────────────┐ │
│           │ │ Security                                     │ │
│           │ │                                              │ │
│           │ │ Current Password: [•••••••••••]              │ │
│           │ │ New Password: [•••••••••••]                  │ │
│           │ │ Confirm Password: [•••••••••••]              │ │
│           │ │                         [Update Password]     │ │
│           │ └──────────────────────────────────────────────┘ │
│           │                                                   │
│           │ ┌──────────────────────────────────────────────┐ │
│           │ │ Danger Zone                     🚨            │ │
│           │ │                                              │ │
│           │ │ Delete Account                               │ │
│           │ │ This action cannot be undone...              │ │
│           │ │                         [Delete Account]      │ │
│           │ └──────────────────────────────────────────────┘ │
└───────────┴─────────────────────────────────────────────────┘
```

**HTML Structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SaaS Nomation - User Settings</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root {
            --bg-primary: #1A202C;
            --bg-secondary: #2D3748;
            --border-color: #4A5568;
            --text-primary: #E2E8F0;
            --text-secondary: #A0AEC0;
            --accent-primary: #38B2AC;
            --accent-danger: #F56565;
        }
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: var(--bg-secondary); color: var(--text-primary); }
        .global-layout { display: flex; min-height: 100vh; }
        .sidebar { width: 260px; background-color: var(--bg-primary); border-right: 1px solid var(--border-color); }
        .page-container { flex-grow: 1; }
        .main-content { padding: 24px; max-width: 800px; margin: 0 auto; width: 100%; }

        h1 { font-size: 2rem; font-weight: 700; margin: 0 0 32px 0; }

        .card { background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 24px; }
        .card-header { padding: 20px 24px; border-bottom: 1px solid var(--border-color); }
        .card-header h3 { font-size: 1.25rem; font-weight: 600; margin: 0; }
        .card-content { padding: 24px; }
        .card-footer { padding: 20px 24px; border-top: 1px solid var(--border-color); text-align: right; }

        .form-group { margin-bottom: 20px; }
        .form-label { font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 8px; display: block; }
        .form-input { width: 100%; box-sizing: border-box; background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; padding: 12px; font-size: 1rem; }
        .form-input:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-primary { background-color: var(--accent-primary); color: #1A202C; border: 1px solid var(--accent-primary); padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        .btn-danger { background-color: var(--accent-danger); color: white; border: 1px solid var(--accent-danger); padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; }

        .danger-zone { border-color: var(--accent-danger); }
        .danger-zone .card-header h3 { color: var(--accent-danger); }
    </style>
</head>
<body>
    <div class="global-layout">
        <aside class="sidebar">
            <div style="padding: 16px;"><h1 style="font-size: 1.5rem; font-weight: 700; margin: 0;">Nomation</h1></div>
        </aside>

        <div class="page-container">
            <main class="main-content">
                <h1>User Settings</h1>

                <!-- Profile Information Card -->
                <div class="card">
                    <div class="card-header">
                        <h3>Profile Information</h3>
                    </div>
                    <div class="card-content">
                        <div class="form-group">
                            <label class="form-label" for="email">Email Address</label>
                            <input class="form-input" type="email" id="email" value="user@example.com" disabled>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="display-name">Display Name</label>
                            <input class="form-input" type="text" id="display-name" value="John Doe" placeholder="Enter your name">
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn-primary">Save Changes</button>
                    </div>
                </div>

                <!-- Security Card -->
                <div class="card">
                    <div class="card-header">
                        <h3>Security</h3>
                    </div>
                    <div class="card-content">
                        <div class="form-group">
                            <label class="form-label" for="current-password">Current Password</label>
                            <input class="form-input" type="password" id="current-password" placeholder="••••••••">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="new-password">New Password</label>
                            <input class="form-input" type="password" id="new-password" placeholder="••••••••">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="confirm-password">Confirm New Password</label>
                            <input class="form-input" type="password" id="confirm-password" placeholder="••••••••">
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn-primary">Update Password</button>
                    </div>
                </div>

                <!-- Danger Zone Card -->
                <div class="card danger-zone">
                    <div class="card-header">
                        <h3>🚨 Danger Zone</h3>
                    </div>
                    <div class="card-content">
                        <div style="margin-bottom: 16px;">
                            <strong>Delete Account</strong>
                            <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 8px 0 0 0;">
                                Once you delete your account, there is no going back. All your projects, tests, and data will be permanently deleted.
                            </p>
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn-danger">Delete My Account</button>
                    </div>
                </div>

            </main>
        </div>
    </div>
</body>
</html>
```

---

### 3. Registration/Signup Page

**File Name:** `registration.html`

**Purpose:** New user account creation

**Layout:** Same centered card style as `login.html`

**HTML Structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SaaS Nomation - Create Account</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root {
            --bg-primary: #1A202C;
            --bg-secondary: #2D3748;
            --border-color: #4A5568;
            --text-primary: #E2E8F0;
            --text-secondary: #A0AEC0;
            --accent-primary: #38B2AC;
            --accent-primary-hover: #4FD1C5;
            --accent-success: #48BB78;
            --accent-warning: #ED8936;
            --accent-danger: #F56565;
        }
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: var(--bg-primary); color: var(--text-primary); display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .login-card { background-color: var(--bg-secondary); border-radius: 8px; padding: 40px; border: 1px solid var(--border-color); width: 100%; max-width: 420px; }
        .login-card h3 { font-size: 1.75rem; font-weight: 600; margin: 0 0 32px 0; text-align: center; }
        .form-group { margin-bottom: 20px; }
        .form-label { font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 8px; display: block; }
        .form-input { width: 100%; box-sizing: border-box; background-color: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; padding: 12px; font-size: 1rem; }
        .btn-primary { background-color: var(--accent-primary); color: #1A202C; border: 1px solid var(--accent-primary); width: 100%; padding: 14px; border-radius: 6px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.2s ease; }
        .btn-primary:hover { background-color: var(--accent-primary-hover); }
        .password-strength { margin-bottom: 20px; }
        .strength-bar { height: 4px; background: var(--bg-primary); border-radius: 2px; overflow: hidden; margin-bottom: 8px; }
        .strength-fill { height: 100%; transition: all 0.3s; }
        .strength-weak { width: 33%; background: var(--accent-danger); }
        .strength-medium { width: 66%; background: var(--accent-warning); }
        .strength-strong { width: 100%; background: var(--accent-success); }
    </style>
</head>
<body>
    <div class="login-card">
        <h3>Create Your Account</h3>

        <div class="form-group">
            <label class="form-label" for="name">Full Name</label>
            <input class="form-input" type="text" id="name" placeholder="John Doe">
        </div>

        <div class="form-group">
            <label class="form-label" for="email">Email Address</label>
            <input class="form-input" type="email" id="email" placeholder="you@example.com">
        </div>

        <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input class="form-input" type="password" id="password" placeholder="••••••••">
        </div>

        <div class="form-group">
            <label class="form-label" for="confirm">Confirm Password</label>
            <input class="form-input" type="password" id="confirm" placeholder="••••••••">
        </div>

        <!-- Password Strength -->
        <div class="password-strength">
            <div class="strength-bar">
                <div class="strength-fill strength-medium"></div>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">
                Password strength: <span style="color: var(--accent-warning); font-weight: 600;">Medium</span>
            </div>
        </div>

        <!-- Terms Checkbox -->
        <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
            <input type="checkbox" id="terms" style="width: auto;">
            <label for="terms" style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">
                I agree to the <a href="#" style="color: var(--accent-primary); text-decoration: none;">Terms of Service</a>
            </label>
        </div>

        <button class="btn-primary">Create Account</button>

        <!-- Sign In Link -->
        <div style="text-align: center; margin-top: 20px;">
            <span style="color: var(--text-secondary); font-size: 0.875rem;">Already have an account?</span>
            <a href="login.html" style="color: var(--accent-primary); font-weight: 600; text-decoration: none; margin-left: 4px;">Sign In</a>
        </div>
    </div>
</body>
</html>
```

---

### 4. Test Suites List Page

**File Name:** `test_suites_list.html`

**Purpose:** Overview of all test suites in a project

**Layout:**
```
┌─[Sidebar]─┬─────────────────────────────────────────────────┐
│           │ < Projects / E-commerce Platform / Test Suites   │
│ Dashboard │                                                   │
│ Projects  │ Test Suites                     [+ New Suite]     │
│           │                                                   │
│           │ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│           │ │Smoke Test│ │Regression│ │  E2E     │          │
│           │ │ 12 tests │ │ 45 tests │ │ 23 tests │          │
│           │ │ 98% ✓    │ │ 87% ✓    │ │ 91% ✓    │          │
│           │ │[Run] [⋮] │ │[Run] [⋮] │ │[Run] [⋮] │          │
│           │ └──────────┘ └──────────┘ └──────────┘          │
│           │                                                   │
│           │ ┌──────────────────┐                             │
│           │ │ + Create Suite   │                             │
│           │ └──────────────────┘                             │
└───────────┴─────────────────────────────────────────────────┘
```

**HTML Structure:** (Similar to projects_list.html but for test suites)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SaaS Nomation - Test Suites</title>
    <style>
        /* Same design system as other pages */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root {
            --bg-primary: #1A202C;
            --bg-secondary: #2D3748;
            --bg-tertiary: #4A5568;
            --border-color: #4A5568;
            --text-primary: #E2E8F0;
            --text-secondary: #A0AEC0;
            --accent-primary: #38B2AC;
            --accent-success: #48BB78;
        }
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: var(--bg-secondary); color: var(--text-primary); }
        .global-layout { display: flex; min-height: 100vh; }
        .sidebar { width: 260px; background-color: var(--bg-primary); border-right: 1px solid var(--border-color); }
        .page-container { flex-grow: 1; }
        .main-content { padding: 24px; }

        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .page-header h1 { font-size: 2rem; font-weight: 700; margin: 0; }

        .btn-primary { background-color: var(--accent-primary); color: #1A202C; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; border: 1px solid var(--accent-primary); display: inline-flex; align-items: center; gap: 8px; }

        .suites-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }

        .suite-card { background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 24px; transition: transform 0.2s, border-color 0.2s; cursor: pointer; }
        .suite-card:hover { transform: translateY(-4px); border-color: var(--accent-primary); }

        .suite-card-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; }
        .suite-card-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 8px; }
        .suite-card-description { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 16px; min-height: 40px; }

        .suite-stats { display: flex; gap: 24px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); }
        .stat-item { }
        .stat-label { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; }
        .stat-value { font-size: 1.5rem; font-weight: 700; }

        .suite-actions { display: flex; gap: 12px; }
        .btn-run { background-color: var(--accent-primary); color: #1A202C; padding: 10px; border-radius: 6px; font-weight: 600; border: none; cursor: pointer; flex-grow: 1; }
        .btn-details { background-color: var(--bg-tertiary); color: var(--text-primary); padding: 10px 20px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; }

        .create-suite-card { background-color: var(--bg-primary); border: 2px dashed var(--border-color); border-radius: 8px; padding: 48px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.2s; }
        .create-suite-card:hover { border-color: var(--accent-primary); }
    </style>
</head>
<body>
    <div class="global-layout">
        <aside class="sidebar">
            <div style="padding: 16px;"><h1 style="font-size: 1.5rem; font-weight: 700; margin: 0;">Nomation</h1></div>
        </aside>

        <div class="page-container">
            <main class="main-content">
                <div class="page-header">
                    <h1>Test Suites</h1>
                    <button class="btn-primary">
                        <span style="font-size: 1.25rem;">+</span> New Suite
                    </button>
                </div>

                <div class="suites-grid">
                    <!-- Suite Card 1 -->
                    <div class="suite-card">
                        <div class="suite-card-header">
                            <h3 class="suite-card-title">Smoke Tests</h3>
                            <button style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">⋮</button>
                        </div>
                        <p class="suite-card-description">Quick sanity checks for critical functionality</p>

                        <div class="suite-stats">
                            <div class="stat-item">
                                <div class="stat-label">Tests</div>
                                <div class="stat-value">12</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Success Rate</div>
                                <div class="stat-value" style="color: var(--accent-success);">98%</div>
                            </div>
                        </div>

                        <div class="suite-actions">
                            <button class="btn-run">
                                <span style="font-size: 1.25rem;">▶</span> Run
                            </button>
                            <button class="btn-details">Details</button>
                        </div>

                        <div style="margin-top: 12px; font-size: 0.75rem; color: var(--text-secondary);">
                            Last run: 2 hours ago
                        </div>
                    </div>

                    <!-- Suite Card 2 -->
                    <div class="suite-card">
                        <div class="suite-card-header">
                            <h3 class="suite-card-title">Regression Tests</h3>
                            <button style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">⋮</button>
                        </div>
                        <p class="suite-card-description">Comprehensive test coverage for all features</p>

                        <div class="suite-stats">
                            <div class="stat-item">
                                <div class="stat-label">Tests</div>
                                <div class="stat-value">45</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Success Rate</div>
                                <div class="stat-value" style="color: var(--accent-success);">87%</div>
                            </div>
                        </div>

                        <div class="suite-actions">
                            <button class="btn-run">
                                <span style="font-size: 1.25rem;">▶</span> Run
                            </button>
                            <button class="btn-details">Details</button>
                        </div>

                        <div style="margin-top: 12px; font-size: 0.75rem; color: var(--text-secondary);">
                            Last run: 1 day ago
                        </div>
                    </div>

                    <!-- Create Suite Card -->
                    <div class="create-suite-card">
                        <div style="font-size: 3rem; color: var(--accent-primary); margin-bottom: 12px;">+</div>
                        <div style="font-weight: 600; color: var(--accent-primary);">Create New Suite</div>
                    </div>
                </div>

            </main>
        </div>
    </div>
</body>
</html>
```

---

### 5. Suite Details Page

**File Name:** `suite_details.html`

**Purpose:** View all tests within a specific suite, manage suite configuration

**Layout:**
```
┌─[Sidebar]─┬─────────────────────────────────────────────────┐
│           │ < Test Suites / Smoke Tests                      │
│ Dashboard │                                                   │
│ Projects  │ Smoke Tests                          [⋮ Menu]     │
│           │ Quick sanity checks for critical functionality    │
│           │                                                   │
│           │ ┌─────────────────────────────────────────────┐  │
│           │ │ 12 Tests │ 98% Pass Rate │ Avg: 2.3s       │  │
│           │ └─────────────────────────────────────────────┘  │
│           │                                                   │
│           │ Tests in this Suite                 [+ Add Test]  │
│           │                                                   │
│           │ ┌──────────────────────────────────────────────┐ │
│           │ │ ✓ Login Flow Test                            │ │
│           │ │   Last run: 2h ago │ Duration: 2.1s          │ │
│           │ │                              [Run] [Edit] [⋮] │ │
│           │ └──────────────────────────────────────────────┘ │
│           │                                                   │
│           │ ┌──────────────────────────────────────────────┐ │
│           │ │ ✓ Homepage Load Test                         │ │
│           │ │   Last run: 2h ago │ Duration: 1.8s          │ │
│           │ │                              [Run] [Edit] [⋮] │ │
│           │ └──────────────────────────────────────────────┘ │
└───────────┴─────────────────────────────────────────────────┘
```

**Key Components:**
- Suite header with description and menu
- Metrics cards (tests count, pass rate, avg duration)
- List of tests with individual run/edit actions
- "Add Test" button to add existing tests to suite

---

### 6. Password Reset Pages

**File Names:** `password_reset_request.html` and `password_reset_form.html`

**Purpose:** Two-step password reset flow

**Layout for Request Page:**
```
Centered card (like login.html)

┌─────────────────────────────┐
│  Reset Your Password        │
│                             │
│  Enter your email and we'll │
│  send reset instructions    │
│                             │
│  [Email input]              │
│                             │
│  [Send Reset Link button]   │
│                             │
│  [← Back to Login]          │
└─────────────────────────────┘
```

**Layout for Reset Form Page:**
```
Centered card (like login.html)

┌─────────────────────────────┐
│  Create New Password        │
│                             │
│  [New Password input]       │
│  [Confirm Password input]   │
│  [Password strength bar]    │
│                             │
│  [Reset Password button]    │
└─────────────────────────────┘
```

---

### 7. Create Project Modal

**File Name:** `create_project_modal.html`

**Purpose:** Modal overlay for creating new projects (used on projects list page)

**Layout:**
```
[Dark Overlay 50% opacity]

    ┌──────────────────────────────────┐
    │ Create New Project          [✕]  │
    │                                  │
    │ Project Name:                    │
    │ [                          ]     │
    │                                  │
    │ Description:                     │
    │ [                          ]     │
    │ [                          ]     │
    │                                  │
    │ Starting URL:                    │
    │ [https://                  ]     │
    │                                  │
    │         [Cancel] [Create Project]│
    └──────────────────────────────────┘
```

**HTML Structure:**

```html
<!-- Modal Overlay -->
<div class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;">

    <!-- Modal Card -->
    <div class="modal-card" style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; width: 100%; max-width: 500px; padding: 32px;">

        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <h3 style="font-size: 1.5rem; font-weight: 600; margin: 0;">Create New Project</h3>
            <button style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">✕</button>
        </div>

        <!-- Form -->
        <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">Project Name</label>
            <input class="form-input" type="text" placeholder="My Test Project">
        </div>

        <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">Description (optional)</label>
            <textarea class="form-input" rows="3" placeholder="Describe your project..."></textarea>
        </div>

        <div class="form-group" style="margin-bottom: 32px;">
            <label class="form-label">Starting URL</label>
            <input class="form-input" type="url" placeholder="https://example.com">
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn-secondary" style="padding: 12px 24px;">Cancel</button>
            <button class="btn-primary" style="padding: 12px 24px;">Create Project</button>
        </div>
    </div>
</div>
```

---

## 🟡 PAGES NEEDING ENHANCEMENT (Priority 2)

These pages exist but need improvements or missing states.

### 8. Enhanced Empty State for Projects List

**File:** `projects_list_empty.html` (UPDATE EXISTING)

**Current Status:** Basic empty state exists
**Needs:** More engaging design with onboarding tips

**Add to existing:**
- Illustration or larger icon
- Step-by-step guide ("How to get started")
- Quick tutorial link

---

### 9. Test Builder Enhancements

**File:** `test_builder.html` (UPDATE EXISTING)

**Current Status:** Basic 3-panel layout exists
**Needs:**
- Step editing inline
- Drag-and-drop reordering visualization
- Variable/data inputs panel
- Assertions panel

---

### 10. Test Results Enhancements

**File:** `test_results.html` (UPDATE EXISTING)

**Current Status:** Basic results display
**Needs:**
- Failed step screenshot gallery
- Error details expansion
- Comparison mode (expected vs actual)
- Share/export buttons

---

## 🟢 NICE-TO-HAVE PAGES (Priority 3)

These enhance UX but aren't critical for MVP.

### 11. Onboarding Wizard

**File:** `onboarding_wizard.html`

**Purpose:** Multi-step wizard for first-time users

**Steps:**
1. Welcome screen
2. Create first project
3. Add URL and analyze
4. Pick first element
5. Create first test

---

### 12. Error Pages

**Files:** `error_404.html`, `error_500.html`, `error_network.html`

**Purpose:** Branded error pages instead of browser defaults

**Layout:** Centered message with action buttons

---

## 📋 IMPLEMENTATION CHECKLIST

Copy this checklist to track progress with Gemini:

### Critical Pages (Must Have)
- [ ] **project_urls.html** - URLs management tab
- [ ] **user_profile.html** - User settings page
- [ ] **registration.html** - Signup form
- [ ] **test_suites_list.html** - Suites overview
- [ ] **suite_details.html** - Suite details page
- [ ] **password_reset_request.html** - Reset request
- [ ] **password_reset_form.html** - Reset form
- [ ] **create_project_modal.html** - New project modal

### Enhancements (Important)
- [ ] Update **projects_list_empty.html** - Better empty state
- [ ] Update **test_builder.html** - More interactions
- [ ] Update **test_results.html** - Enhanced result view

### Nice-to-Have (Optional)
- [ ] **onboarding_wizard.html** - First-time user guide
- [ ] **error_404.html** - Not found page
- [ ] **error_500.html** - Server error page
- [ ] **error_network.html** - Network error page

---

## 🎯 PRIORITY ORDER FOR GEMINI

**Week 1: Critical Pages (Phase 1)**
1. `project_urls.html` - Most requested feature
2. `user_profile.html` - User management needed
3. `registration.html` - Complete auth flow

**Week 2: Critical Pages (Phase 2)**
4. `test_suites_list.html` - Organize tests
5. `suite_details.html` - Suite management
6. `create_project_modal.html` - Streamline project creation

**Week 3: Enhancements**
7. Password reset pages
8. Enhanced empty states
9. Test builder improvements

**Week 4: Polish**
10. Error pages
11. Onboarding wizard
12. Final touches

---

## 💬 NOTES FOR GEMINI

**Consistency Rules:**
1. Always use the design system from `DESIGN_SPECIFICATIONS_FOR_GEMINI.md`
2. Every page has the same sidebar (260px) + main content layout
3. All interactive elements have hover states (0.2s transition)
4. Forms always have validation states (red border on error)
5. Empty states use dashed borders and muted colors
6. Success actions use teal (#38B2AC), danger uses red (#F56565)

**States to Include:**
- Default (normal)
- Loading (spinners/skeletons)
- Empty (no data)
- Error (validation/server errors)
- Success (confirmations)

**Responsive Design:**
- Desktop first (1920×1080 primary)
- Cards should have max-width for readability
- Maintain sidebar on all pages

---

## 🔄 WORKFLOW

1. **User** reviews this document and approves priority
2. **Gemini** creates HTML prototypes following specs
3. **Claude** implements functional React components based on prototypes
4. **Team** reviews and iterates

---

**This document is ready to be shared with Gemini for design implementation.**

**Next Steps:**
1. Move this file to `/design_prototype/` directory
2. Share with Gemini along with design system doc
3. Gemini creates HTML files following specifications
4. Review and iterate on designs before React implementation
