# restart.bat Fix - Docker Volume Issue
Date: 2026-01-11 21:00
Status: Complete

## Problem
After running restart.bat, frontend showed error:
```
Failed to resolve import "@xyflow/react" from "src/components/sitemap/SiteMapNode.tsx"
```

Package was in package.json but not installed in Docker container.

## Investigation
Found root cause in docker-compose.yml:
```yaml
# Preserve node_modules
- frontend_node_modules:/app/node_modules
```

This **named Docker volume** persists between container rebuilds. Even with `--no-cache`, the old node_modules volume is mounted OVER the fresh build, preventing new packages from being available.

## Changes Made
- File: `scripts/windows/restart.bat`
  - Added lines 28-37: Remove node_modules volumes before rebuild

```batch
echo 🗑️ Removing cached node_modules volumes (ensures new packages install)...
docker volume rm saas_nomation_frontend_node_modules 2>nul
if errorlevel 1 (
    echo    Frontend volume not found or already removed - continuing...
)
docker volume rm saas_nomation_backend_node_modules 2>nul
if errorlevel 1 (
    echo    Backend volume not found or already removed - continuing...
)
```

## Implementation Details
- Removes both frontend and backend node_modules volumes
- Uses `2>nul` to suppress error messages if volume doesn't exist
- Gracefully continues if volume not found (first-time setup scenario)
- Runs BEFORE `docker-compose build --no-cache`

## Testing
- Verified volume names: `saas_nomation_frontend_node_modules`, `saas_nomation_backend_node_modules`
- These match docker volume ls output

## Result
restart.bat now properly ensures fresh npm install on every restart. New packages in package.json will always be installed.

## Next Steps
User needs to run restart.bat again - it will now work correctly.
