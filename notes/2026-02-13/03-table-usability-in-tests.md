# Make Tables Usable in Tests
Date: 2026-02-13 21:06 (GMT+4)

## Problem
Table elements in the element library can't be used to build test steps. You can see the table, explore cells, copy selectors — but you can't turn any of that into a test step. The cell selection UI (TableExplorer + CellSelectorPopover) is disconnected from the test step builder.

## What Exists Today
- Backend extracts ALL table data: cell selectors, row selectors, column selectors, assertion templates
- TablePreviewCard shows table preview with "Explore" button
- TableExplorer shows full interactive table with clickable cells
- CellSelectorPopover shows assertion code snippets
- BUT: clicking a cell only copies to clipboard — no path to test step creation

## Solution: Instant Step Creation on Cell Click

### The Flow (After Fix)
1. Open Element Library in test builder
2. Click "Explore" on a table card
3. Click any cell in the table
4. An assertion step is INSTANTLY added to the test: "Assert cell contains 'John Doe'"
5. Brief green notification confirms the step was added
6. Popover still shows for alternative assertions (equals, visible) + manual copy

### What Changes in Each File

#### 1. CellSelectorPopover.tsx
- New prop: `onAddStep` callback
- Assertion buttons now create test steps (primary action) instead of just copying
- Small copy icon next to each button keeps clipboard functionality
- Available assertions: "contains text" (default on click), "equals text", "is visible"

#### 2. TableExplorer.tsx
- New prop: `onAddStep` callback
- On cell click: immediately calls onAddStep with an "assert contains [text]" step
- Then shows CellSelectorPopover for alternative assertions
- Passes onAddStep down to CellSelectorPopover

#### 3. TablePreviewCard.tsx
- New prop: `onAddStep` callback
- Threads it through to TableExplorer

#### 4. ElementLibraryPanel.tsx
- New prop: `onAddStep` callback
- Threads it through to TablePreviewCard

#### 5. TestBuilder.tsx (orchestrator)
- New state: `pendingStep` — holds a step that needs to be consumed by TestBuilderPanel
- Handler: when cell clicked, sets pendingStep
- Passes onAddStep to ElementLibraryPanel
- Passes pendingStep + onPendingStepConsumed to TestBuilderPanel

#### 6. TestBuilderPanel.tsx (step creator)
- New props: `pendingStep`, `onPendingStepConsumed`
- useEffect: when pendingStep arrives, adds it to the steps array and clears it
- Shows brief inline notification: "Step added: Assert cell contains 'John Doe'"

### Visual Result

**Element Library (left panel):**
- Table cards look the same (mini table preview)
- "Explore" opens interactive table — same as before
- Cells are now clickable action targets, not just copy targets

**On cell click:**
- Step instantly appears in the test step list (right panel)
- Green notification: "Step added: Assert cell contains 'John Doe'"
- Popover shows with alternative assertions + copy buttons

**Test Steps (right panel):**
- New step at bottom of list:
  - Type: assert
  - Selector: table tbody tr:nth-child(2) td:nth-child(3)
  - Value: John Doe
  - Description: Assert cell contains: "John Doe"

## Plan
- [+] Add onAddStep callback to CellSelectorPopover
- [+] Wire onAddStep through TableExplorer (+ hint text change)
- [+] Wire onAddStep through TablePreviewCard
- [+] Wire onAddStep through ElementLibraryPanel
- [+] Connect in TestBuilder with pendingStep state + handleAddStep
- [+] Consume pendingStep in TestBuilderPanel with green notification
- [+] Verify TypeScript compiles clean

## Progress
All steps complete. Both backend and frontend compile clean.

## What Happened
Tables are now usable in tests. When you open a table in the explorer and click a cell,
you get action buttons (Assert contains, Assert equals, Assert visible, Click cell) that
instantly add a test step. A green notification confirms the step was added. The copy
functionality is preserved below the action buttons for manual use.
