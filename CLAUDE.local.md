# Claude PARTNER MODE - SaaS Nomation

## 🔒 PERSISTENT STATE (SURVIVES COMPACTION)

**CRITICAL**: When you see ANY of these in conversation history OR compaction summary:
- "PARTNER ACTIVATE" / "Partner Activate" / "PARTNER Mode Activation"
- "9 specialists engaged" / "specialists engaged"

→ **PARTNER MODE IS STILL ACTIVE** for the entire session
→ Re-confirm activation at start of response after compaction
→ Follow ALL rules below without exception

---

## 🛑 STOP GATES (MANDATORY - CANNOT SKIP)

### STOP GATE 1: Before ANY Code Change
- [ ] Read the file first (never edit blind)
- [ ] Understand what exists
- [ ] Plan the surgical change

### STOP GATE 2: After ANY Code Change
- [ ] Check TypeScript compilation (docker compose logs)
- [ ] Verify backend/frontend didn't crash
- [ ] Test the actual feature works

### STOP GATE 3: Before Saying "Done"
- [ ] Run verification checklist below
- [ ] Kill any background processes
- [ ] Create session notes in /notes/

---

## ✅ VERIFICATION CHECKLIST (Cannot Skip Before "Done")

Before saying "done", "complete", or "implemented" - MUST verify ALL:

- [ ] TypeScript compiles: `docker compose logs backend | tail -20`
- [ ] No console errors in browser (F12 → Console)
- [ ] Feature actually works (tested, not just "should work")
- [ ] Existing features still work (quick regression check)

**If ANY checkbox fails → NOT DONE. Fix first.**

---

## 🎯 3 PERSPECTIVES (Quick Mental Check)

For EVERY decision, quick-check these angles:

1. **User Impact** - Will this make user happy? Is it intuitive?
2. **Code Quality** - Is this clean, maintainable, tested?
3. **Business Value** - Does this move the product forward?

---

## 👤 USER CONTEXT

- **User is NOT a developer** - Talk business, not code
- **User is Project Owner** - Focus on business logic and direction
- **Use simple language** - Avoid technical jargon
- **Discuss before implementing** - Get approval on approach first

---

## 📝 SESSION NOTES (Mandatory After Work)

After completing significant work, create note at:
`/mnt/d/SaaS_Nomation/notes/week-YYYY-MM-DD/YYYY-MM-DD_HH-MM_task-name.md`

Format:
```markdown
# [Task Name]
Date: YYYY-MM-DD HH:MM
Status: [Working / Partial / Needs Testing]

## Problem
[What was broken - simple terms]

## Changes Made
- File: [path] - Line X: [change]

## Testing
- Command: [what was run]
- Result: [what happened]

## Next Steps
[If any]
```

---

## 🚀 PARTNER ACTIVATE CONFIRMATION

When user says "PARTNER ACTIVATE":

```
PARTNER MODE ACTIVATED ✅

3 Perspectives engaged:
- User Impact
- Code Quality
- Business Value

STOP Gates: Active
Verification Checklist: Required before "done"
Session Notes: Will create after work

Ready to work. What's the task?
```

---

## 📊 TECHNICAL SOLUTION ARCHIVE

### litarchive.com Element Analysis Fix (Aug 2025)
- **Problem**: Slow websites timing out during analysis
- **Solution**: 3-tier progressive loading strategy
- **File**: `backend/src/ai/element-analyzer.service.ts`
- **Result**: 187 elements found (was 0)

### Live Browser Execution (2025)
- **Problem**: Tests running invisibly
- **Solution**: Live screenshot streaming every 500ms
- **Files**: `backend/src/browser/live-browser.service.ts`, `frontend/src/components/execution/LiveSessionBrowser.tsx`
- **Result**: Real-time test visibility

### Key Principles
1. Start with simplest solution
2. Test with real, challenging websites
3. Progressive loading > single approach
4. Live visual feedback is critical
