# Restart.bat Migration Command Fix
Date: 2026-01-06
Status: ✅ Fixed

## Problem
The `restart.bat` file was using `npx prisma db push` instead of `npx prisma migrate deploy` for applying database migrations in production.

## Why This Matters
- **`db push`** is for development only (syncs schema without migration history)
- **`migrate deploy`** is for production (applies proper migration files created by GEMINI)
- Since GEMINI just created migration files like `20260103000000_add_user_settings`, we need to use `migrate deploy` to apply them correctly

## Fix Applied

**File**: `scripts/windows/restart.bat`

**Line 46 - BEFORE**:
```batch
docker-compose exec backend npx prisma db push 2>nul
```

**Line 46 - AFTER**:
```batch
docker-compose exec backend npx prisma migrate deploy 2>nul
```

## Impact
✅ Proper migrations now applied when using restart.bat
✅ Migration history tracked correctly
✅ Production-ready deployment process

## Verification
- [x] restart.bat updated
- [x] start.bat checked (no migration commands - OK)
- [x] rebuild-backend.bat checked (no migration commands - OK)

## Result
✅ All batch files now follow best practices for database migrations.
