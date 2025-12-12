# 🟢 LIVE STATUS TRACKER
> **SYNCHRONIZATION RULE:** Before starting a task, check this list. After completing, mark as `[COMPLETED]` with your name and time.
> **Format:** `- [ ] Task Name` -> `- [x] Task Name @AgentName (HH:MM)`

## 🚦 CURRENT STATUS: PHASE 0 (FOUNDATION)
- [ ] **C0.1: Test Infrastructure Setup** (Backend Jest + Playwright)
- [ ] **C0.2: Refactor Execution Service** (Split Logic)
- [ ] **G0.1: Design System "Light"** (Tokens + Modal + Fix Preview)
- [ ] **G0.2: Onboarding Design Sprint** (Empty State + Wizard)

---

# 🚀 SAAS NOMATION: MASTER INTEGRATED WORK PLAN
**SPECIALIST TEAM APPROVED | OUTCOME-DRIVEN | PARALLEL EXECUTION**

**Date:** December 12, 2025
**Status:** APPROVED FOR EXECUTION
**Teams:** Claude Squad (Backend/Arch) + Gemini Squad (Frontend/Product)
**Timeline:** 4 Phases (Outcome-Driven)

---

## 🎯 MISSION STATEMENT

**Transform SaaS Nomation into a Commercial Product by prioritizing Trust, Onboarding, and Intelligence.**

**Core Strategy:** 
1. **Foundation First:** No new features until testing infrastructure exists.
2. **Onboarding is Key:** User activation (Time-to-Value < 5 min) is the top UX priority.
3. **Trust is Mandatory:** Anchor-based selectors and self-healing are non-negotiable.

---

## 📊 WORK DISTRIBUTION PHILOSOPHY

### Claude Squad (Architecture & Reliability):
- ✅ Testing Infrastructure (Unit/E2E)
- ✅ Execution Engine Stability (Queues, Redis)
- ✅ Intelligent Selectors (Anchor-based, Self-healing)
- ✅ CI/CD & DevOps

### Gemini Squad (Experience & Growth):
- ✅ Onboarding & Activation (Wizard, Templates)
- ✅ Design System & Polish
- ✅ Mobile/Responsive Layout
- ✅ **Backend Action Implementations** (Gemini owns specific logic)
- ✅ **Growth Engineering** (Landing page, Analytics)

---

## 📅 PHASE 0: FOUNDATION (Week 1)
**Goal:** Build the safety net before driving fast.
**North Star:** 80% Test Coverage on Core Logic.

### CLAUDE TASKS (Phase 0)
**C0.1: Test Infrastructure Setup** ⚡ CRITICAL
- **Tasks:**
  - Setup Jest for Backend.
  - Setup Playwright for "Dogfooding" (Testing our own app).
  - Write 20+ Unit Tests for `SelectorGenerator`.
  - Write E2E test for "Login → Create Project".
- **Deliverable:** Test suite running in CI.

**C0.2: Refactor Execution Service**
- **Tasks:**
  - Separate `ExecutionService` from `AnalysisService`.
  - Implement "Result Object" pattern (standardized success/fail returns).
  - Fix 500 Error masking (proper Exception handling).
- **Deliverable:** Clean, testable service architecture.

### GEMINI TASKS (Phase 0)
**G0.1: Design System "Light"**
- **Tasks:**
  - Define colors, typography, spacing (tokens).
  - Build core components: `Button`, `Input`, `Modal` (Replace alerts).
  - **CRITICAL:** Fix `ElementVisualPreview` buttons (broken feature).
- **Deliverable:** Consistent UI foundation.

**G0.2: Onboarding Design Sprint**
- **Tasks:**
  - Design "Empty State" dashboard.
  - Wireframe "First Run Wizard" (Welcome -> URL -> Test).
  - Review with Product Strategist.
- **Deliverable:** Figma/HTML prototypes for onboarding.

---

## 📅 PHASE 1: "MAKE IT WORK" (Weeks 2-5)
**Goal:** 5 Beta Users creating tests successfully.
**North Star:** Time-to-First-Test < 5 minutes.

### WEEK 2: STABILITY & QUEUES

**Claude (C1.1): BullMQ Job Queue**
- Implement Redis-backed queue.
- Handle concurrent test runs.
- **Priority:** High (Prevents server crash).

**Claude (C1.2): Anchor-Based Selectors**
- Rewrite `element-analyzer` to look for stable parents (`#login-form`).
- Implement "Hierarchy" logic.
- **Priority:** Critical (Trust).

**Gemini (G1.1): Live Element Picker Overlay**
- Implement the "Browser Frame" overlay.
- Visual selection highlight.
- "Add to Test" interaction.
- **Priority:** Critical (UX).

**Gemini (G1.2): Implement Backend Actions**
- Implement `hover`, `scroll`, `upload` in `execution.service.ts`.
- **Note:** Gemini writes backend code here.

### WEEK 3: TRANSPARENCY & VIDEO

**Claude (C1.3): Video Recording Engine**
- Configure Playwright `recordVideo`.
- Store videos in S3/MinIO (local for dev).
- Serve video URL via API.

**Gemini (G1.3): Test Builder UX**
- Split `TestBuilderPanel` into manageable components.
- Implement "Step List" with video timestamps.
- Highlight active step during playback.

### WEEK 4: ONBOARDING & BETA PREP

**Claude (C1.4): Production Environment**
- Docker optimization.
- Rate limiting & Security headers.
- DB Indexing.

**Gemini (G1.4): Onboarding Wizard**
- Implement the "First Run" flow.
- "Create Demo Project" button (pre-filled data).
- Interactive tutorial bubbles.

**Gemini (G1.5): Marketing Landing Page**
- Simple 1-page site (Carrd/Next.js).
- "Join Beta" form.
- Analytics setup (PostHog/Mixpanel).

---

## 📅 PHASE 2: "MAKE IT VALUABLE" (Weeks 6-10)
**Goal:** Users create 10+ tests each (Habit formation).
**North Star:** Self-Healing Accuracy > 60%.

### CLAUDE TASKS (Phase 2)
**C2.1: Self-Healing v1 (Rule-Based)**
- **Trigger:** Element not found.
- **Action:** Search DOM for element with *similar* attributes (text, role).
- **Result:** Update selector + Warn user.

**C2.2: Smart Waits & Retries**
- Implement step-level auto-retry (3x).
- "Wait for Stable" logic (network idle).

### GEMINI TASKS (Phase 2)
**G2.1: Test Templates**
- "Add Login Flow" (Pre-built steps).
- "Add Checkout Flow".
- UI for saving custom templates.

**G2.2: Visual Test Results**
- "Filmstrip" view of execution.
- Side-by-side (Expected vs Actual) screenshots on failure.

---

## 📅 PHASE 3: "MAKE IT SELLABLE" (Weeks 11-16)
**Goal:** First 3 paying customers.
**North Star:** $1k MRR.

### CLAUDE TASKS (Phase 3)
**C3.1: Multi-Tenancy & Teams**
- Organization/Team models.
- Role-based Access Control (RBAC).

**C3.2: Stripe Integration**
- Billing service.
- Usage tracking (Runs per month).

### GEMINI TASKS (Phase 3)
**G3.1: Professional Reporting**
- PDF Export.
- Email notifications ("Your nightly build failed").

**G3.2: Settings & Administration**
- Team management UI.
- Billing portal.

---

## 🌳 BRANCHING STRATEGY (ZERO CONFLICTS)

**Master (Production)**
  └─ `dev/phase_0` (Foundation)
      ├─ `feature/claude-testing`
      └─ `feature/gemini-design`

**Rules:**
1. **Gemini Owns:** `frontend/`, `backend/src/execution/actions/*`
2. **Claude Owns:** `backend/src/queue/*`, `backend/src/browser/*`
3. **Shared:** `prisma/schema.prisma` (Communicate before change!)

---

## ✅ SUCCESS METRICS (KPIs)

| Phase | Metric | Target |
|-------|--------|--------|
| **0** | Test Coverage | 80% (Core) |
| **1** | Onboarding Time | < 5 mins |
| **1** | Beta Signups | 20+ |
| **2** | Self-Healing | 60% Accuracy |
| **3** | Revenue | $1,000 MRR |

---

**APPROVED BY:** Specialist Team (Consensus)