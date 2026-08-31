#!/bin/bash
# Study RPG — Zero-Placeholder CI Gate
# Fails if source files contain TODO, FIXME, placeholder, coming soon,
# not implemented, lorem ipsum, or YOUR_API_KEY outside of allowlisted paths.
#
# Usage: sh scripts/check-no-placeholders.sh
# Exit 0 = clean, Exit 1 = placeholders found

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Patterns to search for (case-insensitive)
PATTERNS="TODO|FIXME|placeholder|coming soon|not implemented|lorem ipsum|YOUR_API_KEY"

# Directories to search
SEARCH_DIRS=("backend/src" "frontend/src")

# Files/dirs to skip (lock files, generated, archive, specs, docs)
SKIP_DIRS="node_modules|dist|build|\.git|archive|specs|\.specify|coverage|\.aider"

HITS=0

for dir in "${SEARCH_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    continue
  fi

  # Search for patterns, exclude lock files, generated files, and allowlisted paths
  RESULTS=$(grep -rn -i -E "$PATTERNS" "$dir" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    --include='*.sql' --include='*.json' \
    2>/dev/null \
    | grep -v "node_modules" \
    | grep -v "dist/" \
    | grep -v "build/" \
    | grep -v "\.spec\." \
    | grep -v "\.test\." \
    | grep -v "_generated" \
    | grep -v "package-lock" \
    | grep -v "archive/" \
    | grep -v "specs/" \
    || true)

  if [ -n "$RESULTS" ]; then
    echo -e "${RED}Placeholders found in $dir:${NC}"
    echo "$RESULTS"
    HITS=$((HITS + 1))
  fi
done

# Also check root-level docs (excluding archive, specs, docs/audits)
DOC_HITS=$(grep -rn -i -E "placeholder|coming soon|not implemented" \
  SECURITY.md AGENTS.md CONTRIBUTING.md README.md \
  2>/dev/null \
  | grep -v "archive/" \
  || true)

if [ -n "$DOC_HITS" ]; then
  echo -e "${RED}Placeholders found in docs:${NC}"
  echo "$DOC_HITS"
  HITS=$((HITS + 1))
fi

if [ "$HITS" -eq 0 ]; then
  echo -e "${GREEN}✓ Zero placeholders found${NC}"
  exit 0
else
  echo -e "${RED}✗ $HITS file(s) contain placeholders — fix before merging${NC}"
  exit 1
fi
