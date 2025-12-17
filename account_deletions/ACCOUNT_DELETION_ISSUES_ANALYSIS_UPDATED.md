# Account Deletion: Issues Analysis (UPDATED - No Refund Policy)

**Project:** MCP Token System
**Analysis Date:** 2025-10-18
**Update:** Reflects NO REFUND policy (legal per Article 38(13) Consumer Rights Act)
**Status:** 6 CRITICAL ISSUES REMAIN

---

## Business Policy Clarification

### No Refund Policy - Legal Basis

**Polish Consumer Rights Act (Ustawa o prawach konsumenta):**

**Article 38 paragraph 13:**
> Konsumentowi nie przysługuje prawo odstąpienia od umowy o dostarczanie treści cyfrowych, które nie są zapisane na nośniku materialnym, jeżeli spełnianie świadczenia rozpoczęło się za wyraźną zgodą konsumenta przed upływem terminu do odstąpienia od umowy i po poinformowaniu go przez przedsiębiorcę o utracie prawa odstąpienia od umowy.

**Translation:**
> The consumer does not have the right to withdraw from a contract for the supply of digital content which is not delivered on a tangible medium if performance has begun with the consumer's express consent before the expiry of the withdrawal period and after the consumer has been informed by the trader of the loss of the right of withdrawal.

### Implementation in Checkout

**Checkout Page Contains:**
```html
<label>
  <input type="checkbox" required>
  ☑️ Rozumiem, że tokeny są treścią cyfrową dostarczaną natychmiast.
     Wyrażam zgodę na natychmiastowe rozpoczęcie świadczenia i przyjmuję
     do wiadomości, że w związku z tym utracę prawo do odstąpienia od umowy
     zgodnie z art. 38 ust. 13 ustawy o prawach konsumenta.
</label>
```

**Translation:**
> ☑️ I understand that tokens are digital content delivered immediately.
> I consent to the immediate commencement of performance and acknowledge
> that I will therefore lose the right of withdrawal in accordance with
> Article 38(13) of the Consumer Rights Act.

### Legal Conclusion

✅ **NO REFUND REQUIRED** when user deletes account
- User explicitly consented to immediate delivery
- User was informed of loss of withdrawal right
- Tokens are digital content (non-refundable)
- Account deletion = user's choice, not product defect

---

## Updated Critical Issues (6 Remaining)

### 🔴 CRITICAL #1: Token Loss Without Warning

**Severity:** 🔴 CRITICAL (UX, not legal)
**Impact:** Users lose tokens without understanding consequences
**Legal Risk:** None (refund not required)
**Reputational Risk:** HIGH

#### The Problem

**Current Deletion Flow:**
```
User clicks "Delete Account" → ❌ IMMEDIATE deletion
- No warning about token loss
- No display of current balance
- No explanation that tokens are non-refundable
- User shocked: "I had 1500 tokens!"
```

**Business Impact:**
- Negative reviews: "They deleted my tokens without warning!"
- Support tickets: "I didn't know I would lose my tokens"
- Even though legal, poor UX damages trust

#### Required Fix: Clear Warning

```typescript
// Deletion confirmation dialog
function showDeletionWarning(user: User) {
  return `
    <div class="deletion-warning">
      <h2>⚠️ Czy na pewno chcesz usunąć konto?</h2>

      <div class="critical-warning">
        <h3>❌ UTRACISZ WSZYSTKIE TOKENY</h3>
        <p class="balance-warning">
          Aktualny stan: <strong>${user.current_token_balance} tokenów</strong>
        </p>
        <p class="no-refund-notice">
          ℹ️ Tokeny są treścią cyfrową dostarczoną natychmiast.
          Zgodnie z art. 38 ust. 13 ustawy o prawach konsumenta,
          <strong>nie przysługuje zwrot środków</strong> za niewykorzystane tokeny.
        </p>
      </div>

      <div class="consequences">
        <h3>Co zostanie usunięte:</h3>
        <ul>
          <li>❌ ${user.current_token_balance} tokenów (bez zwrotu)</li>
          <li>❌ Historia zakupów</li>
          <li>❌ Logi użycia MCP</li>
          <li>✅ Email będzie dostępny do ponownej rejestracji</li>
        </ul>
      </div>

      <p class="confirmation-required">
        Aby potwierdzić, wpisz swój email: <code>${user.email}</code>
      </p>
      <input type="text" id="email-confirm" placeholder="Wpisz email">

      <div class="actions">
        <button onclick="cancel()">Anuluj</button>
        <button onclick="confirmDeletion()" disabled id="delete-btn">
          Rozumiem i usuwam konto
        </button>
      </div>
    </div>
  `;
}
```

**Translation:**
> Are you sure you want to delete your account?
>
> YOU WILL LOSE ALL TOKENS
> Current balance: X tokens
>
> ℹ️ Tokens are digital content delivered immediately.
> According to Article 38(13) of the Consumer Rights Act,
> there is no refund for unused tokens.
>
> What will be deleted:
> - X tokens (no refund)
> - Purchase history
> - MCP usage logs
> - Email will be available for re-registration

---

### 🔴 CRITICAL #2: Stripe Customer Not Deleted (GDPR Violation)

**Severity:** 🔴 CRITICAL
**Impact:** GDPR Article 17 violation - personal data retained in Stripe
**Legal Risk:** Up to €20M or 4% annual revenue fine

#### The Problem

```typescript
// Current code only removes link
db.prepare(`UPDATE users SET stripe_customer_id = NULL WHERE user_id = ?`)

// ❌ Stripe customer object still exists with:
{
  email: "user@example.com",  // PII
  name: "Jan Kowalski",       // PII
  payment_methods: ["pm_123"] // Payment data
}
```

#### Required Fix

```typescript
async function deleteStripeCustomer(stripeCustomerId: string) {
  // 1. Detach all payment methods
  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: 'card',
  });

  for (const pm of paymentMethods.data) {
    await stripe.paymentMethods.detach(pm.id);
  }

  // 2. Delete customer from Stripe
  await stripe.customers.del(stripeCustomerId);

  console.log(`✅ Deleted Stripe customer: ${stripeCustomerId}`);
}

// Call during account deletion (BEFORE setting stripe_customer_id = NULL)
await deleteStripeCustomer(user.stripe_customer_id);
```

**Note:** This is safe because we're NOT issuing refunds. If we were, we'd need to keep the customer for refund processing.

---

### 🔴 CRITICAL #3: MCP Action Parameters Contain PII

**Severity:** 🔴 CRITICAL
**Impact:** User data stored in `mcp_actions.parameters` JSON field
**GDPR Violation:** Article 17 - data not erased

#### The Problem

```sql
SELECT parameters FROM mcp_actions WHERE user_id = '82af3c09-...';

Result:
{
  "params": { "currencyCode": "USD" },
  "result": {
    "rate": 4.15,
    "requestedBy": "user@example.com",  // ❌ EMAIL
    "clientIp": "192.168.1.100"         // ❌ IP ADDRESS
  }
}
```

#### Required Fix

```typescript
async function anonymizeMCPActions(userId: string, db: D1Database) {
  await db.prepare(`
    UPDATE mcp_actions
    SET parameters = json_object(
      'anonymized', true,
      'anonymized_at', datetime('now'),
      'original_tool', tool_name
    )
    WHERE user_id = ?
  `).bind(userId).run();
}

// Add to deletion flow
await anonymizeMCPActions(userId, env.DB);
```

---

### 🔴 CRITICAL #4: Original Email in Deletion Audit

**Severity:** 🔴 CRITICAL
**Impact:** `account_deletions.original_email` retained indefinitely
**GDPR Violation:** Contradicts anonymization

#### The Problem

```typescript
db.prepare(`
  INSERT INTO account_deletions (original_email, ...)
  VALUES (?, ...)
`).bind('user@example.com', ...)

// ❌ Stores plaintext email forever
```

#### Required Fix

```typescript
async function hashEmail(email: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Store hash instead of plaintext
await db.prepare(`
  INSERT INTO account_deletions (
    deletion_id,
    user_id,
    email_hash,  // ✅ SHA-256 hash
    token_balance_at_deletion,  // NEW: Track lost tokens
    deletion_reason,
    deleted_at
  ) VALUES (?, ?, ?, ?, ?, ?)
`).bind(
  deletionId,
  userId,
  await hashEmail(originalEmail),
  currentTokenBalance,  // Record how many tokens user lost
  'user_request',
  timestamp
);
```

**Benefit:** Can still detect re-registration attempts without storing email.

---

### 🔴 CRITICAL #5: Failed Deductions Table Not Cleaned

**Severity:** 🔴 CRITICAL
**Impact:** `failed_deductions` contains user_id + PII parameters
**GDPR Violation:** User data retained after deletion

#### The Problem

```sql
SELECT * FROM failed_deductions WHERE user_id = '82af3c09-...';

Result:
user_id: 82af3c09-...      // ❌ Links to deleted user
parameters: {...}          // ❌ May contain PII
error_message: "DB failed"
```

#### Required Fix

```typescript
async function cleanupFailedDeductions(userId: string, db: D1Database) {
  await db.prepare(`
    UPDATE failed_deductions
    SET
      user_id = 'DELETED',
      parameters = json_object('anonymized', true),
      resolved = 1,
      resolution_note = 'User account deleted - reconciliation cancelled'
    WHERE user_id = ? AND resolved = 0
  `).bind(userId).run();

  console.log(`✅ Anonymized failed deductions for user ${userId}`);
}

// Add to deletion flow
await cleanupFailedDeductions(userId, env.DB);
```

---

### 🔴 CRITICAL #6: Race Condition - Payment During Deletion

**Severity:** 🔴 CRITICAL
**Impact:** User pays 25 PLN → Account deletes → Tokens lost immediately
**Financial Impact:** Customer paid but got nothing

#### The Problem

**Timeline:**
```
T=0  User clicks "Delete Account"
T=1  Deletion starts
T=2  Database: is_deleted = 1
T=3  Stripe webhook arrives (delayed): checkout.session.completed
T=4  Webhook: getOrCreateUser(email)
T=5  Email query returns NULL (anonymized to deleted+uuid@wtyczki.ai)
T=6  Webhook creates NEW user with same email
T=7  2000 tokens credited to NEW user
T=8  ❌ User doesn't know they have new account with 2000 tokens
```

**User Experience:**
```
User: "I deleted my account but was charged €25!"
Support: "You have a new account with 2000 tokens"
User: "But I don't want the service anymore!"
User: "I want a refund!"
Support: "No refunds per terms of service"
User: ⭐☆☆☆☆ (1-star review)
```

#### Required Fix

```typescript
// In webhook handler BEFORE creating user
const recentDeletion = await db.prepare(`
  SELECT deletion_id, deleted_at, email_hash
  FROM account_deletions
  WHERE email_hash = ?
  AND deleted_at > datetime('now', '-1 hour')
`).bind(await hashEmail(guestEmail)).first();

if (recentDeletion) {
  console.log(`⚠️ Payment received for recently deleted account: ${guestEmail}`);

  // OPTION 1: Refund automatically (safest for reputation)
  await stripe.refunds.create({
    payment_intent: session.payment_intent,
    reason: 'requested_by_customer',
    metadata: {
      reason: 'account_deleted_during_checkout',
      deletion_id: recentDeletion.deletion_id
    }
  });

  // Send email explaining situation
  await sendEmail({
    to: guestEmail,
    subject: 'Płatność zwrócona - konto zostało usunięte',
    body: `
      Otrzymaliśmy Twoją płatność, ale Twoje konto zostało niedawno usunięte.

      Automatycznie zwróciliśmy płatność: 25 PLN
      Zwrot pojawi się na koncie w ciągu 5-10 dni roboczych.

      Jeśli chcesz ponownie korzystać z usługi, możesz utworzyć nowe konto.
    `
  });

  return new Response('Payment refunded - account recently deleted', { status: 200 });

  // OPTION 2: Create account and send notification (risky - user may not check email)
  // NOT RECOMMENDED - user explicitly deleted account
}
```

**Why automatic refund is better:**
- User clearly didn't want the service (they deleted account)
- Better reputation (no angry reviews)
- Avoids customer service burden
- Small cost (one refund) vs. reputation damage

**Alternative: Prevent payment entirely**
```typescript
// Cancel pending Stripe checkout sessions on deletion
const pendingCheckouts = await db.prepare(
  'SELECT stripe_session_id FROM pending_checkouts WHERE user_id = ?'
).bind(userId).all();

for (const checkout of pendingCheckouts.results) {
  await stripe.checkout.sessions.expire(checkout.stripe_session_id);
  console.log(`Cancelled pending checkout: ${checkout.stripe_session_id}`);
}
```

---

## Updated Issue Summary

### Critical Issues (6 total)

| Issue | Impact | Legal Risk | Fix Effort |
|-------|--------|------------|------------|
| 1. No deletion warning | UX damage, support burden | None | 1 day |
| 2. Stripe customer not deleted | GDPR violation | €20M fine | 2 days |
| 3. MCP parameters contain PII | GDPR violation | €10K-100K fine | 1 day |
| 4. Email in deletion audit | GDPR violation | €10K-100K fine | 1 day |
| 5. Failed deductions not cleaned | GDPR violation | €10K-100K fine | 1 day |
| 6. Payment race condition | Financial loss, bad reviews | None | 2 days |

**Total Effort:** 8 days

### Issues REMOVED (No Longer Critical)

❌ ~~No token refund system~~ - NOT REQUIRED (legal per Article 38(13))
- User waived withdrawal right during checkout
- No refund obligation
- **BUT:** Must clearly warn about token loss during deletion

---

## Recommended Fixes (Updated Priority)

### Priority 1: GDPR Compliance (5 days)

**Must fix before GA:**

1. **Delete Stripe Customer** (2 days)
   - Detach payment methods
   - Delete customer object
   - GDPR Article 17 compliance

2. **Anonymize MCP Action Parameters** (1 day)
   - Replace JSON with `{"anonymized": true}`
   - Remove all PII from parameters field

3. **Hash Email in Deletion Audit** (1 day)
   - Use SHA-256 hash instead of plaintext
   - Can still detect re-registration

4. **Clean Failed Deductions** (1 day)
   - Set user_id = 'DELETED'
   - Anonymize parameters
   - Mark as resolved

---

### Priority 2: UX & Safety (3 days)

**Highly recommended:**

1. **Add Deletion Warning Dialog** (1 day)
   ```
   - Show current token balance
   - Explain no refund policy
   - Require email confirmation
   - "Are you sure?" protection
   ```

2. **Handle Payment Race Condition** (2 days)
   ```
   - Detect recent deletions in webhook
   - Auto-refund if user deleted account <1 hour ago
   - Send explanation email
   - Prevents bad reviews
   ```

---

## Updated Token Loss Policy

### Legal Documentation Required

**Terms of Service must clearly state:**

```markdown
## 8. Tokeny i Usuwanie Konta

8.1. Tokeny są treścią cyfrową dostarczaną natychmiast po zakupie.

8.2. Zgodnie z art. 38 ust. 13 ustawy o prawach konsumenta,
     wyrażając zgodę na natychmiastowe dostarczenie tokenów,
     tracisz prawo do odstąpienia od umowy.

8.3. W przypadku usunięcia konta:
     - Wszystkie niewykorzystane tokeny przepadają
     - Nie przysługuje zwrot środków za niewykorzystane tokeny
     - Historia zakupów i użycia zostanie usunięta
     - Email zostanie dostępny do ponownej rejestracji

8.4. WAŻNE: Przed usunięciem konta wykorzystaj wszystkie tokeny.
     Usunięcie konta jest nieodwracalne.
```

**Translation:**
> 8. Tokens and Account Deletion
>
> 8.1. Tokens are digital content delivered immediately after purchase.
>
> 8.2. In accordance with Article 38(13) of the Consumer Rights Act,
>      by consenting to immediate delivery of tokens,
>      you lose the right to withdraw from the contract.
>
> 8.3. In case of account deletion:
>      - All unused tokens are forfeited
>      - No refund for unused tokens
>      - Purchase and usage history will be deleted
>      - Email will be available for re-registration
>
> 8.4. IMPORTANT: Use all tokens before deleting your account.
>      Account deletion is irreversible.

---

### Deletion Flow with Clear Warnings

```typescript
async function initiateAccountDeletion(userId: string) {
  // 1. Get user data
  const user = await db.prepare(
    'SELECT email, current_token_balance FROM users WHERE user_id = ?'
  ).bind(userId).first();

  // 2. Show warning modal
  const confirmed = await showDeletionWarning({
    email: user.email,
    tokenBalance: user.current_token_balance,
    noRefundNotice: true
  });

  if (!confirmed) {
    return { cancelled: true };
  }

  // 3. Require email re-entry for confirmation
  const emailConfirmed = await requireEmailConfirmation(user.email);

  if (!emailConfirmed) {
    return { cancelled: true, reason: 'email_mismatch' };
  }

  // 4. Log deletion with token balance
  await db.prepare(`
    INSERT INTO account_deletions (
      deletion_id,
      user_id,
      email_hash,
      tokens_forfeited,  -- NEW: Track how many tokens user lost
      deletion_reason,
      user_acknowledged_no_refund,  -- NEW: Track that user saw warning
      deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    crypto.randomUUID(),
    userId,
    await hashEmail(user.email),
    user.current_token_balance,
    'user_request',
    true  // User clicked "I understand" checkbox
  );

  // 5. Proceed with deletion
  await deleteAccount(userId);

  // 6. Send confirmation email (BEFORE anonymizing)
  await sendEmail({
    to: user.email,
    subject: 'Potwierdzenie usunięcia konta',
    body: `
      Twoje konto zostało usunięte.

      Utracone tokeny: ${user.current_token_balance}
      (zgodnie z polityką braku zwrotów)

      Email ${user.email} jest dostępny do ponownej rejestracji.
    `
  });

  return { deleted: true, tokensForfeited: user.current_token_balance };
}
```

---

## Business Metrics to Track

### Deletion Analytics Dashboard

**Track in `account_deletions` table:**

```sql
-- 1. How many tokens are being forfeited?
SELECT
  DATE(deleted_at) as deletion_date,
  COUNT(*) as deletions,
  SUM(tokens_forfeited) as total_tokens_lost,
  AVG(tokens_forfeited) as avg_tokens_per_deletion,
  SUM(tokens_forfeited) * 0.0125 as estimated_revenue_retained_pln
FROM account_deletions
WHERE deleted_at >= DATE('now', '-30 days')
GROUP BY DATE(deleted_at);

-- Example output:
-- Date       | Deletions | Tokens Lost | Avg/User | Revenue Retained
-- 2025-10-18 |     5     |    7500     |   1500   |      93.75 PLN
```

**Value of Forfeited Tokens:**
- Users lose tokens → You retain that revenue
- Example: If 100 users/month delete with avg 800 tokens each
- 100 × 800 × 0.0125 PLN = **1,000 PLN/month** retained revenue
- This is NOT lost money - it's already paid by users

**Insight:**
- Track if users are deleting with high token balances
- If yes: Consider email campaigns "Use your tokens before they expire"
- Reduce forfeitures by encouraging usage

---

## Conclusion

### Updated Critical Issues: 6 (down from 7)

✅ **Removed:** Token refund requirement (not legally required)

🔴 **Remaining Critical:**
1. No deletion warning (UX damage)
2. Stripe customer not deleted (GDPR)
3. MCP parameters contain PII (GDPR)
4. Email in deletion audit (GDPR)
5. Failed deductions not cleaned (GDPR)
6. Payment race condition (financial/reputation risk)

### GDPR Risk: 🟡 MEDIUM

**Must fix:** Issues #2-5 (Stripe customer, MCP parameters, email hash, failed deductions)
**Estimated fine risk:** €10,000 - €100,000

### Effort Required

- **GDPR fixes (P1):** 5 days
- **UX + Safety (P2):** 3 days
- **Total:** 8 days

### Key Difference from Original Analysis

**Original assumption:** Must refund unused tokens
**Actual business model:** No refunds (legal per waiver checkbox)

**Impact:**
- ✅ Simpler implementation (no refund system needed)
- ✅ Revenue retained when users delete
- ⚠️ MUST clearly warn users about token loss
- ⚠️ MUST handle payment race condition (auto-refund if deleted <1hr ago)

**Recommendation:**
Focus on GDPR compliance (5 days) + deletion warning UX (1 day) = **6 days minimum** before GA.

---

**End of Updated Analysis**
