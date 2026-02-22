#!/bin/bash
# Hook 1: Auto-format with Prettier after every edit
# PostToolUse — Edit|Write
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Skip if no file path
[ -z "$file_path" ] && exit 0

# Only format source code files
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.scss|*.html)
    ;;
  *)
    exit 0
    ;;
esac

# Skip files outside frontend/backend (notes, configs, etc.)
case "$file_path" in
  */frontend/*|*/backend/*)
    ;;
  *)
    exit 0
    ;;
esac

# Skip if file doesn't exist (was deleted)
[ ! -f "$file_path" ] && exit 0

# Run prettier silently
npx prettier --write "$file_path" > /dev/null 2>&1 || true

exit 0
