# 7 Critical Bug Fixes
Date: 2026-01-15 17:30
Status: ✅ All Fixes Implemented

## Summary
Fixed 7 bugs reported by user during testing. Key discovery: Bugs 1, 2, and 7 shared the SAME root cause.

---

## Bug 1, 2, 7: Projects Disappearing / Test Execution 404 / Project Deletion 403

### Root Cause
`OrganizationGuard` required `organizationId` on every request, but it was getting lost during navigation. When missing, the guard threw 403 Forbidden, which frontend silently caught.

### Fix Applied
Modified `OrganizationGuard` to auto-detect organizationId from user's membership if not provided.

**File**: `backend/src/auth/guards/organization.guard.ts`

**Change**:
```typescript
// If organizationId not provided, auto-detect from user's membership
if (!orgId) {
  const membership = await this.prisma.organizationMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' }, // Get first/primary organization
    select: { organizationId: true }
  });
  if (membership) {
    orgId = membership.organizationId;
  }
}
```

---

## Bug 3: Missing Timezones

### User Request
- Keep ONLY Yerevan for Caucasus region
- Remove Tbilisi (Georgia) and Baku (Azerbaijan)

### Fix Applied
**File**: `frontend/src/lib/timezones.ts`

Removed:
- `{ value: 'Asia/Tbilisi', label: 'Tbilisi (Georgia)', offset: '+04:00' }`
- `{ value: 'Asia/Baku', label: 'Baku (Azerbaijan)', offset: '+04:00' }`

Kept:
- `{ value: 'Asia/Yerevan', label: 'Yerevan (Armenia)', offset: '+04:00' }`

---

## Bug 4: Project Analysis Cards Duplicate Info

### Investigation Result
**CODE ALREADY CORRECT** - The Project Analysis section at lines 830-856 already shows:
- Passed Tests (`testStats?.totalPassed`)
- Failed Tests (`testStats?.totalFailed`)
- Regressions (`testStats?.regressions`)
- Success Rate (`testStats?.successRate`)

Screenshot may be from older version. User should refresh/rebuild to see correct data.

---

## Bug 5: Localhost Discovery 500 Error

### Root Cause
Outer catch-block in `discovery.service.ts` was re-wrapping ALL errors as 500 Internal Server Error, even properly categorized 4xx errors from `checkUrlReachable()`.

### Fix Applied
**File**: `backend/src/discovery/discovery.service.ts`

**Change**:
```typescript
} catch (error) {
  // Preserve the original HTTP status if it's already an HttpException
  if (error instanceof HttpException) {
    throw error;
  }
  // Only wrap unknown errors as 500
  throw new HttpException(`Discovery failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
}
```

Now returns:
- 400 Bad Request for connection refused (localhost not running)
- 408 Request Timeout for slow servers
- 500 Internal Server Error only for unknown errors

---

## Bug 6: Dark Theme Incomplete

### Components Fixed

**1. NotificationSettingsPage** (`frontend/src/pages/settings/NotificationSettingsPage.tsx`)
- Recipients section: Added `dark:bg-gray-800`, `dark:border-gray-700`
- Input fields: Added `dark:bg-gray-700`, `dark:text-white`
- Buttons: Added `dark:bg-gray-700`, `dark:hover:bg-gray-600`
- Email list items: Added `dark:bg-gray-700/50`, `dark:text-gray-300`
- Quiet Hours section: Full dark mode support

**2. ProjectDetailsPage URLs Tab** (`frontend/src/pages/projects/ProjectDetailsPage.tsx`)
- URL input form: Added `dark:bg-gray-700/50`, `dark:border-gray-600`
- Empty state: Added `dark:bg-gray-700/50`, `dark:text-white`
- URL cards: Added `dark:border-gray-700`
- Select all controls: Added `dark:border-gray-600`, `dark:text-gray-400`

---

## Testing Required

1. **Bug 1**: Login → Dashboard → Projects → Project Details → Projects → Dashboard. Verify data persists.
2. **Bug 2**: Create test → Run test → Verify execution starts (no 404)
3. **Bug 3**: Open timezone picker → Verify Yerevan visible, Tbilisi/Baku removed
4. **Bug 4**: Open project → Verify analysis cards show test metrics (Passed/Failed/etc.)
5. **Bug 5**: Create project with localhost URL → Discover sitemap → Expect 400 error with helpful message
6. **Bug 6**: Toggle dark mode → Verify NotificationSettingsPage and URLs tab have dark backgrounds
7. **Bug 7**: Projects list → Delete project → Verify deletion works (no 403)

---

## Pre-existing Issues (Not Fixed)

Backend has TypeScript errors in `discovery.service.ts` related to `screenshot` property not existing in Prisma schema. This is unrelated to the bug fixes and existed before this session.

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/auth/guards/organization.guard.ts` | Auto-detect orgId from user membership |
| `backend/src/discovery/discovery.service.ts` | Preserve HttpException status codes |
| `frontend/src/lib/timezones.ts` | Remove Tbilisi/Baku, keep Yerevan |
| `frontend/src/pages/settings/NotificationSettingsPage.tsx` | Full dark mode support |
| `frontend/src/pages/projects/ProjectDetailsPage.tsx` | Dark mode for URLs tab |
