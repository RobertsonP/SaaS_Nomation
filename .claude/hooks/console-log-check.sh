#!/bin/bash
# Hook 3: Detect console.log statements in edited files
# PostToolUse — Edit|Write
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Skip if no file path
[ -z "$file_path" ] && exit 0

# Only check source code files
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx)
    ;;
  *)
    exit 0
    ;;
esac

# Skip if file doesn't exist
[ ! -f "$file_path" ] && exit 0

# Skip test files — console.log is acceptable there
case "$file_path" in
  *.test.*|*.spec.*|*__tests__*)
    exit 0
    ;;
esac

# Check for console.log statements
if grep -n "console\.log" "$file_path" > /dev/null 2>&1; then
  count=$(grep -c "console\.log" "$file_path")
  lines=$(grep -n "console\.log" "$file_path" | head -5)
  echo "WARNING: Found $count console.log statement(s) in $file_path:" >&2
  echo "$lines" >&2
  echo "Remove debug statements before committing." >&2
  # Exit 2 = feed warning back to Claude, but don't hard-block
  exit 2
fi

exit 0
