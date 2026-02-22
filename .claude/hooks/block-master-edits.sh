#!/bin/bash
# Hook 4: Block file edits on master branch
# PreToolUse — Edit|Write
set -euo pipefail

# Read stdin (required even if not used)
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Allow edits to notes, CLAUDE files, and .claude config — always OK
case "$file_path" in
  */notes/*|*CLAUDE*|*/.claude/*)
    exit 0
    ;;
esac

# Check current branch
current_branch=$(git -C "$CLAUDE_PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")

if [ "$current_branch" = "master" ] || [ "$current_branch" = "main" ]; then
  echo "BLOCKED: Cannot edit source files on '$current_branch' branch." >&2
  echo "Create a feature branch first: git checkout -b feature/your-feature" >&2
  exit 2
fi

exit 0
