# CSS Preview System Debugging

## 🎯 OBJECTIVE
Fix the CSS-first preview system that should show instant CSS-based previews instead of attempting 30-second screenshot captures.

## 🔍 INVESTIGATION STEPS

### Step 1: Check Element Data Structure
**Question**: Do elements from the backend have `cssInfo` populated?
**Location**: Elements retrieved via `projectsAPI.getElements()`
**Expected**: Elements should have `attributes.cssInfo` with CSS properties

### Step 2: Preview Detection Logic
**Question**: Is `shouldUseCSSPreview()` in ElementPreviewCard working correctly?
**Logic**: 
```typescript
const shouldUseCSSPreview = () => {
  if (previewMode === 'css') return true;
  if (previewMode === 'screenshot') return false;
  // Auto mode: use CSS if available, fallback to screenshot
  return !!(element.attributes?.cssInfo?.isVisible !== false);
};
```

### Step 3: CSSPreviewRenderer Integration
**Question**: Is CSSPreviewRenderer being called with correct props?
**Expected Flow**: 
1. CSS data available → Use CSSPreviewRenderer
2. CSS data missing → Use screenshot
3. Screenshot missing → Use icon placeholder

## 🧪 DEBUGGING METHODOLOGY

### 1. Console Logging Strategy
Add debug logs to:
- Element data inspection
- Preview mode detection
- CSSPreviewRenderer calls
- Fallback decisions

### 2. Data Inspection Points
- Element structure in ElementLibraryPanel
- CSS data availability check
- Preview component rendering decisions

### 3. Expected vs Actual Behavior
**Expected**: Instant CSS previews
**Actual**: 30-second screenshot timeouts

---

## FINDINGS WILL BE DOCUMENTED BELOW

### Investigation Results:
**CRITICAL ISSUE FOUND**: ElementLibraryPanel is NOT passing Phase 2 props to ElementPreviewCard!

**Lines 343-350 and 359-366**: ElementPreviewCard is called without:
- `previewMode` prop (defaults to 'auto')
- `showQuality` prop (defaults to true) 
- `compact` prop (defaults to false)

This means the CSS-first preview system is never triggered because the smart detection logic depends on these props being properly set.

### Root Cause:
ElementLibraryPanel integration is incomplete - missing Phase 2 prop forwarding to ElementPreviewCard components.

### Solution:
Add Phase 2 props to all ElementPreviewCard calls in ElementLibraryPanel:
1. Add `previewMode="auto"` to enable CSS-first detection
2. Add `showQuality={true}` to show quality indicators  
3. Add `compact={false}` for detailed preview mode

**Additional Finding**: ElementLibraryPanel also has its own screenshot request logic (line 556) that bypasses ElementPreviewCard entirely, causing duplicate screenshot attempts.