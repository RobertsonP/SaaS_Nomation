#!/bin/bash
# Hook 6: Prevent secrets from entering git
# PreToolUse — Bash (filtered to git commands)
set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# Only check git add and git commit commands
case "$command" in
  *"git add"*|*"git commit"*)
    ;;
  *)
    exit 0
    ;;
esac

cd "$CLAUDE_PROJECT_DIR"

# Check for dangerous file patterns in staged files
staged_files=$(git diff --cached --name-only 2>/dev/null || echo "")

if [ -z "$staged_files" ]; then
  # If running git add, check what would be added
  if echo "$command" | grep -q "git add"; then
    # Let git add proceed, the commit check will catch issues
    exit 0
  fi
  exit 0
fi

# Block sensitive file patterns
blocked_file=""
while IFS= read -r file; do
  case "$file" in
    .env|.env.*|*.env)
      blocked_file="$file"
      break
      ;;
    CLAUDE.local.md|*/CLAUDE.local.md)
      blocked_file="$file"
      break
      ;;
    *credentials*|*secrets*|*.pem|*.key)
      blocked_file="$file"
      break
      ;;
  esac
done <<< "$staged_files"

if [ -n "$blocked_file" ]; then
  echo "BLOCKED: Sensitive file staged for commit: $blocked_file" >&2
  echo "Run: git reset HEAD $blocked_file" >&2
  exit 2
fi

# Scan staged file contents for credential patterns
for file in $staged_files; do
  [ ! -f "$file" ] && continue

  # Only scan text files
  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.yml|*.yaml|*.md|*.sh)
      ;;
    *)
      continue
      ;;
  esac

  # Check for hardcoded secrets (common patterns)
  if git diff --cached "$file" 2>/dev/null | grep -iE '(password|api_key|apikey|secret_key|private_key|access_token)\s*[:=]\s*["\x27][^"\x27]{8,}' > /dev/null 2>&1; then
    echo "BLOCKED: Potential hardcoded secret found in staged file: $file" >&2
    echo "Review the file and remove credentials before committing." >&2
    exit 2
  fi
done

exit 0
