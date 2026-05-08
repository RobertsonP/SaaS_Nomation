# Verdant Pro Redesign — Phases 0-3 shipped
Date: 2026-05-08
Branch: `redesign/v2` (4 commits on top of master)

## Plan
- [+] Phase 0: Verdant CSS + theme provider setup
- [+] Phase 1: Layout shell (sidebar + topbar + collapsible project nav)
- [+] Phase 2: Dashboard A (stat tiles + activity feed + projects panel)
- [+] Phase 3: Projects + Project Details + Edit Site modal + responsiveness
- [ ] Phase 4: Tests, Suites, Runs, Sitemap pages
- [ ] Phase 5: Test Builder + Element Picker + Test Results
- [ ] Phase 6: Auth + Settings + Landing
- [ ] Phase 7: Modals + Drawers + Toasts + How-it-works
- [ ] Phase 8: Audit + cleanup + PR

## Progress

### Phase 0 — `0520117`
- Copied prototype `styles.css` (~790 lines) into `frontend/src/styles/verdant.css`, imported from `index.css` ahead of Tailwind directives
- ThemeContext now writes both Tailwind's `dark` class AND `data-theme` attribute on `<html>` so verdant tokens follow the existing toggle
- Removed dead bespoke `.btn` / `.sidebar` / `.nav-item` legacy CSS (zero usages remained)
- Added `design-input/` to gitignore — handoff bundle stays a private reference

### Phase 1 — `95273c7`
- New `VerdantShell + VerdantSidebar + VerdantTopbar` (replaces 143-line Layout.tsx)
- Sidebar: collapsible per-project nodes with sub-nav (Overview / Sites / Sitemap / Elements / Tests / Suites / Runs / Auth flows / Settings)
- Sub-nav for tabbed sections uses `?tab=` query so internal tab state on ProjectDetailsPage stays in sync
- Topbar: breadcrumbs derived from pathname + tab query, ⌘K visual placeholder, "How it works" placeholder (Phase 7)
- Backend: `projects.service.ts` `_count.select` now includes `testSuites: true` so the sidebar can show suite counts
- ProjectDetailsPage reads `?tab=` via `useSearchParams` + writes it back when in-page tabs are clicked
- Sidebar collapse state: `verdant-sidebar-collapsed` localStorage key
- Per-project expansion state: `verdant-sidebar-expanded` (JSON array)

### Phase 2 — `ed841b0`
- New atoms: `Pill`, `Sparkline`, `StatTile` in `frontend/src/components/ui/`
- DashboardPage rebuilt with 4 verdant stat tiles (Pass rate · 7d with sparkline, Total tests, Today, Running now)
- Recent activity card driven by `executionAPI.getTrends(7)` — one row per day, status pill (pass/mixed/fail), counts
- Projects panel + System status (placeholders + TODO) + Selector hygiene tip card
- OnboardingWizard preserved for empty workspaces
- New Project button hooks to `/projects?new=1`; Analyze URLs navigates to `/projects` (project picker — global modal in Phase 7)

### Phase 3 — `30b6c32`
- **Responsive layer** (`verdant-responsive.css`):
  - Mobile (≤768px): sidebar lifts into off-canvas drawer with backdrop, hamburger in topbar
  - Tablet (≤1024px): 4-up stat grids → 2-up; dashboard 1.6fr/1fr → stacked
  - Topbar compresses on mobile (search hidden, button labels hidden)
  - Stat grids on Dashboard + Project Details tagged with `.stat-grid-4`; dashboard split tagged `.split-2`
- VerdantShell tracks `mobileOpen` state, auto-closes on route change + on viewport resize past breakpoint
- VerdantTopbar gets a Menu icon button class `.mobile-menu-btn` (display: none ≥768px)

- **ProjectsPage**:
  - Top header `.page-head`, project cards rebuilt with `.card / .card-pad / .pill`
  - Reads `?new=1` query → auto-opens existing create modal (so dashboard's New Project button works)
  - Cards: title + description, URL preview or amber Setup-needed callout, three count pills (tests/elements/URLs), View tests + New test action row
  - Click anywhere on card to open project; kebab Edit / Trash with stopPropagation
  - Old massive create modal left intact (Phase 7 restyle)

- **ProjectDetailsPage**:
  - New `.page-head` with Back link, project name, description sub
  - Action buttons: Test Suites / Tests / AI Generate Tests / Create Test or Setup Project
  - 4-up stat row in `.card / .card-pad` style (URLs / Elements / Tests / Analyzed)
  - Verdant `.tabs` replace the old colored tab chrome
  - All tab logic, hooks, contexts, side effects unchanged

- **EditSiteModal** (new file, the user explicitly asked for it):
  - Read-only URL display with mono styling
  - Editable Title / Alias bound to existing `projectsAPI.renameUrl(urlId, title)`
  - Status pills (Analyzed / Verified / Auto-discovered)
  - Footer: Remove site (uses existing `handleRemoveUrl`), Cancel, Verify (uses existing `handleVerifyUrl`), Save (only enabled when title changed)
  - Closes on Escape, click-outside, or after a successful save
  - Wired into ProjectUrlsTab via new optional `onEditUrl` prop on UrlCard — additive, doesn't remove existing inline Rename/Verify/Remove buttons

- Sidebar fix: per-project Settings sub-nav now uses `?tab=settings` so its active highlight doesn't collide with Overview when on the project root

## Verification
- TS check both sides exits 0 throughout (multiple invocations during Phases 0-3)
- Real browser screenshots of every changed surface in light + dark
- Smoke-tested: login → dashboard → projects → project details → URL tab → Edit modal end-to-end
- Floating Discovery + Analysis indicators still mounted inside Router (Bundle 2 work intact)
- All existing API calls untouched (`lib/api.ts` not modified except for the existing `executionAPI.getTrends` consumed by the dashboard)
- Backend changes: 1 file, 3 lines (`testSuites: true` added to `_count.select` in projects.service.ts — additive, breaks nothing)

## What Happened

The redesign now covers all the high-traffic user-facing surfaces (auth-gated landing, projects list, project details, every modal-free flow up to "I want to edit my site"). Old design still holds for: Tests, Suites, Runs, Sitemap pages (Phase 4); Test Builder, Live Element Picker, Test Results (Phase 5 — the biggest); Auth pages, Settings, Landing (Phase 6); and all modals + toasts (Phase 7). Final cleanup + PR is Phase 8.

User explicitly noted "responsiveness" mid-Phase-3 — added `verdant-responsive.css` with mobile-drawer sidebar and tablet/mobile grid collapse before continuing the redesign work. That layer benefits every phase to come.

Paused at end of Phase 3 to let user review before the next batch (Phase 4 = Tests / Suites / Runs / Sitemap).

## Screenshots saved at repo root (gitignored)
- `phase1-dashboard.png`, `phase1-sidebar-expanded.png`, `phase1-sites-tab.png`, `phase1-light.png`
- `phase2-dashboard-dark.png`
- `phase3-projects-list.png`, `phase3-project-details.png`, `phase3-edit-site-modal.png`
