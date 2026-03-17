#!/bin/bash
# Repository Cleanup Script - Safe Phase 1-3
# Run this from repo root: bash scripts/cleanup-repo.sh

set -e  # Exit on error

echo "🧹 Starting Repository Cleanup..."
echo ""

# ============================================================================
# PHASE 1: Build Artifacts (Zero Risk)
# ============================================================================
echo "📦 Phase 1: Removing build artifacts..."

# TypeScript error logs
if ls tsc*.txt 1> /dev/null 2>&1; then
    rm -f tsc_errors.txt tsc_new_errors.txt tsc_new_errors2.txt
    echo "  ✓ Deleted TypeScript error logs"
fi

# .turbo folders (not in node_modules)
find . -type d -name ".turbo" -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
echo "  ✓ Cleaned .turbo cache folders"

# Package dist folders
for pkg in packages/*/dist; do
    if [ -d "$pkg" ]; then
        rm -rf "$pkg"
        echo "  ✓ Cleaned $pkg"
    fi
done

# ============================================================================
# PHASE 2: Create Archive Structure
# ============================================================================
echo ""
echo "📁 Phase 2: Creating archive structure..."

mkdir -p scripts/archive/{migrations,one-time,converters,deprecated}
echo "  ✓ Created scripts/archive/ structure"

mkdir -p docs/{architecture,deployment,features,security,api}
echo "  ✓ Created docs/ structure"

# ============================================================================
# PHASE 3: Identify Candidates for Archiving
# ============================================================================
echo ""
echo "📋 Phase 3: Identifying files to review for archiving..."

# List converter scripts
echo ""
echo "Converter scripts (candidates for scripts/archive/converters/):"
ls -1 scripts/convert-*.mjs 2>/dev/null | head -5 || echo "  None found"

# List fix scripts  
echo ""
echo "Fix scripts (candidates for scripts/archive/one-time/):"
ls -1 scripts/fix-*.mjs 2>/dev/null | head -5 || echo "  None found"

# List backfill scripts
echo ""
echo "Backfill scripts (candidates for scripts/archive/migrations/):"
ls -1 scripts/backfill-*.ts 2>/dev/null | head -5 || echo "  None found"

# List documentation
echo ""
echo "Documentation files (candidates for docs/ subfolders):"
ls -1 *.md 2>/dev/null | grep -v "^README\|^CONTRIBUTING\|^LICENSE\|^CHANGELOG\|^SECURITY" | head -10 || echo "  None found"

echo ""
echo "✅ Phase 1 complete (artifacts deleted)"
echo "📁 Phase 2 complete (structure created)"
echo "👀 Phase 3 complete (candidates identified)"
echo ""
echo "Next steps:"
echo "  1. Review the candidates above"
echo "  2. Run: git status  # to see changes"
echo "  3. Manually move files to archive folders"
echo "  4. Commit: git add . && git commit -m 'chore: cleanup repo structure'"
