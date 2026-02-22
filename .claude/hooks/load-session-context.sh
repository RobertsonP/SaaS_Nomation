#!/bin/bash
# Hook 9: Load session context on start
# SessionStart — *
set -euo pipefail

project_dir="$CLAUDE_PROJECT_DIR"

echo "=== Session Context ==="

# Find and display latest active-work.md
latest_active=$(find "$project_dir/notes" -name "active-work.md" -type f 2>/dev/null | sort -r | head -1)
if [ -n "$latest_active" ]; then
  echo ""
  echo "--- Active Work ($(basename $(dirname "$latest_active"))) ---"
  cat "$latest_active"
fi

# Find and display latest handoff.md
latest_handoff=$(find "$project_dir/notes" -name "handoff.md" -type f 2>/dev/null | sort -r | head -1)
if [ -n "$latest_handoff" ]; then
  echo ""
  echo "--- Last Handoff ($(basename $(dirname "$latest_handoff"))) ---"
  cat "$latest_handoff"
fi

# Show today's notes if they exist
today=$(date +%Y-%m-%d)
today_dir="$project_dir/notes/$today"
if [ -d "$today_dir" ]; then
  echo ""
  echo "--- Today's Notes ($today) ---"
  for note in "$today_dir"/*.md; do
    [ -f "$note" ] && echo "  - $(basename "$note")"
  done
fi

echo ""
echo "=== End Session Context ==="
exit 0
