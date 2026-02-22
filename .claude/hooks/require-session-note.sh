#!/bin/bash
# Hook 7: Require session note before code edits
# PreToolUse — Edit|Write
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Skip if no file path
[ -z "$file_path" ] && exit 0

# Normalize path
normalized=$(echo "$file_path" | sed 's|\\|/|g')

# Always allow edits to notes, CLAUDE files, .claude config, and memory
case "$normalized" in
  */notes/*|*CLAUDE*|*/.claude/*|*/memory/*)
    exit 0
    ;;
esac

# Check if today's notes directory has any .md files
today=$(date +%Y-%m-%d)
notes_dir="$CLAUDE_PROJECT_DIR/notes/$today"

if [ ! -d "$notes_dir" ]; then
  echo "BLOCKED: No session note found for today ($today)." >&2
  echo "Create a note first: notes/$today/01-your-task-name.md" >&2
  echo "Document your plan before writing code." >&2
  exit 2
fi

# Check if there's at least one .md file in today's notes
md_count=$(find "$notes_dir" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)

if [ "$md_count" -eq 0 ]; then
  echo "BLOCKED: No session note found for today ($today)." >&2
  echo "Create a note first: notes/$today/01-your-task-name.md" >&2
  echo "Document your plan before writing code." >&2
  exit 2
fi

exit 0
