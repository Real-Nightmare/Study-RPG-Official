#!/bin/sh
# Study RPG — repo hygiene gate (completion plan §4 + T11).
#
# Fails the build when shippable files contain:
#   - upstream brand strings ("studyield", case-insensitive)
#   - stub markers: TODO / FIXME / "coming soon" / "not implemented" /
#     "lorem ipsum" / YOUR_API_KEY / placeholder (outside legitimate uses)
#
# Allowlist policy lives inline below; every entry carries a justification.
# Provenance/licence docs that legitimately reference the upstream project
# (UPSTREAM.md, NOTICE, THIRD_PARTY_NOTICES, CHANGELOG, docs/, specs/,
# .specify/) stay allowlisted until rewrite batch B10 removes them.

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

# ---------------------------------------------------------------------------
# 1) Rebrand gate — no "studyield" outside provenance/licence documentation.
#    Allowlisted entries (justifications):
#      UPSTREAM.md / NOTICE / THIRD_PARTY_NOTICES.md — upstream provenance
#        required by the licence audit until rewrite batch B10 removes them.
#      CHANGELOG.md / IMPLEMENTATION_STATUS.md — historical trackers that
#        reference the upstream project by name in past-tense records.
#      AGENTS.md / README.md — describe the fork's origin for contributors.
#      check-hygiene.sh — this gate's own pattern text.
# ---------------------------------------------------------------------------
BRAND_ALLOWLIST="
UPSTREAM.md
NOTICE
THIRD_PARTY_NOTICES.md
CHANGELOG.md
AGENTS.md
README.md
IMPLEMENTATION_STATUS.md
check-hygiene.sh
"
BRAND_PATH_EXCLUDES="\
-name node_modules -prune -o \
-name .git -prune -o \
-name archive -prune -o \
-name dist -prune -o \
-name coverage -prune -o \
-path ./docs/* -prune -o \
-path ./specs/* -prune -o \
-path ./.specify/* -prune -o \
-path ./backend/node_modules/* -prune -o \
"

brand_hits=$(grep -rniI "studyield" . \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=archive \
    --exclude-dir=dist --exclude-dir=coverage --exclude-dir=.specify \
    --exclude=package-lock.json --exclude-dir=docs --exclude-dir=specs \
    2>/dev/null || true)

while IFS= read -r line; do
    [ -z "$line" ] && continue
    file=${line%%:*}
    base=$(basename "$file")
    if printf '%s\n' "$BRAND_ALLOWLIST" | grep -qx "$base"; then
        continue
    fi
    echo "REBRAND VIOLATION: $line"
    fail=1
done <<EOF
$brand_hits
EOF

# ---------------------------------------------------------------------------
# 2) Stub markers in source. This file is excluded (it contains the patterns).
#
# Legitimate uses of the word "placeholder" are filtered out:
#   - HTML/React attributes:  placeholder="…" / placeholder={…}
#   - i18n JSON keys:         "placeholder": "<input hint>"
#   - TypeScript identifiers: placeholder?: string / { value, placeholder }
#   - Tailwind variants:      placeholder:text-muted-foreground
#   - PascalCase component/type names containing Placeholder
# ---------------------------------------------------------------------------
stub_hits=$(grep -rnE \
    "TODO|FIXME|[Cc]oming [Ss]oon|not implemented|lorem ipsum|YOUR_API_KEY|placeholder" \
    backend/src frontend/src backend/scripts scripts backend/migrations \
    docker --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
    --include='*.py' --include='*.sql' --include='*.yml' --include='*.yaml' \
    --include='Dockerfile' --include='*.sh' --include='*.json' \
    2>/dev/null \
  | grep -v "^scripts/check-hygiene.sh" \
  | grep -vE 'placeholder\??["'"'"']?[[:space:]]*[=:]' \
  | grep -vE 'placeholder\??[,})]' \
  | grep -vE '[,{(] ?placeholder ?' \
  | grep -viE 'placeholder[a-z_-]*-(text|block|opacity)|placeholder-[a-z]' \
  | grep -v "Placeholder" || true)

while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "STUB MARKER: $line"
    fail=1
done <<EOF
$stub_hits
EOF

if [ "$fail" -ne 0 ]; then
    echo ""
    echo "✖ Hygiene gate failed — fix the violations above or extend"
    echo "  scripts/check-hygiene.sh's allowlist WITH a justification."
    exit 1
fi

echo "✔ Hygiene gate passed: no upstream brand strings, no stub markers."
