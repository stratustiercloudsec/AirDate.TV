#!/bin/bash
# remove_ai_labels.sh — strips display instances of "AI" from AirDate React source files
# Usage: bash remove_ai_labels.sh [path/to/src]   (defaults to ./src)

TARGET="${1:-./src}"

echo "🔍 Scanning: $TARGET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Patterns to replace — UI label strings only (not code identifiers like useState, API_BASE etc.)
# We target quoted strings and JSX text nodes, not variable names or import paths.

REPLACEMENTS=(
  # "AI Intel" → "Intel"
  's/"AI Intel"/"Intel"/g'
  "s/>AI Intel</>Intel</g"
  # "AI-Enhanced Recap" → "Enhanced Recap"
  's/"AI-Enhanced Recap"/"Enhanced Recap"/g'
  "s/>AI-Enhanced Recap</>Enhanced Recap</g"
  # "AI Intel" in tracking-widest spans (JSX text)
  's/AI Intel/Intel/g'
  # "AI-Enhanced Recap" bare text
  's/AI-Enhanced Recap/Enhanced Recap/g'
  # Generic: remove " AI " prefix in display strings inside JSX text nodes
  # Careful: only matches word-boundary AI, not "API", "TRAIL", etc.
  's/\bAI\b //g'
)

FILES_CHANGED=0

while IFS= read -r -d '' file; do
  ORIG=$(cat "$file")
  UPDATED="$ORIG"

  for pattern in "${REPLACEMENTS[@]}"; do
    UPDATED=$(echo "$UPDATED" | sed "$pattern")
  done

  if [ "$ORIG" != "$UPDATED" ]; then
    echo "✏️  $file"
    echo "$UPDATED" > "$file"
    FILES_CHANGED=$((FILES_CHANGED + 1))
  fi
done < <(find "$TARGET" -type f \( -name "*.jsx" -o -name "*.tsx" -o -name "*.js" -o -name "*.ts" \) -print0)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Done — $FILES_CHANGED file(s) updated"
