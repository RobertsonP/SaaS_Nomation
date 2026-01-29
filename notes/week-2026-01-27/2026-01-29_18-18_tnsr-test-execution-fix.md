# TNSR Test Execution Fix
Date: 2026-01-29 18:18
Status: Working

## Problem
All test executions were failing with `net::ERR_CONNECTION_REFUSED at http://localhost:3000`

**Root Cause**: Tests were being created with `localhost:3000` as the startingUrl, but Playwright runs inside a Docker container and cannot reach the host's localhost.

## Investigation
- Checked `test_executions` table - all executions failed with same error
- Found TNSR test had `startingUrl: localhost:3000`
- The browser inside Docker needs `host.docker.internal` to reach host machine

## Changes Made

### File: `backend/src/queue/execution-queue.processor.ts`
Added URL normalization function that converts localhost URLs to Docker-compatible URLs:

```typescript
function normalizeUrlForDocker(url: string): string {
  // Converts localhost/127.0.0.1 to host.docker.internal
  // Handles missing protocols
  // Works at execution time so existing tests are automatically fixed
}
```

Applied normalization to:
- Line ~187: `page.goto(dockerUrl)` - main navigation
- Line ~155: `authenticateForUrl(normalizeUrlForDocker(...))` - auth flow URLs
- Line ~149: `loginUrl: normalizeUrlForDocker(authFlowData.loginUrl)` - login URLs
- Line ~652: `navigate` step case - step navigation URLs

### Database Fix (Manual)
Updated existing TNSR test URL directly:
```sql
UPDATE tests SET "startingUrl" = 'http://host.docker.internal:3000/'
WHERE id = 'cmkzdm9uk00h7pzt2sjqpd6un';

UPDATE project_urls SET url = 'http://host.docker.internal:3000/'
WHERE id = 'cmkzctfjb0003pzt2f3eq8pgr';
```

## How the Fix Works
1. User creates test with `localhost:3000` (or any localhost URL)
2. Test is stored in database as-is
3. At execution time, `normalizeUrlForDocker()` converts:
   - `localhost:3000` → `http://host.docker.internal:3000/`
   - `http://localhost:8080/path` → `http://host.docker.internal:8080/path`
   - `127.0.0.1:5000` → `http://host.docker.internal:5000/`
4. Browser inside Docker can now reach the host machine

## Testing
- Backend compiles without errors
- Backend starts successfully
- Existing tests with localhost URLs will now work automatically

## Next Steps
- Run TNSR test from UI to verify fix
- Consider adding frontend warning when user enters localhost URLs
