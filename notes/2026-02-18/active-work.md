# Active Work — 2026-02-18

## Current Task: Table Cell Click → Instant Test Step

**Status: 95% implemented — one small code change remaining**

## What's Done
All `onAddStep` prop wiring is complete through the full 6-file chain:
- CellSelectorPopover ✅ (has `onAddStep` prop, step actions, handler)
- TableExplorer ✅ (has `onAddStep` prop, passes to popover)
- TablePreviewCard ✅ (has `onAddStep` prop, passes to explorer)
- ElementLibraryPanel ✅ (has `onAddStep` prop, passes to table card)
- TestBuilder ✅ (has `pendingStep` state, `handleAddStep`, wires both panels)
- TestBuilderPanel ✅ (consumes `pendingStep`, shows notification, adds to steps array)

## What's Missing (1 change)
**`TableExplorer.tsx` line 41 — `handleCellClick`** needs to auto-call `onAddStep` before showing the popover.

Currently: cell click → shows popover → user clicks "Assert contains" button → step added
Goal: cell click → step INSTANTLY added → popover shows for alternatives

The change (add before `setActiveCell`):
```typescript
if (onAddStep) {
  const truncated = text.length > 50 ? text.substring(0, 50) + '...' : text;
  onAddStep({
    type: 'assert',
    selector,
    value: text,
    description: `Assert cell contains: "${truncated}"`,
  });
}
```

Optional: add 3s auto-dismiss timer to CellSelectorPopover.

## Next Steps
1. Apply the one-line change above to `handleCellClick`
2. Docker rebuild (`docker compose up --build`)
3. Test: open test builder → element library → table → explore → click cell → verify step appears
4. Verify alternative assertions in popover still work
