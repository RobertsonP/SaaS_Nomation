#!/bin/bash
# Hook 2: TypeScript type-check after every edit
# PostToolUse — Edit|Write
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Skip if no file path
[ -z "$file_path" ] && exit 0

# Only check TypeScript files
case "$file_path" in
  *.ts|*.tsx)
    ;;
  *)
    exit 0
    ;;
esac

# Skip if file doesn't exist
[ ! -f "$file_path" ] && exit 0

# Determine which tsconfig to use based on path
if echo "$file_path" | grep -q "frontend/"; then
  tsconfig_dir=$(echo "$file_path" | sed 's|/frontend/.*|/frontend|')
elif echo "$file_path" | grep -q "backend/"; then
  tsconfig_dir=$(echo "$file_path" | sed 's|/backend/.*|/backend|')
else
  exit 0
fi

# Run tsc --noEmit from the correct directory
cd "$tsconfig_dir"
npx tsc --noEmit 2>&1 | head -20 || {
  echo "TypeScript errors found after editing $file_path" >&2
  exit 2
}

exit 0
