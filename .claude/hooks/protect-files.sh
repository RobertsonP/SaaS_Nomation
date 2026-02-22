#!/bin/bash
# Hook 5: Protect sensitive files from accidental edits
# PreToolUse — Edit|Write
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Skip if no file path
[ -z "$file_path" ] && exit 0

# Normalize path for matching
normalized=$(echo "$file_path" | sed 's|\\|/|g')

# Block patterns
blocked=false
reason=""

case "$normalized" in
  *.env|*.env.*)
    blocked=true
    reason=".env files contain secrets — edit manually"
    ;;
  */package-lock.json)
    blocked=true
    reason="package-lock.json is auto-generated — use npm install instead"
    ;;
  */prisma/migrations/*)
    blocked=true
    reason="Prisma migrations are auto-generated — use npx prisma migrate dev"
    ;;
  */.git/*)
    blocked=true
    reason=".git internals should never be edited directly"
    ;;
  */docker-compose.yml|*/docker-compose.yaml)
    blocked=true
    reason="docker-compose.yml changes need deliberate review — discuss first"
    ;;
esac

if [ "$blocked" = true ]; then
  echo "BLOCKED: $reason" >&2
  echo "File: $file_path" >&2
  exit 2
fi

exit 0
