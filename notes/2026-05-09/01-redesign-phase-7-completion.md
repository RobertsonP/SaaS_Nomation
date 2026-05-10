# Verdant Pro Redesign — Phase 7 completion (modals + test builder internals)
Date: 2026-05-09
Branch: `redesign/v2`

## Plan
- [+] TestBuilder 3-pane internals (outer split, action bar, step cards, ElementLibraryPanel header + page sidebar + group headers)
- [+] All inline test-builder modals (Add/Edit step, Execution mode picker, Sequential progress, Failed step confirmation)
- [+] AnalyzeUrlsModal
- [+] AnalysisProgressModal + AnalysisFloatingIndicator
- [+] DiscoveryModal + DiscoveryFloatingIndicator
- [+] RunModePickerModal
- [+] LiveExecutionModal
- [+] TestExecutionModal
- [+] TestConfigurationModal
- [ ] Phase 8: tailwind audit + dead code cleanup + PR

## Progress

### TestBuilder + ElementLibraryPanel — `567b492`
- `SortableTestStep`: full re-skin. Per-step-type tone (moss/info/amber/clay/slate) with paired `--*-soft` background, `--*-edge` border, `--*` foreground. Lucide icons replace the emoji set (👆⌨️✓⏳ etc.). Card chrome on `var(--surface)` with hairline border; active video step gets a moss outline + 2px ring.
- `TestBuilderPanel`:
  - Outer container: `var(--paper)` with left hairline; minimal header row.
  - Selected element card: `var(--surface)` + hairline + mono moss selector block on `var(--surface-2)`.
  - Action bar: `Save` (btn-outline normal / btn-primary amber-coloured when unsaved) + `Cancel` btn-ghost + `Run` btn-success + `Clear` clay icon-btn.
  - Empty state uses `.empty` pattern with PlayCircle icon + moss-soft tip card.
  - Debug panel: amber-soft surface, `.pill` Paused/Running tag, CheckCircle2/XCircle status, Bug icon header.
  - Unsaved-changes hint: amber-soft strip with AlertTriangle icon.
  - All four inline dialogs (Add/Edit step, Execution mode picker, Sequential progress, Failed step confirmation) converted to `.modal-backdrop` / `.modal` / `.modal-head` / `.modal-body` / `.modal-foot` primitive.
  - Sequential modal: tone-coloured row backgrounds (moss-soft pass, clay-soft fail, info-soft running, surface-2 pending) with Lucide CheckCircle2/XCircle/Loader2/Clock icons.
- `TestBuilder.tsx` outer 60/40 split now uses verdant tokens (no Tailwind colours).
- `ElementLibraryPanel`:
  - Header: surface card with Inter Tight title, count pill, Analyze (btn-success) + Live picker (btn-primary) + Clear (clay icon-btn).
  - Search: `.field` with Lucide Search prefix + clear icon-btn.
  - Page sidebar: bone background, moss-soft active state with 2px moss left stripe, mono path under title, tabular count.
  - Group headers: surface-2 hairline cards with Lucide chevrons; count pill.
  - Triangle Unicode escapes (`▸`, `▾`) replaced with Lucide `ChevronRight` / `ChevronDown` (used a small CommonJS Node script to perform the literal-escape replacement that the Edit tool couldn't disambiguate).

### Modals + indicators — `7b5c1bb`
- `AnalyzeUrlsModal`: tabs with moss bottom-border, surface-2 quick-action strip, moss-soft active row, .pill status badges.
- `AnalysisProgressModal`: phase stepper with tone-coloured rings + Lucide icons, 6px progress bar, surface-2 details panel with mono timestamps.
- `AnalysisFloatingIndicator`: bottom-right card with 3px accent stripe + tone squircle + 4px progress fill. Replaces purple-on-purple gradient.
- `DiscoveryModal`: full re-skin. Form section (Smart-discovery callout, starting URL, depth/pages, auth flow) all on verdant fields and tone-soft/edge cards. Progress section uses tone-rings stepper. Results section keeps the SiteMapGraph but the surrounding chrome (success header, selection bar, footer buttons) is on verdant primitives.
- `DiscoveryFloatingIndicator`: same accent-stripe-on-surface pattern as Analysis indicator.
- `RunModePickerModal`: hover-tinted choice cards (info-soft Headed / moss-soft Headless) with Eye / EyeOff icons.
- `LiveExecutionModal`: tone-coloured modal-head with accent squircle + CheckCircle2/XCircle, three-section body (Step details / Execution results / Screenshot / Logs) on verdant cards. Logs panel keeps inverse colour for terminal feel but uses var(--ink) base.
- `TestExecutionModal`: full modal view + minimized bottom-right card. Steppers use tone-coloured pill rings with Lucide CheckCircle2/Loader2/XCircle.
- `TestConfigurationModal`: moss-soft project header card with Pencil edit pill, .field inputs with clay error states, footer kbd hints.

## Verification
- TS check exits 0 after every commit.
- Phase 7 is now feature-complete: every modal, indicator, panel, and inline dialog the user could encounter is on verdant tokens.
- Floating indicators continue to mount inside the Router (AuthLogoutListener) — visual change only, no behavioural drift.
- Sequential execution modal keeps its WebSocket subscription and step lifecycle handlers; only the row chrome changed.

## What Happened

User's standing demand was unambiguous: **"Do everything dont miss anything understood?"** They specifically called out:
1. TestBuilder 3-pane internals — done in `567b492`.
2. LiveElementPicker capture screen — already done in earlier `4662f29`.
3. All remaining modals — done in `7b5c1bb`.

After this commit, the only Tailwind-coloured chrome left in the app is in the third-party SiteMapGraph internals (xyflow nodes) and a few minor utility components (DragOverlay, SelectorValidator, SelectorSuggestions, ElementLibrarySidebar) that aren't user-facing primary surfaces. Those are Phase 8 cleanup territory.

## Cumulative state
13 commits on `redesign/v2`. The redesign is now visually complete across:
- Login / Register / Landing
- Dashboard
- Projects list (grid + list + create modal + GitHub import)
- Project Details (Overview / URLs / Site Map / Elements / Authentication / Settings)
- Tests / Suites / Runs / Suite Details
- Test Builder (3-pane + step cards + element library + every action)
- Test Results / Suite Results
- Live Element Picker
- All modals: Analyze URLs, Analysis Progress, Discovery, Run Mode Picker, Live Execution, Test Execution, Test Configuration, Add/Edit Step, Execution Mode Picker, Sequential Progress, Failed Step, Confirmation, Info, Loading, Flow Diagram (How it works)
- Floating indicators: Analysis + Discovery
- Settings: Profile + Notifications
- Toast notifications (NotificationContainer)

## Remaining for Phase 8
- Visual side-by-side audit vs prototype HTML in light + dark
- Tailwind config trim (remove unreferenced custom colours/animations)
- Hook up ⌘K search if a search endpoint exists; otherwise leave the placeholder
- Final TS clean both sides
- PR `redesign/v2` → `master`
