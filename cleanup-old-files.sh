#!/bin/bash
# Script to clean up old token system files from OAuth-only repository
# Generated: 2025-12-17

set -e  # Exit on error

echo "🧹 Starting cleanup of old token system files..."
echo ""

# Track statistics
deleted_count=0
total_size=0

# Function to safely delete file/directory
safe_delete() {
    local path="$1"
    if [ -e "$path" ]; then
        # Get size before deletion
        if [ -f "$path" ]; then
            size=$(du -k "$path" | cut -f1)
            total_size=$((total_size + size))
        elif [ -d "$path" ]; then
            size=$(du -sk "$path" | cut -f1)
            total_size=$((total_size + size))
        fi

        rm -rf "$path"
        deleted_count=$((deleted_count + 1))
        echo "✅ Deleted: $path"
    else
        echo "⏭️  Skipped (not found): $path"
    fi
}

# 1. CRITICAL - Delete database backup
echo "🔴 [CRITICAL] Removing database backup..."
safe_delete "backup-20251217.sql"
echo ""

# 2. Delete old documentation
echo "🟡 [DOCS] Removing old token system documentation..."
safe_delete "business_goal.md"
safe_delete "OAUTH_2.1_IMPLEMENTATION_PLAN.md"
safe_delete "PHASE_1_OAUTH_PKCE_REPORT.md"
safe_delete "API_KEYS_IMPLEMENTATION_SUMMARY.md"
safe_delete "account_deletions"
echo ""

# 3. Delete obsolete migrations (0001-0011)
echo "🟡 [MIGRATIONS] Removing obsolete migrations (0001-0011)..."
safe_delete "migrations/0001_init_schema.sql"
safe_delete "migrations/0002_add_unique_stripe_payment_id.sql"
safe_delete "migrations/0003_add_balance_check_constraint.sql"
safe_delete "migrations/0004_add_account_deletion_support.sql"
safe_delete "migrations/0005_add_idempotency_and_reconciliation.sql"
safe_delete "migrations/0006_track_stripe_deletion.sql"
safe_delete "migrations/0007_track_mcp_anonymization.sql"
safe_delete "migrations/0008_hash_email_in_deletions.sql"
safe_delete "migrations/0009_track_failed_deductions_cleanup.sql"
safe_delete "migrations/0010_track_no_refund_acknowledgment.sql"
safe_delete "migrations/0011_track_pending_checkouts.sql"
echo ""

# 4. Delete old tests
echo "🟢 [TESTS] Removing old token/Stripe tests..."
safe_delete "pre_testing/account-deletion"
safe_delete "tests/test-real-checkout.js"
safe_delete "tests/test-webhook-flow.mjs"
safe_delete "tests/verify-and-rotate-webhook.mjs"
safe_delete "tests/test-dashboard.sh"
safe_delete "tests/test-report.json"
echo ""

# 5. Delete scripts directory
echo "🟢 [SCRIPTS] Removing ad-hoc scripts..."
safe_delete "scripts"
echo ""

# 6. Delete backup files
echo "🔵 [BACKUP] Removing temporary backup files..."
safe_delete "src/index.ts.new"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Cleanup Complete!"
echo ""
echo "📊 Statistics:"
echo "   Files/directories deleted: $deleted_count"
echo "   Disk space freed: ~$((total_size / 1024)) MB"
echo ""
echo "✅ Remaining files (OAuth system):"
echo "   📁 migrations/: 4 files (0012, 0014, 0015, 0016)"
echo "   📁 pre_testing/: oauth/, api-keys/, authentication/"
echo "   📁 tests/: test-auth-setup.js, test-endpoints.js"
echo "   📁 docs/: OAUTH_2.1_MIGRATION_GUIDE.md"
echo "   📁 guides/: CLOUDFLARE_ACCESS_SETUP.md, WORKOS_AUTHKIT_IMPLEMENTATION.md"
echo "   📄 CLAUDE.md"
echo ""
echo "🎉 Repository is now clean and OAuth-focused!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
