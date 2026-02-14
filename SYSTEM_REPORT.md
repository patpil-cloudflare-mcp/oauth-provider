# MCP OAuth System Report

**Project**: mcp-oauth — MCP Authentication via WorkOS AuthKit
**Platform**: Cloudflare Workers (Serverless Edge Computing)
**Domains**: `panel.wtyczki.ai` (Dashboard), `api.wtyczki.ai` (API)
**Last Updated**: 2026-02-14

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Authentication Flow — How Users Log In](#2-authentication-flow--how-users-log-in)
3. [MCP Authorization Flow — How MCP Clients Connect](#3-mcp-authorization-flow--how-mcp-clients-connect)
4. [API Key Authentication — Alternative Access Method](#4-api-key-authentication--alternative-access-method)
5. [Session Management](#5-session-management)
6. [Database Schema](#6-database-schema)
7. [KV Storage](#7-kv-storage)
8. [Endpoint Reference](#8-endpoint-reference)
9. [Security Model](#9-security-model)
10. [Token Lifecycle](#10-token-lifecycle)
11. [User Workflow — Complete Journeys](#11-user-workflow--complete-journeys)
12. [GDPR & Account Deletion](#12-gdpr--account-deletion)
13. [Deployment & Infrastructure](#13-deployment--infrastructure)
14. [Known Limitations & TODOs](#14-known-limitations--todos)

---

## 1. System Architecture

The system delegates all OAuth 2.1 authorization (authorization codes, tokens, PKCE, consent, dynamic client registration) to **WorkOS AuthKit**. The Cloudflare Worker serves as a thin resource server and user dashboard.

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (e.g. Claude Desktop)          │
│                    Discovers AuthKit via metadata             │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
               │ OAuth 2.1 + PKCE          │ Bearer token
               ▼                           ▼
┌──────────────────────────┐  ┌─────────────────────────────────┐
│   WorkOS AuthKit          │  │  Cloudflare Worker: oauth-provider│
│   (Authorization Server)  │  │  panel.wtyczki.ai / api.wtyczki.ai│
│                           │  │  (Resource Server)                 │
│  • /oauth2/authorize      │  │                                    │
│  • /oauth2/token          │  │  ┌──────────┐  ┌──────────────┐  │
│  • /oauth2/jwks           │  │  │ UserInfo  │  │  Dashboard   │  │
│  • /oauth2/register (DCR) │  │  │ (JWT +   │  │  + API Key   │  │
│  • /oauth2/introspection  │  │  │  API Key) │  │  Management  │  │
│  • Consent UI             │  │  └─────┬────┘  └──────┬───────┘  │
│  • Login UI (AuthKit      │  │
│    or custom via Connect) │  │        │              │           │
│                           │  │  ┌─────┴──────────────┴────────┐ │
│  Domain:                  │  │  │      Authentication Layer     │ │
│  exciting-domain-65       │  │  │  WorkOS Magic Auth + Sessions │ │
│  .authkit.app             │  │  └─────┬──────────────┬────────┘ │
└──────────────────────────┘  │        │              │           │
                               │  ┌─────▼────┐  ┌─────▼──────┐   │
                               │  │ D1 (SQL)  │  │KV: SESSIONS│   │
                               │  │ TOKEN_DB  │  │USER_SESSIONS│  │
                               │  └──────────┘  └────────────┘   │
                               └─────────────────────────────────┘
```

**Technology stack:**

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers (V8 Isolates) |
| Language | TypeScript |
| Database | Cloudflare D1 (SQLite-compatible) |
| KV Storage | Cloudflare KV (2 namespaces) |
| Authorization Server | WorkOS AuthKit (OAuth 2.1, PKCE, DCR, CIMD) |
| Auth Provider | WorkOS (Magic Auth + AuthKit) |
| Static Assets | Cloudflare Workers Assets |
| JWT Library | jose (verification via JWKS + decoding) |
| WorkOS SDK | @workos-inc/node v8 |
| Deployment | GitHub integration (Workers Builds) |

---

## 2. Authentication Flow — How Users Log In

The system uses **WorkOS Magic Auth** as the primary authentication method. Users authenticate via a 6-digit one-time code sent to their email.

### 2.1 Registration Flow

```
User visits panel.wtyczki.ai
        │
        ▼
┌──────────────────┐
│ Unified Auth Page│  (/?tab=register)
│ "Register" tab   │
└────────┬─────────┘
         │ Submits email + CSRF token
         ▼
POST /auth/login-custom/send-code
         │
         ├── Validate CSRF token (cookie vs form)
         ├── Validate email format
         ├── Check user does NOT exist in D1 → reject if exists
         ├── INSERT new user into D1 (users table)
         ├── Call WorkOS REST API: POST /user_management/magic_auth
         │   → Forwards browser Accept-Language header (fallback: pl)
         │   → WorkOS sends 6-digit code to email in user's language
         └── Return code input form (with new CSRF token)
                  │
                  │ User enters 6-digit code
                  ▼
POST /auth/login-custom/verify-code
         │
         ├── Validate CSRF token
         ├── Validate code format (6 digits)
         ├── Call WorkOS: authenticateWithMagicAuth({ code, email })
         │   → Returns workosUser, accessToken, refreshToken
         ├── Lookup user by workos_user_id first, then email
         ├── UPDATE user in D1 (email synced, last_login_at, workos_user_id)
         ├── Generate session token (UUID)
         ├── Store session in KV (USER_SESSIONS) with 72h TTL
         ├── Set cookie: workos_session=<token>
         └── Redirect to /dashboard (or return_to URL)

Note: The `return_to` parameter is preserved across tab switches (login ↔ register)
and error redirects, ensuring MCP connect flows don't lose context.
```

### 2.2 Login Flow

Identical to registration except:
- Uses "Login" tab (`/?tab=login`)
- Checks user **exists** in D1 → rejects if not found
- Does NOT create a new user record
- Looks up user by `workos_user_id` first (handles email changes in WorkOS), falls back to email
- Syncs current email from WorkOS and updates `last_login_at` + `workos_user_id`

### 2.3 WorkOS AuthKit Flow (Alternative)

A secondary login path via WorkOS AuthKit (full OAuth redirect):

```
GET /auth/callback?code=<workos_code>&state=<return_path>
         │
         ├── Exchange code via WorkOS SDK: authenticateWithCode()
         ├── Lookup user by workos_user_id first, fallback to email
         ├── UPDATE existing or INSERT new user (getOrCreateUser)
         │   → Email synced from WorkOS on every login
         ├── Generate session token (UUID)
         ├── Store session in KV (24h TTL)
         ├── Set cookie: workos_session=<token> (Max-Age=259200 / 3 days)
         └── Redirect to state parameter (default: /dashboard)
```

### 2.4 Logout Flow

```
POST /auth/logout
         │
         ├── Extract session token from cookie
         ├── Load session from KV
         ├── Decode WorkOS JWT to extract session ID (sid claim)
         ├── Delete session from KV
         ├── Call WorkOS: getLogoutUrl({ sessionId, returnTo })
         ├── Clear cookie (Max-Age=0)
         └── Return JSON with logoutUrl
                  │
                  ▼ (Client-side redirect to WorkOS)
WorkOS clears its session
                  │
                  ▼ (WorkOS redirects back)
GET /auth/logout-success → Static HTML confirmation page
```

---

## 3. MCP Authorization Flow — How MCP Clients Connect

MCP clients (like Claude Desktop) authenticate via **WorkOS AuthKit** which handles the full OAuth 2.1 flow. The Worker acts as the resource server, and uses **Standalone Connect** to show the custom Magic Auth login instead of AuthKit's native UI.

### 3.1 Discovery

MCP clients discover the authorization server via well-known endpoints:

| Endpoint | Purpose | RFC |
|---|---|---|
| `/.well-known/oauth-protected-resource` | Points clients to AuthKit as the authorization server | RFC 9728 |
| `/.well-known/oauth-authorization-server` | Proxied from AuthKit (backward compat for older MCP clients) | RFC 8414 |

**Protected Resource Metadata response:**
```json
{
  "resource": "https://panel.wtyczki.ai",
  "authorization_servers": ["https://exciting-domain-65.authkit.app"],
  "bearer_methods_supported": ["header"]
}
```

**AuthKit capabilities** (proxied at `/.well-known/oauth-authorization-server`):
- Scopes: `openid`, `profile`, `email`, `offline_access`
- Response types: `code` only
- Grant types: `authorization_code`, `refresh_token`
- Auth methods: `none`, `client_secret_post`, `client_secret_basic`
- PKCE: `S256` only
- Dynamic Client Registration (DCR) + Client ID Metadata Document (CIMD) enabled

### 3.2 Authorization Code Flow with PKCE (via Standalone Connect)

```
MCP Client                   AuthKit                    Worker (Resource Server)
    │                     (Auth Server)                         │
    │                                                           │
    │  1. Fetch /.well-known/oauth-protected-resource──────────▶│
    │◀─JSON: authorization_servers: [authkit_domain]────────────│
    │                                                           │
    │  2. Fetch authkit/.well-known/oauth-authorization-server  │
    │──────────────────────▶│                                   │
    │◀─JSON: endpoints──────│                                   │
    │                       │                                   │
    │  3. (Optional) POST /oauth2/register (DCR)                │
    │──────────────────────▶│                                   │
    │◀─client_id────────────│                                   │
    │                       │                                   │
    │  4. Generate PKCE code_verifier + code_challenge          │
    │                       │                                   │
    │  5. GET /oauth2/authorize                                 │
    │──────────────────────▶│                                   │
    │                       │                                   │
    │  6. AuthKit redirects to Login URI (Standalone Connect)   │
    │                       │──302 /auth/connect-login──────────▶│
    │                       │   ?external_auth_id=xxx           │
    │                       │                                   │
    │  7a. No session → Redirect to custom login                │
    │                       │         /?tab=login&return_to=... │
    │                       │         User logs in via Magic Auth│
    │                       │         → Redirects back to        │
    │                       │           /auth/connect-login      │
    │                       │                                   │
    │  7b. Session exists → Call completion API                 │
    │                       │◀─POST /authkit/oauth2/complete────│
    │                       │   { external_auth_id, user }      │
    │                       │──{ redirect_uri }─────────────────▶│
    │                       │◀─302 redirect to AuthKit──────────│
    │                       │                                   │
    │  8. AuthKit consent + token issuance                      │
    │◀─302 redirect_uri?code=xxx&state=xxx                      │
    │                       │                                   │
    │  9. POST /oauth2/token (code + code_verifier)             │
    │──────────────────────▶│                                   │
    │◀─JSON: access_token (JWT), refresh_token                  │
    │                       │                                   │
    │ 10. GET /oauth/userinfo (Bearer JWT)─────────────────────▶│
    │                       │           ├── Verify JWT via JWKS │
    │                       │           ├── Check issuer claim  │
    │                       │           ├── Lookup user by sub  │
    │                       │           │   (workos_user_id)    │
    │◀─JSON: { sub, email }─────────────────────────────────────│
```

### 3.3 Standalone Connect — Custom Login for MCP

Instead of showing AuthKit's native login page, MCP clients see the same custom Magic Auth login used at `panel.wtyczki.ai`. This is implemented via **WorkOS Standalone Connect**.

**How it works:**

1. AuthKit's **Login URI** is configured to `https://panel.wtyczki.ai/auth/connect-login`
2. When an MCP client initiates OAuth, AuthKit redirects to this URL with an `external_auth_id` parameter
3. The handler checks for an existing session:
   - **Session exists:** Calls the AuthKit completion API (`POST https://api.workos.com/authkit/oauth2/complete`) with the user's WorkOS ID and email, then redirects to the returned `redirect_uri`
   - **No session:** Redirects to the login page (`/?tab=login&return_to=/auth/connect-login?external_auth_id=xxx`), user goes through Magic Auth, then returns to complete the flow

**Completion API call:**
```
POST https://api.workos.com/authkit/oauth2/complete
Authorization: Bearer {WORKOS_API_KEY}
Content-Type: application/json

{
  "external_auth_id": "<from AuthKit redirect>",
  "user": {
    "id": "<workos_user_id from KV session>",
    "email": "<email from KV session>"
  }
}

Response: { "redirect_uri": "<AuthKit URL for consent/token issuance>" }
```

**Source file:** `src/routes/connectAuth.ts`

### 3.4 WWW-Authenticate Header (MCP Discovery)

All 401 responses from `/oauth/userinfo` include a `WWW-Authenticate` header with the `resource_metadata` parameter. This enables MCP clients to automatically discover the authorization server:

```
WWW-Authenticate: Bearer error="unauthorized",
  error_description="Authorization needed",
  resource_metadata="https://panel.wtyczki.ai/.well-known/oauth-protected-resource"
```

### 3.5 Token Refresh

Handled entirely by AuthKit. MCP clients send refresh tokens directly to AuthKit's `/oauth2/token` endpoint. The Worker is not involved.

### 3.6 Dynamic Client Registration (DCR) + CIMD

Both are enabled in WorkOS Dashboard under Connect → Configuration:
- **DCR (RFC 7591):** MCP clients can self-register at AuthKit's `/oauth2/register` endpoint
- **CIMD:** MCP clients can identify themselves using Client ID Metadata Documents (newer approach, Nov 2025+)

---

## 4. API Key Authentication — Alternative Access Method

For MCP clients that don't support full OAuth flows (e.g., AnythingLLM, Cursor IDE), users can generate permanent API keys.

### 4.1 Key Format

```
wtyk_<64 hex characters>
Example: wtyk_a7f3k9m2p5q8r1s4t6v9w2x5y8z1b4c7d8e9f0a1b2c3d4e5f6
Total length: 69 characters (5 prefix + 64 random)
```

### 4.2 Key Lifecycle

```
1. GENERATION (POST /api/keys/create)
   ├── Generate 32 random bytes → 64 hex chars
   ├── Prepend "wtyk_" prefix
   ├── Hash with SHA-256 → store hash in D1
   ├── Store key_prefix (first 16 chars) for UI display
   ├── Return plaintext key ONCE to user (never stored)
   └── User saves the key

2. USAGE (Authorization: Bearer wtyk_...)
   ├── Validate format: starts with "wtyk_", length = 69
   ├── Hash the provided key with SHA-256
   ├── Look up hash in D1 (api_keys table)
   ├── Verify: is_active = 1, not expired
   ├── Verify: user exists and is_deleted = 0
   ├── Update last_used_at timestamp
   └── Return user_id for authorization

3. REVOCATION (DELETE /api/keys/:id)
   ├── Soft delete: SET is_active = 0
   └── Key immediately stops working
```

### 4.3 API Key vs AuthKit JWT

API keys and AuthKit JWTs are both accepted at the `/oauth/userinfo` endpoint. The system differentiates by prefix:

- Starts with `wtyk_` → API key validation (SHA-256 hash lookup in D1)
- Otherwise → AuthKit JWT verification (JWKS from `{AUTHKIT_DOMAIN}/oauth2/jwks`)

---

## 5. Session Management

### 5.1 Session Creation

Sessions are created on successful authentication (Magic Auth or AuthKit callback).

**Session data stored in KV (`USER_SESSIONS`):**

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "workos_user_id": "user_01...",
  "access_token": "<WorkOS JWT>",
  "refresh_token": "<WorkOS refresh token>",
  "created_at": 1707500000000,
  "expires_at": 1707759200000
}
```

**Key format:** `workos_session:<uuid>`

### 5.2 Session TTLs

| Source | Session Duration | Cookie Max-Age |
|---|---|---|
| Magic Auth (custom login) | 72 hours | 259200 seconds (3 days) |
| AuthKit callback | 72 hours | 259200 seconds (3 days) |
| KV auto-expiration | Matches session duration | — |

### 5.3 Session Cookie

```
workos_session=<uuid>; Domain=.wtyczki.ai; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=259200
```

- **HttpOnly**: Not accessible via JavaScript
- **Secure**: HTTPS only
- **SameSite=Lax**: Prevents CSRF while allowing top-level navigation
- **Domain=.wtyczki.ai**: Shared across subdomains (panel, api)

---

## 6. Database Schema

**Database**: Cloudflare D1 (`mcp-oauth`, ID: `eac93639-d58e-4777-82e9-f1e28113d5b2`)
**Binding**: `TOKEN_DB`

### 6.1 users

Primary user accounts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | TEXT | PRIMARY KEY | UUID, generated at registration |
| `email` | TEXT | UNIQUE, NOT NULL | User email, synced from WorkOS on login |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `last_login_at` | TEXT | | Updated on each login |
| `is_deleted` | INTEGER | DEFAULT 0 | Soft delete flag (0=active, 1=deleted) |
| `deleted_at` | TEXT | | Timestamp of deletion |
| `workos_user_id` | TEXT | **UNIQUE** | WorkOS user ID — primary lookup key |

**Indexes:** `idx_users_workos_user_id` on `workos_user_id`

**User lookup order:** `workos_user_id` first (prevents duplicate records on email changes), then fallback to `email`.

### 6.2 api_keys

Permanent API keys for programmatic access.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `api_key_id` | TEXT | PRIMARY KEY | UUID |
| `user_id` | TEXT | FK → users, NOT NULL | Owner |
| `api_key_hash` | TEXT | UNIQUE, NOT NULL | SHA-256 hash of the key |
| `key_prefix` | TEXT | NOT NULL | First 16 chars for display (`wtyk_a7f3k9m2...`) |
| `name` | TEXT | NOT NULL | User-given label |
| `last_used_at` | INTEGER | | Epoch ms, updated on each use |
| `created_at` | INTEGER | NOT NULL | Epoch ms |
| `expires_at` | INTEGER | | Epoch ms, NULL = never expires |
| `is_active` | INTEGER | DEFAULT 1, CHECK (0,1) | Soft delete (0=revoked) |

**Indexes:** `user_id`, `api_key_hash`, `is_active`, `(user_id, is_active)`
**Cascade:** ON DELETE CASCADE from users

### 6.3 account_deletions

GDPR audit trail for account deletions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `deletion_id` | TEXT | PRIMARY KEY | UUID |
| `user_id` | TEXT | FK → users, NOT NULL | |
| `original_email` | TEXT | NOT NULL | Preserved for audit |
| `deletion_reason` | TEXT | | Optional reason |
| `deleted_at` | TEXT | DEFAULT datetime('now') | |
| `deleted_by_ip` | TEXT | | IP address of requester |

### 6.4 Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────┐       ┌──────────────────┐
│   users           │       │  api_keys     │       │ account_deletions│
│──────────────────│       │──────────────│       │──────────────────│
│ user_id (PK)     │──┐    │ api_key_id   │       │ deletion_id (PK) │
│ email (UQ)       │  ├───▶│ user_id (FK) │       │ user_id (FK)     │
│ workos_user_id   │  │    │ api_key_hash │       │ original_email   │
│   (UQ)           │  ├───▶│ name         │       │ deleted_at       │
│ is_deleted       │  │    │ is_active    │       └──────────────────┘
└──────────────────┘  │    └──────────────┘
                      │
                      └───▶ account_deletions.user_id
```

**Dropped tables** (migration 0021): `oauth_clients` and `oauth_authorizations` — these were used by the custom OAuth server which has been replaced by AuthKit.

---

## 7. KV Storage

### 7.1 USER_SESSIONS

**Namespace ID:** `e5ad189139cd44f38ba0224c3d596c73`
**Purpose:** User login sessions (active)

| Key Pattern | Value | TTL |
|---|---|---|
| `workos_session:<uuid>` | `WorkOSSession` JSON | 86400s (24h) or 259200s (72h) |

---

## 8. Endpoint Reference

### 8.1 Public Endpoints (No Authentication)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Root — unified auth page (panel) or API status (api) |
| GET | `/.well-known/oauth-protected-resource` | MCP resource metadata → points to AuthKit |
| GET | `/.well-known/oauth-authorization-server` | Proxied from AuthKit (backward compat) |
| GET | `/oauth/userinfo` | User profile (Bearer token: AuthKit JWT or API key) |
| GET | `/auth/login` | Redirect to unified auth |
| GET | `/auth/callback` | WorkOS AuthKit callback |
| GET | `/auth/login-custom` | Redirect to unified auth |
| POST | `/auth/login-custom/send-code` | Send Magic Auth code |
| POST | `/auth/login-custom/verify-code` | Verify code & create session |
| GET | `/auth/connect-login` | Standalone Connect — AuthKit redirects here for custom login |
| GET | `/auth/logout-success` | Logout confirmation page |
| GET | `/privacy` | Privacy policy |
| GET | `/terms` | Terms of service |

### 8.2 Protected Endpoints (Session Cookie Required)

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | User dashboard with API keys |
| GET | `/dashboard/settings` | Account settings page |
| GET | `/auth/user` | Current user info (JSON) |
| POST | `/api/keys/create` | Generate new API key |
| GET | `/api/keys/list` | List user's API keys |
| DELETE | `/api/keys/:id` | Revoke an API key |
| POST | `/auth/logout` | Logout (clear session) |

**Protected route detection:** Any path starting with `/dashboard`, `/auth/user`, or `/api/keys` triggers the authentication middleware.

### 8.3 Removed Endpoints (Replaced by AuthKit)

These endpoints were removed as AuthKit now handles them:

| Removed Endpoint | AuthKit Equivalent |
|---|---|
| `GET/POST /oauth/authorize` | `{AUTHKIT_DOMAIN}/oauth2/authorize` |
| `POST /oauth/token` | `{AUTHKIT_DOMAIN}/oauth2/token` |
| `POST /oauth/revoke` | AuthKit handles token lifecycle |
| `GET /api/oauth/grants` | AuthKit manages consent |
| `DELETE /api/oauth/grants/:id` | AuthKit manages consent |

---

## 9. Security Model

### 9.1 MCP Auth Security

| Requirement | Status | Implementation |
|---|---|---|
| PKCE mandatory for all flows | Enforced by AuthKit | S256 only |
| Dynamic Client Registration | Enabled | AuthKit `/oauth2/register` |
| Client ID Metadata Document | Enabled | For newer MCP clients |
| JWT verification via JWKS | Implemented | `jose.jwtVerify()` with `createRemoteJWKSet` |
| Issuer validation | Implemented | JWT `iss` must match `AUTHKIT_DOMAIN` |
| Audience validation | Implemented | JWT `aud` validated against `WORKOS_CLIENT_ID` when present |
| WWW-Authenticate header | Implemented | All 401s include `resource_metadata` URL |
| Token refresh | Delegated to AuthKit | Rotation handled by AuthKit |
| Session invalidation on logout | Implemented | KV entry deleted immediately on `POST /auth/logout` |

### 9.2 CSRF Protection

- **Magic Auth forms:** Double-submit cookie pattern. CSRF token in form + `magic_auth_csrf` cookie. Validated on every POST.
- **Session cookie:** `SameSite=Lax` prevents cross-origin form submissions.

### 9.3 Open Redirect Protection

All redirect targets from user-controlled input are validated via `safeRedirectPath()` (`src/utils/safeRedirect.ts`):
- **`/auth/callback` `state` param** — validated before use as `Location` header
- **`return_to` form field** — validated in both `handleSendMagicAuthCode()` and `handleVerifyMagicAuthCode()`
- **Auth middleware redirects** — use `url.origin` instead of hardcoded domain

The utility rejects absolute URLs, protocol-relative URLs (`//evil.com`), and backslash tricks (`\/evil.com`), falling back to `/dashboard`.

### 9.4 XSS Protection

- **HTML escaping:** All user-controlled values rendered in HTML templates are escaped via `escapeHtml()`, including error messages from URL query parameters and `returnTo` values in form fields.
- **Error responses:** Internal error details (stack traces, SDK messages) are never exposed to clients. Generic error messages are returned instead.

### 9.5 Deleted User Protection

Every token validation path checks `is_deleted = 0`:
- AuthKit JWTs: `handleUserInfoEndpoint()` looks up user by `workos_user_id` with `is_deleted = 0`
- API keys: `validateApiKey()` verifies user exists and is not deleted
- If user is deleted, 401 is returned immediately

### 9.6 Email Change Protection

User lookup uses `workos_user_id` as the primary key (with `UNIQUE` constraint in DB), falling back to `email` only for users who haven't authenticated via WorkOS yet. This prevents duplicate records when a user changes their email in WorkOS.

### 9.7 Cookie Security

```
HttpOnly     → No JavaScript access (XSS protection)
Secure       → HTTPS only
SameSite=Lax → CSRF protection
Domain=.wtyczki.ai → Shared across subdomains
```

### 9.8 API Key Hashing

Keys are hashed with SHA-256 using the Web Crypto API before storage. The plaintext key is shown once at generation and never stored. The `key_prefix` (first 16 chars) is stored separately for UI display.

---

## 10. Token Lifecycle

| Token Type | Issued By | Storage | TTL | Verification |
|---|---|---|---|---|
| AuthKit access token (JWT) | AuthKit | Client-side | Set by AuthKit | JWKS signature + issuer claim |
| AuthKit refresh token | AuthKit | Client-side | Set by AuthKit | Sent to AuthKit `/oauth2/token` |
| Session token | Worker | USER_SESSIONS KV | 72h | KV lookup |
| API key | Worker | D1 (hash) | Configurable / never | SHA-256 hash match |

---

## 11. User Workflow — Complete Journeys

### 11.1 New User — First Time Setup

```
1. Visit panel.wtyczki.ai → See unified auth page
2. Switch to "Register" tab
3. Enter email → Receive 6-digit code via email
4. Enter code → Account created, redirected to dashboard
5. Dashboard shows: welcome message, empty API keys list
6. (Optional) Create API key for an MCP client
```

### 11.2 MCP Client — Connecting via AuthKit + Standalone Connect

```
1. MCP client (e.g., Claude Desktop) makes request to resource server
2. Receives 401 with WWW-Authenticate header containing resource_metadata URL
3. Fetches /.well-known/oauth-protected-resource
4. Discovers AuthKit as the authorization server
5. (Optional) Self-registers via DCR or uses CIMD
6. Redirects user to AuthKit /oauth2/authorize
7. AuthKit redirects to custom Login URI (/auth/connect-login)
8a. If user has active session → completion API called → skip to step 10
8b. If no session → user sees custom Magic Auth login page
9. User enters email → receives Polish code → verifies code → session created
   → redirected back to /auth/connect-login → completion API called
10. AuthKit handles consent and issues access token (JWT) + refresh token
11. MCP client calls /oauth/userinfo with Bearer JWT
12. Worker verifies JWT via JWKS, returns user profile
```

### 11.3 User — Managing Access

```
Dashboard (/dashboard):
├── View list of API keys (name, prefix, created date, last used)
├── Create new API key → shown once, user must save
├── Revoke API key → soft delete, immediately stops working
└── Account settings → manage account
```

---

## 12. GDPR & Account Deletion

The system supports soft deletion with audit trail:

1. User account is soft-deleted (`is_deleted = 1`, `deleted_at` timestamp set)
2. API keys are cascade-deleted (ON DELETE CASCADE)
3. Audit record created in `account_deletions` table (preserves original email, IP, reason)
4. All active tokens immediately fail (deleted user check in validation paths)

---

## 13. Deployment & Infrastructure

### 13.1 Deployment Method

**GitHub integration (Workers Builds)** — automatic deployment on push to `main` branch.

```bash
# To deploy: just push to GitHub
git push origin main

# Database migrations (manual, not automated):
npx wrangler d1 migrations apply mcp-oauth --remote
```

### 13.2 Environment Variables / Secrets

| Variable | Storage | Purpose |
|---|---|---|
| `WORKOS_API_KEY` | Cloudflare secret | WorkOS API authentication |
| `WORKOS_CLIENT_ID` | Cloudflare secret | WorkOS OAuth client identifier |
| `AUTHKIT_DOMAIN` | Cloudflare secret | AuthKit domain (`https://exciting-domain-65.authkit.app`) |
| `OAUTH_BASE_URL` | wrangler.toml vars | `https://panel.wtyczki.ai` |

### 13.3 Bindings

| Binding | Type | Resource | Status |
|---|---|---|---|
| `TOKEN_DB` | D1 Database | `mcp-oauth` | Active |
| `USER_SESSIONS` | KV Namespace | Login sessions | Active |
| `ASSETS` | Static Assets | `./public` directory | Active |
| `RATE_LIMIT_SEND_CODE` | Rate Limit | 5 req/60s | Active |
| `RATE_LIMIT_VERIFY_CODE` | Rate Limit | 10 req/60s | Active |
| `RATE_LIMIT_API_KEYS` | Rate Limit | 5 req/60s | Active |

### 13.4 Custom Domains

| Domain | Purpose |
|---|---|
| `panel.wtyczki.ai` | User-facing dashboard and auth pages |
| `api.wtyczki.ai` | API endpoints (same Worker) |

### 13.5 WorkOS Dashboard Configuration

| Setting | Value |
|---|---|
| AuthKit Domain | `exciting-domain-65.authkit.app` |
| Dynamic Client Registration | Enabled |
| Client ID Metadata Document | Enabled |
| Login URI (Standalone Connect) | `https://panel.wtyczki.ai/auth/connect-login` |
| Logout URI | `https://panel.wtyczki.ai/auth/logout-success` |
| Localization | Enabled, fallback language: Polish (`pl`) |

---

## 14. Known Limitations & TODOs

### 14.1 Session Duration (Standardized)

All sessions (Magic Auth and AuthKit callback) use a **72-hour** duration. Both the KV TTL (`expirationTtl: 259200`) and in-session `expires_at` timestamp are set to 72 hours. The cookie `Max-Age` is also 259200 seconds (3 days), matching the session lifetime.

### 14.2 Rate Limiting (Implemented)

Rate limiting is implemented using **Cloudflare Workers Rate Limiting bindings** (GA Sep 2025). Three bindings protect the most sensitive endpoints:

| Binding | Endpoint | Limit | Period | Key Strategy |
|---|---|---|---|---|
| `RATE_LIMIT_SEND_CODE` | `/auth/login-custom/send-code` | 5 req | 60s | `send-code:{email}` |
| `RATE_LIMIT_VERIFY_CODE` | `/auth/login-custom/verify-code` | 10 req | 60s | `verify-code:{email}` |
| `RATE_LIMIT_API_KEYS` | `/api/keys/create` | 5 req | 60s | `api-keys:{user_id}` |

**Key strategy:** Email (lowercased) for auth endpoints, `user_id` for authenticated endpoints. IP addresses are not used as rate limit keys (per Cloudflare best practices — shared IPs cause false positives).

**Fail-open design:** If the rate limiting binding errors, the request is allowed through to avoid blocking legitimate traffic.

**Source files:** `src/middleware/rateLimit.ts`, `src/routes/customAuth.ts`, `src/routes/apiKeySettings.ts`

### 14.3 OAUTH_KV Namespace Removed

The legacy `OAUTH_KV` binding (used by the old custom OAuth server) has been removed from `wrangler.toml` and the `Env` interface. The KV namespace itself can be deleted from the Cloudflare dashboard when convenient.

### 14.4 Magic Auth Email Localization

Magic Auth emails are sent via direct REST API call (bypassing the WorkOS SDK) to forward the user's browser `Accept-Language` header. This ensures WorkOS sends the email in the user's language (with Polish as the fallback). The SDK's `createMagicAuth()` method does not support passing custom headers.

**Implementation:** `src/routes/customAuth.ts` calls `POST https://api.workos.com/user_management/magic_auth` directly with `Accept-Language` header from the user's browser request.

### 14.5 JWT Audience Validation (Implemented)

The `/oauth/userinfo` endpoint validates both `iss` (issuer) and `aud` (audience) JWT claims. Audience validation is conditional: WorkOS standard tokens may omit the `aud` claim, so tokens without it are accepted, but tokens with a mismatched `aud` are rejected (must include `WORKOS_CLIENT_ID`). This prevents tokens issued for other WorkOS resources from being accepted.

**Source file:** `src/routes/userinfo.ts`

---

*Report generated: 2026-02-14*
*Source: Full codebase analysis of mcp-oauth repository after AuthKit MCP Auth migration + Standalone Connect*
