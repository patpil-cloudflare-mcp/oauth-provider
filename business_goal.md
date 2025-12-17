# MCP Token System - Complete Business & Technical Documentation

**Version:** 3.0
**Last Updated:** 2025-10-18
**Purpose:** Comprehensive system documentation for development, expansion, and maintenance

**Version 3.0 Updates:**
- ✨ Added Section 13: Account Deletion System (GDPR compliance)
- ✨ Added Section 14: Reconciliation & Reliability (automatic recovery)
- ✨ Added Section 15: Advanced Idempotency (multi-layer protection)
- ✨ Added Section 16: Edge Case Handling (6 critical scenarios)
- 📊 Updated Section 8: Database Schema (5 tables instead of 3)
- 🔄 Documented 11 migrations (0001-0011) with full details

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Business Model](#2-business-model)
3. [System Architecture](#3-system-architecture)
4. [Authentication System](#4-authentication-system)
5. [Payment System](#5-payment-system)
6. [Token Management](#6-token-management)
7. [User Journeys](#7-user-journeys)
8. [Database Schema](#8-database-schema)
9. [Security & Reliability](#9-security--reliability)
10. [Technical Implementation Details](#10-technical-implementation-details)
11. [Future Expansion Guide](#11-future-expansion-guide)
12. [Operational Guidelines](#12-operational-guidelines)
13. [Account Deletion System](#13-account-deletion-system)
14. [Reconciliation & Reliability](#14-reconciliation--reliability)
15. [Advanced Idempotency](#15-advanced-idempotency)
16. [Edge Case Handling](#16-edge-case-handling)

---

## 1. EXECUTIVE SUMMARY

### What This System Does

The MCP Token System is a **prepaid token-based platform** that enables users to access AI-powered MCP (Model Context Protocol) servers. Users purchase tokens upfront and consume them by performing actions through various MCP servers - think of it as an arcade: users buy tokens at the entrance, then use them to access different AI services.

### Business Model at a Glance

- **Revenue Model:** One-time token package sales (no subscriptions)
- **Target Market:** 2,000+ users, 30-200 MCP servers
- **Pricing Tiers:** Starter (10 PLN / 500 tokens), Plus (25 PLN / 2,000 tokens), Pro (59 PLN / 5,500 tokens), Gold (119 PLN / 12,000 tokens)
- **Competitive Advantage:** No subscriptions, no expiration, pay-per-use simplicity

### Technology Stack

- **Platform:** Cloudflare Workers (serverless, globally distributed)
- **Language:** TypeScript
- **Database:** Cloudflare D1 (SQLite at the edge)
- **Payment Processing:** Stripe (card, BLIK, Przelewy24)
- **Authentication:** Dual system - WorkOS + Custom Magic Auth with CSRF protection
- **OAuth Provider:** OAuth 2.1 with mandatory PKCE (S256), token revocation, refresh rotation
- **Session Storage:** Cloudflare KV (OAuth tokens, user sessions)

### Key Architectural Decisions

1. **Database as Single Source of Truth:** All token balances queried in real-time from D1 (no caching)
2. **Dual Payment Processing:** Success page + webhook for reliability
3. **Idempotency Protection:** Prevents double-crediting via unique payment IDs
4. **Atomic Transactions:** All balance updates are all-or-nothing operations
5. **Guest Checkout Support:** Users can purchase before creating an account
6. **Dual Authentication System:** WorkOS for simplicity + Custom Magic Auth for better UX

---

## 2. BUSINESS MODEL

### Revenue Streams

**Primary Revenue:** Token Package Sales

Users purchase token packages through Stripe checkout. Each package provides a specific number of tokens that never expire.

### Pricing Structure

| Package | Price (PLN) | Tokens | Cost per Token | Savings | Target User |
|---------|-------------|--------|----------------|---------|-------------|
| **Starter** | 10 | 500 | 0.02 PLN | Baseline | First-time users, testing |
| **Plus** | 25 | 2,000 | 0.0125 PLN | 37.5% | Occasional use |
| **Pro** | 59 | 5,500 | 0.0107 PLN | 46.5% | Regular users |
| **Gold** | 119 | 12,000 | 0.0099 PLN | 50.5% | Power users, businesses |

**Pricing Strategy:**
- Volume discounts incentivize larger purchases
- No subscriptions reduce commitment anxiety
- No expiration removes urgency pressure
- Transparent pricing builds trust

### Why This Model Works

**For Users:**
- **Low friction:** No recurring billing to cancel
- **Clear value:** Exact cost per action is visible
- **Fair pricing:** Only pay for actual usage
- **No pressure:** Tokens never expire

**For Business:**
- **Predictable revenue:** Upfront payments
- **Low churn:** No subscription cancellations
- **Scalable:** Add new MCP servers without pricing complexity
- **Simple accounting:** One-time transactions

### Market Positioning

**Target Segments:**
1. **Individual AI Users:** ChatGPT Plus/Claude Pro subscribers who need specialized tools
2. **Developers:** Testing MCP servers during development
3. **Small Businesses:** Occasional AI automation needs
4. **Power Users:** Regular access to multiple MCP servers

**Competitive Advantages:**
1. No subscription fatigue
2. Pay-per-use transparency
3. Multi-server access with single token balance
4. Guest checkout for zero-friction first purchase

---

## 3. SYSTEM ARCHITECTURE

### Core Components Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     PUBLIC INTERNET                          │
└──────────────┬──────────────────────────────────────────────┘
               │
               ├──────> User Browser (Guest/Authenticated)
               │
               ↓
┌──────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKERS (Edge Runtime)                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Main Worker (src/index.ts)                            │  │
│  │  - Public routes (/, /checkout/create-guest)           │  │
│  │  - Protected routes (/dashboard, /user/*)              │  │
│  │  - Authentication endpoints (/auth/*)                  │  │
│  │  - OAuth endpoints (/oauth/*)                          │  │
│  │  - MCP endpoints (/mcp/calculator)                     │  │
│  │  - Webhook endpoint (/stripe/webhook)                  │  │
│  └────────────────────────────────────────────────────────┘  │
└───────┬────────────┬────────────┬──────────────┬─────────────┘
        │            │            │              │
        ↓            ↓            ↓              ↓
   ┌─────────┐  ┌────────┐  ┌─────────┐  ┌──────────┐
   │   D1    │  │   KV   │  │ WorkOS  │  │  Stripe  │
   │Database │  │Sessions│  │UserMgmt │  │ Payments │
   └─────────┘  └────────┘  └─────────┘  └──────────┘
```

### Component Responsibilities

#### 1. Main Worker (src/index.ts)
**Purpose:** Central request router and handler

**Responsibilities:**
- Route incoming HTTP requests to appropriate handlers
- Apply authentication middleware to protected routes
- Coordinate between authentication, payment, and token management modules
- Serve public home page and protected dashboard

**Public Endpoints:**
- `GET /` - Public home page (guest checkout)
- `POST /checkout/create-guest` - Create guest checkout session
- `GET /checkout/success` - Payment success page (public for guest flow)
- `POST /stripe/webhook` - Stripe event handler
- `GET /privacy` - Privacy policy page
- `GET /terms` - Terms of service page

**Protected Endpoints (require authentication):**
- `GET /dashboard` - User dashboard with balance and transaction history
- `GET /auth/user` - Get current user profile (API)
- `GET /user/transactions` - Get transaction history (API)
- `POST /checkout/create` - Create authenticated checkout session
- `POST /auth/logout` - Logout and clear session

**Authentication Endpoints (public but create sessions):**
- `GET /auth/login` - Redirect to WorkOS authentication
- `GET /auth/callback` - Handle WorkOS callback
- `GET /auth/login-custom` - Custom Magic Auth login page
- `POST /auth/login-custom/send-code` - Send Magic Auth code
- `POST /auth/login-custom/verify-code` - Verify code and create session

**OAuth 2.1 Endpoints (for MCP servers - PKCE required):**
- `GET /oauth/authorize` - Authorization endpoint (requires PKCE S256)
- `POST /oauth/token` - Token exchange (supports authorization_code and refresh_token)
- `POST /oauth/revoke` - Token revocation endpoint (RFC 7009)
- `GET /oauth/userinfo` - User info endpoint
- `GET /.well-known/oauth-authorization-server` - OAuth metadata (RFC 8414)

**MCP Server Endpoints (OAuth Bearer token required):**
- `POST /mcp/calculator` - Calculator operations
- `GET /mcp/calculator/health` - Health check

#### 2. Database Layer (Cloudflare D1)
**Purpose:** Single source of truth for all system data

**Tables:**
- `users` - User accounts and token balances
- `transactions` - Immutable transaction history
- `mcp_actions` - Detailed MCP usage logs

**Characteristics:**
- SQLite database at Cloudflare edge
- <50ms query latency typical
- ACID guarantees for transactions
- Automatic replication across regions

**Critical Principle:** NEVER cache token balances. Always query database for current state.

#### 3. Session Storage (Cloudflare KV)
**Purpose:** Fast key-value storage for temporary data

**Stored Data:**
- OAuth authorization codes (10 min TTL)
- OAuth access tokens (30 min TTL) - OAuth 2.1 security requirement
- OAuth refresh tokens (30 days TTL, rotated on use)
- WorkOS user sessions (72 hours TTL)
- CSRF tokens for Magic Auth (10 min TTL)

**Characteristics:**
- Eventually consistent (global)
- Automatic TTL/expiration
- Key-value only (no complex queries)

#### 4. Authentication System (WorkOS + Custom Magic Auth)
**Purpose:** Verify user identity for dashboard and MCP access

**Dual System:**
1. **WorkOS:** Enterprise-grade authentication (primary)
2. **Custom Magic Auth:** Simplified email-based login (better UX)

**Why Dual System:**
- WorkOS provides OAuth/SSO capabilities (future expansion)
- Magic Auth provides simpler UX for token-only users
- Both systems share same user database (users table)
- Session format identical - transparent to application

#### 5. Payment Processor (Stripe)
**Purpose:** Handle credit card payments securely

**Supported Payment Methods:**
- Credit/debit cards (Visa, Mastercard, Amex)
- BLIK (Polish instant payment)
- Przelewy24 (Polish bank transfers)

**Integration Points:**
- Checkout sessions for payment collection
- Webhooks for payment notifications
- Customer management for user linking
- Price metadata for token amounts

#### 6. OAuth 2.1 Provider (Custom Implementation)
**Purpose:** Secure MCP server access with modern OAuth 2.1 security

**Flow:**
1. MCP server redirects user to `/oauth/authorize` with PKCE parameters
2. User authenticates (if not already) via WorkOS Magic Auth
3. User approves MCP server access (consent screen)
4. System generates authorization code (linked to PKCE challenge)
5. MCP server exchanges code + code_verifier for access token
6. MCP server uses token for API requests

**OAuth 2.1 Security Features:**
- **Mandatory PKCE (S256 only)** - Required for all authorization requests
- **Exact redirect URI matching** - No wildcards or pattern matching
- **Short-lived tokens** - 30 minutes for access, 30 days for refresh
- **Token revocation** - RFC 7009 compliant revocation endpoint
- **Refresh token rotation** - New tokens issued on every refresh, old token invalidated
- **CSRF protection** - HttpOnly cookies with SameSite=Lax for Magic Auth
- **Scope-based permissions** - Fine-grained access control

---

## 4. AUTHENTICATION SYSTEM

### Overview: Dual Authentication Architecture

The system supports **TWO** authentication methods, both backed by the same user database:

1. **WorkOS Authentication:** Enterprise-grade, supports OAuth/SSO
2. **Custom Magic Auth:** Simplified email-based, better UX

Both methods create identical session structures in KV storage and provide seamless user experience.

### WorkOS Authentication Flow

**Technology:** WorkOS User Management API
**Purpose:** Primary authentication system with OAuth/SSO support

**Login Flow:**

```
User clicks "Login"
     ↓
GET /auth/login
     ↓
Redirect to WorkOS AuthKit
     ↓
User enters email
     ↓
WorkOS sends OTP to email
     ↓
User enters OTP code
     ↓
WorkOS validates code
     ↓
Redirect to /auth/callback?code=...
     ↓
Exchange code for user profile
     ↓
Get/Create user in D1 database
     ↓
Create session token (UUID)
     ↓
Store session in KV:
  - user_id
  - email
  - workos_user_id
  - access_token
  - refresh_token
  - expires_at (72 hours)
     ↓
Set workos_session cookie
     ↓
Redirect to /dashboard
```

**Implementation Files:**
- `src/workos-auth.ts` - WorkOS integration functions
- `src/auth.ts` - User management (getOrCreateUser)

**Session Structure (KV):**
```typescript
{
  user_id: string;           // Internal user ID (UUID)
  email: string;             // User email
  workos_user_id: string;    // WorkOS user ID
  access_token: string;      // WorkOS access token
  refresh_token: string;     // WorkOS refresh token
  created_at: number;        // Timestamp
  expires_at: number;        // Expiry timestamp (72 hours)
}
```

**Key Functions:**
- `getAuthorizationUrl()` - Generate WorkOS login URL
- `handleCallback()` - Exchange auth code for user session
- `validateSession()` - Verify session token from cookie
- `getLogoutUrl()` - Generate WorkOS logout URL

### Custom Magic Auth Flow

**Technology:** WorkOS MagicAuth API
**Purpose:** Simplified email-based authentication for better UX

**Why Custom Magic Auth:**
- Better UX: 2 steps instead of multiple redirects
- User control: Form stays on our domain
- Clearer errors: "Account not found? Purchase tokens to create account"
- No registration barrier: Account auto-created after first purchase

**Login Flow:**

```
User visits /auth/login-custom
     ↓
Shows email input form
     ↓
User enters email
     ↓
POST /auth/login-custom/send-code
     ↓
Check: Does user exist in D1?
     ↓
NO → Show error: "No account found. Purchase tokens to create account →"
     ↓
YES → Call WorkOS createMagicAuth({ email })
     ↓
WorkOS sends 6-digit code to email
     ↓
Show code input form
     ↓
User enters 6-digit code
     ↓
POST /auth/login-custom/verify-code
     ↓
Call WorkOS authenticateWithMagicAuth({ code, email })
     ↓
WorkOS validates code
     ↓
Load user from D1 database
     ↓
Update last_login_at timestamp
     ↓
Create session token (UUID)
     ↓
Store session in KV (same format as WorkOS)
     ↓
Set workos_session cookie
     ↓
Redirect to /dashboard
```

**Implementation Files:**
- `src/routes/customAuth.ts` - Custom Magic Auth endpoints
- `src/views/customLoginPage.ts` - HTML forms for email + code input

**User Experience Benefits:**
1. **Clearer onboarding:** "No account? Purchase first"
2. **Less confusing:** No unexpected redirects
3. **Faster login:** 2 steps instead of 3+ redirects
4. **Better errors:** Clear guidance on what to do

**Security Considerations:**
- Code expires after 10 minutes (WorkOS enforced)
- Code is single-use (WorkOS enforced)
- User must exist in database before login
- Session expires after 72 hours

### Authentication Middleware

**File:** `src/middleware/authMiddleware.ts`

**Purpose:** Intercept requests to protected routes and validate sessions

**Protected Routes:**
- `/dashboard` - User dashboard
- `/auth/user` - Get user profile API
- `/user/transactions` - Transaction history API

**Flow:**

```
Request arrives
     ↓
Check pathname: Is this protected?
     ↓
NO → Pass through (no auth required)
     ↓
YES → Extract session token from cookie
     ↓
No cookie? → Redirect to /auth/login
     ↓
Has cookie → Validate session in KV
     ↓
Invalid/Expired? → Redirect to /auth/login
     ↓
Valid → Load user from D1
     ↓
User not found? → Redirect to /auth/login
     ↓
User found → Attach user object to request
     ↓
Continue to route handler
```

**Key Functions:**
- `requiresAuthentication(pathname)` - Check if route needs auth
- `authenticateRequest(request, env)` - Main middleware function

### User Creation Flow

**Two Paths to User Creation:**

1. **First Login (Authenticated Purchase Flow):**
   - User logs in via WorkOS or Magic Auth
   - Email not in database → Create new user
   - Generate UUID for user_id
   - Create Stripe customer
   - Insert into D1 users table
   - Return user object

2. **Guest Purchase Flow:**
   - User purchases tokens without login
   - Webhook/success page calls `getOrCreateUser(email)`
   - Same creation logic as above
   - Also creates WorkOS user for future login

**Implementation:** `src/auth.ts` - `getOrCreateUser()`

**Created Records:**
- D1 users table: user_id, email, balances=0, stripe_customer_id
- Stripe customer: with user_id in metadata
- WorkOS user: (for guest purchases only) with email

### Session Management

**Session Duration:** 72 hours (3 days)

**Cookie Configuration:**
```javascript
workos_session=<token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=259200
```

**Security Features:**
- `HttpOnly` - Prevents JavaScript access (XSS protection)
- `Secure` - HTTPS only
- `SameSite=Lax` - CSRF protection
- `Max-Age=259200` - 72 hours (auto-expiry)

**Logout Flow:**
1. User clicks "Logout"
2. POST /auth/logout
3. Clear session from KV
4. Clear cookie (Max-Age=0)
5. Return logout URL (for WorkOS logout)

### API Keys for MCP Access (IMPLEMENTED - Phase A+)

**Purpose:** Permanent authentication for MCP servers in tools that don't support OAuth flows (AnythingLLM, Cursor IDE, custom scripts)

**Why API Keys:**
- ✅ **Simplicity:** Single Bearer token, no OAuth redirects
- ✅ **Compatibility:** Works in all MCP clients (even those without OAuth support)
- ✅ **Permanence:** Never expires unless manually revoked
- ✅ **Developer-friendly:** Easy to use in scripts and automation

#### Dual Authentication for MCP Servers

MCP servers accept **TWO** types of authentication:

| Method | Format | Expiration | Use Case | Detection |
|--------|--------|------------|----------|-----------|
| **OAuth 2.1 Token** | Random 64-char hex | 30 minutes (auto-refresh) | Interactive apps (Claude Desktop) | Standard token format |
| **API Key** | `wtyk_` + 64 hex chars | Never | Scripts, AnythingLLM, Cursor | Starts with `wtyk_` |

**Authentication Endpoint:** `GET /oauth/userinfo`

Both types are sent as Bearer tokens:
```
Authorization: Bearer <oauth_token>
Authorization: Bearer wtyk_<api_key>
```

**Detection Logic:**
```typescript
// In /oauth/userinfo endpoint
const token = request.headers.get('Authorization')?.replace('Bearer ', '');

if (token.startsWith('wtyk_')) {
  // Validate as API key
  const userId = await validateApiKey(token, env);
} else {
  // Validate as OAuth token
  const userId = await validateOAuthToken(token, env);
}
```

#### API Key Database Schema

**Table:** `api_keys`

```sql
CREATE TABLE api_keys (
  api_key_id TEXT PRIMARY KEY,           -- UUID
  user_id TEXT NOT NULL,                 -- Foreign key to users
  api_key_hash TEXT NOT NULL UNIQUE,     -- SHA-256 hash of key
  key_prefix TEXT NOT NULL,              -- First 16 chars for display
  name TEXT NOT NULL,                    -- User-provided name
  last_used_at INTEGER,                  -- Timestamp of last auth
  created_at INTEGER NOT NULL,           -- Creation timestamp
  expires_at INTEGER,                    -- Optional expiration
  is_active INTEGER NOT NULL DEFAULT 1,  -- 0 = revoked, 1 = active
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
```

#### API Key Format

```
wtyk_<64_hexadecimal_characters>

Example: wtyk_a7f3k9m2p5q8r1s4t6v9w2x5y8z1b4c7d9e2f5g8h1i4j7k0l3m6n9p2q5r8s1
```

**Format Validation:**
- Prefix: `wtyk_` (4 chars)
- Body: 64 hexadecimal characters
- Total length: 69 characters
- Character set: `[0-9a-f]` (lowercase hex)

#### API Key Generation Flow

```
User visits /dashboard/settings
     ↓
Clicks "⚙️ Ustawienia" (Settings)
     ↓
Scrolls to "🔑 Klucze API" section
     ↓
Clicks "+ Utwórz nowy klucz API"
     ↓
Enters name (e.g., "AnythingLLM")
     ↓
POST /api-keys/create
     ↓
Validate: User has < 10 active keys?
     ↓
NO → Error: "Maximum 10 keys per account"
     ↓
YES → Generate random API key:
  - prefix = "wtyk_"
  - body = 64 random hex chars (crypto.getRandomValues)
  - plaintext_key = prefix + body
     ↓
Hash the key (SHA-256):
  - api_key_hash = sha256(plaintext_key)
     ↓
Store in database:
  - api_key_id: UUID
  - user_id: current user
  - api_key_hash: SHA-256 hash
  - key_prefix: First 16 chars (wtyk_a7f3k9m2...)
  - name: User-provided name
  - created_at: Current timestamp
  - is_active: 1
     ↓
Return plaintext_key to user (ONCE!)
     ↓
Display in UI with copy button
     ↓
⚠️ USER MUST SAVE IT NOW!
(Cannot be retrieved again)
```

**Implementation Files:**
- `src/apiKeys.ts` - Core API key logic (generate, validate, revoke)
- `src/routes/apiKeySettings.ts` - CRUD endpoints
- `src/views/templates/dashboard/settings.ts` - Dashboard UI
- `migrations/0012_add_api_keys_table.sql` - Database schema

#### API Key Validation Flow

```
MCP request arrives with Authorization header
     ↓
Extract token: Bearer wtyk_a7f3k9m2...
     ↓
Detect: Starts with "wtyk_"? → API Key flow
     ↓
Validate format:
  - Length = 69 chars?
  - Starts with "wtyk_"?
  - Body = 64 hex chars?
     ↓
Invalid format? → 401 Unauthorized
     ↓
Valid format → Hash the key (SHA-256)
     ↓
Query database:
  SELECT user_id, is_active, expires_at, name
  FROM api_keys
  WHERE api_key_hash = ?
     ↓
Key not found? → 401 Unauthorized
     ↓
Key found → Check is_active
     ↓
is_active = 0? → 401 Unauthorized (revoked)
     ↓
is_active = 1 → Check expiration
     ↓
expires_at set AND < now? → 401 Unauthorized (expired)
     ↓
Valid and active → Update last_used_at
     ↓
Return user_id → Continue to MCP logic
```

**Security Features:**
- **SHA-256 hashing:** Plaintext key never stored
- **Shown once:** User must save key immediately
- **Instant revocation:** Setting `is_active=0` prevents auth
- **Last used tracking:** Monitor for suspicious activity
- **Max 10 keys:** Prevents unlimited key generation

**SHA-256 Trade-off:**
- ⚠️ **Less secure than bcrypt** (~10M hashes/sec vs ~10-100 hashes/sec)
- ✅ **Cloudflare Workers compatible** (native crypto.subtle API)
- ✅ **Still secure** with 64 hex chars (256 bits entropy)
- 🔮 **Future:** Consider bcrypt via WebAssembly (WASM)

#### API Key Management UI

**Location:** `/dashboard/settings` → **🔑 Klucze API** section

**Features:**
1. **Create New Key:**
   - Button: "+ Utwórz nowy klucz API"
   - Modal: Enter key name
   - Response: Show plaintext key ONCE with copy button

2. **List Existing Keys:**
   - Name (user-provided)
   - Prefix (e.g., `wtyk_a7f3k9m2...`)
   - Created date
   - Last used timestamp
   - Status (Active / Revoked)
   - Actions: Revoke button

3. **Revoke Key:**
   - Button: "🚫 Odwołaj klucz"
   - Confirmation dialog
   - Immediate effect (no grace period)

4. **Copy AnythingLLM Config:**
   - Pre-filled JSON snippet with user's API key
   - One-click copy to clipboard
   - Instructions for AnythingLLM setup

**Example UI Output:**
```json
{
  "mcpServers": {
    "nbp-wtyczki-ai": {
      "type": "sse",
      "url": "https://nbp.wtyczki.ai/sse",
      "headers": {
        "Authorization": "Bearer wtyk_YOUR_ACTUAL_KEY_HERE"
      }
    }
  }
}
```

#### Performance: LRU Cache for API Key Users

**Overview:** MCP servers for API key users are cached using LRU (Least Recently Used) cache to improve performance.

**Configuration:**
- **Max cached servers:** 1000 per Worker instance
- **Cache key:** user_id (same user = same cached server)
- **Eviction policy:** LRU (least recently used)

**Performance Impact:**
- **First request (cache miss):** ~30-60ms (create + cache server)
- **Subsequent requests (cache hit):** ~1ms (instant retrieval)
- **Expected hit rate:** 95-99% for active users

**Cache Characteristics:**

🔸 **Ephemeral (Non-Persistent):**
- Cache cleared on Worker eviction (deployments, inactivity, memory pressure)
- No guarantee of persistence between requests
- **This is acceptable** - cache misses simply recreate servers

🔸 **Worker-Instance-Specific:**
- Different data centers have separate caches
- Not replicated globally (unlike D1 database)

🔸 **Safe for Financial Data:**
- Token balances ALWAYS queried from D1 (never cached)
- Token consumption is atomic via D1 transactions
- MCP server recreation doesn't cause data loss
- Cache stores only server instances, not financial data

**What Gets Cached:**
- ✅ MCP server instance (tools and configurations)
- ✅ Connection state

**What Doesn't Get Cached (Always Fresh):**
- ❌ Token balance (queried on every tool use)
- ❌ Transaction history
- ❌ User data
- ❌ Tool execution results

**Reference Implementation:** `nbp-exchange-mcp/src/api-key-handler.ts`

#### API Key vs OAuth 2.1 Comparison

| Feature | API Key | OAuth 2.1 Token |
|---------|---------|-------------|
| **Format** | `wtyk_` + 64 hex | 64 hex chars |
| **Expiration** | Never | 30 minutes |
| **Refresh** | N/A | Refresh token rotation (30 days) |
| **Revocation** | Manual (settings UI) | Manual (POST /oauth/revoke) + automatic (logout) |
| **PKCE Required** | No | Yes (S256 only) |
| **Use Case** | AnythingLLM, Cursor, scripts | Claude Desktop, interactive |
| **Setup Complexity** | Simple (copy-paste) | Complex (OAuth redirect + PKCE) |
| **Security** | Good (SHA-256 hash) | Excellent (PKCE + rotation + short-lived) |
| **Best For** | Long-running scripts, tools | Interactive applications |

**Recommendation:**
- Use **OAuth 2.1 + PKCE** for interactive tools that support it (Claude Desktop, mcp-remote)
- Use **API Keys** for everything else (AnythingLLM, Cursor, scripts)

#### Common API Key Operations

**Generate Key:**
```typescript
const result = await generateApiKey(env, userId, 'AnythingLLM');
console.log('Save this key:', result.apiKey); // Shown ONCE!
```

**Validate Key:**
```typescript
const userId = await validateApiKey(apiKey, env);
if (!userId) {
  return new Response('Invalid API key', { status: 401 });
}
```

**Revoke Key:**
```typescript
const success = await revokeApiKey(env, apiKeyId, userId);
// Key stops working immediately
```

**List User Keys:**
```typescript
const keys = await listApiKeys(env, userId);
// Returns: [{id, name, prefix, created_at, last_used_at, is_active}, ...]
```

#### Limits & Constraints

- **Max keys per user:** 10 active
- **Key format:** `wtyk_` + 64 hex chars (69 total)
- **Expiration:** Never (unless manually set)
- **Rate limiting:** Shared with OAuth tokens (per-user)
- **Character set:** `[0-9a-f]` (lowercase hexadecimal)

#### Security Best Practices

**For Users:**
- ✅ Store keys in environment variables or secure vaults
- ✅ Use descriptive names ("AnythingLLM Laptop", "Production Server")
- ✅ Rotate keys every 90 days (security best practice)
- ✅ Revoke unused keys immediately
- ✅ Create separate keys for different applications
- ❌ Never commit keys to version control (add to `.gitignore`)
- ❌ Never share keys publicly (Discord, forums, screenshots)

**For Developers:**
- ✅ Validate key format before database query
- ✅ Use SHA-256 for hashing (Cloudflare Workers compatible)
- ✅ Update `last_used_at` on every successful auth
- ✅ Return same 401 error for all failure cases (timing attack prevention)
- ✅ Log key usage for audit trail

**If Key is Compromised:**
1. Immediately revoke in Settings → API Keys
2. Create new key with different name
3. Update applications with new key
4. Check balance for unauthorized usage
5. Contact support if suspicious activity detected

---

## 5. PAYMENT SYSTEM

### Stripe Integration Architecture

**API Version:** `2025-09-30.clover` (latest stable)

**Integration Pattern:** Checkout Sessions + Webhooks

**Why Checkout Sessions:**
- Pre-built payment UI (mobile responsive)
- Automatic 3D Secure handling
- Multiple payment methods (card, BLIK, P24)
- PCI compliance handled by Stripe
- No card data touches our servers

### Payment Flow: Guest Checkout (NEW)

**Purpose:** Allow users to purchase tokens BEFORE creating an account

**Why This Matters:** 30-75% higher conversion vs. mandatory registration

**Flow:**

```
User visits https://wtyczki.ai/ (public home page)
     ↓
Sees token packages (no login required)
     ↓
Enters email in input field
     ↓
Clicks "Kup teraz" (Buy now)
     ↓
POST /checkout/create-guest
  - email: user@example.com
  - priceId: price_xxx
     ↓
Validate email format
     ↓
Create Stripe Checkout Session:
  - customer_email: user@example.com
  - metadata: { guest_email: user@example.com }
  - payment_intent_data.metadata: { guest_email: user@example.com }
  - payment_method_types: ['card', 'blik', 'p24']
     ↓
Return { sessionId, url }
     ↓
Redirect user to Stripe payment page
     ↓
User completes payment
     ↓
──────────────────────────────────
PARALLEL PROCESSING (CRITICAL!)
──────────────────────────────────
     ↓
Path A: Success Page           Path B: Webhook
     ↓                              ↓
User redirected back          Stripe sends webhook
     ↓                              ↓
GET /checkout/success         POST /stripe/webhook
  ?session_id=cs_xxx            event: checkout.session.completed
     ↓                              ↓
Retrieve session              Verify webhook signature
     ↓                              ↓
Extract guest_email           Extract guest_email
     ↓                              ↓
Call getOrCreateUser()        Call getOrCreateUser()
  ↓                              ↓
  ├─> Check D1: User exists?   ├─> Check D1: User exists?
  │                             │
  NO → Create user:             NO → Create user:
       - Generate UUID                - Generate UUID
       - Create Stripe customer       - Create Stripe customer
       - Insert into D1               - Insert into D1
       - Create WorkOS user           - Create WorkOS user
  │                             │
  YES → Return existing         YES → Return existing
     ↓                              ↓
Check idempotency             Check idempotency
(payment_intent_id)           (payment_intent_id)
     ↓                              ↓
Already processed?            Already processed?
  ↓                               ↓
  YES → Return current balance    YES → Acknowledge (HTTP 200)
  │                               │
  NO → Credit tokens              NO → Credit tokens
       - Atomic transaction            - Atomic transaction
       - Insert transaction            - Insert transaction
       - Update balance                - Update balance
       - Verify balance                - Verify balance
     ↓                              ↓
Show success page             Return success JSON
"Account created!"
"2000 tokens credited!"
     ↓
User clicks "Go to dashboard"
     ↓
Redirect to /dashboard
     ↓
Auth middleware intercepts
     ↓
No session → Redirect to /auth/login
     ↓
User can now login:
- WorkOS (/auth/login) OR
- Magic Auth (/auth/login-custom)
     ↓
Tokens waiting in account!
```

**Critical Implementation Details:**

1. **Why Both Paths:**
   - Success page: User sees immediate feedback (good UX)
   - Webhook: Guarantees crediting even if browser crashes
   - Idempotency: Prevents double-crediting

2. **Metadata Fields:**
   - `session.metadata.guest_email` - Checkout session metadata
   - `payment_intent.metadata.guest_email` - Payment intent metadata
   - Used to identify guest purchases (no user_id yet)

3. **WorkOS User Creation:**
   - After crediting tokens, create WorkOS user
   - Allows user to login via WorkOS flow
   - If fails: Non-fatal (user can still use Magic Auth)

4. **Success Page Messaging:**
   - First purchase: "🎉 Pierwsze zakupy!" (First purchase!)
   - Already processed: "Zakup pomyślnie zakończony!" (Purchase completed!)
   - Always positive language (never confuse users)

**Implementation Files:**
- `src/stripe/stripeEndpoints.ts` - `handleCheckoutCreateGuest()`
- `src/stripe/stripeEndpoints.ts` - `handleCheckoutSuccess()`
- `src/stripe/stripeEndpoints.ts` - `handleStripeWebhook()`
- `src/auth.ts` - `getOrCreateUser()` (shared function)

### Payment Flow: Authenticated Purchase

**Purpose:** Allow logged-in users to purchase additional tokens

**Flow:**

```
User logged in on /dashboard
     ↓
Clicks "Kup teraz" on package
     ↓
POST /checkout/create
  - userId: <user_id>
  - priceId: price_xxx
  - (sessionToken in cookie)
     ↓
Validate session token
     ↓
Session invalid/expired? → 401 Unauthorized
     ↓
Session valid → Verify userId matches
     ↓
Mismatch? → 403 Forbidden
     ↓
Match → Load user from D1
     ↓
User not found? → 404 Not Found
     ↓
User found → Create Stripe Checkout Session:
  - customer: <stripe_customer_id>
  - metadata: { user_id: <user_id> }
  - payment_intent_data.metadata: { user_id: <user_id> }
     ↓
Redirect to Stripe payment page
     ↓
User completes payment
     ↓
──────────────────────────────────
PARALLEL PROCESSING (same as guest)
──────────────────────────────────
Success page + Webhook both credit tokens
(Using user_id instead of guest_email)
     ↓
User redirected to success page
     ↓
Shows: "2000 tokenów dodanych!"
       "Nowe saldo: 7500 tokenów"
     ↓
User clicks "Wróć do panelu"
     ↓
Back to /dashboard (still logged in)
```

**Key Differences from Guest Flow:**
- Requires authentication
- Uses existing Stripe customer
- No user creation needed
- User stays logged in throughout

### Webhook Handler

**Endpoint:** `POST /stripe/webhook`

**Purpose:** Reliable token crediting even if user's browser crashes

**Supported Events:**
- `checkout.session.completed` - Main event (payment successful)

**Flow:**

```
Stripe sends POST request
     ↓
Extract Stripe-Signature header
     ↓
Verify signature using STRIPE_WEBHOOK_SECRET
     ↓
Invalid signature? → 400 Bad Request (reject immediately)
     ↓
Valid signature → Parse event
     ↓
Event type = checkout.session.completed?
     ↓
NO → Return 200 OK (acknowledge but ignore)
     ↓
YES → Extract data:
  - checkoutSessionId
  - paymentIntentId
  - guest_email OR user_id
  - paymentStatus
     ↓
Check: guest_email present?
     ↓
YES → Guest purchase:
  - Call getOrCreateUser(guest_email)
  - Create user if needed
  - Get user_id
     ↓
NO → Check: user_id present?
     ↓
YES → Authenticated purchase:
  - Use user_id directly
     ↓
NO → Neither present:
  - Log error
  - Return 200 (acknowledge but don't process)
     ↓
Check payment_status = 'paid'?
     ↓
NO → Return 200 (acknowledge, too early)
     ↓
YES → Check idempotency:
  Query transactions WHERE stripe_payment_id = paymentIntentId
     ↓
Already processed? → Return 200 (success, already done)
     ↓
Not processed → Retrieve token amount:
  - Fetch checkout session with expanded line_items
  - Extract price.metadata.token_amount
  - Parse integer
     ↓
Invalid/missing? → Return 200 (acknowledge but log error)
     ↓
Valid amount → Call creditTokens():
  - Check idempotency again (race condition protection)
  - Atomic transaction (insert + update)
  - Verify balance after
     ↓
Success → Return 200 with transaction details
     ↓
Failure → Return 500 (Stripe will retry)
```

**Critical Security Checks:**

1. **Signature Verification:** Prevents fake webhooks
   ```typescript
   const event = await stripe.webhooks.constructEventAsync(
     body,              // Raw request body (NOT parsed)
     signature,         // Stripe-Signature header
     env.STRIPE_WEBHOOK_SECRET
   );
   ```

2. **Idempotency Check:** Prevents double-crediting
   ```sql
   SELECT * FROM transactions
   WHERE stripe_payment_id = ?
   ```

3. **Payment Status Check:** Only credit if actually paid
   ```typescript
   if (session.payment_status !== 'paid') {
     return // Too early
   }
   ```

**Webhook Retry Behavior:**
- Stripe retries failed webhooks (500 errors) automatically
- Up to 3 days of retries
- Exponential backoff (1min, 5min, 30min, etc.)
- View retry history in Stripe Dashboard

### Token Amount Storage

**CRITICAL:** Token amounts are stored in Stripe Price metadata, NOT in session metadata.

**Why Price Metadata:**
- Authoritative source (set once in Stripe Dashboard)
- User cannot manipulate (unlike session metadata)
- Consistent across all purchases
- Single point of configuration

**Configuration (Stripe Dashboard):**
```
Product: Starter Token Package
  └─ Price: 25 PLN
       └─ Metadata:
            token_amount: 2000

Product: Pro Token Package
  └─ Price: 59 PLN
       └─ Metadata:
            token_amount: 5500

Product: Gold Token Package
  └─ Price: 119 PLN
       └─ Metadata:
            token_amount: 12000
```

**Retrieval Pattern:**
```typescript
// Retrieve session with expanded price data
const session = await stripe.checkout.sessions.retrieve(sessionId, {
  expand: ['line_items.data.price']
});

// Extract price metadata
const price = session.line_items.data[0].price;
const tokenAmount = parseInt(price.metadata.token_amount, 10);
```

**Validation:**
```typescript
// Always validate
if (!tokenAmountStr) {
  throw new Error('token_amount missing from Price metadata');
}

if (isNaN(tokenAmount) || tokenAmount <= 0) {
  throw new Error(`Invalid token_amount: ${tokenAmountStr}`);
}
```

### Idempotency System

**Purpose:** Ensure tokens credited exactly once per payment, even if multiple processes attempt crediting

**Implementation:** Database constraint + application-level check

**Database Level (Migration 0002):**
```sql
CREATE UNIQUE INDEX idx_transactions_stripe_payment_unique
ON transactions(stripe_payment_id)
WHERE stripe_payment_id IS NOT NULL;
```

**Application Level:**
```typescript
// Check before crediting
const existingTx = await env.DB.prepare(
  'SELECT transaction_id FROM transactions WHERE stripe_payment_id = ?'
).bind(paymentIntentId).first();

if (existingTx) {
  console.log('Already processed, skipping credit');
  return { alreadyProcessed: true, ... };
}

// Proceed with crediting
```

**Why Both Levels:**
- Database constraint: Final safety net (prevents race conditions)
- Application check: Avoids unnecessary transaction attempts
- Together: Complete protection against double-crediting

**Idempotency Key:** `payment_intent_id` from Stripe

**Scenarios Handled:**
1. Success page AND webhook both fire (common)
2. Webhook retries after timeout (Stripe behavior)
3. User refreshes success page
4. Network failures causing duplicate requests

---

## 6. TOKEN MANAGEMENT

### Token Crediting System

**File:** `src/tokenCrediting.ts`

**Purpose:** Shared function for crediting tokens with idempotency protection

**Function Signature:**
```typescript
async function creditTokens(params: {
  env: Env;
  userId: string;
  tokenAmount: number;
  paymentIntentId: string;
  description: string;
  source: 'webhook' | 'success_page';
}): Promise<CreditTokensResult>
```

**Return Value:**
```typescript
{
  success: boolean;
  transactionId: string;
  newBalance: number;
  tokensAdded: number;
  alreadyProcessed: boolean;
  isFirstPurchase: boolean;
}
```

**Process Flow:**

```
creditTokens() called
     ↓
STEP 1: Check Idempotency
  Query: SELECT * FROM transactions
         WHERE stripe_payment_id = ?
     ↓
  Exists? → Return:
    success: true
    alreadyProcessed: true
    newBalance: (current balance)
    isFirstPurchase: (total_purchased == this transaction amount)
     ↓
  Not exists → Continue
     ↓
STEP 2: Verify User Exists
  Query: SELECT user_id, current_token_balance, total_tokens_purchased
         FROM users WHERE user_id = ?
     ↓
  Not found? → Throw error
     ↓
  Found → Continue
     ↓
STEP 3: Atomic Transaction
  Generate: transactionId (UUID)
  Timestamp: ISO 8601 string
     ↓
  Batch execute:
    [
      INSERT INTO transactions (...),
      UPDATE users SET
        current_token_balance = current_token_balance + ?,
        total_tokens_purchased = total_tokens_purchased + ?
    ]
     ↓
  Both succeed OR both fail (atomic)
     ↓
STEP 4: Verify Balance Update
  Query: SELECT current_token_balance, total_tokens_purchased
         FROM users WHERE user_id = ?
     ↓
  Calculate expected: previous + added
  Compare with actual
     ↓
  Mismatch? → Throw error (CRITICAL)
     ↓
  Match → Continue
     ↓
STEP 5: Update Transaction Record
  UPDATE transactions
  SET balance_after = ?
  WHERE transaction_id = ?
     ↓
STEP 6: Determine First Purchase
  Check: Was total_tokens_purchased == 0 before this?
     ↓
  YES → isFirstPurchase = true
  NO → isFirstPurchase = false
     ↓
Return success result
```

**Critical Safeguards:**

1. **Idempotency Check First:** Prevents unnecessary work
2. **Atomic Transaction:** Both operations succeed together or fail together
3. **Balance Verification:** Ensures transaction actually worked
4. **Error Handling:** Throws on failure (causes webhook retry)

**Used By:**
- `handleCheckoutSuccess()` - Success page handler
- `handleStripeWebhook()` - Webhook handler

### Token Consumption System

**File:** `src/tokenConsumption.ts`

**Purpose:** Check balance and consume tokens for MCP actions

**Key Functions:**

#### 1. checkBalance()
```typescript
async function checkBalance(
  db: D1Database,
  userId: string,
  requiredTokens: number
): Promise<{
  sufficient: boolean;
  currentBalance: number;
  required: number;
}>
```

**Purpose:** Read-only balance check before action execution

**Flow:**
```
Query: SELECT current_token_balance FROM users WHERE user_id = ?
     ↓
User not found? → Return { sufficient: false, currentBalance: 0 }
     ↓
User found → Compare: currentBalance >= requiredTokens
     ↓
Return result
```

**CRITICAL:** NEVER cache this value. Always fresh query.

#### 2. consumeTokens()
```typescript
async function consumeTokens(
  db: D1Database,
  userId: string,
  tokenAmount: number,
  mcpServerName: string,
  toolName: string,
  actionParams: Record<string, any>,
  actionResult: any,
  success: boolean
): Promise<TokenConsumptionResult>
```

**Purpose:** Atomically consume tokens and log action

**Flow:**
```
Generate IDs:
  - transactionId (UUID)
  - actionId (UUID)
  - timestamp (ISO 8601)
     ↓
Validate inputs:
  - tokenAmount > 0
  - All required fields present
     ↓
Prepare parameters JSON:
  { params: actionParams, result: actionResult }
     ↓
Atomic batch transaction:
  [
    1. UPDATE users SET
         current_token_balance = current_token_balance - ?,
         total_tokens_used = total_tokens_used + ?
       WHERE user_id = ?

    2. INSERT INTO transactions (
         type='usage',
         token_amount=-?,  // Negative for usage
         ...
       )

    3. INSERT INTO mcp_actions (
         action_id, user_id, mcp_server_name, tool_name,
         parameters, tokens_consumed, success, ...
       )
  ]
     ↓
All succeed? → Query new balance
     ↓
Return:
  success: true
  newBalance: <current balance>
  transactionId: <UUID>
  actionId: <UUID>
     ↓
Any fail? → Throw error
```

**Why Atomic:**
- All 3 operations must succeed together
- If deduction fails, no transaction or action logged
- If action log fails, balance not deducted
- Prevents data inconsistencies

#### 3. getInsufficientBalanceMessage()
```typescript
function getInsufficientBalanceMessage(
  currentBalance: number,
  requiredTokens: number,
  dashboardUrl: string
): string
```

**Purpose:** User-friendly error message for insufficient balance

**Example Output:**
```
Insufficient tokens. You have 3 tokens but need 5 tokens for this action.

Purchase more tokens at: https://panel.wtyczki.ai/dashboard
```

### MCP Server Integration

**Example:** Calculator MCP Server

**Endpoint:** `POST /mcp/calculator`

**Authentication:** OAuth Bearer token (required)

**Request:**
```json
{
  "operation": "add",
  "a": 5,
  "b": 3
}
```

**Flow:**
```
Request arrives
     ↓
Extract Authorization header
     ↓
Bearer token present?
     ↓
NO → 401 Unauthorized
     ↓
YES → Validate OAuth token:
  Query: OAUTH_STORE.get(`access_token:${token}`)
     ↓
Invalid/Expired? → 401 Unauthorized
     ↓
Valid → Extract user_id from token
     ↓
Check balance:
  required = 1 token (calculator operation)
  current = checkBalance(user_id, 1)
     ↓
Insufficient? → 402 Payment Required
  message: "Insufficient tokens. You have X, need 1. Buy more at: ..."
     ↓
Sufficient → Execute operation:
  result = a + b  // Example
     ↓
Consume tokens:
  consumeTokens(
    userId,
    tokenAmount: 1,
    mcpServerName: 'calculator',
    toolName: 'add',
    actionParams: { a: 5, b: 3 },
    actionResult: { result: 8 },
    success: true
  )
     ↓
Return result:
  {
    result: 8,
    tokensConsumed: 1,
    newBalance: <updated balance>
  }
```

**Implementation File:** `src/calculatorEndpoints.ts`

**Error Handling:**
- 401: Invalid OAuth token → "Authentication required"
- 402: Insufficient balance → "Purchase more tokens at..."
- 500: Operation failed → Log error, don't consume tokens

**Token Cost Configuration:**
```typescript
const TOKEN_COSTS = {
  'add': 1,
  'subtract': 1,
  'multiply': 1,
  'divide': 1,
  'power': 2,      // More expensive
  'factorial': 3,  // Even more expensive
};
```

---

## 7. USER JOURNEYS

### Journey 1: First-Time Guest Purchase

**Starting Point:** User discovers the platform
**Goal:** Purchase tokens without registration barrier

**Steps:**

1. **Discovery**
   - User visits `https://wtyczki.ai/` (public home page)
   - Sees clear value proposition: "Kup tokeny, używaj MCP"
   - Views three package options with pricing

2. **Package Selection**
   - User compares packages (Starter, Plus, Pro, Gold)
   - Sees token amounts and pricing clearly
   - No authentication required

3. **Email Entry**
   - User enters email in input field
   - Client-side validation (format check)
   - No password required

4. **Checkout Initiation**
   - User clicks "Kup teraz" (Buy now)
   - JavaScript calls `POST /checkout/create-guest`
   - Success: Redirected to Stripe payment page

5. **Payment**
   - Stripe presents payment form
   - User chooses method (card/BLIK/P24)
   - Completes payment securely

6. **Account Creation (Automatic)**
   - Webhook fires → `checkout.session.completed`
   - System detects `guest_email` in metadata
   - Calls `getOrCreateUser(email)`
   - Creates user account:
     * Generates UUID
     * Creates Stripe customer
     * Inserts into D1 database
     * Creates WorkOS user (optional)
   - Credits tokens to new account

7. **Success Confirmation**
   - User redirected to success page
   - Sees: "🎉 Pierwsze zakupy!" (First purchase!)
   - Message: "Account created for your@email.com"
   - Shows tokens credited (e.g., "2000 tokenów")
   - Call to action: "Przejdź do panelu" (Go to dashboard)

8. **First Login**
   - User clicks "Go to dashboard"
   - Redirected to `/dashboard` (protected route)
   - Authentication required → Redirect to login
   - User chooses login method:
     * Option A: WorkOS (`/auth/login`)
     * Option B: Magic Auth (`/auth/login-custom`) ← Recommended
   - Completes login flow
   - Lands on dashboard with tokens ready!

**End State:**
- User has account with token balance
- User is authenticated
- Tokens available for immediate use
- Conversion achieved in <2 minutes

**Conversion Metrics:**
- Time to first purchase: ~30-60 seconds
- Steps to purchase: 3 (email → payment → done)
- Friction points: Minimal (no registration form)
- Expected conversion lift: 30-75% vs. mandatory registration

### Journey 2: Returning User Login

**Starting Point:** User has account, wants to log in
**Goal:** Access dashboard to view balance and purchase more tokens

**Path A: Magic Auth (Recommended)**

1. User visits `/auth/login-custom`
2. Sees email input form
3. Enters email address
4. System checks if user exists
   - Not found? → Show error: "No account found. Purchase tokens first →"
   - Found? → Send Magic Auth code via WorkOS
5. User receives 6-digit code in email
6. User enters code in form
7. System validates code with WorkOS
8. Creates session (72 hours)
9. Sets cookie: `workos_session=<token>`
10. Redirects to `/dashboard`

**Path B: WorkOS (Alternative)**

1. User visits `/auth/login`
2. Redirected to WorkOS AuthKit
3. Enters email
4. WorkOS sends OTP
5. Enters OTP code
6. WorkOS validates
7. Redirects to `/auth/callback?code=...`
8. System exchanges code for user profile
9. Creates session (72 hours)
10. Redirects to `/dashboard`

**End State:**
- User authenticated
- Session valid for 72 hours
- Full access to dashboard and MCP servers

**UX Comparison:**

| Aspect | Magic Auth | WorkOS |
|--------|------------|--------|
| **Steps** | 2 (email → code) | 3-4 (redirect → email → code → redirect) |
| **Domain** | Stays on wtyczki.ai | Redirects to WorkOS domain |
| **Error clarity** | Clear: "No account? Purchase first" | Generic errors |
| **Speed** | Faster (no redirects) | Slower (multiple redirects) |
| **Recommended for** | Token-only users | OAuth/SSO users (future) |

### Journey 3: Authenticated User Purchasing More Tokens

**Starting Point:** User logged in, balance low
**Goal:** Purchase additional tokens without logging out

1. **Balance Check**
   - User on `/dashboard`
   - Sees current balance: "150 tokenów"
   - Decides to purchase more

2. **Package Selection**
   - Scrolls to package options
   - Chooses package (e.g., Pro - 5500 tokens)
   - Clicks "Kup teraz"

3. **Checkout**
   - JavaScript calls `POST /checkout/create` (authenticated)
   - System validates session token
   - System checks user_id matches
   - Creates Stripe checkout with existing customer
   - Redirects to Stripe payment page

4. **Payment**
   - Stripe shows payment form (pre-filled email)
   - User completes payment
   - Redirect back to success page

5. **Success**
   - Shows: "Zakup pomyślnie zakończony!" (Purchase completed!)
   - Displays: "5500 tokenów dodanych!" (5500 tokens added!)
   - New balance: "5650 tokenów" (150 + 5500)
   - Button: "Wróć do panelu" (Back to dashboard)

6. **Return to Dashboard**
   - Clicks button → Back to `/dashboard`
   - Still logged in (session unchanged)
   - Updated balance visible immediately

**End State:**
- User still authenticated
- Token balance increased
- Transaction recorded
- Ready to use MCP servers

**UX Benefits:**
- No re-authentication needed
- Seamless experience
- Immediate balance update

### Journey 4: Using MCP Server (Calculator Example)

**Starting Point:** User wants to use calculator via AI agent
**Goal:** Perform calculation using tokens

**Phase 1: MCP Server Setup (One-Time)**

1. **Configuration**
   - User opens AI agent (Claude Desktop, OpenAI app, etc.)
   - Adds MCP server to configuration:
     ```json
     {
       "mcpServers": {
         "calculator": {
           "command": "npx",
           "args": ["-y", "@example/calculator-mcp"],
           "env": {
             "API_URL": "https://panel.wtyczki.ai/mcp/calculator"
           }
         }
       }
     }
     ```
   - Restarts AI agent

2. **Authorization (OAuth Flow)**
   - User asks AI: "Calculate 5 + 3"
   - AI agent attempts to connect to MCP server
   - MCP server requests OAuth authorization
   - AI agent opens browser with authorization URL:
     ```
     https://panel.wtyczki.ai/oauth/authorize?
       client_id=mcp_calculator&
       redirect_uri=http://localhost:3000/callback&
       response_type=code&
       scope=mcp_access user_info
     ```

3. **User Authentication**
   - Browser shows authorization request
   - User not logged in? → Redirect to `/auth/login`
   - User logs in (Magic Auth or WorkOS)
   - Returns to authorization page

4. **User Consent**
   - Browser shows: "Calculator MCP wants to:"
     * Access MCP servers and use your tokens
     * View your email and account information
   - User clicks "Approve"

5. **Token Exchange**
   - System generates authorization code (10 min TTL)
   - Redirects to: `http://localhost:3000/callback?code=<auth_code>`
   - MCP client exchanges code for access token:
     ```
     POST /oauth/token
     grant_type=authorization_code
     code=<auth_code>
     client_id=mcp_calculator
     client_secret=<secret>
     ```
   - System returns:
     ```json
     {
       "access_token": "<token>",
       "token_type": "Bearer",
       "expires_in": 1800,
       "refresh_token": "<refresh>"
     }
     ```

6. **Connection Established**
   - MCP client stores access token
   - Connection active for 30 minutes (OAuth 2.1 security requirement)
   - Ready to process requests

**Phase 2: Action Execution (Each Request)**

1. **User Request**
   - User asks AI: "Calculate 5 + 3"
   - AI agent receives request

2. **MCP Request**
   - MCP client sends to server:
     ```
     POST /mcp/calculator
     Authorization: Bearer <access_token>
     Content-Type: application/json

     {
       "operation": "add",
       "a": 5,
       "b": 3
     }
     ```

3. **Server Validation**
   - Extract Bearer token
   - Validate against OAUTH_STORE
   - Extract user_id from token
   - Token expired? → 401 Unauthorized (client refreshes)

4. **Balance Check**
   - Query: `SELECT current_token_balance FROM users WHERE user_id = ?`
   - Current balance: 150 tokens
   - Required: 1 token
   - Sufficient? YES → Continue

5. **Operation Execution**
   - Perform calculation: 5 + 3 = 8
   - Operation successful

6. **Token Consumption**
   - Atomic transaction:
     * Deduct 1 token from balance
     * Insert transaction record (type='usage', amount=-1)
     * Insert mcp_action record (details of operation)
   - New balance: 149 tokens

7. **Response**
   - Return to MCP client:
     ```json
     {
       "result": 8,
       "tokensConsumed": 1,
       "newBalance": 149
     }
     ```

8. **Display to User**
   - AI agent receives result
   - Shows user: "The result is 8."
   - User satisfied, continues conversation

**End State:**
- Operation completed successfully
- 1 token consumed
- Balance updated (149 tokens remaining)
- Action logged for analytics

**Error Scenario: Insufficient Balance**

If balance was 0:
1. Balance check fails (0 < 1)
2. Return 402 Payment Required:
   ```json
   {
     "error": "insufficient_tokens",
     "message": "Insufficient tokens. You have 0 tokens but need 1 token for this action.\n\nPurchase more tokens at: https://panel.wtyczki.ai/dashboard",
     "currentBalance": 0,
     "requiredTokens": 1,
     "purchaseUrl": "https://panel.wtyczki.ai/dashboard"
   }
   ```
3. AI agent shows user the error message
4. User clicks link to purchase more tokens
5. Returns to Journey 3 (purchase flow)

### Journey 5: Session Expiration and Re-authentication

**Starting Point:** User's session expired (72 hours)
**Goal:** Re-authenticate seamlessly

**Scenario A: User Visits Dashboard**

1. User visits `/dashboard` (bookmarked)
2. Middleware extracts `workos_session` cookie
3. Validates session in KV
4. Session expired → Redirect to `/auth/login?return_to=/dashboard`
5. User logs in (Magic Auth or WorkOS)
6. Redirected back to `/dashboard`
7. Session restored for 72 hours

**Scenario B: MCP Server Access Token Expired**

1. User asks AI agent to perform operation
2. MCP client sends request with expired access token
3. Server validates token → Expired
4. Returns 401 Unauthorized:
   ```json
   {
     "error": "invalid_token",
     "error_description": "Token expired"
   }
   ```
5. MCP client automatically refreshes:
   ```
   POST /oauth/token
   grant_type=refresh_token
   refresh_token=<refresh_token>
   client_id=mcp_calculator
   client_secret=<secret>
   ```
6. Server returns NEW tokens (OAuth 2.1 rotation):
   ```json
   {
     "access_token": "<new_access_token>",
     "refresh_token": "<new_refresh_token>",
     "expires_in": 1800
   }
   ```
7. Old refresh token is invalidated (security: prevents token reuse)
8. MCP client retries operation with new access token
9. Operation succeeds

**End State:**
- User re-authenticated
- Access restored with fresh tokens (30 minutes)
- Old refresh token invalidated (OAuth 2.1 rotation)
- Tokens safe and available

---

## 8. DATABASE SCHEMA

### Overview

**Database:** Cloudflare D1 (SQLite)
**Migrations:** Located in `/migrations/`
**Migration Tool:** `wrangler d1 migrations apply`

**Six Main Tables:**
1. `users` - User accounts and balances (with soft delete support)
2. `transactions` - Immutable transaction history (with idempotency)
3. `mcp_actions` - Detailed MCP usage logs (with idempotency)
4. `api_keys` - Permanent API keys for MCP authentication (SHA-256 hashed)
5. `account_deletions` - GDPR-compliant deletion audit trail
6. `failed_deductions` - Reconciliation tracking for failed token charges

### Table 1: users

**Purpose:** Store user accounts and current token balances

**Schema:**
```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,              -- UUID
    email TEXT UNIQUE NOT NULL,            -- User email (unique constraint)
    current_token_balance INTEGER DEFAULT 0,  -- Current available tokens
    monthly_token_limit INTEGER,           -- Optional usage limit (future)
    total_tokens_purchased INTEGER DEFAULT 0, -- Lifetime purchased
    total_tokens_used INTEGER DEFAULT 0,   -- Lifetime consumed
    stripe_customer_id TEXT,               -- Stripe customer reference
    created_at TEXT DEFAULT (datetime('now')), -- Account creation
    last_login_at TEXT,                    -- Last login timestamp
    -- Account deletion fields (Migration 0004)
    is_deleted INTEGER DEFAULT 0 CHECK (is_deleted IN (0, 1)), -- Soft delete flag
    deleted_at TEXT,                       -- Deletion timestamp
    workos_user_id TEXT                    -- WorkOS user ID for deletion tracking
);
```

**Indexes:**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_users_is_deleted ON users(is_deleted);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

**Constraints:**
- `email UNIQUE` - One account per email
- `current_token_balance CHECK(current_token_balance >= 0)` (Migration 0003) - Prevent negative balances
- `is_deleted CHECK(is_deleted IN (0, 1))` (Migration 0004) - Soft delete validation

**Sample Row:**
```
user_id: "550e8400-e29b-41d4-a716-446655440000"
email: "user@example.com"
current_token_balance: 1500
total_tokens_purchased: 5500
total_tokens_used: 4000
stripe_customer_id: "cus_ABC123"
created_at: "2025-10-15T10:30:00.000Z"
last_login_at: "2025-10-17T14:22:15.000Z"
```

**Critical Fields:**
- `current_token_balance` - ALWAYS query database (never cache)
- `stripe_customer_id` - Used for checkout sessions
- `total_tokens_purchased` - Used to determine first purchase

### Table 2: transactions

**Purpose:** Immutable audit trail of all token movements

**Schema:**
```sql
CREATE TABLE transactions (
    transaction_id TEXT PRIMARY KEY,      -- UUID
    user_id TEXT NOT NULL,                -- Foreign key to users
    type TEXT NOT NULL CHECK(type IN ('purchase', 'usage')),
    token_amount INTEGER NOT NULL,        -- Positive for purchase, negative for usage
    balance_after INTEGER NOT NULL,       -- Balance after this transaction
    stripe_payment_id TEXT,               -- Stripe payment_intent_id (for purchases)
    mcp_server_name TEXT,                 -- Server name (for usage)
    description TEXT,                     -- Human-readable description
    created_at TEXT DEFAULT (datetime('now')), -- Transaction timestamp
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_stripe_payment ON transactions(stripe_payment_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);

-- UNIQUE constraint for idempotency (Migration 0002)
CREATE UNIQUE INDEX idx_transactions_stripe_payment_unique
ON transactions(stripe_payment_id)
WHERE stripe_payment_id IS NOT NULL;
```

**Constraints:**
- `type CHECK(type IN ('purchase', 'usage'))` - Only two types allowed
- `stripe_payment_id UNIQUE` - Enforce idempotency (one transaction per payment)

**Sample Rows:**

Purchase:
```
transaction_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7"
user_id: "550e8400-e29b-41d4-a716-446655440000"
type: "purchase"
token_amount: 2000
balance_after: 2000
stripe_payment_id: "pi_1AbC2DeF3GhI4JkL"
description: "Token purchase via Stripe (2000 tokens)"
created_at: "2025-10-15T10:35:12.000Z"
```

Usage:
```
transaction_id: "8d1f7890-8536-51ef-b55c-f18gd2g01bf8"
user_id: "550e8400-e29b-41d4-a716-446655440000"
type: "usage"
token_amount: -1
balance_after: 1999
mcp_server_name: "calculator"
description: "calculator MCP: add"
created_at: "2025-10-15T10:40:05.000Z"
```

**Query Patterns:**

Get user transaction history:
```sql
SELECT * FROM transactions
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

Check idempotency:
```sql
SELECT transaction_id FROM transactions
WHERE stripe_payment_id = ?;
```

Get purchase history only:
```sql
SELECT * FROM transactions
WHERE user_id = ? AND type = 'purchase'
ORDER BY created_at DESC;
```

### Table 3: mcp_actions

**Purpose:** Detailed logs of MCP server usage for analytics

**Schema:**
```sql
CREATE TABLE mcp_actions (
    action_id TEXT PRIMARY KEY,           -- UUID
    user_id TEXT NOT NULL,                -- Foreign key to users
    mcp_server_name TEXT NOT NULL,        -- Server name (e.g., 'calculator')
    tool_name TEXT NOT NULL,              -- Tool/operation name (e.g., 'add')
    tokens_consumed INTEGER NOT NULL,     -- Tokens used for this action
    success INTEGER DEFAULT 1,            -- 1 = success, 0 = failure
    error_message TEXT,                   -- Error details (if failed)
    execution_time_ms INTEGER,            -- Execution duration (optional)
    parameters TEXT,                      -- JSON: { params: {...}, result: {...} }
    created_at TEXT DEFAULT (datetime('now')), -- Action timestamp
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_mcp_actions_user_id ON mcp_actions(user_id);
CREATE INDEX idx_mcp_actions_server_name ON mcp_actions(mcp_server_name);
CREATE INDEX idx_mcp_actions_created_at ON mcp_actions(created_at DESC);
-- Idempotency protection (Migration 0005)
CREATE UNIQUE INDEX idx_mcp_actions_action_id ON mcp_actions(action_id);
```

**Sample Row:**
```
action_id: "9e2g8901-9647-62fg-c66d-g29he3h12cg9"
user_id: "550e8400-e29b-41d4-a716-446655440000"
mcp_server_name: "calculator"
tool_name: "add"
tokens_consumed: 1
success: 1
parameters: '{"params":{"a":5,"b":3},"result":{"result":8}}'
created_at: "2025-10-15T10:40:05.000Z"
```

**Query Patterns:**

Get user's MCP usage:
```sql
SELECT * FROM mcp_actions
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 50;
```

Analyze most-used servers:
```sql
SELECT mcp_server_name, COUNT(*) as usage_count
FROM mcp_actions
GROUP BY mcp_server_name
ORDER BY usage_count DESC;
```

Calculate total tokens consumed by server:
```sql
SELECT mcp_server_name, SUM(tokens_consumed) as total_tokens
FROM mcp_actions
WHERE user_id = ?
GROUP BY mcp_server_name;
```

### Table 4: account_deletions

**Purpose:** GDPR-compliant audit trail for account deletions (Migration 0004)

**Schema:**
```sql
CREATE TABLE account_deletions (
    deletion_id TEXT PRIMARY KEY,         -- UUID
    user_id TEXT NOT NULL,                -- Foreign key to users
    original_email TEXT NOT NULL,         -- Email before anonymization
    tokens_forfeited INTEGER NOT NULL,    -- Tokens lost at deletion
    total_tokens_purchased INTEGER DEFAULT 0, -- Lifetime purchased
    total_tokens_used INTEGER DEFAULT 0,  -- Lifetime consumed
    stripe_customer_id TEXT,              -- Stripe customer reference
    deletion_reason TEXT,                 -- User-provided reason (optional)
    deleted_at TEXT DEFAULT (datetime('now')), -- Deletion timestamp
    deleted_by_ip TEXT,                   -- IP address for security audit
    -- Migration 0009: Failed deductions cleanup tracking
    failed_deductions_cleaned INTEGER NOT NULL DEFAULT 0,
    -- Migration 0011: Pending checkout tracking
    had_pending_checkout INTEGER NOT NULL DEFAULT 0,
    checkout_session_id TEXT,
    checkout_auto_refunded INTEGER NOT NULL DEFAULT 0,
    checkout_refund_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_account_deletions_user_id ON account_deletions(user_id);
CREATE INDEX idx_account_deletions_deleted_at ON account_deletions(deleted_at DESC);
CREATE INDEX idx_account_deletions_original_email ON account_deletions(original_email);
-- Pending checkout tracking (Migration 0011)
CREATE INDEX idx_account_deletions_recent_checkout ON account_deletions(deleted_at, had_pending_checkout)
WHERE had_pending_checkout = 1;
```

**Purpose:**
- **Legal compliance:** GDPR Article 17 (Right to Erasure)
- **Audit trail:** Track all account deletions for compliance reporting
- **Revenue protection:** Detect and handle pending payments at deletion time
- **Analytics:** Understand user churn patterns

**Sample Row:**
```
deletion_id: "7a8b9c0d-1234-5678-90ab-cdef12345678"
user_id: "550e8400-e29b-41d4-a716-446655440000"
original_email: "user@example.com"
tokens_forfeited: 150
total_tokens_purchased: 5500
total_tokens_used: 5350
stripe_customer_id: "cus_ABC123"
deletion_reason: "No longer needed"
deleted_at: "2025-10-18T12:30:00.000Z"
deleted_by_ip: "192.168.1.1"
failed_deductions_cleaned: 2
had_pending_checkout: 0
```

**Business Rules:**
1. Account deletion is **permanent** - no reversal
2. Tokens are **forfeited** (no refunds) - user must acknowledge before deletion
3. Transaction history **preserved** for tax/accounting compliance
4. User data **anonymized**: `email` → `deleted_{hash}@anonymized.local`
5. Failed deductions **cleaned** and marked as resolved
6. Pending checkouts **tracked** and auto-refunded if payment completes within 1 hour

### Table 5: failed_deductions

**Purpose:** Reconciliation tracking for failed token consumption attempts (Migration 0005)

**Schema:**
```sql
CREATE TABLE failed_deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_id TEXT NOT NULL UNIQUE,       -- Action ID that failed (idempotency)
    user_id TEXT NOT NULL,                -- Foreign key to users
    mcp_server_name TEXT NOT NULL,        -- Server name
    tool_name TEXT NOT NULL,              -- Tool name
    token_amount INTEGER NOT NULL,        -- Tokens that should have been charged
    parameters TEXT NOT NULL,             -- JSON: action details
    error_message TEXT NOT NULL,          -- Error description
    created_at TEXT NOT NULL,             -- Failure timestamp
    resolved_at TEXT,                     -- Reconciliation timestamp
    retry_count INTEGER DEFAULT 0,        -- Number of retry attempts
    last_retry_at TEXT,                   -- Last retry timestamp
    -- Migration 0009: Resolution tracking
    resolved INTEGER NOT NULL DEFAULT 0,  -- 0 = pending, 1 = resolved
    resolution_note TEXT,                 -- How it was resolved
    FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
```

**Indexes:**
```sql
-- Optimizes query: SELECT * FROM failed_deductions WHERE resolved_at IS NULL
CREATE INDEX idx_failed_deductions_unresolved ON failed_deductions(resolved_at, created_at)
WHERE resolved_at IS NULL;
```

**Purpose:**
- **Revenue protection:** Recover lost revenue from transient database failures
- **Reliability:** Automatic retry and reconciliation
- **Audit trail:** Track all failed token consumption attempts
- **Error analysis:** Identify systemic issues

**Sample Row:**
```
id: 1
action_id: "9e2g8901-9647-62fg-c66d-g29he3h12cg9"
user_id: "550e8400-e29b-41d4-a716-446655440000"
mcp_server_name: "calculator"
tool_name: "add"
token_amount: 1
parameters: '{"params":{"a":5,"b":3},"result":{"result":8}}'
error_message: "Database timeout"
created_at: "2025-10-15T10:40:05.000Z"
resolved_at: NULL
retry_count: 3
last_retry_at: "2025-10-15T10:40:15.000Z"
resolved: 0
resolution_note: NULL
```

**Reconciliation Process:**
1. **Detection:** Token consumption fails after 3 retries with exponential backoff
2. **Logging:** Failed attempt recorded to `failed_deductions` table
3. **Background Job:** Cron job runs every 6 hours (see `src/reconciliation.ts`)
4. **Retry:** Attempt to charge user's account again
5. **Resolution:**
   - Success → Mark `resolved = 1`, set `resolved_at`, add `resolution_note`
   - User deleted → Mark `resolved = 1`, set `resolution_note = "User account deleted"`
   - Still failing → Increment `retry_count`, update `last_retry_at`

**Query Patterns:**

Find unresolved failed deductions:
```sql
SELECT * FROM failed_deductions
WHERE resolved = 0
ORDER BY created_at ASC;
```

Find failed deductions for specific user:
```sql
SELECT * FROM failed_deductions
WHERE user_id = ? AND resolved = 0;
```

### Database Operations Best Practices

**1. Atomic Transactions**

ALWAYS use `env.DB.batch()` for multi-step operations:

```typescript
await env.DB.batch([
  env.DB.prepare('INSERT INTO transactions ...').bind(...),
  env.DB.prepare('UPDATE users SET ...').bind(...),
]);
```

**Why:** Both succeed together or fail together (no partial updates).

**2. Balance Queries**

NEVER cache balances:

```typescript
// CORRECT: Fresh query every time
const user = await env.DB.prepare(
  'SELECT current_token_balance FROM users WHERE user_id = ?'
).bind(userId).first();

// WRONG: Caching (DON'T DO THIS)
const cachedBalance = await KV.get(`balance:${userId}`);
```

**Why:** Database is fast enough (<50ms), caching adds complexity and risk.

**3. Prepared Statements**

ALWAYS use `.bind()` to prevent SQL injection:

```typescript
// CORRECT
await env.DB.prepare('SELECT * FROM users WHERE email = ?')
  .bind(email)
  .first();

// WRONG: String interpolation (SQL injection risk)
await env.DB.prepare(`SELECT * FROM users WHERE email = '${email}'`)
  .first();
```

**4. Error Handling**

Always catch database errors:

```typescript
try {
  await env.DB.batch([...]);
} catch (error) {
  console.error('Database error:', error);
  throw new Error('Failed to update balance');
}
```

---

## 9. SECURITY & RELIABILITY

### Payment Security

#### Webhook Signature Verification

**Why Critical:** Prevents attackers from sending fake payment notifications

**Implementation:**
```typescript
const event = await stripe.webhooks.constructEventAsync(
  body,              // Raw request body (string)
  signature,         // Stripe-Signature header
  env.STRIPE_WEBHOOK_SECRET
);
```

**Failure Modes:**
- Missing signature → 400 Bad Request (reject immediately)
- Invalid signature → 400 Bad Request (reject immediately)
- Valid signature → Process event

**NEVER skip this check.** Without verification, an attacker could:
1. Send fake `checkout.session.completed` events
2. Credit unlimited tokens to any account
3. Steal tokens by crediting their own account

#### PCI Compliance

**Strategy:** Let Stripe handle card data

**How:**
- User enters card details on Stripe's payment page (NOT our servers)
- Stripe tokenizes card data
- Our system only sees:
  * Checkout session ID
  * Payment intent ID
  * Payment status
- No card numbers, CVV, or sensitive data touches our infrastructure

**Result:** PCI compliance automatic (Stripe is PCI Level 1 certified).

#### API Key Management

**Storage:**
- Local development: `.dev.vars` file (NOT committed to git)
- Production: Wrangler secrets (`npx wrangler secret put STRIPE_SECRET_KEY`)

**NEVER:**
- Hardcode keys in source code
- Commit `.dev.vars` to version control
- Log API keys in console output
- Expose keys in error messages

**Rotation:**
1. Generate new key in Stripe Dashboard
2. Update production secret: `npx wrangler secret put STRIPE_SECRET_KEY`
3. Update webhook secret: `npx wrangler secret put STRIPE_WEBHOOK_SECRET`
4. Test webhook signature verification
5. Delete old keys from Stripe Dashboard

### Authentication Security

#### Session Management

**Session Storage:** Cloudflare KV (key-value store)

**Session Data:**
```typescript
{
  user_id: string;
  email: string;
  workos_user_id: string;
  access_token: string;      // WorkOS access token
  refresh_token: string;     // WorkOS refresh token
  created_at: number;
  expires_at: number;        // 72 hours from creation
}
```

**Session Token:** Random UUID (cryptographically secure)

**Cookie Configuration:**
```
workos_session=<token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=259200
```

**Security Features:**
- `HttpOnly` - Prevents JavaScript access (XSS protection)
- `Secure` - HTTPS only (prevents MITM attacks)
- `SameSite=Lax` - CSRF protection
- Random UUID - Unpredictable (prevents session fixation)
- KV TTL - Automatic expiration (72 hours)

**Session Validation:**
```typescript
// 1. Extract token from cookie
const token = getSessionTokenFromRequest(request);

// 2. Query KV
const session = await env.USER_SESSIONS.get(`workos_session:${token}`, 'json');

// 3. Check expiration
if (!session || session.expires_at < Date.now()) {
  // Session expired
}

// 4. Load user from D1
const user = await getUserById(session.user_id, env.DB);
```

#### OAuth Security (MCP Servers)

**OAuth 2.1 Implementation:**

**Authorization Code Flow:**
1. Short-lived codes (10 minutes)
2. One-time use (deleted after exchange)
3. Client authentication required
4. PKCE support (optional but recommended)

**Access Tokens:**
- Random 64-character hex strings
- 1 hour expiration
- Stored in KV with TTL
- Bearer token format

**Refresh Tokens:**
- Random 64-character hex strings
- 30 day expiration
- Stored in KV with longer TTL
- Can be used to get new access tokens

**PKCE (Proof Key for Code Exchange):**

Why: Prevents authorization code interception

Flow:
1. Client generates random `code_verifier` (43-128 chars)
2. Client computes `code_challenge = SHA256(code_verifier)`
3. Client sends `code_challenge` in `/oauth/authorize` request
4. Server stores `code_challenge` with authorization code
5. Client sends `code_verifier` in `/oauth/token` request
6. Server verifies: `SHA256(code_verifier) === code_challenge`

**Scope-Based Permissions:**
```typescript
const OAUTH_SCOPES = {
  'mcp_access': 'Access MCP servers and use your tokens',
  'user_info': 'View your email and account information',
  'token_balance': 'View your token balance',
};
```

User must approve each scope explicitly during authorization.

### Data Security

#### SQL Injection Prevention

**ALWAYS use prepared statements:**

```typescript
// CORRECT: Parameterized query
await env.DB.prepare('SELECT * FROM users WHERE email = ?')
  .bind(email)
  .first();

// WRONG: String concatenation (vulnerable)
await env.DB.prepare(`SELECT * FROM users WHERE email = '${email}'`)
  .first();
```

**Why:** Prepared statements separate SQL structure from data, preventing injection.

**Example Attack (without protection):**
```typescript
// Malicious input
email = "'; DROP TABLE users; --"

// Vulnerable query (concatenation)
query = `SELECT * FROM users WHERE email = '${email}'`
// Becomes: SELECT * FROM users WHERE email = ''; DROP TABLE users; --'
// ⚠️  Deletes entire users table!
```

#### XSS Prevention

**HTML Rendering:**

NEVER insert user input directly into HTML:

```typescript
// WRONG: Direct insertion (XSS vulnerable)
const html = `<div>Welcome, ${user.email}</div>`;

// CORRECT: Escape HTML entities
const html = `<div>Welcome, ${escapeHtml(user.email)}</div>`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**Current Implementation:**
- All HTML templates use template literals
- User data is minimal (email, balance, transaction IDs)
- Consider: Content Security Policy (CSP) headers

### Balance Accuracy Guarantees

#### 1. Atomic Transactions

**Principle:** All balance updates are all-or-nothing

**Implementation:**
```typescript
await env.DB.batch([
  // Operation 1: Update balance
  env.DB.prepare('UPDATE users SET current_token_balance = current_token_balance + ? WHERE user_id = ?')
    .bind(tokenAmount, userId),

  // Operation 2: Record transaction
  env.DB.prepare('INSERT INTO transactions (...) VALUES (...)')
    .bind(...),
]);
```

**Guarantee:** Either BOTH operations succeed OR BOTH fail (no partial updates).

**What This Prevents:**
- Balance updated but no transaction record → Lost audit trail
- Transaction recorded but balance not updated → Incorrect balance
- Race conditions causing lost updates

#### 2. Idempotency Protection

**Principle:** Each payment processed exactly once

**Implementation:**
- Database constraint: `UNIQUE(stripe_payment_id)`
- Application check before crediting
- Both success page and webhook check idempotency

**Scenarios Handled:**
- User refreshes success page
- Webhook fires after success page
- Webhook retried by Stripe
- Network timeouts causing duplicate requests

**Result:** Tokens credited exactly once per payment_intent_id.

#### 3. Balance Verification

**Principle:** After crediting, verify the math actually worked

**Implementation:**
```typescript
// Before
const previousBalance = 1500;

// Credit 2000 tokens
await creditTokens(...);

// After
const newBalance = await queryBalance();
const expected = previousBalance + 2000; // 3500

if (newBalance !== expected) {
  throw new Error(`Balance verification failed: expected ${expected}, got ${newBalance}`);
}
```

**Why:** Catches database errors, race conditions, or bugs in update logic.

#### 4. No Negative Balances

**Database Constraint (Migration 0003):**
```sql
ALTER TABLE users
ADD CONSTRAINT check_balance_non_negative
CHECK(current_token_balance >= 0);
```

**Application-Level Check:**
```typescript
// Before executing action
const balance = await checkBalance(userId, requiredTokens);

if (!balance.sufficient) {
  return new Response('Insufficient tokens', { status: 402 });
}

// Proceed with action
```

**Result:** Impossible to consume more tokens than available.

### Error Handling & Recovery

#### Webhook Retry Strategy

**Stripe Behavior:**
- Failed webhooks (500 errors) are retried automatically
- Retry schedule: 1min, 5min, 30min, 2hr, 4hr, 8hr, 16hr (up to 3 days)
- Success (200 OK) → No retry
- Client error (400-499) → No retry (considered permanent)

**Our Strategy:**
```typescript
// Idempotency check
if (alreadyProcessed) {
  return new Response(JSON.stringify({ status: 'already_processed' }), { status: 200 });
  // ✅ Acknowledge to Stripe (prevents retries)
}

// Missing data
if (!userId && !guestEmail) {
  return new Response(JSON.stringify({ error: 'missing_user_id' }), { status: 200 });
  // ✅ Acknowledge but don't process (prevents endless retries)
}

// Database error
try {
  await creditTokens(...);
} catch (error) {
  return new Response(JSON.stringify({ error: 'database_error' }), { status: 500 });
  // ❌ Tell Stripe to retry
}
```

**Key Principle:** Return 200 for issues that won't be fixed by retry, 500 for transient failures.

#### Database Error Recovery

**D1 Automatic Features:**
- Automatic replication across regions
- Automatic failover to healthy replicas
- Transaction rollback on failures

**Our Responsibilities:**
- Catch exceptions and log errors
- Return appropriate HTTP status codes
- Don't commit partial transactions

**Example:**
```typescript
try {
  await env.DB.batch([...]);
} catch (error) {
  console.error('❌ Database transaction failed:', error);
  // Transaction automatically rolled back by D1
  throw error; // Propagate to caller
}
```

#### Session Recovery

**Expired Session:**
- User action → Session validation fails
- Redirect to login with `return_to` parameter
- User logs in → Redirected back to original destination
- Session restored (72 hours)

**Corrupt Session:**
- Session data in KV but user not in D1
- Clear session from KV
- Redirect to login
- User logs in → New session created

**OAuth Token Expiry:**
- MCP request fails with 401
- Client uses refresh token to get new access token
- Retry request with new token
- Transparent to user

---

## 10. TECHNICAL IMPLEMENTATION DETAILS

### Cloudflare Workers Environment

**Runtime:** V8 JavaScript engine at the edge

**Characteristics:**
- No cold starts (workers are always warm)
- Global distribution (deployed to 275+ locations)
- Isolation (each request in separate V8 isolate)
- Strict CPU time limits (50ms CPU time on free plan)

**Environment Bindings:**

```typescript
export interface Env {
  // Database
  DB: D1Database;                // D1 SQL database binding

  // KV Namespaces
  OAUTH_STORE: KVNamespace;      // OAuth tokens/codes
  USER_SESSIONS: KVNamespace;    // User sessions

  // Stripe Configuration
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PRICE_ID_STARTER?: string;
  PRICE_ID_PRO?: string;
  PRICE_ID_GOLD?: string;

  // WorkOS Configuration
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;

  // Legacy (for Cloudflare Access JWT validation)
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_POLICY_AUD: string;
}
```

**Access in Code:**
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // env.DB - Database queries
    // env.OAUTH_STORE - OAuth storage
    // env.USER_SESSIONS - Session storage
    // env.STRIPE_SECRET_KEY - Stripe API key
    // etc.
  }
}
```

### Request Routing Architecture

**Pattern:** Single worker with internal routing

**File:** `src/index.ts`

**Structure:**

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // MCP Endpoints (OAuth required)
    if (url.pathname === '/mcp/calculator' && request.method === 'POST') {
      return await handleCalculatorRequest(...);
    }

    // OAuth Endpoints (public)
    if (url.pathname === '/oauth/authorize') {
      return await handleAuthorizeEndpoint(...);
    }

    // WorkOS Auth Endpoints (public)
    if (url.pathname === '/auth/login' && request.method === 'GET') {
      // ...
    }

    // Custom Magic Auth Endpoints (public)
    if (url.pathname === '/auth/login-custom' && request.method === 'GET') {
      // ...
    }

    // Authentication Middleware (for protected routes)
    const { user, response: authResponse } = await authenticateRequest(request, env);
    if (authResponse) {
      return authResponse; // Redirect to login
    }

    // Protected Endpoints (require authentication)
    if (url.pathname === '/dashboard' && request.method === 'GET') {
      return new Response(renderDashboardPage(user!), { ... });
    }

    // Public Endpoints
    if (url.pathname === '/' && request.method === 'GET') {
      return await handleRootPath(request);
    }

    // Stripe Webhook (public but signature verified)
    if (url.pathname === '/stripe/webhook' && request.method === 'POST') {
      return await handleStripeWebhook(request, env);
    }

    // 404
    return new Response('Not found', { status: 404 });
  }
}
```

**Benefits:**
- Simple to understand (all routes in one place)
- Easy to debug (single entry point)
- Middleware applies cleanly (authentication)
- Fast routing (no complex regex matching)

**Considerations:**
- File gets large (currently ~375 lines)
- Consider: Extract route handlers to separate files (already done for most)

### Module Organization

**Current Structure:**
```
src/
├── index.ts                   # Main worker (routing)
├── types.ts                   # TypeScript interfaces
├── auth.ts                    # User auth (Cloudflare Access - legacy)
├── workos-auth.ts             # WorkOS auth (primary)
├── oauth.ts                   # OAuth provider for MCP servers
├── tokenCrediting.ts          # Token crediting logic
├── tokenConsumption.ts        # Token consumption logic
├── calculatorEndpoints.ts     # Calculator MCP server
├── dashboardEndpoints.ts      # Dashboard API functions
├── middleware/
│   └── authMiddleware.ts      # Authentication middleware
├── stripe/
│   └── stripeEndpoints.ts     # Stripe integration
├── routes/
│   ├── staticPages.ts         # Public pages (/, /privacy, /terms)
│   └── customAuth.ts          # Custom Magic Auth endpoints
└── views/
    ├── htmlTemplates.ts       # HTML templates (dashboard, success page)
    └── customLoginPage.ts     # Login forms (email + code)
```

**Design Principles:**
1. **Separation of Concerns:** Each file has single responsibility
2. **Shared Logic:** `tokenCrediting.ts` used by both webhook and success page
3. **Type Safety:** `types.ts` defines all shared interfaces
4. **Modularity:** Easy to add new MCP servers (follow `calculatorEndpoints.ts` pattern)

### HTML Rendering

**Strategy:** Server-side rendering with template literals

**Example:**
```typescript
export function renderDashboardPage(user: User): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel - MCP Token System</title>
  <style>
    /* CSS styles */
  </style>
</head>
<body>
  <div class="container">
    <h1>Panel użytkownika</h1>
    <p>Email: ${escapeHtml(user.email)}</p>
    <p>Saldo: ${user.current_token_balance} tokenów</p>
    <!-- More content -->
  </div>
  <script>
    // JavaScript for interactivity
  </script>
</body>
</html>
  `;
}
```

**Why Template Literals:**
- Simple (no build step for templates)
- Fast (no parsing overhead)
- Flexible (full JavaScript power)
- Type-safe (TypeScript checks at compile time)

**Considerations:**
- HTML escaping required for user data
- Large templates can be hard to maintain
- Consider: Template engine (Handlebars, EJS) for complex UIs

### External API Integrations

#### Stripe API

**SDK:** `stripe` npm package
**Version:** Latest (automatically updated)
**API Version:** `2025-09-30.clover`

**Initialization:**
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-09-30.clover',
});
```

**Common Operations:**

Create checkout session:
```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card', 'blik', 'p24'],
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'payment',
  success_url: 'https://panel.wtyczki.ai/checkout/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://panel.wtyczki.ai/',
  metadata: { user_id: userId },
});
```

Retrieve session:
```typescript
const session = await stripe.checkout.sessions.retrieve(sessionId, {
  expand: ['line_items.data.price'] // Include price metadata
});
```

Verify webhook:
```typescript
const event = await stripe.webhooks.constructEventAsync(
  body,      // Raw request body
  signature, // Stripe-Signature header
  webhookSecret
);
```

#### WorkOS API

**SDK:** `@workos-inc/node` npm package
**Version:** Latest

**Initialization:**
```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(env.WORKOS_API_KEY);
```

**Common Operations:**

Get authorization URL:
```typescript
const authUrl = workos.userManagement.getAuthorizationUrl({
  provider: 'authkit',
  clientId: env.WORKOS_CLIENT_ID,
  redirectUri: 'https://panel.wtyczki.ai/auth/callback',
  state: '/dashboard',
});
```

Authenticate with code:
```typescript
const { user, accessToken, refreshToken } =
  await workos.userManagement.authenticateWithCode({
    clientId: env.WORKOS_CLIENT_ID,
    code: authCode,
  });
```

Create MagicAuth:
```typescript
const magicAuth = await workos.userManagement.createMagicAuth({
  email: userEmail,
});
// User receives 6-digit code via email
```

Verify MagicAuth:
```typescript
const { user, accessToken, refreshToken } =
  await workos.userManagement.authenticateWithMagicAuth({
    clientId: env.WORKOS_CLIENT_ID,
    code: sixDigitCode,
    email: userEmail,
  });
```

Create user in directory:
```typescript
const workosUser = await workos.userManagement.createUser({
  email: email,
  emailVerified: false,
});
```

### Logging Strategy

**Current:** `console.log()` and `console.error()`

**View Logs:**
```bash
# Real-time logs (production)
npx wrangler tail

# Local development
npx wrangler dev
# Logs appear in terminal
```

**Log Format:**
```typescript
// Structured logging with emojis for quick scanning
console.log(`🔄 [webhook] Processing checkout session: ${sessionId}`);
console.log(`✅ [webhook] Tokens credited: ${tokenAmount}`);
console.error(`❌ [webhook] Failed to credit tokens:`, error);
```

**Emojis Used:**
- 🔄 Process starting
- ✅ Success
- ❌ Error
- ⚠️ Warning (non-fatal)
- 🔐 Authentication event
- 💰 Payment event
- 🎫 Token operation
- 🆕 New user creation

**Future Considerations:**
- Structured logging (JSON format)
- Log aggregation (Datadog, New Relic)
- Error tracking (Sentry)
- Analytics (Mixpanel, Amplitude)

### Performance Considerations

**Database Query Optimization:**

1. **Indexes:** All foreign keys and frequently queried fields indexed
2. **Batch Operations:** Use `env.DB.batch()` instead of sequential queries
3. **Limit Results:** Always use `LIMIT` for lists
4. **Selective Columns:** `SELECT user_id, email` not `SELECT *` (where possible)

**KV Performance:**

1. **TTL:** Set appropriate expiration (auto-cleanup)
2. **Key Design:** Prefix keys by type (`session:`, `access_token:`)
3. **Consistency:** KV is eventually consistent (handle stale reads)

**HTTP Response Times:**

Typical performance:
- Static page: <50ms
- Database query: <50ms
- Stripe API call: 200-500ms
- WorkOS API call: 200-400ms
- End-to-end (with payment): 1-2 seconds

**Optimization Opportunities:**
1. Cache static HTML (success page templates)
2. Parallel API calls where possible
3. Reduce Stripe API calls (cache price metadata)
4. Add CDN caching for static assets

---

## 11. FUTURE EXPANSION GUIDE

### Adding New MCP Servers

**Pattern to Follow:**

1. **Create Endpoint Handler** (`src/<server-name>Endpoints.ts`)

```typescript
import { validateOAuthToken } from './oauth';
import { checkBalance, consumeTokens } from './tokenConsumption';
import type { Env } from './index';

const TOKEN_COST = 5; // Set cost for operations

export async function handle<ServerName>Request(
  request: Request,
  db: D1Database,
  oauthStore: KVNamespace
): Promise<Response> {
  // 1. Validate OAuth token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const token = authHeader.substring(7);
  const userId = await validateOAuthToken(token, { OAUTH_STORE: oauthStore } as any);

  if (!userId) {
    return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 });
  }

  // 2. Parse request
  const body = await request.json();
  // Validate inputs...

  // 3. Check balance
  const balance = await checkBalance(db, userId, TOKEN_COST);
  if (!balance.sufficient) {
    return new Response(JSON.stringify({
      error: 'insufficient_tokens',
      message: getInsufficientBalanceMessage(balance.currentBalance, TOKEN_COST, 'https://panel.wtyczki.ai/dashboard'),
    }), { status: 402 });
  }

  // 4. Execute operation
  let result;
  let success = true;
  try {
    result = await performOperation(body);
  } catch (error) {
    success = false;
    result = { error: error.message };
  }

  // 5. Consume tokens (even if operation failed)
  const consumption = await consumeTokens(
    db,
    userId,
    TOKEN_COST,
    '<server-name>',
    body.operation,
    body,
    result,
    success
  );

  // 6. Return result
  return new Response(JSON.stringify({
    ...result,
    tokensConsumed: TOKEN_COST,
    newBalance: consumption.newBalance,
  }), {
    status: success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

2. **Register Route** (in `src/index.ts`)

```typescript
// MCP Server Endpoints
if (url.pathname === '/mcp/<server-name>' && request.method === 'POST') {
  return await handle<ServerName>Request(request, env.DB, env.OAUTH_STORE);
}
```

3. **Add OAuth Client** (in `src/oauth.ts`)

```typescript
const OAUTH_CLIENTS: Record<string, OAuthClient> = {
  // ...existing clients
  'mcp_<server-name>': {
    client_id: 'mcp_<server-name>',
    client_secret_hash: '$2a$10$...',
    redirect_uris: ['http://localhost:3000/callback'],
    name: '<Server Name> MCP Server',
    scopes: ['mcp_access', 'user_info'],
    created_at: new Date().toISOString(),
  },
};
```

4. **Document Token Costs**

Update pricing documentation:
- Add server to MCP server list
- Specify token cost per operation
- Provide example operations

### Adding New Payment Methods

**Stripe supports 100+ payment methods.** To add a new method:

1. **Enable in Stripe Dashboard**
   - Go to Settings → Payment Methods
   - Enable method (e.g., "Apple Pay", "Google Pay", "Bancontact")

2. **Update Checkout Session** (`src/stripe/stripeEndpoints.ts`)

```typescript
const sessionParams: Stripe.Checkout.SessionCreateParams = {
  payment_method_types: [
    'card',
    'blik',
    'p24',
    'apple_pay',    // NEW
    'google_pay',   // NEW
  ],
  // ...rest of params
};
```

3. **No Other Changes Required**
   - Webhook processing unchanged
   - Token crediting unchanged
   - Success page unchanged

**Popular Methods for Poland:**
- BLIK ✅ (already enabled)
- Przelewy24 ✅ (already enabled)
- Credit cards ✅ (already enabled)
- Bank transfers (needs Stripe approval)
- Klarna (buy now, pay later)

### Adding Subscription Model

**Current:** One-time purchases only
**Future:** Optional subscription tiers

**Architecture Changes Needed:**

1. **Database Schema** (new migration)

```sql
CREATE TABLE subscriptions (
  subscription_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL, -- 'monthly_pro', 'monthly_gold'
  status TEXT NOT NULL, -- 'active', 'canceled', 'past_due'
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

2. **Stripe Products** (Stripe Dashboard)

Create subscription products:
- Monthly Pro: 49 PLN/month → 4000 tokens/month
- Monthly Gold: 99 PLN/month → 10000 tokens/month

3. **Webhook Handler** (add events)

```typescript
// Handle subscription events
if (event.type === 'customer.subscription.created') {
  // Create subscription record
  // Credit initial tokens
}

if (event.type === 'invoice.paid') {
  // Recurring payment succeeded
  // Credit monthly tokens
}

if (event.type === 'customer.subscription.deleted') {
  // Subscription canceled
  // Update status
  // Don't remove tokens (already purchased)
}
```

4. **Dashboard UI** (add subscription section)

Display:
- Current subscription tier
- Next billing date
- Usage this period
- Cancel/upgrade buttons

5. **Business Logic** (token handling)

Options:
- **A) Accumulate:** Unused tokens carry over (user-friendly)
- **B) Reset:** Tokens reset each month (encourages usage)
- **C) Hybrid:** Base tokens reset, purchased tokens carry over (balanced)

**Recommendation:** Hybrid approach (most flexible)

### Adding User Management Features

**Potential Features:**

1. **Multiple Team Members**
   - Share token balance across team
   - Role-based permissions (admin, member)
   - Usage tracking per member

2. **API Keys for Programmatic Access**
   - Generate API keys for direct API access (bypass OAuth)
   - Scoped permissions (read-only, consume tokens)
   - Usage limits per key

3. **Usage Analytics Dashboard**
   - Token consumption graphs
   - MCP server usage breakdown
   - Cost projections
   - Export usage data (CSV, JSON)

4. **Billing History**
   - View all past purchases
   - Download invoices (from Stripe)
   - Refund requests

5. **Account Settings**
   - Change email
   - Delete account (GDPR compliance)
   - Export all data (GDPR compliance)

**Implementation Priority:**
1. Usage analytics (high value, moderate effort)
2. Billing history (high value, low effort)
3. API keys (moderate value, moderate effort)
4. Team features (high value, high effort)

### Internationalization (i18n)

**Current:** Polish language only
**Future:** Multi-language support

**Implementation:**

1. **Extract Strings** (create translation files)

```typescript
// src/i18n/pl.ts
export const pl = {
  dashboard: {
    title: 'Panel użytkownika',
    balance: 'Saldo',
    tokens: 'tokenów',
  },
  checkout: {
    buyNow: 'Kup teraz',
    firstPurchase: 'Pierwsze zakupy!',
  },
  // ...
};

// src/i18n/en.ts
export const en = {
  dashboard: {
    title: 'User Dashboard',
    balance: 'Balance',
    tokens: 'tokens',
  },
  checkout: {
    buyNow: 'Buy now',
    firstPurchase: 'First purchase!',
  },
  // ...
};
```

2. **Translation Function**

```typescript
function t(key: string, locale: string = 'pl'): string {
  const translations = locale === 'en' ? en : pl;
  return key.split('.').reduce((obj, k) => obj[k], translations);
}

// Usage
const title = t('dashboard.title', userLocale);
```

3. **Locale Detection**

```typescript
function getUserLocale(request: Request): string {
  // 1. Check cookie
  const cookieLocale = getCookie(request, 'locale');
  if (cookieLocale) return cookieLocale;

  // 2. Check Accept-Language header
  const acceptLanguage = request.headers.get('Accept-Language');
  if (acceptLanguage?.startsWith('en')) return 'en';

  // 3. Default to Polish
  return 'pl';
}
```

4. **Update Templates**

```typescript
export function renderDashboardPage(user: User, locale: string): string {
  return `
<html>
<head>
  <title>${t('dashboard.title', locale)}</title>
</head>
<body>
  <h1>${t('dashboard.title', locale)}</h1>
  <p>${t('dashboard.balance', locale)}: ${user.current_token_balance} ${t('dashboard.tokens', locale)}</p>
</body>
</html>
  `;
}
```

**Supported Languages Priority:**
1. Polish (already supported)
2. English (international users)
3. German (large market)
4. French (large market)

### Monitoring & Observability

**Current State:** Basic console logging + wrangler tail

**Future Implementation:**

1. **Error Tracking** (Sentry)

```typescript
import * as Sentry from '@sentry/cloudflare';

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: 'production',
});

try {
  await creditTokens(...);
} catch (error) {
  Sentry.captureException(error, {
    extra: {
      userId,
      paymentIntentId,
      tokenAmount,
    },
  });
  throw error;
}
```

2. **Analytics** (Mixpanel or Amplitude)

Track events:
- User signup
- First purchase
- Subsequent purchases
- MCP server usage
- Errors encountered

```typescript
mixpanel.track('Token Purchase', {
  user_id: userId,
  package: 'pro',
  token_amount: 5500,
  price: 59,
  currency: 'PLN',
  is_first_purchase: true,
});
```

3. **Performance Monitoring** (Cloudflare Analytics)

Built-in metrics:
- Request count
- Response time (p50, p95, p99)
- Error rate
- Bandwidth usage

Access via Cloudflare Dashboard.

4. **Custom Metrics** (D1 Queries)

Business metrics:
```sql
-- Daily revenue
SELECT DATE(created_at) as date, SUM(token_amount) as tokens_sold
FROM transactions
WHERE type = 'purchase'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Most popular MCP servers
SELECT mcp_server_name, COUNT(*) as usage_count
FROM mcp_actions
GROUP BY mcp_server_name
ORDER BY usage_count DESC;

-- Average purchase size
SELECT AVG(token_amount) as avg_tokens
FROM transactions
WHERE type = 'purchase';
```

---

## 12. OPERATIONAL GUIDELINES

### Deployment Process

**Command:**
```bash
npx wrangler deploy
```

**What Happens:**
1. TypeScript compiled to JavaScript
2. Code bundled (including dependencies)
3. Uploaded to Cloudflare
4. Deployed to 275+ edge locations globally
5. Live in <30 seconds

**Pre-Deployment Checklist:**

- [ ] Run type check: `npx tsc --noEmit`
- [ ] Test locally: `npx wrangler dev`
- [ ] Review migrations: Ensure D1 migrations applied
- [ ] Check secrets: Verify all secrets configured
- [ ] Test webhook: Use Stripe CLI to send test events
- [ ] Verify balance accuracy: Check sample user balances
- [ ] Review logs: No critical errors in wrangler tail

**Post-Deployment Verification:**

```bash
# Check deployment status
npx wrangler deployments list

# Tail production logs
npx wrangler tail

# Test endpoints
curl https://panel.wtyczki.ai/
curl https://panel.wtyczki.ai/mcp/calculator/health
```

### Database Migrations

**Create Migration:**
```bash
npx wrangler d1 migrations create mcp-tokens-database <migration-name>
```

**Apply Locally:**
```bash
npx wrangler d1 migrations apply mcp-tokens-database --local
```

**Apply Production:**
```bash
npx wrangler d1 migrations apply mcp-tokens-database --remote
```

**Migration History:**

| Migration | Purpose | Date | Key Changes |
|-----------|---------|------|-------------|
| **0001_init_schema.sql** | Initial database setup | 2025-10-12 | Created `users`, `transactions`, `mcp_actions` tables |
| **0002_add_unique_stripe_payment_id.sql** | Payment idempotency | 2025-10-12 | Added UNIQUE constraint on `transactions.stripe_payment_id` |
| **0003_add_balance_check_constraint.sql** | Prevent negative balances | 2025-10-12 | Added CHECK constraint: `current_token_balance >= 0` |
| **0004_add_account_deletion_support.sql** | GDPR compliance | 2025-10-17 | Added `is_deleted`, `deleted_at`, `workos_user_id` to `users`; created `account_deletions` table |
| **0005_add_idempotency_and_reconciliation.sql** | Action idempotency + reconciliation | 2025-10-17 | Added UNIQUE index on `mcp_actions.action_id`; created `failed_deductions` table |
| **0006_track_stripe_deletion.sql** | Stripe deletion tracking | 2025-10-18 | Added Stripe deletion fields to `account_deletions` |
| **0007_track_mcp_anonymization.sql** | MCP action anonymization | 2025-10-18 | Added anonymization tracking for MCP actions |
| **0008_hash_email_in_deletions.sql** | Email hashing | 2025-10-18 | Added email hash field to `account_deletions` |
| **0009_track_failed_deductions_cleanup.sql** | Failed deduction cleanup | 2025-10-18 | Added `resolved`, `resolution_note` to `failed_deductions`; added `failed_deductions_cleaned` to `account_deletions` |
| **0010_track_no_refund_acknowledgment.sql** | No-refund acknowledgment | 2025-10-18 | Added no-refund acknowledgment tracking |
| **0011_track_pending_checkouts.sql** | Pending checkout protection | 2025-10-18 | Added `had_pending_checkout`, `checkout_session_id`, `checkout_auto_refunded`, `checkout_refund_id` to `account_deletions` |

**Migration Best Practices:**

1. **Always Test Locally First**
   ```bash
   # Test on local DB
   npx wrangler dev
   # Verify migration worked
   npx wrangler d1 execute mcp-tokens-database --local --command "SELECT * FROM users LIMIT 1"
   ```

2. **Backwards Compatible**
   - Add new columns with DEFAULT values
   - Don't drop columns (mark as deprecated instead)
   - Create new tables before dropping old ones

3. **Idempotent**
   - Use `IF NOT EXISTS` for CREATE statements
   - Use `IF EXISTS` for DROP statements
   - Handle duplicate key errors gracefully

**Example Migration (Add New Column):**
```sql
-- Migration: 0004_add_referral_code.sql

-- Add referral code column (nullable for existing users)
ALTER TABLE users
ADD COLUMN referral_code TEXT;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code
ON users(referral_code);

-- Backfill: Generate codes for existing users
UPDATE users
SET referral_code = lower(hex(randomblob(4)))
WHERE referral_code IS NULL;
```

### Managing Secrets

**List Secrets:**
```bash
npx wrangler secret list
```

**Set Secret:**
```bash
npx wrangler secret put STRIPE_SECRET_KEY
# Prompts for value (hidden input)
```

**Delete Secret:**
```bash
npx wrangler secret delete STRIPE_SECRET_KEY
```

**Required Secrets:**
- `STRIPE_SECRET_KEY` - Stripe API key (sk_live_... for production)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (whsec_...)
- `WORKOS_API_KEY` - WorkOS API key
- `WORKOS_CLIENT_ID` - WorkOS client ID

**Local Development:**

Create `.dev.vars` (NOT committed):
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
WORKOS_API_KEY=sk_workos_...
WORKOS_CLIENT_ID=client_...
```

### Testing Webhooks Locally

**Install Stripe CLI:**
```bash
brew install stripe/stripe-cli/stripe
# or
npm install -g stripe
```

**Login:**
```bash
stripe login
```

**Forward Webhooks:**
```bash
# Terminal 1: Start local worker
npx wrangler dev

# Terminal 2: Forward webhooks
stripe listen --forward-to http://localhost:8787/stripe/webhook
```

**Trigger Test Events:**
```bash
# Successful payment
stripe trigger checkout.session.completed

# Failed payment
stripe trigger payment_intent.payment_failed
```

**View Events:**
```bash
# List recent events
stripe events list

# View specific event
stripe events retrieve evt_...
```

### Monitoring Production

**Real-Time Logs:**
```bash
npx wrangler tail
```

**Filter Logs:**
```bash
# Only errors
npx wrangler tail --status error

# Specific endpoint
npx wrangler tail --search "/stripe/webhook"
```

**Cloudflare Dashboard:**

Navigate to: Workers & Pages → mcp-token-system → Analytics

View:
- Request count (last 24h, 7d, 30d)
- Success rate
- Error rate
- Response time (p50, p95, p99)
- Top routes

**Set Up Alerts:**

Cloudflare Dashboard → Notifications → Add

Example alerts:
- Error rate > 5% (last 30 minutes)
- Response time p95 > 2 seconds
- Request rate sudden drop (possible outage)

### Handling Incidents

**Incident Response Plan:**

1. **Detect**
   - Monitor alert
   - User report
   - Error spike in logs

2. **Assess**
   - Check Cloudflare status: status.cloudflare.com
   - Check Stripe status: status.stripe.com
   - Check WorkOS status: status.workos.com
   - Review recent deployments
   - Check error logs: `npx wrangler tail --status error`

3. **Mitigate**
   - If deployment caused issue: Rollback
     ```bash
     npx wrangler rollback
     ```
   - If database migration issue: Create fix migration
   - If external service down: Wait or implement fallback

4. **Communicate**
   - Update status page (if available)
   - Email affected users
   - Post to social media

5. **Resolve**
   - Deploy fix
   - Verify resolution
   - Monitor for recurrence

6. **Post-Mortem**
   - Document timeline
   - Identify root cause
   - Implement preventive measures
   - Update runbook

**Common Incidents:**

| Issue | Symptoms | Diagnosis | Resolution |
|-------|----------|-----------|------------|
| **Webhook failures** | Tokens not credited | Check Stripe Dashboard → Webhooks | Verify STRIPE_WEBHOOK_SECRET, check signature verification code |
| **Balance corruption** | Incorrect balances | Query users table, check transactions | Run balance verification script, fix manually if needed |
| **Session expired** | Users logged out early | Check KV expiration | Adjust TTL in session creation code |
| **Database timeout** | 500 errors on queries | Check D1 status | Wait for D1 recovery, add retries |
| **OAuth errors** | MCP servers can't authorize | Check OAUTH_STORE | Clear stale tokens, verify client credentials |

### Data Backup & Recovery

**Database Backups:**

Cloudflare D1 has automatic backups (point-in-time recovery for last 7 days).

**Manual Backup:**
```bash
# Export entire database
npx wrangler d1 export mcp-tokens-database --output=backup.sql --remote

# Store backup securely
# (Upload to S3, Google Drive, etc.)
```

**Restore from Backup:**
```bash
# Import SQL file
npx wrangler d1 execute mcp-tokens-database --file=backup.sql --remote
```

**Backup Schedule:**
- Automatic: Daily (by Cloudflare)
- Manual: Before major migrations

**Data Retention:**
- User accounts: Forever (unless user requests deletion)
- Transactions: Forever (legal requirement)
- MCP actions: Forever (analytics)
- Sessions (KV): 72 hours (auto-expire)
- OAuth tokens (KV): 1 hour - 30 days (auto-expire)

**GDPR Compliance:**

User requests deletion:
```sql
-- 1. Delete sessions (KV)
DELETE workos_session:* for user

-- 2. Delete MCP actions
DELETE FROM mcp_actions WHERE user_id = ?;

-- 3. Delete transactions
DELETE FROM transactions WHERE user_id = ?;

-- 4. Delete user
DELETE FROM users WHERE user_id = ?;

-- 5. Notify Stripe
stripe.customers.del(stripeCustomerId);
```

User requests data export:
```sql
-- Export all user data
SELECT * FROM users WHERE user_id = ?;
SELECT * FROM transactions WHERE user_id = ?;
SELECT * FROM mcp_actions WHERE user_id = ?;
```

Return as JSON file to user.

---

## APPENDIX: Quick Reference

### Environment Variables

**Required for Production:**
- `STRIPE_SECRET_KEY` - Stripe API key (sk_live_...)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (whsec_...)
- `WORKOS_API_KEY` - WorkOS API key (sk_workos_...)
- `WORKOS_CLIENT_ID` - WorkOS client ID (client_...)

**Optional:**
- `PRICE_ID_STARTER` - Stripe price ID for Starter package
- `PRICE_ID_PLUS` - Stripe price ID for Plus package
- `PRICE_ID_PRO` - Stripe price ID for Pro package
- `PRICE_ID_GOLD` - Stripe price ID for Gold package
- `ACCESS_TEAM_DOMAIN` - Legacy Cloudflare Access domain
- `ACCESS_POLICY_AUD` - Legacy Cloudflare Access audience

### API Endpoints

**Public Endpoints:**
- `GET /` - Public home page (guest checkout)
- `GET /privacy` - Privacy policy
- `GET /terms` - Terms of service
- `POST /checkout/create-guest` - Guest checkout session
- `GET /checkout/success` - Payment success page
- `POST /stripe/webhook` - Stripe webhook handler

**Authentication Endpoints:**
- `GET /auth/login` - WorkOS login (redirect)
- `GET /auth/callback` - WorkOS callback
- `GET /auth/login-custom` - Custom Magic Auth (email form)
- `POST /auth/login-custom/send-code` - Send Magic Auth code
- `POST /auth/login-custom/verify-code` - Verify code

**Protected Endpoints (require authentication):**
- `GET /dashboard` - User dashboard
- `GET /auth/user` - Get current user (API)
- `GET /user/transactions` - Transaction history (API)
- `POST /checkout/create` - Authenticated checkout
- `POST /auth/logout` - Logout

**OAuth Endpoints (for MCP servers):**
- `GET /oauth/authorize` - Authorization endpoint
- `POST /oauth/token` - Token endpoint
- `GET /oauth/userinfo` - User info endpoint

**MCP Endpoints (OAuth required):**
- `POST /mcp/calculator` - Calculator operations
- `GET /mcp/calculator/health` - Health check

### Database Queries

**Get user by ID:**
```sql
SELECT * FROM users WHERE user_id = ?;
```

**Get user by email:**
```sql
SELECT * FROM users WHERE email = ?;
```

**Check balance:**
```sql
SELECT current_token_balance FROM users WHERE user_id = ?;
```

**Get transaction history:**
```sql
SELECT * FROM transactions
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT ? OFFSET ?;
```

**Check payment processed:**
```sql
SELECT transaction_id FROM transactions
WHERE stripe_payment_id = ?;
```

**Get MCP usage:**
```sql
SELECT * FROM mcp_actions
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT ?;
```

### Common Commands

**Development:**
```bash
# Install dependencies
npm install

# Start local development
npx wrangler dev

# Type check
npx tsc --noEmit

# Apply migrations locally
npx wrangler d1 migrations apply mcp-tokens-database --local

# Query local database
npx wrangler d1 execute mcp-tokens-database --local --command "SELECT * FROM users"
```

**Deployment:**
```bash
# Deploy to production
npx wrangler deploy

# View deployments
npx wrangler deployments list

# Rollback
npx wrangler rollback

# Apply migrations to production
npx wrangler d1 migrations apply mcp-tokens-database --remote
```

**Secrets:**
```bash
# List secrets
npx wrangler secret list

# Set secret
npx wrangler secret put SECRET_NAME

# Delete secret
npx wrangler secret delete SECRET_NAME
```

**Monitoring:**
```bash
# Tail logs
npx wrangler tail

# Filter errors only
npx wrangler tail --status error

# Search logs
npx wrangler tail --search "keyword"
```

**Testing:**
```bash
# Forward webhooks locally
stripe listen --forward-to http://localhost:8787/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

---

## 13. ACCOUNT DELETION SYSTEM

### Overview

**Purpose:** GDPR-compliant account deletion with data anonymization

**Legal Basis:** GDPR Article 17 - Right to Erasure

**Implementation:** `src/routes/accountSettings.ts`, `src/services/accountDeletionService.ts`

### User-Facing Flow

**Entry Point:** `/dashboard/settings` → "Usuń konto" button

**Step 1: Warning Display**
```
⚠️  UWAGA: Usunięcie konta jest nieodwracalne

Skutki usunięcia konta:
• Wszystkie niewykorzystane tokeny przepadną (brak zwrotu środków)
• Historia transakcji zostanie zanonimizowana
• Nie będziesz mógł zalogować się ponownie
• Twoje dane osobowe zostaną usunięte zgodnie z RODO

[Anuluj] [Potwierdź usunięcie]
```

**Step 2: Email Confirmation**
```
Wpisz swój adres email, aby potwierdzić:
[_____________________]

☐ Rozumiem, że niewykorzystane tokeny przepadną bez zwrotu środków

[Anuluj] [Usuń konto]
```

**Step 3: Processing**
```
POST /account/delete/confirm
{
  "userId": "550e8400-...",
  "emailConfirmation": "user@example.com",
  "acknowledgedNoRefund": true,
  "deletionReason": "No longer needed" // Optional
}
```

**Step 4: Success**
```
✅ Konto zostało usunięte

Twoje dane osobowe zostały zanonimizowane zgodnie z RODO.
Historia transakcji została zachowana dla celów księgowych.

Dziękujemy za korzystanie z naszych usług.

[Powrót do strony głównej]
```

### Backend Processing

**Function:** `deleteUserAccount()` in `src/services/accountDeletionService.ts`

**Process Flow:**

```
1. Validate Request
   - Check userId exists
   - Check is_deleted = 0 (not already deleted)
   - Verify email confirmation matches
   - Verify acknowledgedNoRefund = true

2. Check Eligibility
   - Get current token balance
   - Get total tokens purchased/used
   - Check for pending checkout sessions

3. Create Audit Record
   INSERT INTO account_deletions (
     deletion_id, user_id, original_email,
     tokens_forfeited, total_tokens_purchased, total_tokens_used,
     stripe_customer_id, deletion_reason, deleted_at, deleted_by_ip,
     failed_deductions_cleaned, had_pending_checkout, checkout_session_id
   )

4. Anonymize User Data
   UPDATE users SET
     email = 'deleted_{SHA256(email)}@anonymized.local',
     is_deleted = 1,
     deleted_at = current_timestamp,
     current_token_balance = 0  -- Forfeit remaining tokens
   WHERE user_id = ?

5. Clean Failed Deductions
   UPDATE failed_deductions SET
     user_id = 'DELETED',
     parameters = '{"anonymized": true, "reason": "user_account_deleted"}',
     resolved = 1,
     resolution_note = 'User account deleted - reconciliation cancelled'
   WHERE user_id = ? AND resolved = 0

6. Delete from WorkOS (optional)
   - Call WorkOS API to delete user
   - Non-fatal if fails (user can still be deleted locally)

7. Delete from Stripe (optional)
   - Call Stripe API to delete customer
   - Non-fatal if fails (customer can remain in Stripe)

8. Clear Session
   - Delete from USER_SESSIONS KV
   - Clear workos_session cookie

9. Return Success
   {
     "success": true,
     "message": "Konto zostało usunięte",
     "tokensForfeited": 150
   }
```

### Data Retention Policy

**What Gets Deleted:**
- ✅ Email address (anonymized to `deleted_{hash}@anonymized.local`)
- ✅ User session (cleared from KV)
- ✅ WorkOS user account (best effort)
- ✅ Stripe customer (best effort)
- ✅ Token balance (forfeited)

**What Gets Preserved:**
- ✅ Transaction history (anonymized user_id)
- ✅ MCP action logs (anonymized user_id)
- ✅ Account deletion audit record
- ✅ Failed deductions (anonymized, marked resolved)

**Why Preserve Transaction History:**
- **Legal requirement:** Tax and accounting compliance (7-10 years)
- **Fraud prevention:** Detect patterns of abuse
- **Analytics:** Understand user behavior (anonymized)

### Edge Cases Handled

**1. User has pending checkout session**

Detection:
```typescript
const pendingSession = await stripe.checkout.sessions.list({
  customer: stripeCustomerId,
  limit: 1
});

if (pendingSession.data[0]?.status === 'open') {
  // Record in account_deletions
  had_pending_checkout = 1;
  checkout_session_id = pendingSession.data[0].id;
}
```

Handling in webhook:
```typescript
// In handleStripeWebhook() - checkout.session.completed
const user = await db.prepare('SELECT is_deleted, deleted_at FROM users WHERE user_id = ?').first();

if (user.is_deleted === 1) {
  const deletionTime = new Date(user.deleted_at);
  const now = new Date();
  const hoursSinceDeletion = (now - deletionTime) / (1000 * 60 * 60);

  if (hoursSinceDeletion < 1) {
    // Auto-refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer'
    });

    // Update account_deletions record
    await db.prepare(
      'UPDATE account_deletions SET checkout_auto_refunded = 1, checkout_refund_id = ? WHERE user_id = ?'
    ).bind(refund.id, userId).run();

    console.log('✅ Auto-refund issued for deleted user');
    return new Response(JSON.stringify({ status: 'refunded' }), { status: 200 });
  }
}
```

**2. User has unresolved failed deductions**

```typescript
const failedDeductions = await env.DB.prepare(
  'SELECT COUNT(*) as count FROM failed_deductions WHERE user_id = ? AND resolved = 0'
).bind(userId).first();

if (failedDeductions.count > 0) {
  // Anonymize and mark as resolved (handled in step 5 above)
  console.log(`Cleaning ${failedDeductions.count} failed deductions`);
}
```

**3. User tries to delete already deleted account**

```typescript
if (user.is_deleted === 1) {
  return new Response(JSON.stringify({
    success: false,
    error: 'Konto zostało już usunięte'
  }), { status: 410 }); // 410 Gone
}
```

---

## 14. RECONCILIATION & RELIABILITY

### Overview

**Purpose:** Automatic recovery from transient token consumption failures

**Problem Solved:** Database timeouts, network issues, or temporary failures can cause token charges to fail, resulting in:
- Lost revenue (user got service but wasn't charged)
- Inconsistent state (action logged but no transaction)
- Poor user experience (operation failed unexpectedly)

**Solution:** Automatic retry with exponential backoff + background reconciliation job

### Failed Token Consumption Flow

**Location:** `src/tokenConsumption.ts` - `consumeTokensWithRetry()`

```
User executes MCP action
     ↓
Generate action_id (UUID) for idempotency
     ↓
Call consumeTokensWithRetry()
     ↓
──────────────────────────
ATTEMPT 1 (immediate)
──────────────────────────
     ↓
Try to consume tokens (atomic transaction)
     ↓
SUCCESS? → Return result ✅
     ↓
FAILURE → Log error
     ↓
Wait 100ms (exponential backoff)
     ↓
──────────────────────────
ATTEMPT 2
──────────────────────────
     ↓
Retry same action_id (idempotent)
     ↓
SUCCESS? → Return result ✅
     ↓
FAILURE → Log error
     ↓
Wait 200ms (exponential backoff)
     ↓
──────────────────────────
ATTEMPT 3 (final)
──────────────────────────
     ↓
Retry same action_id (idempotent)
     ↓
SUCCESS? → Return result ✅
     ↓
FAILURE → All retries exhausted
     ↓
──────────────────────────
LOG TO failed_deductions
──────────────────────────
INSERT INTO failed_deductions (
  action_id, user_id, mcp_server_name, tool_name,
  token_amount, parameters, error_message,
  created_at, retry_count
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 3)
     ↓
Throw error to caller
(User sees failure, but we have audit trail)
```

### Background Reconciliation Job

**Location:** `src/reconciliation.ts` - `handleReconciliation()`

**Trigger:** Cron job every 6 hours (configured in `wrangler.toml`)

```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours at minute 0
```

**Process:**

```
Cron triggers /cron/reconcile endpoint
     ↓
Query failed_deductions WHERE resolved = 0
     ↓
For each failed deduction:
     ↓
1. Check if user still exists and not deleted
   SELECT is_deleted FROM users WHERE user_id = ?
     ↓
   User deleted? → Mark resolved with note "User deleted"
     ↓
2. Check if user has sufficient balance NOW
   SELECT current_token_balance FROM users WHERE user_id = ?
     ↓
   Insufficient? → Skip (wait for user to purchase more)
     ↓
3. Attempt to consume tokens (with original action_id)
   Call consumeTokens(action_id, userId, tokenAmount, ...)
     ↓
   SUCCESS:
   - UPDATE failed_deductions SET resolved = 1, resolved_at = NOW(),
     resolution_note = 'Successfully reconciled by background job'
   - Revenue recovered! ✅
     ↓
   FAILURE (idempotency - already processed):
   - UPDATE failed_deductions SET resolved = 1, resolved_at = NOW(),
     resolution_note = 'Already processed (idempotency check passed)'
     ↓
   FAILURE (other error):
   - UPDATE failed_deductions SET retry_count = retry_count + 1,
     last_retry_at = NOW()
   - Try again in next cron run
     ↓
Return summary:
{
  "totalPending": 10,
  "reconciled": 7,
  "skipped": 2,
  "failed": 1
}
```

### Monitoring & Alerts

**Metrics to Track:**

1. **Failure Rate:**
```sql
SELECT COUNT(*) as total_failures,
       DATE(created_at) as failure_date
FROM failed_deductions
GROUP BY DATE(created_at)
ORDER BY failure_date DESC;
```

2. **Reconciliation Success Rate:**
```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved,
  ROUND(SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM failed_deductions;
```

3. **Revenue at Risk:**
```sql
SELECT SUM(token_amount) as tokens_at_risk
FROM failed_deductions
WHERE resolved = 0;
```

**Alert Thresholds:**

- ⚠️  **Warning:** >10 unresolved failed deductions
- 🚨 **Critical:** >50 unresolved failed deductions or failure rate >5%

### Testing Reconciliation

**Local Test:**

```bash
# Start worker
npx wrangler dev

# Trigger reconciliation manually
curl -X POST http://localhost:8787/cron/reconcile
```

**Insert Test Failed Deduction:**

```sql
INSERT INTO failed_deductions (
  action_id, user_id, mcp_server_name, tool_name,
  token_amount, parameters, error_message,
  created_at, retry_count
) VALUES (
  '12345678-1234-1234-1234-123456789012',
  'your-test-user-id',
  'calculator',
  'add',
  1,
  '{"params":{"a":5,"b":3},"result":{"result":8}}',
  'Test failure for reconciliation',
  datetime('now'),
  3
);
```

---

## 15. ADVANCED IDEMPOTENCY

### Overview

**Idempotency:** Performing the same operation multiple times produces the same result as performing it once.

**Critical for:**
- Token crediting (payment webhooks may be retried)
- Token consumption (MCP requests may be retried)
- Account operations (network failures cause retries)

### Layer 1: Payment Idempotency (Stripe)

**Key:** `payment_intent_id` from Stripe

**Implementation:** `src/tokenCrediting.ts` - `creditTokens()`

**Database Constraint (Migration 0002):**
```sql
CREATE UNIQUE INDEX idx_transactions_stripe_payment_unique
ON transactions(stripe_payment_id)
WHERE stripe_payment_id IS NOT NULL;
```

**Application Check:**
```typescript
// Check if payment already processed
const existingTx = await env.DB.prepare(
  'SELECT transaction_id FROM transactions WHERE stripe_payment_id = ?'
).bind(paymentIntentId).first();

if (existingTx) {
  console.log('Already processed, skipping credit');
  return { alreadyProcessed: true, ... };
}

// Otherwise, proceed with atomic crediting
await env.DB.batch([
  env.DB.prepare('INSERT INTO transactions ...'),
  env.DB.prepare('UPDATE users SET ...')
]);
```

**Protection Against:**
- Webhook retry after timeout
- Success page AND webhook both firing
- User refreshing success page
- Network failures causing duplicate requests

**Example Scenario:**

```
10:00:00 - User completes payment
10:00:01 - Stripe sends webhook #1 → Processing...
10:00:02 - User redirected to success page → Processing...
10:00:03 - Webhook #1 completes → Tokens credited ✅
10:00:04 - Success page completes → Idempotency check passes → Returns same result ✅
10:00:30 - Stripe times out waiting for webhook response
10:01:00 - Stripe sends webhook #2 (retry) → Idempotency check passes → Returns same result ✅

Result: User credited exactly once 🎯
```

### Layer 2: Action Idempotency (MCP)

**Key:** `action_id` (UUID) generated by MCP client or server

**Implementation:** `src/tokenConsumption.ts` - `consumeTokens()`

**Database Constraint (Migration 0005):**
```sql
CREATE UNIQUE INDEX idx_mcp_actions_action_id ON mcp_actions(action_id);
```

**Application Check:**
```typescript
// Check if action already processed
const existingAction = await db.prepare(
  'SELECT action_id, tokens_consumed FROM mcp_actions WHERE action_id = ?'
).bind(action_id).first();

if (existingAction) {
  console.log('Action already processed, returning existing result');
  return { alreadyProcessed: true, ... };
}

// Otherwise, proceed with atomic consumption
await db.batch([
  db.prepare('UPDATE users SET current_token_balance = current_token_balance - ?'),
  db.prepare('INSERT INTO transactions ...'),
  db.prepare('INSERT INTO mcp_actions ...')  // UNIQUE constraint here
]);
```

**Race Condition Handling:**

```typescript
// If two concurrent requests use same action_id
try {
  await db.batch([/* operations */]);
} catch (error) {
  if (error.message.includes('UNIQUE constraint failed')) {
    // Race detected - second request arrived while first was processing
    console.log('Race condition detected, fetching existing action');

    // Recursive call to get existing result (idempotent)
    return await consumeTokens(db, userId, tokenAmount, ..., action_id);
  }
  throw error;
}
```

**Protection Against:**
- MCP client retry on timeout
- Network failures causing duplicate requests
- Race conditions (concurrent requests with same action_id)
- Failed deduction reconciliation

### Layer 3: Session Idempotency

**Key:** Session token (UUID)

**Implementation:** `src/workos-auth.ts` - `validateSession()`

**Storage:** KV with TTL (72 hours)

**Pattern:**
```typescript
// Check if session already exists
const existingSession = await USER_SESSIONS.get(sessionToken);

if (existingSession) {
  return JSON.parse(existingSession);  // Reuse existing
}

// Create new session
await USER_SESSIONS.put(sessionToken, JSON.stringify(sessionData), {
  expirationTtl: 72 * 60 * 60  // 72 hours
});
```

### Testing Idempotency

**Test 1: Duplicate Payment Webhook**

```bash
# Send same webhook twice
stripe trigger checkout.session.completed --override payment_intent_id=pi_test123
sleep 2
stripe trigger checkout.session.completed --override payment_intent_id=pi_test123

# Expected: Second webhook returns "already_processed"
```

**Test 2: Duplicate MCP Action**

```bash
# Send same action_id twice
curl -X POST http://localhost:8787/mcp/calculator \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Action-ID: test-action-123" \
  -d '{"operation":"add","a":5,"b":3}'

curl -X POST http://localhost:8787/mcp/calculator \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Action-ID: test-action-123" \
  -d '{"operation":"add","a":5,"b":3}'

# Expected: Second request returns same result, tokens charged once
```

---

## 16. EDGE CASE HANDLING

### Overview

**Edge cases** are rare scenarios that can cause data inconsistencies or poor user experience if not handled properly.

### Edge Case 1: Payment After Account Deletion

**Scenario:**
1. User starts checkout process
2. User deletes account while Stripe payment page is open
3. User completes payment after deletion

**Detection (Webhook Handler):**

```typescript
// In handleStripeWebhook() - checkout.session.completed
const user = await env.DB.prepare(
  'SELECT is_deleted, deleted_at FROM users WHERE user_id = ?'
).bind(userId).first();

if (user?.is_deleted === 1) {
  const deletionTime = new Date(user.deleted_at);
  const now = new Date();
  const hoursSinceDeletion = (now - deletionTime) / (1000 * 60 * 60);

  if (hoursSinceDeletion < 1) {
    // Payment completed within 1 hour of deletion → Auto-refund
    console.log('⚠️  Payment after deletion detected - issuing refund');

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer'
    });

    // Update audit record
    await env.DB.prepare(`
      UPDATE account_deletions
      SET checkout_auto_refunded = 1, checkout_refund_id = ?
      WHERE user_id = ?
    `).bind(refund.id, userId).run();

    // Send explanatory email (optional)
    await sendEmail({
      to: originalEmail,  // From account_deletions table
      subject: 'Refund Issued - Account Deleted',
      body: 'Your payment was refunded because your account was deleted.'
    });

    return new Response(JSON.stringify({ status: 'refunded' }), { status: 200 });
  } else {
    // More than 1 hour since deletion → Log anomaly but don't refund
    console.warn('⚠️  Late payment after deletion (>1 hour) - manual review required');
    // TODO: Alert admin for manual review
  }
}
```

**Prevention (Account Deletion Handler):**

```typescript
// In deleteUserAccount() - check for pending checkouts
const pendingSessions = await stripe.checkout.sessions.list({
  customer: stripeCustomerId,
  limit: 10
});

const openSession = pendingSessions.data.find(s => s.status === 'open');

if (openSession) {
  // Record in audit trail
  await env.DB.prepare(`
    UPDATE account_deletions
    SET had_pending_checkout = 1, checkout_session_id = ?
    WHERE deletion_id = ?
  `).bind(openSession.id, deletionId).run();

  console.warn(`⚠️  User has pending checkout: ${openSession.id}`);
}
```

### Edge Case 2: Negative Balance (Protection)

**Scenario:** Bug or race condition causes token balance to go negative

**Prevention (Migration 0003):**

```sql
ALTER TABLE users
ADD CONSTRAINT check_balance_non_negative
CHECK (current_token_balance >= 0);
```

**Application Check:**

```typescript
// Before consuming tokens, always check balance
const balanceCheck = await checkBalance(env.DB, userId, requiredTokens);

if (!balanceCheck.sufficient) {
  return new Response(JSON.stringify({
    error: 'insufficient_tokens',
    message: getInsufficientBalanceMessage(balanceCheck.currentBalance, requiredTokens, dashboardUrl)
  }), { status: 402 });  // 402 Payment Required
}

// Proceed with consumption
```

**Detection:**

```typescript
// After atomic transaction, verify balance is non-negative
const verifyUser = await env.DB.prepare(
  'SELECT current_token_balance FROM users WHERE user_id = ?'
).bind(userId).first();

if (verifyUser.current_token_balance < 0) {
  console.error('🚨 CRITICAL: Negative balance detected!');
  // Database constraint should prevent this, but log if it happens
  throw new Error('Balance verification failed: negative balance');
}
```

### Edge Case 3: Deleted User Token Operations

**Scenario:** Deleted user tries to consume tokens or check balance

**Protection (All Token Operations):**

```typescript
// In checkBalance() and consumeTokens()
const user = await db.prepare(
  'SELECT current_token_balance FROM users WHERE user_id = ? AND is_deleted = 0'
).bind(userId).first();

if (!user) {
  return {
    sufficient: false,
    currentBalance: 0,
    required: requiredTokens,
    error: 'User not found or account deleted'
  };
}
```

**UPDATE Protection:**

```typescript
// In consumeTokens() - atomic transaction
db.prepare(`
  UPDATE users
  SET current_token_balance = current_token_balance - ?
  WHERE user_id = ? AND is_deleted = 0
`).bind(tokenAmount, userId)

// Check if update affected any rows
if (batchResult[0].meta.changes === 0) {
  throw new Error('User not found, deleted, or balance update failed');
}
```

### Edge Case 4: Concurrent Balance Updates

**Scenario:** Two MCP actions execute simultaneously on same user account

**Protection:** Database-level atomic transactions (SQLite's ACID guarantees)

```typescript
// Both requests execute this atomically
await env.DB.batch([
  env.DB.prepare('UPDATE users SET current_token_balance = current_token_balance - ?'),
  env.DB.prepare('INSERT INTO transactions ...'),
  env.DB.prepare('INSERT INTO mcp_actions ...')
]);

// SQLite ensures:
// 1. Request A reads balance: 100
// 2. Request A writes balance: 95 (100 - 5)
// 3. Request B reads balance: 95 (NOT 100)
// 4. Request B writes balance: 94 (95 - 1)
// Final balance: 94 ✅ (not 99 or 96)
```

### Edge Case 5: Stripe Webhook Signature Verification Failure

**Scenario:** Malicious actor sends fake webhook to credit tokens

**Protection:**

```typescript
// ALWAYS verify webhook signature first
try {
  const event = await stripe.webhooks.constructEventAsync(
    body,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
} catch (error) {
  console.error('❌ Invalid webhook signature');
  return new Response('Webhook signature verification failed', { status: 400 });
  // REJECT immediately - don't process event
}

// Only proceed if signature is valid
```

**Never skip this check:**
```typescript
// 🚨 WRONG - allows fake webhooks
const event = JSON.parse(body);
await creditTokens(...);  // Attacker can credit arbitrary tokens!

// ✅ CORRECT - verifies authenticity
const event = await stripe.webhooks.constructEventAsync(body, signature, secret);
await creditTokens(...);
```

### Edge Case 6: WorkOS/Stripe API Failures During Account Deletion

**Scenario:** User deletes account, but WorkOS/Stripe API calls fail

**Handling (Best Effort):**

```typescript
// Delete from WorkOS (non-fatal)
try {
  await deleteWorkOSUser(workosUserId);
  console.log('✅ WorkOS user deleted');
} catch (error) {
  console.warn('⚠️  WorkOS deletion failed (non-fatal):', error);
  // Continue with deletion - user is still deleted locally
}

// Delete from Stripe (non-fatal)
try {
  await stripe.customers.del(stripeCustomerId);
  console.log('✅ Stripe customer deleted');
} catch (error) {
  console.warn('⚠️  Stripe deletion failed (non-fatal):', error);
  // Continue with deletion - customer can remain in Stripe
}

// User is still considered deleted in our system
// Account deletion succeeds even if external APIs fail
```

---

## CONCLUSION

This document provides comprehensive coverage of the MCP Token System architecture, business logic, and operational procedures.

**Key Principles to Remember:**

1. **Database is Source of Truth:** Always query D1 for current balances (never cache)
2. **Security First:** Verify signatures, use prepared statements, validate inputs
3. **Atomic Operations:** Use batch transactions for multi-step updates
4. **Idempotency:** Protect against duplicate processing
5. **User Experience:** Clear errors, positive messaging, zero friction

---

**Document Version:** 2.0
**Last Updated:** 2025-10-17
**Maintainer:** Development Team