# Account Deletion: Issues, Edge Cases & Risk Analysis

**Project:** MCP Token System
**Analysis Date:** 2025-10-18
**Scope:** Identify potential errors, race conditions, and customer impact scenarios
**Status:** CRITICAL ISSUES IDENTIFIED

---

## Executive Summary

This document identifies **15 critical issues** and **8 medium-priority concerns** in the current account deletion implementation that could lead to:

- 💰 **Financial Loss:** Users losing paid tokens without refund
- 🔒 **Privacy Violations:** Potential GDPR non-compliance
- 🐛 **Race Conditions:** Data corruption and inconsistent state
- 😡 **Poor UX:** Confusing flows and accidental deletions
- ⚖️ **Legal Risk:** Consumer protection violations

**Severity Distribution:**
- 🔴 **CRITICAL:** 7 issues (require immediate fix)
- 🟡 **HIGH:** 5 issues (should fix before GA)
- 🟠 **MEDIUM:** 8 issues (improve when possible)
- 🟢 **LOW:** 3 issues (nice-to-have)

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [High Priority Issues](#2-high-priority-issues)
3. [Medium Priority Issues](#3-medium-priority-issues)
4. [Low Priority Issues](#4-low-priority-issues)
5. [Race Condition Analysis](#5-race-condition-analysis)
6. [GDPR Compliance Gaps](#6-gdpr-compliance-gaps)
7. [Recommended Fixes](#7-recommended-fixes)

---

## 1. Critical Issues

### 🔴 CRITICAL #1: No Token Refund on Account Deletion

**Severity:** 🔴 CRITICAL
**Impact:** Financial loss for customers
**Legal Risk:** Consumer protection violation (Polish law: 14-day withdrawal right)

#### The Problem

```typescript
// Current code: accountDeletionService.ts
await env.DB.batch([
  // Step 1: Anonymize user
  db.prepare(`UPDATE users SET email = ?, is_deleted = 1`).bind(anonymizedEmail, userId),

  // Step 2: Remove Stripe link
  db.prepare(`UPDATE users SET stripe_customer_id = NULL`).bind(userId),
]);

// ❌ PROBLEM: current_token_balance is NOT zeroed out
// ❌ PROBLEM: No refund initiated for remaining tokens
```

**Current State After Deletion:**
```sql
SELECT user_id, current_token_balance, total_tokens_purchased
FROM users
WHERE is_deleted = 1;

Result:
user_id: 82af3c09-...
current_token_balance: 1500  -- ❌ USER LOST 1500 TOKENS!
total_tokens_purchased: 2000
```

#### Customer Impact Scenario

**User Story:**
1. User purchases 2000 tokens for 25 PLN (€5.50)
2. User uses 500 tokens (€1.38 value)
3. User deletes account (1500 tokens remaining = €4.12 value)
4. ❌ **1500 tokens lost - no refund issued**

**Expected by Customer:**
- Refund of €4.12 for unused tokens, OR
- Warning: "You have 1500 tokens remaining (€4.12 value). Are you sure you want to delete?"

**Actual Behavior:**
- ✅ Account deleted successfully
- ❌ No refund
- ❌ No warning about token loss
- ❌ No way to retrieve tokens

#### Legal Risk: Polish Consumer Law

**Ustawa o prawach konsumenta (Consumer Rights Act):**
- Article 27: 14-day withdrawal right for online purchases
- User can request refund within 14 days of purchase
- Deletion should preserve refund eligibility

**Current Gap:**
- `stripe_customer_id` set to NULL → Cannot process Stripe refund
- No record of original purchase price per token
- Cannot calculate refund amount

#### Financial Impact

**Assumptions:**
- 100 users/month delete accounts
- Average remaining balance: 800 tokens
- Token value: ~€0.00275/token (25 PLN / 2000 tokens)

**Monthly Loss to Customers:**
- 100 users × 800 tokens × €0.00275 = **€220/month = €2,640/year**

**Reputational Risk:**
- Negative reviews: "They keep your money even after deletion!"
- Potential legal action
- Trust erosion

---

### 🔴 CRITICAL #2: Stripe Customer Not Deleted (GDPR Violation)

**Severity:** 🔴 CRITICAL
**Impact:** GDPR Article 17 violation, personal data retained in Stripe
**Legal Risk:** Up to €20M or 4% of annual revenue fine

#### The Problem

```typescript
// accountDeletionService.ts - Line 300-305
db.prepare(`
  UPDATE users
  SET stripe_customer_id = NULL
  WHERE user_id = ?
`).bind(userId)

// ❌ PROBLEM: Only removes link in OUR database
// ❌ PROBLEM: Stripe customer object still exists with:
//    - Email address
//    - Payment methods
//    - Purchase history
//    - Metadata
```

**What Remains in Stripe:**
```javascript
// Stripe Customer Object (still exists)
{
  id: "cus_xyz123",
  email: "user@example.com",  // ❌ PII NOT DELETED
  name: "Jan Kowalski",        // ❌ PII NOT DELETED
  created: 1234567890,
  metadata: {
    user_id: "82af3c09-...",   // ❌ Linkable to deleted account
    original_email: "user@example.com"
  },
  invoice_settings: {
    default_payment_method: "pm_123"  // ❌ Payment method retained
  }
}

// Payment Methods (still exist)
{
  id: "pm_123",
  type: "card",
  card: {
    last4: "4242",
    brand: "visa"
  }
}
```

#### GDPR Analysis

**Article 17 RODO - Right to Erasure:**
- User requests deletion → ALL personal data must be erased
- Personal data includes: email, name, payment methods
- Third-party processors (Stripe) must also delete data

**Current Compliance:**
- ✅ Email anonymized in D1 database
- ❌ Email retained in Stripe customer object
- ❌ Name retained in Stripe
- ❌ Payment methods retained

**GDPR Requirement:**
```typescript
// REQUIRED: Delete Stripe customer when account deleted
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// Option 1: Delete customer completely
await stripe.customers.del(stripeCustomerId);

// Option 2: Anonymize customer data (if deletion not possible)
await stripe.customers.update(stripeCustomerId, {
  email: `deleted+${userId}@wtyczki.ai`,
  name: `Deleted User ${userId}`,
  metadata: {
    account_deleted: true,
    deletion_date: new Date().toISOString()
  }
});

// Option 3: Detach all payment methods then delete
const paymentMethods = await stripe.paymentMethods.list({
  customer: stripeCustomerId,
  type: 'card',
});

for (const pm of paymentMethods.data) {
  await stripe.paymentMethods.detach(pm.id);
}

await stripe.customers.del(stripeCustomerId);
```

#### Impact on Business Operations

**If Stripe customer deleted:**
- ✅ GDPR compliant
- ❌ Cannot process refunds (no customer to refund to)
- ❌ Cannot view historical invoices
- ❌ Cannot analyze churn metrics

**Proposed Solution:**
1. Before deletion: Offer refund for remaining tokens
2. Process refund to original payment method
3. After refund: Delete Stripe customer
4. Update our DB: Set `stripe_customer_id = NULL`

---

### 🔴 CRITICAL #3: Race Condition - Token Purchase During Deletion

**Severity:** 🔴 CRITICAL
**Impact:** Orphaned payment, tokens credited to deleted account, money lost
**Probability:** Medium (async webhooks + user timing)

#### The Problem

**Timeline:**
```
T=0    User clicks "Delete Account" button
T=1    Deletion transaction starts
T=2    Database: is_deleted = 1
T=3    Deletion transaction commits
T=4    Stripe webhook arrives: checkout.session.completed (delayed)
T=5    Webhook handler: getOrCreateUser(email)
T=6    Query: SELECT * FROM users WHERE email = 'user@example.com'
T=7    Result: NULL (email now 'deleted+{uuid}@wtyczki.ai')
T=8    Webhook creates NEW user with SAME email
T=9    ❌ TWO users exist: deleted one + newly created one
```

**Database State After Race:**
```sql
-- Old account (deleted)
user_id: 82af3c09-...
email: deleted+82af3c09-...@wtyczki.ai
current_token_balance: 0
is_deleted: 1

-- New account (auto-created by webhook)
user_id: f9e3b1a7-...
email: user@example.com
current_token_balance: 2000  -- From purchase
is_deleted: 0
```

**WORSE Scenario - Payment After Deletion Starts:**
```
T=0    User starts deletion
T=1    Database query: SELECT stripe_customer_id  → "cus_xyz"
T=2    User completes payment in separate browser tab
T=3    Stripe webhook: Credit 2000 tokens to user_id
T=4    Database UPDATE: current_token_balance = 2000
T=5    Deletion continues: UPDATE users SET is_deleted = 1
T=6    ❌ User deleted WITH 2000 newly purchased tokens
```

**Result:**
- User paid 25 PLN
- User deleted account
- 2000 tokens lost immediately
- User furious: "I paid and you deleted my tokens!"

#### Current Code Gap

```typescript
// src/index.ts - Webhook handler
const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
const userEmail = session.metadata?.user_id
  ? (await getUserById(session.metadata.user_id))?.email
  : session.metadata?.guest_email;

// ❌ PROBLEM: No check if user is being deleted
// ❌ PROBLEM: No lock to prevent concurrent deletion
const userId = await getOrCreateUser(env.DB, userEmail, stripe, env.STRIPE_SECRET_KEY);

// Race: getOrCreateUser() might run while deletion is in progress
```

#### Fix Required

```typescript
// SOLUTION: Use database transaction with lock
await env.DB.batch([
  // 1. Lock user row for update
  db.prepare(`
    SELECT user_id, is_deleted
    FROM users
    WHERE email = ?
    FOR UPDATE  -- ❌ NOT SUPPORTED IN D1!
  `).bind(email),

  // 2. Check if user being deleted
  // 3. Abort if is_deleted = 1 OR deletion_in_progress = 1

  // 4. Credit tokens only if safe
]);
```

**D1 Limitation:** D1 doesn't support `FOR UPDATE` row-level locks!

**Alternative Solution:**
```typescript
// Use optimistic locking with version number
UPDATE users
SET
  current_token_balance = current_token_balance + ?,
  version = version + 1
WHERE
  user_id = ?
  AND is_deleted = 0
  AND version = ?  -- Only update if version matches

// If 0 rows affected → concurrent modification detected
```

---

### 🔴 CRITICAL #4: MCP Action Parameters Contain PII

**Severity:** 🔴 CRITICAL
**Impact:** GDPR violation - user data retained after deletion
**Legal Risk:** Personal data stored in `parameters` JSON field

#### The Problem

```sql
-- mcp_actions table
SELECT action_id, tool_name, parameters, created_at
FROM mcp_actions
WHERE user_id = '82af3c09-...';

Result:
{
  "action_id": "abc-123",
  "tool_name": "getCurrencyRate",
  "parameters": {
    "params": {
      "currencyCode": "USD",
      "date": "2025-10-15"
    },
    "result": {
      "rate": 4.15,
      "effectiveDate": "2025-10-15",
      "currency": "USD",
      // ❌ POTENTIAL PII IN RESULT:
      "requestedBy": "user@example.com",  // If tool echoes email
      "userLocation": "Warsaw, Poland"     // If tool logs location
    }
  }
}
```

**GDPR Issue:**
- User deletes account → expects ALL data erased
- `mcp_actions.parameters` is JSON text field
- May contain user email, IP address, location, or other PII
- Currently NOT anonymized during deletion

#### Examples of PII in Parameters

**1. Email in API Results:**
```json
// Tool: "sendNotification"
{
  "params": { "message": "Rate alert" },
  "result": {
    "sent_to": "user@example.com",  // ❌ EMAIL
    "delivery_status": "delivered"
  }
}
```

**2. IP Address Logging:**
```json
// Tool: "getGeoRate"
{
  "params": {
    "currency": "EUR",
    "client_ip": "192.168.1.100"  // ❌ IP ADDRESS (PII under GDPR)
  }
}
```

**3. User Metadata:**
```json
// Tool: "analyzeUsage"
{
  "params": { "user_id": "82af3c09-..." },
  "result": {
    "email": "user@example.com",      // ❌ EMAIL
    "full_name": "Jan Kowalski",      // ❌ NAME
    "most_used_currency": "PLN",
    "typical_request_time": "09:00"   // ❌ Behavioral data
  }
}
```

#### Current Deletion Code - Missing This

```typescript
// accountDeletionService.ts
// ❌ MISSING: Anonymize mcp_actions.parameters

// SHOULD DO:
await db.prepare(`
  UPDATE mcp_actions
  SET parameters = '{"anonymized": true, "user_deleted": true}'
  WHERE user_id = ?
`).bind(userId).run();
```

#### Risk Assessment

**Likelihood:** HIGH
- Every MCP tool logs parameters
- JSON field contains arbitrary data
- No validation of PII content

**Impact:** CRITICAL
- GDPR Article 17 violation
- Potential €20M fine
- User trust destroyed

---

### 🔴 CRITICAL #5: Account Deletions Table Stores Original Email

**Severity:** 🔴 CRITICAL
**Impact:** GDPR violation - email retained indefinitely
**Legal Risk:** Defeats purpose of anonymization

#### The Problem

```typescript
// accountDeletionService.ts - Line 290
db.prepare(`
  INSERT INTO account_deletions (
    deletion_id,
    user_id,
    original_email,  // ❌ STORING PLAIN EMAIL PERMANENTLY
    deletion_reason,
    deleted_at
  ) VALUES (?, ?, ?, 'user_request', CURRENT_TIMESTAMP)
`).bind(deletionId, userId, originalEmail, timestamp)
```

**Database After Deletion:**
```sql
SELECT * FROM account_deletions;

Result:
deletion_id: del_123
user_id: 82af3c09-...
original_email: user@example.com  -- ❌ PII RETAINED!
deletion_reason: user_request
deleted_at: 2025-10-18T14:32:15Z
```

**GDPR Violation:**
- Purpose of deletion: Erase personal data
- `original_email` is personal data
- Stored in audit table FOREVER
- Contradicts anonymization in `users` table

#### Why This Exists

**Intended Use:**
- Audit trail for compliance
- Prove deletion occurred
- Support investigations
- Prevent re-registration abuse

**GDPR Conflict:**
- Audit ≠ Retention of original PII
- Can audit with anonymized identifiers
- Don't need email to prove deletion

#### Correct Implementation

```typescript
// GDPR-Compliant Audit Trail
db.prepare(`
  INSERT INTO account_deletions (
    deletion_id,
    user_id,
    email_hash,           -- SHA-256(email) for duplicate detection
    deletion_reason,
    token_balance_at_deletion,
    refund_processed,
    deleted_at
  ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`).bind(
  deletionId,
  userId,
  sha256(originalEmail),  // Hash instead of plaintext
  'user_request',
  currentTokenBalance,
  false,
  timestamp
)

// Can still detect re-registration:
// - Hash new email: sha256('user@example.com')
// - Query: SELECT * FROM account_deletions WHERE email_hash = ?
// - If found: User previously deleted, handle accordingly
```

**Benefits:**
- ✅ Audit trail preserved
- ✅ No plaintext email stored
- ✅ Can detect re-registration
- ✅ GDPR compliant

---

### 🔴 CRITICAL #6: Failed Deductions Table Never Cleaned Up

**Severity:** 🔴 CRITICAL
**Impact:** User data retained indefinitely, GDPR violation
**Table:** `failed_deductions`

#### The Problem

```typescript
// tokenConsumption.ts - Lines 354-372
await db.prepare(`
  INSERT INTO failed_deductions (
    action_id,
    user_id,           // ❌ USER_ID RETAINED
    mcp_server_name,
    tool_name,
    token_amount,
    parameters,        // ❌ MAY CONTAIN PII
    error_message,
    created_at,
    retry_count
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  actionId,
  userId,  // ❌ Links to deleted user
  mcpServerName,
  toolName,
  tokenAmount,
  JSON.stringify({ params: actionParams, result: actionResult }),  // ❌ Possible PII
  lastError.message,
  new Date().toISOString(),
  maxRetries
).run();

// ❌ PROBLEM: Account deletion does NOT clean this table
```

**After User Deletes Account:**
```sql
SELECT * FROM failed_deductions WHERE user_id = '82af3c09-...';

Result:
action_id: failed_001
user_id: 82af3c09-...    -- ❌ LINKS TO DELETED USER
parameters: {            -- ❌ MAY CONTAIN PII
  "params": { "currencyCode": "USD" },
  "result": { "requestedBy": "user@example.com" }
}
error_message: "Database connection failed"
created_at: 2025-10-15T10:30:00Z
```

**GDPR Issue:**
- User deleted account
- `failed_deductions` still contains `user_id`
- Can re-link to deleted user via UUID
- `parameters` JSON may contain email, IP, etc.

#### Business Impact

**Purpose of `failed_deductions`:**
- Track token deduction failures
- Reconcile charges later
- Prevent revenue loss

**Conflict:**
- User wants data deleted
- Business wants to charge for failed deductions
- Reconciliation may take days/weeks

**Solution Required:**
```typescript
// accountDeletionService.ts - ADD THIS
await db.prepare(`
  UPDATE failed_deductions
  SET
    user_id = 'deleted',  -- Anonymize
    parameters = '{"anonymized": true}',
    resolved = true,  -- Mark as not requiring reconciliation
    resolution_note = 'User account deleted before reconciliation'
  WHERE user_id = ?
`).bind(userId).run();
```

---

### 🔴 CRITICAL #7: No Confirmation Dialog for Deletion

**Severity:** 🔴 CRITICAL
**Impact:** Accidental deletions, customer service burden
**UX Risk:** Users don't understand consequences

#### The Problem

**Current Flow:**
```
User → Dashboard → "Delete Account" button → ❌ IMMEDIATE DELETION
```

**No Confirmation:**
- ❌ No "Are you sure?" dialog
- ❌ No explanation of consequences
- ❌ No token balance warning
- ❌ No re-authentication required
- ❌ No cooling-off period

#### Real-World Scenario

**User Story:**
1. User logs into dashboard
2. Curious user explores settings
3. Clicks "Delete Account" to see what happens
4. ❌ Account immediately deleted
5. User shocked: "I didn't mean to delete it!"
6. Support ticket: "Please restore my account!"

**Current Response:**
- ❌ Cannot restore deleted accounts
- ❌ All tokens lost (no refund implemented)
- ❌ No undo mechanism
- ❌ Poor customer experience

#### Industry Best Practices

**Example: GitHub Account Deletion**
```
1. User clicks "Delete account"
2. Modal appears:
   - "Are you absolutely sure?"
   - "This action cannot be undone"
   - "All repositories will be deleted"
   - "Type your username to confirm: {username}"
   - Requires password re-entry
3. Confirmation email sent
4. 7-day grace period before permanent deletion
```

**Example: Google Account Deletion**
```
1. Warning page:
   - "You're about to delete your Google account"
   - "This will delete all data from Gmail, Drive, Photos..."
   - Checkboxes: ☐ I understand Gmail will be deleted
                 ☐ I understand Drive will be deleted
   - Download data option
2. Re-authenticate
3. Final confirmation
4. 20-day recovery window
```

#### Proposed Implementation

```typescript
// PHASE 1: Soft Delete with Grace Period
POST /user/request-deletion
→ Sets deletion_scheduled = CURRENT_TIMESTAMP + 7 days
→ Sends confirmation email with cancellation link
→ User can still login and cancel during grace period

// PHASE 2: Permanent Deletion (automated)
// Scheduled job runs daily:
SELECT user_id FROM users
WHERE deletion_scheduled < CURRENT_TIMESTAMP
AND is_deleted = 0

→ For each: Execute permanent deletion
→ Send final confirmation email: "Account permanently deleted"
```

**Benefits:**
- ✅ Prevents accidental deletions
- ✅ Gives users time to reconsider
- ✅ Reduces support burden
- ✅ Industry standard practice

---

## 2. High Priority Issues

### 🟡 HIGH #1: Transaction Descriptions May Contain PII

**Severity:** 🟡 HIGH
**Impact:** User email or name leaked in transaction descriptions
**Table:** `transactions.description`

#### The Problem

```typescript
// tokenConsumption.ts - Line 207
db.prepare(`
  INSERT INTO transactions (...)
  VALUES (..., ?, ...)  -- description parameter
`).bind(
  ...,
  `${mcpServerName}: ${toolName}`,  // ✅ OK
  ...
)

// BUT other code might do:
`).bind(
  ...,
  `Purchase by ${userEmail}`,  // ❌ PII IN DESCRIPTION
  ...
)
```

**Example from Stripe Webhook:**
```typescript
// src/index.ts - hypothetical
const description = `Token purchase - ${session.customer_email}`;
// ❌ Email in description field
```

**Current State Unknown:**
- Need to audit all places where `description` is set
- May already contain PII in production

#### Fix

```typescript
// Audit all description fields:
SELECT DISTINCT description FROM transactions WHERE description LIKE '%@%';

// If found: Anonymize
UPDATE transactions
SET description = REGEXP_REPLACE(description, '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', 'REDACTED_EMAIL')
WHERE user_id = ?;
```

---

### 🟡 HIGH #2: Session Cleanup Incomplete

**Severity:** 🟡 HIGH
**Impact:** Deleted user sessions remain active temporarily
**Security Risk:** Medium

#### The Problem

```typescript
// accountDeletionService.ts - Lines 421-433
const allSessions = await env.USER_SESSIONS.list();
for (const sessionKey of allSessions.keys) {
  const sessionData = await env.USER_SESSIONS.get(sessionKey.name, 'json');
  if (sessionData?.userId === userId) {
    await env.USER_SESSIONS.delete(sessionKey.name);
  }
}
```

**Race Condition:**
```
T=0  Deletion starts
T=1  List sessions → [session_1, session_2]
T=2  User opens new browser tab
T=3  New session created: session_3
T=4  Delete session_1, session_2
T=5  ❌ session_3 still active!
```

**Impact:**
- User deleted account
- One browser tab still logged in
- Can see dashboard briefly
- Can make purchase (race with deletion)

#### Fix

```typescript
// Solution: Mark user as deleted FIRST, then cleanup sessions
// Sessions will fail on next request (is_deleted check)

// Better: Use session prefix for efficient deletion
// Store sessions as: session:{userId}:{sessionId}
const sessionsToDelete = await env.USER_SESSIONS.list({
  prefix: `session:${userId}:`
});

for (const session of sessionsToDelete.keys) {
  await env.USER_SESSIONS.delete(session.name);
}
```

---

### 🟡 HIGH #3: Pending Stripe Checkout Not Cancelled

**Severity:** 🟡 HIGH
**Impact:** User pays after deleting account
**Financial Risk:** Payment accepted for deleted account

#### The Problem

**Timeline:**
```
T=0  User starts Stripe checkout (opens payment form)
T=1  User switches to another tab
T=2  User deletes account in dashboard
T=3  Account deleted, Stripe customer_id = NULL
T=4  User returns to payment tab
T=5  User completes payment
T=6  Stripe webhook: checkout.session.completed
T=7  ❌ Payment succeeded for deleted account
```

**Current Webhook Behavior:**
```typescript
// src/index.ts
const userEmail = session.metadata?.guest_email;
const userId = await getOrCreateUser(db, userEmail, stripe, STRIPE_SECRET_KEY);

// If user deleted:
// - Query returns NULL (email anonymized)
// - getOrCreateUser() creates NEW user
// - Tokens credited to new account
// ✅ User gets tokens (but doesn't know - account deleted!)
```

**User Experience:**
```
User: "I deleted my account but was charged €25"
Support: "We created a new account for you with 2000 tokens"
User: "But I don't want the service anymore!"
Support: "Sorry, no refunds for digital goods"
User: ⭐☆☆☆☆ (1-star review)
```

#### Fix

```typescript
// Option 1: Store pending checkout sessions, cancel on deletion
await db.prepare(`
  INSERT INTO pending_checkouts (session_id, user_id, expires_at)
  VALUES (?, ?, ?)
`).bind(checkoutSessionId, userId, expiresAt).run();

// On deletion:
const pendingCheckouts = await db.prepare(
  'SELECT session_id FROM pending_checkouts WHERE user_id = ?'
).bind(userId).all();

for (const checkout of pendingCheckouts) {
  await stripe.checkout.sessions.expire(checkout.session_id);
}

// Option 2: Check deletion status in webhook before crediting
const user = await db.prepare(
  'SELECT is_deleted FROM users WHERE email = ?'
).bind(guestEmail).first();

if (user?.is_deleted === 1) {
  // Refund payment
  await stripe.refunds.create({
    payment_intent: session.payment_intent,
    reason: 'requested_by_customer'
  });

  return new Response('User deleted, payment refunded', { status: 200 });
}
```

---

### 🟡 HIGH #4: Multiple MCP Servers - Incomplete Cleanup

**Severity:** 🟡 HIGH
**Impact:** OAuth tokens remain in some MCP server namespaces
**Security Risk:** Medium

#### The Problem

**Current Architecture:**
```
Main System:
- OAUTH_STORE (ed207a9e99b2420cb3c65622c1b4d6f9) ✅ Cleaned

NBP MCP Server:
- OAUTH_KV (b77ec4c7e96043fab0c466a978c2f186) ❌ NOT cleaned

Future MCP Servers:
- Currency Converter MCP: OAUTH_KV (different namespace) ❌ NOT cleaned
- Weather MCP: OAUTH_KV (different namespace) ❌ NOT cleaned
```

**Current Deletion Code:**
```typescript
// accountDeletionService.ts
// Only cleans OAUTH_STORE (main system)
await cleanupOAuthTokens(env.OAUTH_STORE, userId);

// ❌ MISSING: Cleanup for each MCP server's OAUTH_KV
```

**Impact:**
- User deletes account
- Main system tokens revoked ✅
- MCP server tokens still valid ❌
- User can still authenticate to MCP (until token expires)

**Probability:**
- HIGH if user actively using MCP server
- Tokens expire eventually (hours/days)
- But violates "immediate deletion" principle

#### Fix

```typescript
// Solution 1: Centralize OAuth tokens (architectural change)
// Use single OAUTH_STORE for all services
// Drawback: All services share namespace (harder to isolate)

// Solution 2: Register all MCP KV namespaces in config
const MCP_SERVERS = [
  { name: 'nbp-mcp', kvBinding: env.NBP_OAUTH_KV },
  { name: 'weather-mcp', kvBinding: env.WEATHER_OAUTH_KV },
  // etc.
];

for (const server of MCP_SERVERS) {
  await cleanupOAuthTokens(server.kvBinding, userId);
}

// Solution 3: Use database to track user's connected MCP servers
CREATE TABLE user_mcp_connections (
  user_id TEXT,
  mcp_server_name TEXT,
  kv_namespace_id TEXT,
  connected_at TEXT
);

// On deletion:
const connections = await db.prepare(
  'SELECT kv_namespace_id FROM user_mcp_connections WHERE user_id = ?'
).bind(userId).all();

for (const conn of connections) {
  const kvBinding = getKVBinding(conn.kv_namespace_id);
  await cleanupOAuthTokens(kvBinding, userId);
}
```

---

### 🟡 HIGH #5: In-Flight Tool Execution During Deletion

**Severity:** 🟡 HIGH
**Impact:** Tool executes after deletion, tokens deducted
**Data Integrity:** Race condition

#### The Problem

**Timeline:**
```
T=0  User executes getCurrencyRate
T=1  checkBalance() returns: { sufficient: true, currentBalance: 100 }
T=2  Tool starts fetching NBP API
T=3  [CONCURRENT] User deletes account in browser
T=4  Account marked: is_deleted = 1
T=5  NBP API call completes
T=6  consumeTokens() executes
T=7  ❌ Tokens deducted from deleted account
```

**consumeTokens() Code:**
```typescript
// tokenConsumption.ts - Line 185
db.prepare(`
  UPDATE users
  SET current_token_balance = current_token_balance - ?
  WHERE user_id = ? AND is_deleted = 0  // ✅ Protects deletion
`).bind(tokenAmount, userId)

// Check if update succeeded:
if (batchResult[0].meta.changes === 0) {
  throw new Error('User not found, deleted, or balance update failed');
}
```

**Current Protection:**
- ✅ `AND is_deleted = 0` prevents deduction
- ✅ Update fails → throws error
- ✅ Transaction rolled back

**Remaining Issue:**
- Tool already executed (NBP API called)
- User got result
- But not charged (good)
- However: Confusing UX

**User sees:**
```
Tool result: "1 USD = 4.15 PLN"  ✅ Success
Then immediately:
Error: "User not found, deleted, or balance update failed"  ❌ Confusing
```

#### Assessment

**Actual Impact:** LOW
- ✅ Correctly prevents charging deleted user
- ✅ Database integrity maintained
- ⚠️ Confusing error message (user already saw result)

**Recommendation:**
- Document as acceptable race condition
- Error message is correct (user IS deleted)
- Alternative: Check `is_deleted` before AND after tool execution

---

## 3. Medium Priority Issues

### 🟠 MEDIUM #1: No Deletion Reason Tracking

**Severity:** 🟠 MEDIUM
**Impact:** Cannot analyze why users delete accounts
**Business Intelligence:** Lost opportunity

#### The Problem

```typescript
// accountDeletionService.ts
db.prepare(`
  INSERT INTO account_deletions (deletion_reason, ...)
  VALUES ('user_request', ...)  // ❌ Always same reason
`)
```

**No User Input:**
- Why did you delete your account?
  - [ ] No longer needed
  - [ ] Too expensive
  - [ ] Privacy concerns
  - [ ] Switching to competitor
  - [ ] Bad experience
  - [ ] Other: ___________

**Lost Insights:**
- Cannot identify product issues
- Cannot improve retention
- Cannot offer targeted discounts
- Cannot understand churn drivers

#### Fix

```typescript
// Add deletion_reason_detail field
await db.prepare(`
  INSERT INTO account_deletions (
    deletion_id,
    user_id,
    deletion_reason,         -- 'user_request'
    deletion_reason_detail,  -- NEW: User's explanation
    created_at
  ) VALUES (?, ?, ?, ?, ?)
`).bind(deletionId, userId, 'user_request', userProvidedReason, timestamp)
```

---

### 🟠 MEDIUM #2: No Deletion Analytics Dashboard

**Severity:** 🟠 MEDIUM
**Impact:** Cannot monitor deletion trends
**Operations:** Blind to problems

#### Current State

**Questions We Cannot Answer:**
- How many users delete accounts per week?
- What's the average time from signup to deletion?
- What's the average token balance at deletion?
- Are deletions increasing or decreasing?
- Which user segments delete most frequently?

**No Monitoring:**
- No alerts for deletion spikes
- No tracking of revenue lost to deletions
- No correlation with product changes

#### Fix

```sql
-- Deletion Metrics Dashboard Queries

-- 1. Deletions per day (last 30 days)
SELECT
  DATE(deleted_at) as deletion_date,
  COUNT(*) as deletions,
  AVG(token_balance_at_deletion) as avg_balance_lost,
  SUM(token_balance_at_deletion) as total_tokens_lost
FROM account_deletions
WHERE deleted_at >= DATE('now', '-30 days')
GROUP BY DATE(deleted_at)
ORDER BY deletion_date DESC;

-- 2. Time to deletion (how long before users quit?)
SELECT
  AVG(JULIANDAY(ad.deleted_at) - JULIANDAY(u.created_at)) as avg_days_until_deletion,
  COUNT(*) as deletion_count
FROM account_deletions ad
JOIN users u ON ad.user_id = u.user_id
WHERE ad.deleted_at >= DATE('now', '-90 days');

-- 3. Revenue lost to deletions
SELECT
  SUM(token_balance_at_deletion * 0.0125) as estimated_revenue_lost_pln
FROM account_deletions
WHERE deleted_at >= DATE('now', '-30 days');
-- Assumption: 1 token = 0.0125 PLN (25 PLN / 2000 tokens)
```

---

### 🟠 MEDIUM #3: Audit Log Retention Unclear

**Severity:** 🟠 MEDIUM
**Impact:** Unclear GDPR compliance for audit logs
**Legal Risk:** Indefinite retention may violate minimization principle

#### The Problem

**account_deletions Table:**
```sql
CREATE TABLE account_deletions (
  deletion_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_email TEXT,  -- ❌ PII retained forever
  deletion_reason TEXT,
  deleted_at TEXT NOT NULL
);
-- ❌ No TTL (time-to-live)
-- ❌ No retention policy
```

**GDPR Article 5(1)(e) - Storage Limitation:**
> Personal data shall be kept in a form which permits identification of data subjects for no longer than is necessary for the purposes for which the personal data are processed.

**Questions:**
- How long should we keep deletion audit logs?
- When can we delete the deletion record?
- What's legally required retention period in Poland?

**Polish Law - Accounting:**
- Invoice/transaction records: 5-6 years
- Tax documentation: 5 years
- But deletion audit logs? Unclear.

#### Fix

```typescript
// Option 1: Auto-expire audit logs after N years
CREATE TABLE account_deletions (
  ...,
  expires_at TEXT,  -- NEW: Auto-delete after 6 years
  ...
);

// Scheduled job:
DELETE FROM account_deletions
WHERE expires_at < CURRENT_TIMESTAMP;

// Option 2: Anonymize audit logs after grace period
// After 90 days:
UPDATE account_deletions
SET original_email = NULL  -- Remove email, keep record
WHERE deleted_at < DATE('now', '-90 days');
```

---

### 🟠 MEDIUM #4: No Export Before Deletion

**Severity:** 🟠 MEDIUM
**Impact:** GDPR Article 20 - Right to data portability not offered
**Legal Requirement:** Users should be able to download their data

#### GDPR Article 20 - Right to Data Portability

**Requirement:**
> Data subject has right to receive personal data in structured, commonly used, machine-readable format.

**Before deletion, user should get:**
- Transaction history (JSON/CSV)
- MCP action history (JSON/CSV)
- Account metadata
- Token balance summary

**Current State:**
- ❌ No data export feature
- ❌ User cannot download before deleting
- ❌ No "Download my data" button

#### Fix

```typescript
// Before deletion:
POST /user/export-data
→ Generate JSON export:
{
  "user_id": "82af3c09-...",
  "email": "user@example.com",
  "account_created": "2025-01-01",
  "current_balance": 1500,
  "total_purchased": 2000,
  "total_used": 500,
  "transactions": [
    {
      "date": "2025-01-01",
      "type": "purchase",
      "amount": 2000,
      "description": "Token package 25 PLN"
    },
    ...
  ],
  "mcp_actions": [...]
}

// Deletion flow:
1. User clicks "Delete Account"
2. Modal: "Do you want to download your data first?"
3. [Download Data] [Skip] [Cancel]
4. If Download → Generate export
5. After download → Proceed with deletion confirmation
```

---

### 🟠 MEDIUM #5: No Rate Limiting on Deletion

**Severity:** 🟠 MEDIUM
**Impact:** Potential abuse - mass deletion spam
**Attack Vector:** Low, but possible

#### The Problem

**Current Code:**
```typescript
// userRoutes.ts
POST /user/delete-account
→ Immediate deletion, no rate limiting
```

**Abuse Scenario:**
```
Attacker:
1. Create 1000 accounts (guest checkout with fake emails)
2. Delete all 1000 accounts rapidly
3. Overwhelm database with deletion transactions
4. Denial of Service (DoS)
```

**Impact:**
- Database writes spike
- KV namespace iterations (slow)
- Stripe API calls (can hit rate limits)
- Legitimate deletions delayed

#### Fix

```typescript
// Add rate limiting
import { RateLimiter } from '@cloudflare/workers-rate-limiter';

const deletionLimiter = new RateLimiter({
  namespace: env.RATE_LIMIT_KV,
  key: `deletion:${userId}`,
  limit: 1,           // Max 1 deletion
  window: 3600,       // Per hour
});

// Before deletion:
const allowed = await deletionLimiter.check();
if (!allowed) {
  return new Response('Rate limit exceeded. Try again later.', {
    status: 429
  });
}
```

---

### 🟠 MEDIUM #6: Console Logs Contain User IDs

**Severity:** 🟠 MEDIUM
**Impact:** User IDs logged to Cloudflare (privacy concern)
**Data Minimization:** Logs retained longer than necessary

#### The Problem

```typescript
// Throughout codebase:
console.log(`[Token Consumption] User ${userId} balance check`);
console.log(`[NBP OAuth] User found in database: ${dbUser.user_id}`);
console.error(`[Account Deletion] Deleting account for user: ${userId}`);
```

**Cloudflare Logs:**
```
[2025-10-18T14:32:15.123Z] [Token Consumption] User 82af3c09-1234-5678-90ab-cdef12345678 balance check
[2025-10-18T14:32:16.456Z] [Account Deletion] Deleting account for user: 82af3c09-...
```

**Privacy Issue:**
- User IDs are quasi-identifiers
- Can correlate with other logs
- Retained by Cloudflare for days/weeks
- Not anonymized when user deletes account

#### Fix

```typescript
// Hash user IDs in logs
function hashUserId(userId: string): string {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId))
    .then(buf => Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 8));  // First 8 chars of hash
}

// Usage:
console.log(`[Token Consumption] User ${await hashUserId(userId)} balance check`);
// Output: [Token Consumption] User a3f8c2d1 balance check
```

---

### 🟠 MEDIUM #7: No Notification to User After Deletion

**Severity:** 🟠 MEDIUM
**Impact:** User doesn't receive confirmation email
**UX:** User unsure if deletion worked

#### The Problem

**Current Flow:**
```
User clicks "Delete Account"
→ HTTP 200 response
→ Redirect to home page
→ ❌ No email confirmation
```

**User Concerns:**
- "Did the deletion work?"
- "Will I stop being charged?"
- "Can I verify my data was deleted?"
- "What if there was an error?"

**Best Practice:**
```
User deletes account
→ Immediate: "Account deletion initiated"
→ Email 1: "We're processing your deletion request"
→ Email 2 (24h later): "Your account has been permanently deleted"
```

#### Fix

```typescript
// After successful deletion:
await sendEmail({
  to: anonymizedEmail,  // ❌ Can't send to anonymized email
  // PROBLEM: We already anonymized the email!

  // SOLUTION: Send email BEFORE anonymizing
  to: originalEmail,
  subject: 'Account Deletion Confirmation',
  body: `
    Your account has been successfully deleted.

    - Account deleted: ${new Date().toISOString()}
    - Token balance refunded: ${refundAmount} PLN
    - Data anonymized: Yes
    - Email available for reuse: Yes

    If you did not request this deletion, contact support immediately.
  `
});

// Then anonymize:
await db.prepare('UPDATE users SET email = ? WHERE user_id = ?')
  .bind(anonymizedEmail, userId).run();
```

---

### 🟠 MEDIUM #8: Soft Delete vs Hard Delete Strategy Unclear

**Severity:** 🟠 MEDIUM
**Impact:** Confusion about deletion permanence
**Architecture:** Mixed approach (soft + hard)

#### Current Implementation

**Soft Delete (is_deleted flag):**
```sql
UPDATE users SET is_deleted = 1 WHERE user_id = ?;
-- ✅ Row remains in database
-- ✅ Can preserve foreign key integrity
-- ✅ Can analyze deleted users
```

**Hard Delete (row removal):**
```sql
DELETE FROM oauth_tokens WHERE user_id = ?;
-- ✅ Row physically removed
-- ✅ Free up storage
-- ✅ Faster queries (no need to filter is_deleted)
```

**Current Mix:**
- `users` table: Soft delete (is_deleted = 1)
- OAuth tokens: Hard delete (KV delete)
- Sessions: Hard delete (KV delete)
- Transactions: Not deleted (foreign key to user_id)
- MCP actions: Not deleted (foreign key to user_id)

**Problem:**
- Inconsistent strategy
- Some data hard-deleted, some soft-deleted
- Foreign keys reference soft-deleted users
- Cannot truly purge user from database

#### Design Decision Needed

**Option 1: Fully Soft Delete**
```sql
-- All tables keep rows, use is_deleted flag
UPDATE users SET is_deleted = 1 WHERE user_id = ?;
UPDATE oauth_tokens SET is_deleted = 1 WHERE user_id = ?;
UPDATE sessions SET is_deleted = 1 WHERE user_id = ?;

-- Queries must always filter:
SELECT * FROM users WHERE is_deleted = 0;
```

**Pros:**
- ✅ Can restore deleted accounts
- ✅ Maintain referential integrity
- ✅ Analyze deleted user patterns

**Cons:**
- ❌ Database grows forever
- ❌ All queries slower (filter is_deleted)
- ❌ More complex GDPR compliance

**Option 2: Fully Hard Delete After Grace Period**
```sql
-- Immediate: Soft delete
UPDATE users SET deletion_scheduled = NOW() + 7 days;

-- After 7 days: Hard delete everything
DELETE FROM transactions WHERE user_id = ?;
DELETE FROM mcp_actions WHERE user_id = ?;
DELETE FROM users WHERE user_id = ?;
```

**Pros:**
- ✅ Database stays clean
- ✅ GDPR-compliant (actual deletion)
- ✅ No query performance impact

**Cons:**
- ❌ Cannot restore after hard delete
- ❌ Lose analytics data
- ❌ Complex cascade deletion logic

**Option 3: Hybrid (Current Approach)**
- Soft delete users table
- Hard delete OAuth/sessions (temporary data)
- Preserve transactions/actions (business records)
- Anonymize PII fields

**Recommendation:**
- Document current strategy clearly
- Add scheduled job to purge old soft-deleted users (e.g., after 1 year)
- Implement data retention policy

---

## 4. Low Priority Issues

### 🟢 LOW #1: Deletion Metrics Not Tracked

**Severity:** 🟢 LOW
**Impact:** No monitoring of deletion performance
**Operations:** Nice-to-have

#### Missing Metrics

- Average deletion time (end-to-end)
- OAuth token cleanup duration
- Session cleanup duration
- Database transaction time
- Error rate during deletion

#### Fix

```typescript
// Add timing metrics
const startTime = Date.now();

await performDeletion(userId);

const duration = Date.now() - startTime;
analytics.track('account_deletion_completed', {
  duration_ms: duration,
  tokens_cleaned: tokenCount,
  sessions_cleaned: sessionCount,
});
```

---

### 🟢 LOW #2: No Admin Panel for Deletion Management

**Severity:** 🟢 LOW
**Impact:** Support cannot assist with deletion issues
**Operations:** Manual intervention difficult

#### Current State

**No Admin Interface For:**
- Viewing pending deletions
- Manually triggering deletion
- Restoring accidentally deleted accounts
- Viewing deletion audit logs
- Refunding deleted users

**Support Tickets:**
```
User: "I deleted my account by mistake, please restore it!"
Support: "Let me SSH into the database... hmm... where's the user_id?"
```

#### Fix

```typescript
// Admin panel endpoints (authenticated)
GET /admin/deletions/pending
GET /admin/deletions/completed
POST /admin/deletions/{userId}/restore  // If within grace period
POST /admin/deletions/{userId}/refund
```

---

### 🟢 LOW #3: No Deletion Success Rate Monitoring

**Severity:** 🟢 LOW
**Impact:** Don't know if deletions are failing silently
**Reliability:** Unknown

#### The Problem

**Questions:**
- What % of deletion requests succeed?
- What % fail partially (DB succeeds, KV fails)?
- Are there any stuck deletions?

**No Alerting:**
- If deletion endpoint returns 500
- If OAuth cleanup fails
- If database transaction fails

#### Fix

```typescript
// Track deletion outcomes
enum DeletionStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',  // DB succeeded, cleanup failed
  FAILED = 'failed',
}

await db.prepare(`
  INSERT INTO deletion_audit (
    deletion_id,
    user_id,
    status,
    error_message,
    created_at
  ) VALUES (?, ?, ?, ?, ?)
`).bind(deletionId, userId, DeletionStatus.SUCCESS, null, timestamp);

// Alert on failures:
if (status !== DeletionStatus.SUCCESS) {
  await alertOpsTeam('Deletion failed', { deletionId, error });
}
```

---

## 5. Race Condition Analysis

### Race Condition Matrix

| Concurrent Action | Deletion in Progress | Impact | Severity | Mitigation |
|-------------------|----------------------|--------|----------|------------|
| Token purchase (Stripe webhook) | Soft delete completed | New user created with same email | 🔴 CRITICAL | Check is_deleted before crediting |
| Tool execution (MCP) | Soft delete completed | Tool fails (user deleted) | 🟢 LOW | Already handled by is_deleted check |
| OAuth token refresh | Token cleanup in progress | Refresh succeeds, old token revived | 🟡 MEDIUM | Check is_deleted in refresh endpoint |
| New session creation | Session cleanup in progress | New session created after cleanup | 🟡 MEDIUM | Check is_deleted on session creation |
| Second deletion request | First deletion in progress | Duplicate deletion records | 🟢 LOW | Idempotent (already deleted) |
| Refund request | Deletion completed | Cannot refund (stripe_customer_id = NULL) | 🔴 CRITICAL | Process refund BEFORE deletion |

### Critical Race Scenarios (Detailed)

#### Scenario 1: Webhook + Deletion Race
```
Thread A (User)              Thread B (Stripe Webhook)
─────────────────            ────────────────────────
T=0  Request deletion
T=1  Lock user row?
     (❌ D1 doesn't support locks)
T=2  UPDATE is_deleted=1
T=3                          webhook.received
T=4                          getUserByEmail(email)
T=5                          → returns NULL (email anonymized)
T=6                          getOrCreateUser()
T=7                          → creates NEW user
T=8                          creditTokens(NEW_USER_ID)
T=9  Deletion completes
T=10                         Webhook completes

RESULT:
- Old user deleted (is_deleted=1)
- New user created with same email
- Tokens credited to new user
- User doesn't know they have new account
```

**Fix:**
```typescript
// In webhook handler - BEFORE creating user
const recentDeletion = await db.prepare(`
  SELECT deletion_id FROM account_deletions
  WHERE email_hash = ?
  AND deleted_at > datetime('now', '-1 hour')
`).bind(hashEmail(guestEmail)).first();

if (recentDeletion) {
  // User deleted account in last hour
  // Refund payment instead of creating new account
  await stripe.refunds.create({
    payment_intent: session.payment_intent,
    reason: 'requested_by_customer'
  });

  // Send email explaining situation
  await sendEmail({
    to: guestEmail,
    subject: 'Payment Refunded - Account Recently Deleted',
    body: 'You recently deleted your account. Your payment has been automatically refunded.'
  });

  return new Response('Payment refunded due to recent deletion', { status: 200 });
}
```

#### Scenario 2: Concurrent Deletions (Same User, Multiple Tabs)
```
Tab 1                        Tab 2
─────                        ─────
T=0  Click "Delete Account"
T=1  POST /user/delete-account
T=2  Begin deletion          Click "Delete Account"
T=3  UPDATE is_deleted=1     POST /user/delete-account
T=4                          Begin deletion
T=5                          UPDATE is_deleted=1 (no-op, already 1)
T=6  INSERT account_deletions
T=7                          INSERT account_deletions (duplicate!)
T=8  Complete                Complete

RESULT:
- 2 deletion records in account_deletions table
- Harmless but confusing for analytics
```

**Fix:**
```typescript
// Add UNIQUE constraint
CREATE UNIQUE INDEX idx_account_deletions_user_id
ON account_deletions(user_id);

// Or check before inserting:
const existing = await db.prepare(
  'SELECT deletion_id FROM account_deletions WHERE user_id = ?'
).bind(userId).first();

if (existing) {
  return new Response('Account already deleted', { status: 200 });
}
```

---

## 6. GDPR Compliance Gaps

### Compliance Checklist

| Requirement | Current Status | Gap | Severity |
|-------------|----------------|-----|----------|
| **Art. 17 - Right to Erasure** | | | |
| - Email anonymized | ✅ YES | None | - |
| - Name removed | N/A (not stored) | None | - |
| - Stripe customer deleted | ❌ NO | Customer data retained in Stripe | 🔴 CRITICAL |
| - OAuth tokens deleted | ✅ YES (main system) | MCP servers not cleaned | 🟡 HIGH |
| - Sessions deleted | ✅ YES | Race conditions possible | 🟡 MEDIUM |
| - Transaction history | ⚠️ PARTIAL | Preserved for legal compliance | 🟢 OK |
| - MCP action logs | ❌ NO | Parameters may contain PII | 🔴 CRITICAL |
| - Deletion audit | ❌ NO | Original email stored indefinitely | 🔴 CRITICAL |
| | | | |
| **Art. 20 - Right to Data Portability** | | | |
| - Data export offered | ❌ NO | No download feature | 🟡 MEDIUM |
| - Machine-readable format | ❌ NO | N/A | 🟡 MEDIUM |
| | | | |
| **Art. 5(1)(e) - Storage Limitation** | | | |
| - Retention policy defined | ❌ NO | Indefinite retention | 🟡 MEDIUM |
| - Automatic purging | ❌ NO | No scheduled cleanup | 🟡 MEDIUM |
| | | | |
| **Art. 25 - Data Protection by Design** | | | |
| - Minimal data collection | ✅ YES | Only email stored | 🟢 OK |
| - Encryption at rest | ✅ YES (Cloudflare) | N/A | - |
| - Access controls | ✅ YES (Cloudflare Access) | N/A | - |

### GDPR Risk Score

**Overall Compliance:** 🟡 **MEDIUM RISK**

**Critical Gaps (Must Fix):**
1. Stripe customer data retained (Art. 17 violation)
2. MCP action parameters contain PII (Art. 17 violation)
3. Original email in deletion audit (Art. 17 violation)

**Estimated GDPR Fine Risk:**
- **Best case:** Warning letter
- **Worst case:** €20M or 4% annual revenue (standard maximum)
- **Realistic:** €10,000 - €100,000 for SMB

---

## 7. Recommended Fixes

### Priority 1: CRITICAL Fixes (Implement Immediately)

#### Fix 1.1: Implement Token Refund System

**Effort:** 3-5 days
**Impact:** HIGH - Prevents financial loss to customers

```typescript
// Step 1: Calculate refund amount
async function calculateRefund(userId: string, db: D1Database) {
  const user = await db.prepare(
    'SELECT current_token_balance, total_tokens_purchased FROM users WHERE user_id = ?'
  ).bind(userId).first();

  // Find most recent purchase to determine price per token
  const recentPurchase = await db.prepare(`
    SELECT token_amount, stripe_payment_id
    FROM transactions
    WHERE user_id = ? AND type = 'purchase'
    ORDER BY created_at DESC LIMIT 1
  `).bind(userId).first();

  // Get payment intent to find amount paid
  const paymentIntent = await stripe.paymentIntents.retrieve(recentPurchase.stripe_payment_id);
  const amountPaidPLN = paymentIntent.amount / 100;  // Stripe stores in grosze
  const pricePerToken = amountPaidPLN / recentPurchase.token_amount;

  const refundAmountPLN = user.current_token_balance * pricePerToken;

  return {
    tokensToRefund: user.current_token_balance,
    refundAmountPLN,
    refundAmountGrosze: Math.round(refundAmountPLN * 100)
  };
}

// Step 2: Process refund via Stripe
async function processRefund(userId: string, stripeCustomerId: string) {
  const { refundAmountGrosze } = await calculateRefund(userId, env.DB);

  if (refundAmountGrosze === 0) {
    return { refunded: false, reason: 'No balance to refund' };
  }

  // Create Stripe refund
  const refund = await stripe.refunds.create({
    customer: stripeCustomerId,
    amount: refundAmountGrosze,
    reason: 'requested_by_customer',
    metadata: {
      user_id: userId,
      reason: 'account_deletion'
    }
  });

  // Record refund in database
  await db.prepare(`
    INSERT INTO transactions (
      transaction_id, user_id, type, token_amount, description, created_at
    ) VALUES (?, ?, 'refund', ?, ?, CURRENT_TIMESTAMP)
  `).bind(crypto.randomUUID(), userId, -refundAmountGrosze / 100, 'Account deletion refund');

  return { refunded: true, amount: refundAmountGrosze / 100 };
}

// Step 3: Update deletion flow
async function deleteAccountWithRefund(userId: string) {
  // 1. Calculate and process refund FIRST
  const refund = await processRefund(userId, stripeCustomerId);

  // 2. Send confirmation email (BEFORE anonymizing email)
  await sendEmail({
    to: originalEmail,
    subject: 'Account Deletion & Refund Confirmation',
    body: `
      Your account has been deleted.

      Refund issued: ${refund.amount} PLN
      Tokens refunded: ${refund.tokensToRefund}

      Refund will appear in 5-10 business days.
    `
  });

  // 3. NOW proceed with deletion
  await deleteAccount(userId);
}
```

**Migration:**
```sql
-- Add refund tracking
ALTER TABLE account_deletions
ADD COLUMN refund_amount_pln REAL;
ADD COLUMN refund_stripe_id TEXT;
ADD COLUMN refund_status TEXT; -- 'pending', 'succeeded', 'failed', 'not_applicable'
```

---

#### Fix 1.2: Delete Stripe Customer Properly

**Effort:** 2 days
**Impact:** CRITICAL - GDPR compliance

```typescript
async function deleteStripeCustomer(stripeCustomerId: string) {
  // Step 1: Detach all payment methods (required before deletion)
  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: 'card',
  });

  for (const pm of paymentMethods.data) {
    await stripe.paymentMethods.detach(pm.id);
    console.log(`Detached payment method: ${pm.id}`);
  }

  // Step 2: Delete the customer
  const deletedCustomer = await stripe.customers.del(stripeCustomerId);

  console.log(`Deleted Stripe customer: ${deletedCustomer.id}`);

  return deletedCustomer;
}

// Integrate into deletion flow
async function deleteAccount(userId: string) {
  const user = await db.prepare('SELECT stripe_customer_id FROM users WHERE user_id = ?')
    .bind(userId).first();

  if (user.stripe_customer_id) {
    // Delete from Stripe BEFORE removing reference
    await deleteStripeCustomer(user.stripe_customer_id);
  }

  // Then proceed with database deletion
  await db.batch([
    db.prepare('UPDATE users SET stripe_customer_id = NULL, is_deleted = 1, ...')
      .bind(...),
  ]);
}
```

---

#### Fix 1.3: Anonymize MCP Action Parameters

**Effort:** 1 day
**Impact:** CRITICAL - GDPR compliance

```typescript
async function anonymizeMCPActions(userId: string, db: D1Database) {
  await db.prepare(`
    UPDATE mcp_actions
    SET parameters = json_object(
      'anonymized', true,
      'anonymized_at', datetime('now'),
      'reason', 'user_account_deleted'
    )
    WHERE user_id = ?
  `).bind(userId).run();

  console.log(`Anonymized MCP action parameters for user ${userId}`);
}

// Add to deletion flow
await anonymizeMCPActions(userId, env.DB);
```

---

#### Fix 1.4: Hash Email in Deletion Audit

**Effort:** 1 day
**Impact:** CRITICAL - GDPR compliance

```typescript
async function hashEmail(email: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Update deletion audit
await db.prepare(`
  INSERT INTO account_deletions (
    deletion_id,
    user_id,
    email_hash,          -- ✅ Hash instead of plaintext
    deletion_reason,
    deleted_at
  ) VALUES (?, ?, ?, ?, ?)
`).bind(
  deletionId,
  userId,
  await hashEmail(originalEmail),  // ✅ GDPR-compliant
  'user_request',
  timestamp
);
```

**Migration:**
```sql
-- Update existing records
UPDATE account_deletions
SET email_hash = lower(hex(sha256(original_email))),
    original_email = NULL;

-- Drop old column
ALTER TABLE account_deletions DROP COLUMN original_email;
```

---

#### Fix 1.5: Add Deletion Confirmation Dialog

**Effort:** 1 day
**Impact:** HIGH - Prevents accidental deletions

```typescript
// Frontend: Add confirmation modal
function showDeletionConfirmation(user: User) {
  const modal = `
    <div class="modal">
      <h2>⚠️ Are you sure you want to delete your account?</h2>

      <div class="warning-box">
        <h3>This action cannot be undone!</h3>
        <ul>
          <li>✅ Your remaining <strong>${user.current_token_balance} tokens</strong> will be refunded (${calculateRefund(user.current_token_balance)} PLN)</li>
          <li>❌ All purchase history will be permanently deleted</li>
          <li>❌ All MCP action logs will be erased</li>
          <li>✅ Your email will be available for new registration</li>
        </ul>
      </div>

      <p>To confirm deletion, please type: <code>${user.email}</code></p>
      <input type="text" id="email-confirm" placeholder="Enter your email">

      <div class="actions">
        <button onclick="cancelDeletion()">Cancel</button>
        <button onclick="confirmDeletion()" disabled id="confirm-btn">Delete My Account</button>
      </div>
    </div>
  `;

  // Enable button only when email matches
  document.getElementById('email-confirm').addEventListener('input', (e) => {
    const matches = e.target.value === user.email;
    document.getElementById('confirm-btn').disabled = !matches;
  });
}
```

---

### Priority 2: HIGH Fixes (Implement Soon)

#### Fix 2.1: Prevent Webhook Race Condition

```typescript
// Check for recent deletions before processing payment
const recentDeletionWindow = 3600; // 1 hour

const recentDeletion = await db.prepare(`
  SELECT deletion_id, deleted_at
  FROM account_deletions
  WHERE email_hash = ?
  AND deleted_at > datetime('now', '-${recentDeletionWindow} seconds')
`).bind(await hashEmail(guestEmail)).first();

if (recentDeletion) {
  // Refund payment
  await stripe.refunds.create({
    payment_intent: session.payment_intent,
    reason: 'requested_by_customer',
    metadata: {
      reason: 'account_recently_deleted',
      deletion_id: recentDeletion.deletion_id
    }
  });

  return new Response('Payment refunded - account recently deleted', { status: 200 });
}
```

---

#### Fix 2.2: Cleanup All MCP Server OAuth Tokens

```typescript
// Create MCP server registry
const MCP_SERVERS = [
  { name: 'nbp-mcp', kvNamespaceId: 'b77ec4c7e96043fab0c466a978c2f186' },
  // Add new servers here
];

// Update deletion service
async function cleanupAllMCPTokens(userId: string, env: Env) {
  const results = [];

  for (const server of MCP_SERVERS) {
    const kv = env[`${server.name.toUpperCase()}_OAUTH_KV`];
    const count = await cleanupOAuthTokens(kv, userId);
    results.push({ server: server.name, tokensDeleted: count });
  }

  return results;
}
```

---

### Priority 3: MEDIUM Fixes (Improve When Possible)

#### Fix 3.1: Add Deletion Reason Tracking

```typescript
// Add enum for deletion reasons
enum DeletionReason {
  NO_LONGER_NEEDED = 'no_longer_needed',
  TOO_EXPENSIVE = 'too_expensive',
  PRIVACY_CONCERNS = 'privacy_concerns',
  SWITCHING_SERVICE = 'switching_service',
  BAD_EXPERIENCE = 'bad_experience',
  OTHER = 'other'
}

// Update deletion endpoint
POST /user/delete-account
{
  "reason": "too_expensive",
  "feedback": "Optional user comment"
}
```

---

### Summary of Fixes

| Priority | Fix | Effort | Impact | GDPR |
|----------|-----|--------|--------|------|
| 🔴 P1 | Token refund system | 3-5 days | HIGH | Yes |
| 🔴 P1 | Delete Stripe customer | 2 days | CRITICAL | Yes |
| 🔴 P1 | Anonymize MCP action parameters | 1 day | CRITICAL | Yes |
| 🔴 P1 | Hash email in deletion audit | 1 day | CRITICAL | Yes |
| 🔴 P1 | Add deletion confirmation | 1 day | HIGH | No |
| 🟡 P2 | Prevent webhook race | 2 days | HIGH | No |
| 🟡 P2 | Cleanup all MCP tokens | 2 days | MEDIUM | Yes |
| 🟠 P3 | Deletion reason tracking | 1 day | LOW | No |
| 🟠 P3 | Data export feature | 3 days | MEDIUM | Yes |
| 🟠 P3 | Email notifications | 1 day | LOW | No |

**Total Effort (P1):** ~9 days
**Total Effort (P1+P2):** ~13 days
**Total Effort (All):** ~18 days

---

## Conclusion

The account deletion system has **7 CRITICAL issues** that must be addressed immediately:

1. 💰 No token refund (financial loss to customers)
2. 🔒 Stripe customer not deleted (GDPR violation)
3. ⚠️ Race condition with token purchases
4. 📝 MCP action parameters contain PII
5. 📧 Original email stored in audit logs
6. 🗑️ Failed deductions not cleaned up
7. ⚡ No deletion confirmation dialog

**Legal Risk:** Current GDPR compliance gaps could result in fines up to €20M or 4% of annual revenue.

**Financial Impact:** Users lose approximately €220/month (€2,640/year) in unrefunded tokens.

**Recommendation:** Prioritize fixing all CRITICAL issues before general availability. Estimated effort: **9 days** for P1 fixes.

---

**End of Analysis**
