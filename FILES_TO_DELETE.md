# Files Safe to Delete from OAuth-Provider Repository

## Analysis Summary
This repository was refactored from a token-based payment system to OAuth-only authentication.
Many files remain from the old system and are no longer needed.

---

## 🔴 CRITICAL - DELETE IMMEDIATELY

### 1. Database Backup (Contains Production Data)
```
backup-20251217.sql  (1.3MB - contains user data, should NOT be in repo)
```
**Reason:** Contains actual production database with user emails and sensitive data

---

## 🟡 HIGHLY RECOMMENDED - Delete Old System Documentation

### 2. Token System Documentation (Obsolete)
```
business_goal.md                              (138KB - documents old token payment system)
OAUTH_2.1_IMPLEMENTATION_PLAN.md             (26KB - migration plan, already completed)
PHASE_1_OAUTH_PKCE_REPORT.md                 (36KB - implementation report, archived info)
API_KEYS_IMPLEMENTATION_SUMMARY.md           (13KB - summary of completed work)
```
**Reason:** These document the OLD token-based system with Stripe payments, not the current OAuth-only system

### 3. Account Deletion Documentation (Old Token System)
```
account_deletions/ACCOUNT_DELETION.md                          (23KB)
account_deletions/ACCOUNT_DELETION_REPORT.md                   (42KB)
account_deletions/ACCOUNT_DELETION_ISSUES_ANALYSIS.md          (58KB)
account_deletions/ACCOUNT_DELETION_ISSUES_ANALYSIS_UPDATED.md  (20KB)
```
**Reason:** Documents account deletion WITH token forfeiture and Stripe cleanup - no longer relevant

**ENTIRE DIRECTORY:** `account_deletions/` can be deleted

---

## 🟡 HIGHLY RECOMMENDED - Delete Old Migrations

### 4. Obsolete Migration Files (Token System)
```
migrations/0001_init_schema.sql                      (creates transactions, mcp_actions tables)
migrations/0002_add_unique_stripe_payment_id.sql     (Stripe payment idempotency)
migrations/0003_add_balance_check_constraint.sql     (token balance validation)
migrations/0004_add_account_deletion_support.sql     (token forfeiture tracking)
migrations/0005_add_idempotency_and_reconciliation.sql (failed_deductions table)
migrations/0006_track_stripe_deletion.sql            (Stripe customer deletion)
migrations/0007_track_mcp_anonymization.sql          (mcp_actions anonymization)
migrations/0008_hash_email_in_deletions.sql          (deletion audit)
migrations/0009_track_failed_deductions_cleanup.sql  (reconciliation)
migrations/0010_track_no_refund_acknowledgment.sql   (payment refund policy)
migrations/0011_track_pending_checkouts.sql          (Stripe checkout tracking)
```

**KEEP ONLY:**
```
migrations/0012_add_api_keys_table.sql       (✅ KEEP - OAuth API keys)
migrations/0014_drop_transaction_tables.sql  (✅ KEEP - cleanup migration)
migrations/0015_drop_failed_deductions.sql   (✅ KEEP - cleanup migration)
migrations/0016_remove_token_columns.sql     (✅ KEEP - final schema)
```

**Reason:** Migrations 0001-0011 create token/Stripe tables that were later deleted by migrations 0014-0016

---

## 🟢 RECOMMENDED - Delete Old Tests

### 5. Token System Tests (No Longer Valid)
```
pre_testing/account-deletion/A6.1-data-anonymization.test.ts
pre_testing/account-deletion/A6.2-audit-trail-creation.test.ts
pre_testing/account-deletion/A6.3-mcp-actions-anonymization.test.ts
pre_testing/account-deletion/A6.4-failed-deductions-cleanup.test.ts
pre_testing/account-deletion/A6.6-no-refund-acknowledgment.test.ts
```
**Reason:** Test account deletion WITH Stripe/token cleanup - tables no longer exist

**ENTIRE DIRECTORY:** `pre_testing/account-deletion/` can be deleted

### 6. Old Integration Tests (Stripe/Checkout)
```
tests/test-real-checkout.js       (tests Stripe checkout flow)
tests/test-webhook-flow.mjs       (tests Stripe webhooks)
tests/verify-and-rotate-webhook.mjs (Stripe webhook management)
tests/test-dashboard.sh           (tests token balance display)
tests/test-report.json            (old test results)
```

**KEEP:**
```
tests/test-auth-setup.js          (✅ KEEP - auth setup)
tests/test-endpoints.js           (✅ KEEP - OAuth endpoints)
```

---

## 🟢 RECOMMENDED - Delete Old Scripts

### 7. API Key Testing Scripts (Redundant)
```
scripts/test-api-keys.mjs         (API key testing - use proper tests instead)
scripts/test-apikey-syntax.mjs    (syntax validation - redundant)
```
**Reason:** These are ad-hoc scripts; should use proper test suite instead

**ENTIRE DIRECTORY:** `scripts/` can be deleted (contains only 2 files)

---

## 🔵 OPTIONAL - Delete Backup Files

### 8. Backup/Temporary Files
```
src/index.ts.new                  (backup file from refactoring)
```
**Reason:** Temporary backup file, no longer needed

---

## 🟢 RECOMMENDED - Keep (OAuth System Files)

### Documentation (KEEP)
```
✅ CLAUDE.md                                    (project guide for Claude Code)
✅ docs/OAUTH_2.1_MIGRATION_GUIDE.md           (OAuth 2.1 compliance guide)
✅ guides/CLOUDFLARE_ACCESS_SETUP.md           (Cloudflare Access setup)
✅ guides/WORKOS_AUTHKIT_IMPLEMENTATION.md     (WorkOS integration)
```

### Tests (KEEP - OAuth/Auth related)
```
✅ pre_testing/oauth/A4.1-oauth-token-validation.test.ts
✅ pre_testing/oauth/A4.2-pkce-validation.test.ts
✅ pre_testing/api-keys/A7.1-oauth-apikey-same-user.test.ts
✅ pre_testing/authentication/A3.1-session-validation.test.ts
✅ pre_testing/authentication/A3.2-session-token-extraction.test.ts
✅ pre_testing/authentication/A3.3-user-creation-first-login.test.ts
```

### Migrations (KEEP - Final schema)
```
✅ migrations/0012_add_api_keys_table.sql
✅ migrations/0014_drop_transaction_tables.sql
✅ migrations/0015_drop_failed_deductions.sql
✅ migrations/0016_remove_token_columns.sql
```

---

## Summary Statistics

**Total Files to Delete:** ~30 files
**Total Size to Remove:** ~1.8 MB
**Directories to Delete:** 2 (account_deletions/, scripts/)

**Priority Breakdown:**
- 🔴 Critical (security): 1 file (backup-20251217.sql)
- 🟡 Highly Recommended: 19 files (old docs + old migrations)
- 🟢 Recommended: 9 files (old tests + scripts)
- 🔵 Optional: 1 file (backup)

---

## Deletion Commands

### Safe Deletion (All Recommended)
```bash
# Critical - Remove database backup
rm backup-20251217.sql

# Remove old documentation
rm business_goal.md
rm OAUTH_2.1_IMPLEMENTATION_PLAN.md
rm PHASE_1_OAUTH_PKCE_REPORT.md
rm API_KEYS_IMPLEMENTATION_SUMMARY.md
rm -rf account_deletions/

# Remove obsolete migrations (0001-0011)
rm migrations/0001_init_schema.sql
rm migrations/0002_add_unique_stripe_payment_id.sql
rm migrations/0003_add_balance_check_constraint.sql
rm migrations/0004_add_account_deletion_support.sql
rm migrations/0005_add_idempotency_and_reconciliation.sql
rm migrations/0006_track_stripe_deletion.sql
rm migrations/0007_track_mcp_anonymization.sql
rm migrations/0008_hash_email_in_deletions.sql
rm migrations/0009_track_failed_deductions_cleanup.sql
rm migrations/0010_track_no_refund_acknowledgment.sql
rm migrations/0011_track_pending_checkouts.sql

# Remove old tests
rm -rf pre_testing/account-deletion/

# Remove old integration tests
rm tests/test-real-checkout.js
rm tests/test-webhook-flow.mjs
rm tests/verify-and-rotate-webhook.mjs
rm tests/test-dashboard.sh
rm tests/test-report.json

# Remove scripts directory
rm -rf scripts/

# Remove backup file
rm src/index.ts.new
```

### Verification
```bash
# After deletion, verify remaining structure
ls -la migrations/     # Should show only: 0012, 0014, 0015, 0016
ls -la tests/          # Should show only: test-auth-setup.js, test-endpoints.js
ls -la pre_testing/    # Should show: oauth/, api-keys/, authentication/
```

---

## What Remains (Clean OAuth System)

**Documentation:**
- CLAUDE.md (project guide)
- docs/OAUTH_2.1_MIGRATION_GUIDE.md
- guides/CLOUDFLARE_ACCESS_SETUP.md
- guides/WORKOS_AUTHKIT_IMPLEMENTATION.md

**Migrations (Final Schema):**
- 0012_add_api_keys_table.sql
- 0014_drop_transaction_tables.sql
- 0015_drop_failed_deductions.sql
- 0016_remove_token_columns.sql

**Tests (OAuth/Auth):**
- pre_testing/oauth/
- pre_testing/api-keys/
- pre_testing/authentication/
- tests/test-auth-setup.js
- tests/test-endpoints.js

**Source Code:**
- src/ (all OAuth-only implementation)
- public/ (logo assets)
- legal/ (privacy/terms)
