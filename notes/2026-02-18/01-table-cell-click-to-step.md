# Table Cell Click → Instant Test Step
Date: 2026-02-18

## Plan
- [+] Read all 6 files to understand current state
- [ ] Add auto-step-creation on cell click in TableExplorer
- [ ] Add auto-dismiss timer (3s) to CellSelectorPopover
- [ ] Verify TypeScript compiles
- [ ] Docker rebuild + test

## What's Already Done
All `onAddStep` prop wiring is complete through the full chain:
- CellSelectorPopover → TableExplorer → TablePreviewCard → ElementLibraryPanel → TestBuilder → TestBuilderPanel

## What's Missing
1. `TableExplorer.handleCellClick` doesn't call `onAddStep` automatically
2. CellSelectorPopover doesn't auto-dismiss after 3s

## Progress
(Updated as work happens)

## What Happened
(Filled at the end)
