# 🧪 TESTING GUIDE - Changes from Today's Session
**Date**: December 12, 2025
**Changes**: C0.1, C0.2, C1.1 Complete Implementation
**Status**: Ready for Testing

---

## ✅ YOUR EXISTING .BAT FILES ARE FINE!

**Good News**: Your restart scripts work perfectly! I only added Redis to the services list.

**You can use**:
- `scripts/windows/start.bat` - Start everything
- `scripts/windows/restart.bat` - Full restart with rebuild
- `scripts/windows/stop.bat` - Stop all services

---

## 📋 WHAT CHANGED TODAY

### 1. **C0.1: Playwright Environment** ✅ VERIFIED WORKING
- **Status**: Already functional, no changes needed
- **What was fixed**: Nothing - Gemini's error was misreported
- **Testing**: Not required (already verified)

### 2. **C0.2: Execution Service Refactor** ✅ REQUIRES TESTING
- **What changed**: API now returns 200 OK always (never 500)
- **File modified**: `backend/src/execution/execution.controller.ts`
- **Impact**: Test execution responses now use Result Object pattern

### 3. **C1.1: BullMQ Job Queue** ✅ REQUIRES TESTING
- **What changed**: Test execution now uses job queue with Redis
- **Files created**:
  - `backend/src/queue/queue.module.ts`
  - `backend/src/queue/execution-queue.service.ts`
  - `backend/src/queue/execution-queue.processor.ts`
- **Files modified**:
  - `docker-compose.yml` (added Redis service)
  - `backend/src/app.module.ts` (registered queue)
  - `backend/src/execution/execution.controller.ts` (now queues jobs)

---

## 🚀 STEP-BY-STEP TESTING INSTRUCTIONS

### STEP 1: Restart the Project with Redis

```batch
cd D:\SaaS_Nomation
scripts\windows\restart.bat
```

**What this does:**
- Stops all existing containers
- Pulls Redis 7 Alpine image (small, fast)
- Rebuilds backend with new queue code
- Starts: PostgreSQL + Redis + Backend + Frontend + Ollama

**Expected output:**
```
🐳 Starting Nomation services...
  - PostgreSQL Database
  - Redis (Job Queue)        ← NEW!
  - Backend API (with Playwright)
  - Frontend React App
  - Ollama AI Service
```

**Verify Redis is running:**
```batch
docker ps | findstr redis
```

**Expected:**
```
nomation-redis    redis:7-alpine    Up 2 minutes    6379/tcp
```

---

### STEP 2: Verify Backend Compiles and Starts

**Check backend logs:**
```batch
docker-compose logs -f backend
```

**Look for these success messages:**
```
✅ "Nest application successfully started"
✅ "Listening on port 3002"
✅ No errors about Redis connection
```

**If you see Redis connection errors:**
- Redis might still be starting
- Wait 10 seconds and check again
- Run: `docker-compose restart backend`

---

### STEP 3: Test C0.2 - Result Object Pattern

**Open Browser → DevTools (F12) → Network Tab**

1. **Login to application**: http://localhost:3001
2. **Navigate to Tests page**
3. **Run any test**
4. **Check Network tab** for the API call

**What to verify:**

✅ **Status Code is 200 OK** (not 500)
✅ **Response has this structure:**
```json
{
  "success": true,
  "jobId": "test-abc123-1234567890",
  "position": 1,
  "message": "Test queued successfully (Position 1 in queue)"
}
```

❌ **If you see 500 error:**
- This means Result Object pattern failed
- Check backend logs for stack trace
- Report error to me

---

### STEP 4: Test C1.1 - Job Queue (Single Test)

**Run a single test from the UI:**

1. Navigate to a test
2. Click "Run Test"
3. **Response should be INSTANT** (< 100ms)

**What to verify:**

✅ **Immediate response** with `jobId` and `position`
✅ **Test executes in background** (watch WebSocket events)
✅ **Results appear** after execution completes

**Frontend behavior:**
- You should see "Test queued (Position 1)"
- Then real-time progress updates via WebSocket
- Then final result

---

### STEP 5: Test C1.1 - Concurrent Execution (Critical!)

**This is the MAIN requirement from C1.1 Definition of Done**

**Method 1: Using 3 Browser Tabs (Easiest)**

1. Open **3 browser tabs** with the same test
2. In Tab 1: Click "Run Test"
3. **IMMEDIATELY** in Tab 2: Click "Run Test"
4. **IMMEDIATELY** in Tab 3: Click "Run Test"

**What to verify:**

✅ **All 3 return instantly** with different positions:
- Tab 1: Position 1
- Tab 2: Position 2
- Tab 3: Position 3

✅ **Server does NOT crash**
✅ **All 3 tests execute** (one after another or parallel)
✅ **Check backend logs** - should show:
```
📋 Test abc queued as job test-abc-123 at position 1
📋 Test def queued as job test-def-456 at position 2
📋 Test ghi queued as job test-ghi-789 at position 3
🚀 [Job test-abc-123] Starting test execution
✅ [Job test-abc-123] Test execution completed: PASSED
🚀 [Job test-def-456] Starting test execution
...
```

✅ **All 3 complete successfully**

**Method 2: Using curl (Advanced)**

Open 3 Command Prompts and run simultaneously:

**Terminal 1:**
```batch
curl -X POST http://localhost:3002/api/execution/test/YOUR_TEST_ID/run ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Terminal 2 & 3:** Same command, run immediately

---

### STEP 6: Test Queue Monitoring Endpoints (New Features)

**Check queue status:**
```batch
curl http://localhost:3002/api/execution/queue/status ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "queue": {
    "waiting": 0,
    "active": 1,
    "completed": 5,
    "failed": 0,
    "delayed": 0,
    "paused": 0
  }
}
```

**Check specific job status:**
```batch
curl http://localhost:3002/api/execution/job/YOUR_JOB_ID ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "job": {
    "jobId": "test-abc123-1234567890",
    "testId": "abc123",
    "state": "completed",
    "progress": 100,
    "attempts": 1,
    "createdAt": "2025-12-12T18:00:00.000Z",
    "finishedOn": "2025-12-12T18:00:30.000Z"
  }
}
```

---

### STEP 7: Test Auto-Retry Mechanism (C1.1 Requirement 3)

**This tests "Failed jobs automatically retry 3 times"**

**How to force a test to fail:**
1. Create a test with a selector that doesn't exist: `#nonexistent-element-12345`
2. Run the test
3. Watch backend logs

**What to verify:**

✅ **Job attempts 3 times** before final failure:
```
🚀 [Job test-abc-123] Starting test execution (Attempt 1/3)
❌ [Job test-abc-123] Test execution failed: Element not found
🔄 Retrying job test-abc-123 (Attempt 2/3) in 2 seconds...
🚀 [Job test-abc-123] Starting test execution (Attempt 2/3)
❌ [Job test-abc-123] Test execution failed: Element not found
🔄 Retrying job test-abc-123 (Attempt 3/3) in 4 seconds...
🚀 [Job test-abc-123] Starting test execution (Attempt 3/3)
❌ [Job test-abc-123] Test execution failed: Element not found
🚫 Job test-abc-123 failed permanently after 3 attempts
```

✅ **Exponential backoff**: 2s delay, then 4s delay, then 8s delay
✅ **Final state is "failed"** after 3 attempts

---

## 🎯 DEFINITION OF DONE - VERIFICATION CHECKLIST

### C0.2: Refactor Execution Service

- [ ] Test execution returns `200 OK` with `{ success: true/false }`
- [ ] Failed tests return `200 OK` (not 500) with error message
- [ ] Network tab shows 200 status for all test executions

### C1.1: BullMQ Job Queue

- [ ] Clicking "Run Test" returns immediately with "Queued (Pos 1)"
- [ ] Server does NOT crash when 10 tests started simultaneously
- [ ] Failed jobs automatically retry 3 times
- [ ] Queue status endpoint works
- [ ] Job status endpoint works
- [ ] Backend logs show job processing messages

---

## ❌ TROUBLESHOOTING

### Problem: "Redis connection refused"

**Solution:**
```batch
docker ps | findstr redis
# If Redis not running:
docker-compose up -d redis
docker-compose restart backend
```

### Problem: "500 Internal Server Error"

**Check:**
1. Backend logs: `docker-compose logs backend | findstr ERROR`
2. Redis running: `docker ps | findstr redis`
3. Queue registered: Look for "Queue processor registered" in logs

**Solution:**
```batch
docker-compose restart backend
```

### Problem: "Jobs not processing"

**Check:**
1. Redis is healthy: `docker exec nomation-redis redis-cli ping` (should return PONG)
2. Backend connected to Redis: Check backend logs for connection messages
3. Queue has jobs: `curl http://localhost:3002/api/execution/queue/status`

**Solution:**
```batch
# Restart Redis and backend
docker-compose restart redis backend
```

### Problem: "Tests still return 500 error"

**This means C0.2 fix didn't work.**

**Check:**
1. Run: `docker-compose exec backend cat src/execution/execution.controller.ts | grep "@HttpCode"`
2. Should see: `@HttpCode(HttpStatus.OK)`
3. If not, backend needs rebuild

**Solution:**
```batch
scripts\windows\restart.bat
```

---

## 📊 SUCCESS CRITERIA

**ALL GREEN = Ready for Production**

✅ Backend starts without errors
✅ Redis connected and healthy
✅ Single test execution works
✅ 3 concurrent tests work (no crash)
✅ All tests return 200 OK (never 500)
✅ Queue status shows active jobs
✅ Job status tracking works
✅ Failed tests retry 3 times
✅ WebSocket progress updates work

---

## 📝 WHAT TO REPORT BACK

Please test and tell me:

1. **Did restart.bat work?**
   - "Yes, all services started"
   - Or: "Error: [describe error]"

2. **Did single test execution work?**
   - "Yes, got jobId and position"
   - Or: "Error: Still getting 500"

3. **Did concurrent execution work?**
   - "Yes, ran 3 tests simultaneously, no crash"
   - Or: "Server crashed after 2 tests"

4. **Did auto-retry work?**
   - "Yes, saw 3 retry attempts in logs"
   - Or: "No retries, failed immediately"

5. **Any errors in logs?**
   - Copy and paste any ERROR messages from `docker-compose logs backend`

---

## 🔄 NEXT STEPS AFTER TESTING

**If all tests pass:**
- ✅ C0.1, C0.2, C1.1 are COMPLETE
- ✅ Ready to move to C1.2 (Anchor-Based Selectors)
- ✅ Update Master Plan status

**If any tests fail:**
- I will debug and fix immediately
- Provide me with error logs
- We'll iterate until all green

---

**Good luck with testing! Let me know results! 🚀**
