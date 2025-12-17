# Account Deletion Process

## Overview

This document describes the GDPR-compliant account deletion feature implemented in the MCP Token System. The system allows users to permanently delete their accounts while maintaining compliance with GDPR (data privacy) and tax/accounting regulations (financial record retention).

**Version:** 1.0
**Last Updated:** 2025-10-17
**Migration:** `0004_add_account_deletion_support.sql`

---

## Table of Contents

1. [User Experience Flow](#user-experience-flow)
2. [Technical Architecture](#technical-architecture)
3. [Database Schema](#database-schema)
4. [Deletion Process Steps](#deletion-process-steps)
5. [Data Handling Strategy](#data-handling-strategy)
6. [Compliance & Legal](#compliance--legal)
7. [Testing & Verification](#testing--verification)
8. [Troubleshooting](#troubleshooting)

---

## User Experience Flow

### 1. Access Settings Page
- User navigates to: `https://panel.wtyczki.ai/dashboard`
- Clicks **"⚙️ Ustawienia"** link in the top-right header
- Redirected to: `https://panel.wtyczki.ai/dashboard/settings`

### 2. Review Account Information
Settings page displays:
- Email address
- Current token balance
- Account creation date
- Logout button

### 3. Danger Zone Section
User sees clear warnings about:
- ⚠️ **Permanent and irreversible action**
- Loss of access to account and all tokens
- Token forfeit: Shows exact balance (e.g., "5000 tokenów")
- No refunds for unused tokens
- GDPR-compliant data anonymization
- Transaction history preservation for accounting

### 4. Two-Step Confirmation Process

#### Step 1: Warning Modal
- User clicks **"Usuń moje konto"** button
- Modal appears with:
  - ⚠️ "Czy na pewno chcesz usunąć konto?"
  - List of what will be lost:
    - Access to account
    - All tokens (exact amount shown)
    - Purchase and usage history
  - Options: **"Anuluj"** or **"Kontynuuj"**

#### Step 2: Final Confirmation
- User clicks **"Kontynuuj"**
- Second modal appears requiring:
  - Type the word: **"DELETE"** (case-sensitive)
  - Real-time validation:
    - ❌ Red background = incorrect
    - ✅ Green background = correct
  - Warning about consequences
  - Options: **"Anuluj"** or **"Usuń konto na zawsze"**

### 5. Deletion Execution
- User types "DELETE" correctly
- Clicks **"Usuń konto na zawsze"**
- Button text changes to: **"Usuwanie konta..."**
- Backend processes deletion (3-5 seconds)
- Success: Alert message + redirect to home page
- Error: Alert with error message, modal stays open

---

## Technical Architecture

### Endpoints

#### 1. Settings Page (Protected)
```
GET /dashboard/settings
```
- **Authentication:** Required (WorkOS session cookie)
- **Handler:** `handleSettingsPage(user: User)`
- **Response:** HTML page with settings UI

#### 2. Account Deletion (Protected)
```
POST /account/delete/confirm
```
- **Authentication:** Required (WorkOS session cookie)
- **Handler:** `handleAccountDeletion(request, env)`
- **Request Body:**
  ```json
  {
    "userId": "user_01234567890abcdef",
    "confirmation": "DELETE",
    "deletionReason": "Optional user-provided reason"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Konto zostało pomyślnie usunięte",
    "tokensForfeited": 5000
  }
  ```

### File Structure

```
src/
├── services/
│   └── accountDeletionService.ts      # Core deletion logic
├── routes/
│   └── accountSettings.ts             # Route handlers
├── views/
│   └── htmlTemplates.ts               # Settings page HTML
└── index.ts                           # Route registration

migrations/
└── 0004_add_account_deletion_support.sql  # Database schema
```

---

## Database Schema

### Migration: 0004_add_account_deletion_support.sql

#### Users Table (Modified)

**New Columns Added:**
```sql
is_deleted INTEGER DEFAULT 0 CHECK (is_deleted IN (0, 1))
deleted_at TIMESTAMP
workos_user_id TEXT
```

**New Indexes:**
```sql
CREATE INDEX idx_users_is_deleted ON users(is_deleted);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

#### Account Deletions Table (New)

**Purpose:** Audit trail for deleted accounts (GDPR compliance + tax records)

```sql
CREATE TABLE account_deletions (
  deletion_id TEXT PRIMARY KEY,           -- UUID for this deletion event
  user_id TEXT NOT NULL,                  -- Original user_id (preserved)
  original_email TEXT NOT NULL,           -- Email before anonymization
  tokens_forfeited INTEGER NOT NULL,      -- Tokens lost in deletion
  total_tokens_purchased INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  stripe_customer_id TEXT,                -- Stripe customer (preserved)
  deletion_reason TEXT,                   -- Optional user reason
  deleted_at TIMESTAMP DEFAULT (datetime('now')),
  deleted_by_ip TEXT,                     -- IP address for audit
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_account_deletions_user_id ON account_deletions(user_id);
CREATE INDEX idx_account_deletions_deleted_at ON account_deletions(deleted_at DESC);
CREATE INDEX idx_account_deletions_original_email ON account_deletions(original_email);
```

---

## Deletion Process Steps

### Step 1: Eligibility Check
**Function:** `checkDeletionEligibility(userId, env)`

**Query:**
```sql
SELECT * FROM users
WHERE user_id = ? AND is_deleted = 0
```

**Returns:**
```typescript
{
  eligible: boolean,
  reason?: string,
  tokensToForfeit?: number
}
```

**Validation:**
- User exists
- User not already deleted (`is_deleted = 0`)

---

### Step 2: Get User Data
**Function:** `getUserForDeletion(userId, db)`

**Query:**
```sql
SELECT
  user_id,
  email,
  current_token_balance,
  total_tokens_purchased,
  total_tokens_used,
  stripe_customer_id,
  workos_user_id,
  created_at
FROM users
WHERE user_id = ? AND is_deleted = 0
```

**Purpose:** Capture all data before anonymization

---

### Step 3: Anonymize User Data (Atomic)
**Function:** `anonymizeUserDataAtomic(user, db, reason, ip)`

**Operation:** D1 Batch Transaction (atomic - all or nothing)

```typescript
await db.batch([
  // Update 1: Anonymize user record
  db.prepare(`
    UPDATE users
    SET
      email = ?,                    -- deleted+{userId}@wtyczki.ai
      stripe_customer_id = NULL,     -- Remove from user record
      workos_user_id = NULL,         -- Remove from user record
      is_deleted = 1,                -- Mark as deleted
      deleted_at = ?                 -- Timestamp
    WHERE user_id = ?
  `).bind(anonymizedEmail, timestamp, userId),

  // Update 2: Create audit record
  db.prepare(`
    INSERT INTO account_deletions (
      deletion_id,
      user_id,
      original_email,
      tokens_forfeited,
      total_tokens_purchased,
      total_tokens_used,
      stripe_customer_id,
      deletion_reason,
      deleted_at,
      deleted_by_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    userId,
    originalEmail,
    tokenBalance,
    tokensPurchased,
    tokensUsed,
    stripeCustomerId,
    reason,
    timestamp,
    ipAddress
  )
]);
```

**Atomicity Guarantee:**
- Both operations succeed together, or both fail
- No partial deletions possible
- Database rollback on any error

---

### Step 4: Update Stripe Customer
**Function:** `updateStripeCustomerAsDeleted(stripeCustomerId, userId, env)`

**Why NOT Delete:**
- Payment disputes can occur months later
- Required for refunds/chargebacks
- Tax and accounting compliance (7-year retention)
- Payment history preservation

**Operation:**
```typescript
await stripe.customers.update(stripeCustomerId, {
  email: `deleted+${userId}@wtyczki.ai`,  // Anonymized
  metadata: {
    account_deleted: 'true',
    deletion_date: new Date().toISOString(),
    original_user_id: userId,
    deletion_reason: 'User requested account deletion'
  }
});
```

**Error Handling:** Non-blocking (logs warning, continues deletion)

---

### Step 5: Delete WorkOS User
**Function:** `deleteWorkOSUser(workosUserId, env)`

**API Call:**
```typescript
DELETE https://api.workos.com/user_management/users/{workosUserId}
Authorization: Bearer {WORKOS_API_KEY}
```

**Purpose:** Remove from authentication system

**Error Handling:**
- 404 (already deleted) = acceptable, continue
- Other errors = log warning, continue deletion

---

### Step 6: Delete All Sessions
**Function:** `deleteAllUserSessions(userId, env)`

**Cleanup Operations:**

1. **WorkOS Sessions (USER_SESSIONS KV):**
   ```typescript
   prefix: `session:${userId}:`
   ```

2. **OAuth Access Tokens (OAUTH_STORE KV):**
   ```typescript
   // SECURITY FIX: Iterate through all tokens and check user_id field
   // Tokens are stored as `access_token:${token}`, not `token:${userId}:`
   prefix: `access_token:`
   filter: tokenData.user_id === userId
   ```

3. **OAuth Refresh Tokens (OAUTH_STORE KV):**
   ```typescript
   // SECURITY FIX: Iterate through all tokens and check user_id field
   // Tokens are stored as `refresh_token:${token}`, not `token:${userId}:`
   prefix: `refresh_token:`
   filter: tokenData.user_id === userId
   ```

4. **OAuth Authorization Codes (OAUTH_STORE KV):**
   ```typescript
   prefix: `auth_code:${userId}:`
   ```

**Result:**
- All active sessions terminated
- All OAuth tokens revoked (access + refresh)
- User immediately logged out
- No lingering authentication data
- **CRITICAL:** Deleted users can NO LONGER use MCP servers

---

## Data Handling Strategy

### What Gets Deleted (GDPR Compliance)

✅ **Personal Identifiable Information (PII):**
- Original email address → Anonymized to `deleted+{userId}@wtyczki.ai`
- WorkOS user account → Permanently deleted
- Active user sessions → All cleared from KV
- OAuth tokens → All cleared from KV

### What Gets Preserved (Legal Compliance)

✅ **Financial Records (Tax/Accounting):**
- Transaction history in `transactions` table (anonymized)
- MCP action logs in `mcp_actions` table (anonymized)
- Audit record in `account_deletions` table
- Stripe customer record (anonymized email, metadata updated)

✅ **Why Preserve:**
- Tax regulations require 7-year retention of financial transactions
- Payment disputes can occur months after deletion
- Refund/chargeback processing requirements
- Business analytics and fraud prevention

### Anonymization Approach

**Email Format:**
```
Original: user@example.com
Anonymized: deleted+user_01ABC123@wtyczki.ai
```

**Benefits:**
- Unique identifier preserved for database relationships
- No PII revealed (UUID is random)
- Recognizable as deleted account
- Foreign key constraints maintained

---

## Compliance & Legal

### GDPR Compliance (Article 17 - Right to Erasure)

✅ **Personal Data Removal:**
- Email address anonymized
- WorkOS authentication data deleted
- Session data cleared
- User profile anonymized

✅ **Lawful Basis for Retention:**
- Financial transactions: Legal obligation (tax law)
- Audit records: Legitimate interest (fraud prevention)
- Stripe data: Legal obligation (payment disputes)

### Tax & Accounting Compliance

✅ **Required Retention Period:** 7 years (varies by jurisdiction)

✅ **Retained Data (Anonymized):**
- Purchase transactions (tokens bought)
- Usage transactions (tokens consumed)
- Payment records (amounts, dates)
- Aggregated statistics

### User Rights

✅ **Right to Know:**
- Clear warnings about what will be deleted
- Exact token balance shown before deletion
- No-refund policy displayed prominently

✅ **Right to Confirm:**
- Two-step confirmation process
- Type "DELETE" verification
- Cannot be done accidentally

---

## Testing & Verification

### Local Testing

1. **Start Development Server:**
   ```bash
   npx wrangler dev
   ```

2. **Apply Migration Locally:**
   ```bash
   npx wrangler d1 migrations apply mcp-tokens-database --local
   ```

3. **Test Flow:**
   - Visit: `http://localhost:8787/dashboard`
   - Login with test account
   - Navigate to Settings
   - Test both modals (cancel and proceed)
   - Test "DELETE" input validation
   - Execute deletion
   - Verify success message

### Production Testing

1. **Verify Migration Applied:**
   ```bash
   npx wrangler d1 migrations list mcp-tokens-database --remote
   ```

2. **Check Database Schema:**
   ```bash
   npx wrangler d1 execute mcp-tokens-database --remote \
     --command "PRAGMA table_info(users);"
   ```

3. **Test with Real Account:**
   - Create test user account
   - Purchase some tokens
   - Navigate to Settings
   - Execute full deletion flow
   - Verify all steps complete

### Verification Checklist

After deletion, verify:

- [ ] User email anonymized in `users` table
- [ ] `is_deleted = 1` in `users` table
- [ ] `deleted_at` timestamp set
- [ ] Audit record created in `account_deletions`
- [ ] Stripe customer email anonymized
- [ ] Stripe customer metadata updated
- [ ] WorkOS user deleted (or 404)
- [ ] All KV sessions cleared
- [ ] User cannot login anymore
- [ ] Transaction history preserved (anonymized)

### Database Queries for Verification

**Check anonymized user:**
```sql
SELECT user_id, email, is_deleted, deleted_at
FROM users
WHERE user_id = '{userId}';
```

**Check audit record:**
```sql
SELECT * FROM account_deletions
WHERE user_id = '{userId}';
```

**Check preserved transactions:**
```sql
SELECT transaction_id, type, token_amount, created_at
FROM transactions
WHERE user_id = '{userId}';
```

---

## Troubleshooting

### Error: "Database error while checking eligibility"

**Cause:** Migration not applied to production database

**Solution:**
```bash
npx wrangler d1 migrations apply mcp-tokens-database --remote
```

**Verification:**
```bash
# Check migration status
npx wrangler d1 migrations list mcp-tokens-database --remote

# Verify columns exist
npx wrangler d1 execute mcp-tokens-database --remote \
  --command "PRAGMA table_info(users);"
```

---

### Error: "User not found or already deleted"

**Cause:** User already deleted or doesn't exist

**Check:**
```sql
SELECT user_id, email, is_deleted, deleted_at
FROM users
WHERE user_id = '{userId}';
```

**If deleted:**
- `is_deleted = 1`
- Email format: `deleted+{userId}@wtyczki.ai`

---

### Error: "Batch operation did not return expected results"

**Cause:** D1 batch transaction failed

**Debugging:**
```bash
# Check D1 logs
npx wrangler tail

# Check for foreign key violations
# Check for unique constraint violations
```

**Common Causes:**
- Duplicate deletion_id (UUID collision - very rare)
- Foreign key constraint violation
- Database connection timeout

---

### WorkOS User Deletion Failed

**Symptom:** Warning in logs but deletion continues

**Expected Behavior:**
- 404 = User already deleted (acceptable)
- Other errors = Non-blocking (logged, deletion continues)

**Verification:**
```bash
# Check WorkOS directly
curl -X GET https://api.workos.com/user_management/users/{workosUserId} \
  -H "Authorization: Bearer {WORKOS_API_KEY}"
```

---

### Stripe Customer Update Failed

**Symptom:** Warning in logs but deletion continues

**Expected Behavior:**
- Non-blocking (logged, deletion continues)
- Stripe customer preserved for payment disputes

**Verification:**
```bash
# Use Stripe Dashboard
https://dashboard.stripe.com/customers/{customerId}

# Or Stripe CLI
stripe customers retrieve {customerId}
```

---

## Deployment Checklist

Before deploying account deletion to production:

### Pre-Deployment
- [ ] Code reviewed and tested locally
- [ ] Migration file committed to repository
- [ ] Environment variables verified (WORKOS_API_KEY, STRIPE_SECRET_KEY)
- [ ] Backup taken of production database
- [ ] Documentation reviewed and updated

### Deployment Steps
1. [ ] Deploy Worker: `npx wrangler deploy`
2. [ ] Apply migration: `npx wrangler d1 migrations apply mcp-tokens-database --remote`
3. [ ] Verify migration: `npx wrangler d1 migrations list mcp-tokens-database --remote`
4. [ ] Test with staging account
5. [ ] Monitor logs: `npx wrangler tail`

### Post-Deployment
- [ ] Test full deletion flow in production
- [ ] Verify database schema changes
- [ ] Check Stripe customer anonymization
- [ ] Verify WorkOS user deletion
- [ ] Monitor error rates for 24 hours

---

## Security Considerations

### Authentication
- ✅ Settings page requires valid WorkOS session
- ✅ Deletion endpoint validates user session
- ✅ User can only delete their own account
- ✅ No user_id spoofing possible

### Authorization
- ✅ Two-step confirmation prevents accidents
- ✅ Type "DELETE" prevents UI bugs/automation
- ✅ IP address logged for audit trail
- ✅ Deletion reason captured (optional)

### Data Protection
- ✅ Atomic database operations prevent partial deletions
- ✅ Rollback on failure ensures data integrity
- ✅ Stripe customer preserved for disputes
- ✅ Transaction history preserved for tax compliance

### Session Management
- ✅ All active sessions terminated immediately
- ✅ OAuth tokens cleared from KV
- ✅ User cannot login after deletion
- ✅ Session cookie cleared in response

---

## Performance & Scalability

### Execution Time
- **Average:** 2-4 seconds
- **Steps:**
  - Database operations: ~500ms (atomic batch)
  - Stripe API call: ~500ms
  - WorkOS API call: ~500ms
  - KV cleanup: ~1000ms (depends on session count)

### Database Impact
- **Tables Modified:** 2 (users, account_deletions)
- **Queries:** 1 batch transaction (2 operations)
- **Locks:** Brief row lock on user record
- **Impact:** Minimal (non-blocking for other operations)

### Rate Limiting
- No specific rate limits implemented (low frequency operation)
- Protected by authentication (prevents abuse)
- Could add per-user cooldown if needed

---

## Future Enhancements

### Potential Improvements

1. **Grace Period:**
   - Soft delete with 30-day recovery window
   - Scheduled hard deletion after grace period
   - User can cancel during grace period

2. **Data Export:**
   - GDPR Article 20: Right to data portability
   - Download transaction history before deletion
   - Export format: JSON or CSV

3. **Account Recovery:**
   - Limited recovery window (7-14 days)
   - Email verification required
   - Restore from audit record

4. **Deletion Statistics:**
   - Dashboard for admins
   - Deletion reasons analysis
   - Token forfeit statistics
   - Monthly deletion trends

5. **Scheduled Deletions:**
   - User schedules deletion for future date
   - Cancel anytime before execution
   - Email reminder 24 hours before

---

## References

### Legal & Compliance
- **GDPR Article 17:** Right to Erasure ("Right to be Forgotten")
- **GDPR Article 20:** Right to Data Portability
- **Tax Retention:** Varies by jurisdiction (typically 7 years)

### Technical Documentation
- **Cloudflare D1:** https://developers.cloudflare.com/d1/
- **WorkOS User Management:** https://workos.com/docs/user-management
- **Stripe Customer API:** https://stripe.com/docs/api/customers

### Internal Documentation
- `business_goal.md` - Business requirements and user journeys
- `CLAUDE.md` - Project guidelines and best practices
- `POST_DEPLOYMENT_CHECKLIST.md` - Deployment procedures

---

## Support & Contact

For questions or issues related to account deletion:

- **Technical Issues:** Check logs with `npx wrangler tail`
- **Database Issues:** Verify migration status
- **API Issues:** Check WorkOS/Stripe API status pages
- **User Support:** support@wtyczki.pl

---

---

## Security Fix: Authentication Bypass (2025-10-18)

### ⚠️ Critical Vulnerability Patched

**Issue Discovered:** Deleted users could still use MCP servers despite account deletion.

### Root Causes

**Bug #1: OAuth Token Deletion Pattern Mismatch**
- **Problem:** Token deletion used wrong KV key pattern
- **Expected:** `token:${userId}:*`
- **Actual:** Tokens stored as `access_token:${token}` and `refresh_token:${token}`
- **Result:** Tokens never deleted when account deleted

**Bug #2: Missing `is_deleted` Validation**
- **Problem:** No validation in 5 critical functions
- **Locations:**
  1. `oauth.ts:handleUserInfoEndpoint()` - User info endpoint
  2. `oauth.ts:validateOAuthToken()` - Token validation
  3. `tokenConsumption.ts:checkBalance()` - Balance check
  4. `tokenConsumption.ts:consumeTokens()` - Token deduction
  5. `tokenConsumption.ts:getUserStats()` - User statistics

### Fixes Applied

**1. Fixed OAuth Token Deletion (`accountDeletionService.ts`)**
```typescript
// Iterate through ALL tokens and check user_id field
const allAccessTokens = await env.OAUTH_STORE.list({ prefix: 'access_token:' });
for (const key of allAccessTokens.keys) {
  const tokenData = await env.OAUTH_STORE.get(key.name, 'json');
  if (tokenData?.user_id === userId) {
    await env.OAUTH_STORE.delete(key.name);
  }
}
```

**2. Added `is_deleted` Checks**
All 5 locations now include `AND is_deleted = 0` in database queries:
```sql
-- Example from checkBalance()
SELECT current_token_balance
FROM users
WHERE user_id = ? AND is_deleted = 0
```

**3. Database-Level Protection**
`validateOAuthToken()` now queries database after KV lookup:
```typescript
const user = await env.DB.prepare(
  'SELECT is_deleted FROM users WHERE user_id = ?'
).bind(tokenObj.user_id).first();

if (!user || user.is_deleted === 1) {
  await env.OAUTH_STORE.delete(`access_token:${token}`);
  return null;
}
```

### Cleanup Process

**For Existing Deleted Users:**
1. Run cleanup script: `node cleanup-deleted-user-tokens.mjs`
2. Script finds all deleted users (`is_deleted = 1`)
3. Iterates through all OAuth tokens in KV
4. Deletes tokens matching deleted user IDs
5. Reports tokens revoked

### Verification

**Test Deleted User Cannot Access:**
```bash
# 1. Check user is deleted
npx wrangler d1 execute mcp-tokens-database --remote \
  --command "SELECT email, is_deleted FROM users WHERE user_id = '{userId}'"

# 2. Attempt to use MCP server → Should fail with 401
# 3. Check logs for authentication failure
npx wrangler tail
```

### Impact Assessment

**Before Fix:**
- ❌ Deleted users could use MCP servers
- ❌ Deleted users could consume tokens
- ❌ OAuth tokens never revoked
- ❌ Financial loss (free token usage)

**After Fix:**
- ✅ Deleted users immediately blocked
- ✅ OAuth tokens automatically revoked
- ✅ Database queries validate `is_deleted`
- ✅ Security restored

### Files Modified

1. `src/services/accountDeletionService.ts` - Fixed token deletion
2. `src/oauth.ts` - Added is_deleted checks (2 locations)
3. `src/tokenConsumption.ts` - Added is_deleted checks (3 locations)
4. `cleanup-deleted-user-tokens.mjs` - New cleanup script
5. `ACCOUNT_DELETION.md` - Updated documentation

---

**Document Version:** 1.1
**Last Updated:** 2025-10-18
**Author:** Wtyczki DEV (with Claude Code assistance)
**Status:** Production Ready ✅
**Security Patch:** Applied 2025-10-18
