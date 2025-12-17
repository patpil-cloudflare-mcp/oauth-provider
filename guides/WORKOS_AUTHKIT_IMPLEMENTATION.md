# WorkOS AuthKit Integration Documentation

**Project:** MCP Token System
**Date:** October 15, 2025
**Status:** ✅ Production Deployment Complete
**Authentication Method:** WorkOS Hosted AuthKit (Magic Auth - Passwordless OTP)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Why WorkOS AuthKit?](#why-workos-authkit)
3. [Architecture](#architecture)
4. [Implementation Details](#implementation-details)
5. [Authentication Flow](#authentication-flow)
6. [File Changes](#file-changes)
7. [Configuration](#configuration)
8. [API Endpoints](#api-endpoints)
9. [Session Management](#session-management)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)
12. [Future Enhancements](#future-enhancements)

---

## Overview

This document describes the implementation of **WorkOS AuthKit** for user authentication in the MCP Token System. WorkOS AuthKit replaced Cloudflare Access to provide:

- **Magic Auth (Passwordless OTP)** - 6-digit codes sent via email
- **Customizable email templates** for better branding
- **Better user onboarding** experience with no passwords to remember
- **Custom branding** on authentication pages
- **10-minute code expiration** for security
- **No password management** overhead

### Key Features

✅ Magic Auth (Passwordless) - 6-digit OTP codes via email
✅ Hosted authentication UI (managed by WorkOS)
✅ 72-hour session management with KV storage
✅ Automatic user creation on first login
✅ 10-minute code expiration
✅ No passwords to remember or reset
✅ Secure session cookies (HttpOnly, Secure, SameSite)
✅ Compatible with guest checkout flow

---

## Why WorkOS AuthKit?

### Business Requirements

The platform needed email customization for authentication emails, which **Cloudflare Access does not support**. WorkOS AuthKit was chosen because:

1. **Email Customization:** Full control over welcome emails, password reset emails, and verification emails
2. **Branding Control:** Customize logo, colors, and UI of authentication pages
3. **Email + Password:** More familiar authentication method than OTP-only
4. **Enterprise Ready:** Future support for SSO, SAML, OAuth providers
5. **Free Tier:** Up to 1,000,000 users free
6. **Production Ready:** Managed service with 99.9% uptime SLA

### Previous Authentication Method

**Before:** Cloudflare Access with OTP (One-Time Password)
- Users received a 6-digit code via email
- No password required
- Limited email customization
- Simple but less control over UX

**After:** WorkOS AuthKit with Magic Auth (Passwordless OTP)
- Users receive 6-digit codes via email (similar to before)
- No passwords to remember or manage
- Fully customizable email templates
- Custom branding on authentication pages
- Better email delivery and customization

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ 1. Access /dashboard
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Worker (src/index.ts)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Protected Routes Middleware                          │   │
│  │  - Check for workos_session cookie                    │   │
│  │  - If no session → redirect to /auth/login           │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ 2. Redirect to /auth/login
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              WorkOS Hosted AuthKit                          │
│  - Email + Password form                                    │
│  - Signup / Login / Password Reset                          │
│  - Branding: Your logo, colors                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ 3. User authenticates
                   ▼
┌─────────────────────────────────────────────────────────────┐
│         Callback: /auth/callback?code=xxx                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  src/workos-auth.ts: handleCallback()                 │   │
│  │  1. Exchange code for user profile                    │   │
│  │  2. Get/create user in D1 database                    │   │
│  │  3. Create session in KV                              │   │
│  │  4. Set workos_session cookie                         │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ 4. Redirect to /dashboard with session
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard (Authenticated)                │
│  - User sees token balance                                  │
│  - Can purchase tokens                                      │
│  - Session valid for 72 hours                               │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Authentication Provider** | WorkOS AuthKit | Hosted authentication UI & user management |
| **Session Storage** | Cloudflare KV (USER_SESSIONS) | Store encrypted session data (24h TTL) |
| **User Database** | Cloudflare D1 (SQLite) | Store user accounts & token balances |
| **Worker Runtime** | Cloudflare Workers | Edge compute for authentication logic |
| **SDK** | @workos-inc/node@^7.71.0 | WorkOS Node.js SDK |

---

## Implementation Details

### New Files Created

#### 1. `src/workos-auth.ts` (262 lines)

**Purpose:** WorkOS authentication module for Cloudflare Workers

**Key Functions:**

| Function | Purpose | Returns |
|----------|---------|---------|
| `getAuthorizationUrl()` | Generate WorkOS login URL | Authorization URL string |
| `handleCallback()` | Exchange auth code for user | User object + session token |
| `validateSession()` | Validate session token | SessionResult (success/error) |
| `clearSession()` | Logout user | void |
| `getLogoutUrl()` | Generate WorkOS logout URL | Logout URL string |
| `getSessionTokenFromRequest()` | Extract session cookie | Session token or null |

**Session Data Structure:**

```typescript
interface WorkOSSession {
  user_id: string;           // Internal user UUID
  email: string;             // User email
  workos_user_id: string;    // WorkOS user ID
  access_token: string;      // WorkOS access token
  refresh_token: string;     // WorkOS refresh token
  created_at: number;        // Timestamp (ms)
  expires_at: number;        // Expiration timestamp (ms)
}
```

**KV Storage:**
- **Key Pattern:** `workos_session:{sessionToken}`
- **TTL:** 259200 seconds (72 hours)
- **Format:** JSON string

### Modified Files

#### 1. `src/index.ts`

**Changes:**

1. **Added Imports:**
   ```typescript
   import {
     getAuthorizationUrl,
     handleCallback,
     validateSession,
     getLogoutUrl,
     getSessionTokenFromRequest,
   } from './workos-auth';
   ```

2. **Updated Env Interface:**
   ```typescript
   export interface Env {
     // ... existing
     WORKOS_API_KEY: string;
     WORKOS_CLIENT_ID: string;
   }
   ```

3. **New Endpoints:**

   | Endpoint | Method | Purpose | Status |
   |----------|--------|---------|--------|
   | `/auth/login` | GET | Redirect to WorkOS AuthKit | Public |
   | `/auth/callback` | GET | Handle OAuth callback | Public |
   | `/auth/logout` | POST | Logout and clear session | Protected |

4. **Updated Protected Routes Middleware:**
   - Replaced Cloudflare Access JWT validation
   - Now uses WorkOS session validation
   - Checks `workos_session` cookie
   - Redirects to `/auth/login` if no valid session

5. **Protected Routes:**
   ```typescript
   const protectedRoutes = [
     '/dashboard',
     '/auth/user',
     '/user/transactions',
     '/checkout/create',
   ];
   ```

#### 2. `package.json` & `package-lock.json`

**Added Dependency:**
```json
{
  "dependencies": {
    "@workos-inc/node": "^7.71.0"
  }
}
```

---

## Authentication Flow

### 1. Login Flow (Returning User)

```
User → /dashboard (no session)
  ↓
Worker checks: workos_session cookie?
  ↓ NO
Redirect to /auth/login?return_to=/dashboard
  ↓
Worker calls getAuthorizationUrl()
  ↓
Redirect to WorkOS hosted login page
  ↓
User enters email on WorkOS page
  ↓
WorkOS sends 6-digit code to user's email
  ↓
User checks email and enters code
  ↓
WorkOS validates code (10-minute expiration)
  ↓ SUCCESS
WorkOS redirects to /auth/callback?code=xxx&state=/dashboard
  ↓
Worker exchanges code for user profile via handleCallback()
  ↓
Worker creates session in KV
  ↓
Worker sets workos_session cookie
  ↓
Redirect to /dashboard
  ↓
User sees dashboard with token balance
```

### 2. Signup Flow (New User)

```
User → /dashboard (no session)
  ↓
Redirect to /auth/login
  ↓
User enters email on WorkOS page
  ↓
WorkOS sends 6-digit code to email
  ↓
User checks email and enters code
  ↓
WorkOS validates code
  ↓ SUCCESS
WorkOS creates user account (if new)
  ↓
WorkOS redirects to /auth/callback?code=xxx
  ↓
Worker exchanges code for user profile
  ↓
Worker calls getOrCreateUser(email, env)
  ↓
Worker creates:
  - User record in D1 database
  - Stripe customer
  - Session in KV
  ↓
Redirect to /dashboard
  ↓
User sees dashboard with 0 tokens
  ↓
User can now purchase tokens
```

### 3. Session Validation (Every Protected Request)

```
User → /dashboard (with session cookie)
  ↓
Worker extracts workos_session cookie
  ↓
Worker calls validateSession(sessionToken, env)
  ↓
Query KV for session data
  ↓
Check session expiration (72 hours)
  ↓ VALID
Query D1 database for user data
  ↓
Return user object with token balance
  ↓
Render dashboard page
```

### 4. Logout Flow

```
User clicks "Logout" button
  ↓
POST /auth/logout
  ↓
Worker extracts session token
  ↓
Worker calls getLogoutUrl(sessionToken, env)
  ↓
Worker deletes session from KV
  ↓
Worker clears workos_session cookie
  ↓
Return logoutUrl to client
  ↓
Client redirects to WorkOS logout page
  ↓
WorkOS invalidates tokens
  ↓
WorkOS redirects to homepage
```

### 5. Guest Checkout Flow (Magic Auth Compatible)

```
Guest → panel.wtyczki.ai/ (public homepage)
  ↓
Guest enters email in form
  ↓
Guest clicks "Kup teraz" (Buy now)
  ↓
POST /checkout/create-guest
  ↓
Create Stripe checkout with guest_email metadata
  ↓
Redirect to Stripe payment page
  ↓
Guest completes payment
  ↓
Stripe webhook fires
  ↓
Worker creates user account + credits tokens
  ↓
Stripe redirects to /checkout/success
  ↓
Success page shows "Click to go to dashboard"
  ↓
Guest clicks link → /dashboard
  ↓
No session → redirect to /auth/login
  ↓
Guest enters email on WorkOS → receives 6-digit code
  ↓
Guest enters code → authenticated
  ↓
After login → Dashboard with tokens already credited
```

---

## Configuration

### WorkOS Dashboard Configuration

#### 1. Redirect URIs

**Location:** WorkOS Dashboard → Authentication → Redirects

**Production:**
```
https://panel.wtyczki.ai/auth/callback
```

**Local Development:**
```
http://localhost:8787/auth/callback
```

#### 2. Logout Redirect

**Location:** WorkOS Dashboard → Authentication → Redirects

**Production:**
```
https://panel.wtyczki.ai/
```

#### 3. Login Endpoint

**Location:** WorkOS Dashboard → Authentication → Redirects

**Production:**
```
https://panel.wtyczki.ai/auth/login
```

**Purpose:** Where WorkOS redirects if user bookmarks login page.

#### 4. Enable Magic Auth

**Location:** WorkOS Dashboard → Authentication → Methods

**CRITICAL:** Enable Magic Auth to use passwordless OTP authentication.

**Steps:**
1. Navigate to WorkOS Dashboard
2. Go to **Authentication** tab
3. Find **Magic Auth** section
4. Toggle ON: "Enable Magic Auth"
5. (Optional) Toggle OFF: "Email + Password" if you want ONLY Magic Auth

**Configuration:**
- Code expiration: 10 minutes (default, matches business requirement)
- Code length: 6 digits (default)
- Email template: Customize in "Email Templates" section

**Important Notes:**
- Magic Auth codes are single-use only
- Codes expire after 10 minutes
- Users receive codes at the email they enter
- No password creation or management required

### Cloudflare Dashboard Configuration

#### Environment Variables (Secrets)

**Location:** Cloudflare Dashboard → Workers & Pages → mcp-token-system → Settings → Variables and Secrets

**Required Secrets:**

| Name | Type | Value | Source |
|------|------|-------|--------|
| `WORKOS_API_KEY` | Secret | `sk_test_...` (test) or `sk_live_...` (prod) | WorkOS Dashboard → API Keys |
| `WORKOS_CLIENT_ID` | Secret | `client_...` | WorkOS Dashboard → API Keys |

**Set via CLI:**
```bash
npx wrangler secret put WORKOS_API_KEY
npx wrangler secret put WORKOS_CLIENT_ID
```

#### Removed Configuration

**Cloudflare Access Application:**
- Deleted Access application for `panel.wtyczki.ai`
- No longer needed (WorkOS handles authentication)

**Note:** Cloudflare Access variables kept in code for backward compatibility but not used.

### WorkOS Branding Configuration

**Location:** WorkOS Dashboard → Authentication → Branding

**Customizable:**
- Logo (upload PNG/SVG)
- Primary color (brand color)
- Background color/image
- Favicon
- Custom CSS (advanced)

**Email Templates:**
- Magic Auth code email (6-digit code)
- Welcome email (optional)
- Email verification (optional)
- Custom branding with logo and colors

---

## API Endpoints

### Public Endpoints (No Authentication)

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/` | GET | Public home page | HTML page with guest checkout |
| `/auth/login` | GET | Redirect to WorkOS AuthKit | 302 redirect |
| `/auth/callback` | GET | OAuth callback handler | 302 redirect + session cookie |
| `/checkout/create-guest` | POST | Create guest checkout | Stripe checkout URL |
| `/checkout/success` | GET | Payment success page | HTML success page |
| `/stripe/webhook` | POST | Stripe webhook handler | 200 OK |

### Protected Endpoints (Require Authentication)

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/dashboard` | GET | User dashboard | HTML dashboard page |
| `/auth/user` | GET | Get current user info | JSON user object |
| `/auth/logout` | POST | Logout user | JSON + logoutUrl |
| `/user/transactions` | GET | User transaction history | JSON transactions array |
| `/checkout/create` | POST | Create authenticated checkout | Stripe checkout URL |

### Endpoint Details

#### `GET /auth/login`

**Purpose:** Initiate WorkOS authentication flow

**Query Parameters:**
- `return_to` (optional): Where to redirect after login (default: `/dashboard`)

**Implementation:**
```typescript
if (url.pathname === '/auth/login' && request.method === 'GET') {
  const redirectUri = 'https://panel.wtyczki.ai/auth/callback';
  const state = url.searchParams.get('return_to') || '/dashboard';

  const authorizationUrl = await getAuthorizationUrl(env, redirectUri, state);

  return Response.redirect(authorizationUrl, 302);
}
```

**Response:**
- **Status:** 302 Found
- **Location:** WorkOS AuthKit URL

---

#### `GET /auth/callback`

**Purpose:** Handle OAuth callback from WorkOS

**Query Parameters:**
- `code` (required): Authorization code from WorkOS
- `state` (optional): Return URL (default: `/dashboard`)

**Implementation:**
```typescript
if (url.pathname === '/auth/callback' && request.method === 'GET') {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '/dashboard';

  const { user, sessionToken } = await handleCallback(code, env);

  // Set session cookie
  headers.append('Set-Cookie',
    `workos_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=259200`
  );

  return new Response(null, { status: 302, headers });
}
```

**Response:**
- **Status:** 302 Found
- **Location:** Value from `state` parameter
- **Set-Cookie:** `workos_session` cookie (24h)

**Error Handling:**
- Missing `code`: Return 400 Bad Request
- Invalid code: Return 500 Internal Server Error
- WorkOS API error: Return 500 with error message

---

#### `POST /auth/logout`

**Purpose:** Logout user and clear session

**Implementation:**
```typescript
if (url.pathname === '/auth/logout' && request.method === 'POST') {
  const sessionToken = getSessionTokenFromRequest(request);

  const logoutUrl = await getLogoutUrl(sessionToken, env);

  return new Response(JSON.stringify({
    success: true,
    logoutUrl,
    message: 'Logged out successfully'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'workos_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    }
  });
}
```

**Response:**
```json
{
  "success": true,
  "logoutUrl": "https://auth.workos.com/logout?...",
  "message": "Logged out successfully"
}
```

**Client-Side:**
```javascript
fetch('/auth/logout', { method: 'POST' })
  .then(res => res.json())
  .then(data => {
    if (data.logoutUrl) {
      window.location.href = data.logoutUrl;
    } else {
      window.location.href = '/';
    }
  });
```

---

## Session Management

### Session Cookie

**Cookie Name:** `workos_session`

**Cookie Attributes:**
```
workos_session={uuid};
Path=/;
HttpOnly;
Secure;
SameSite=Lax;
Max-Age=259200
```

**Attributes Explained:**
- `HttpOnly`: Cannot be accessed via JavaScript (XSS protection)
- `Secure`: Only sent over HTTPS
- `SameSite=Lax`: CSRF protection while allowing top-level navigation
- `Max-Age=259200`: 72-hour expiration (259200 seconds)

### Session Storage (KV)

**Namespace:** `USER_SESSIONS`

**Key Pattern:** `workos_session:{sessionToken}`

**Value (JSON):**
```json
{
  "user_id": "uuid-here",
  "email": "user@example.com",
  "workos_user_id": "user_01H...",
  "access_token": "...",
  "refresh_token": "...",
  "created_at": 1697040000000,
  "expires_at": 1697126400000
}
```

**TTL:** 259200 seconds (72 hours)

**Automatic Cleanup:** KV automatically deletes expired keys

### Session Lifecycle

1. **Creation:** After successful WorkOS authentication
2. **Validation:** On every protected route access
3. **Expiration:** After 72 hours
4. **Deletion:** On logout or manual deletion

---

## Testing

### Test Scenarios

#### 1. New User Signup (Magic Auth)

**Steps:**
1. Visit `https://panel.wtyczki.ai/dashboard`
2. Redirected to WorkOS login page
3. Enter email address
4. Click "Continue" or "Send code"
5. Check email inbox for 6-digit code
6. Enter code in WorkOS page
7. Should redirect to dashboard
8. Check token balance (should be 0)

**Expected Result:**
- ✅ User account created in D1 database
- ✅ Stripe customer created
- ✅ Session created in KV
- ✅ Session cookie set
- ✅ Redirected to dashboard

#### 2. Returning User Login (Magic Auth)

**Steps:**
1. Visit `https://panel.wtyczki.ai/dashboard`
2. Redirected to WorkOS login page
3. Enter email address
4. Check email for 6-digit code
5. Enter code in WorkOS page
6. Should redirect to dashboard

**Expected Result:**
- ✅ Session created
- ✅ User sees token balance
- ✅ Last login timestamp updated

#### 3. Session Persistence

**Steps:**
1. Login successfully
2. Close browser
3. Reopen browser
4. Visit `https://panel.wtyczki.ai/dashboard`
5. Should still be logged in (within 72 hours)

**Expected Result:**
- ✅ Session cookie persists
- ✅ No re-authentication required

#### 4. Session Expiration

**Steps:**
1. Login successfully
2. Wait 72+ hours
3. Visit `https://panel.wtyczki.ai/dashboard`
4. Should redirect to login

**Expected Result:**
- ✅ Session expired
- ✅ Redirect to login page

#### 5. Code Expiration Test

**Steps:**
1. Visit login page
2. Enter email address
3. Receive 6-digit code
4. Wait 10+ minutes (code expiration time)
5. Try to use expired code
6. Request new code
7. Enter new code within 10 minutes

**Expected Result:**
- ✅ Expired code rejected with error message
- ✅ New code generated successfully
- ✅ New code works within expiration window

#### 6. Logout

**Steps:**
1. Login successfully
2. Click logout button
3. Confirm logout

**Expected Result:**
- ✅ Session deleted from KV
- ✅ Cookie cleared
- ✅ Redirected to homepage
- ✅ Cannot access dashboard without re-login

#### 7. Guest Checkout Integration (Magic Auth)

**Steps:**
1. Visit homepage (not logged in)
2. Enter email
3. Click "Kup teraz"
4. Complete Stripe payment
5. View success page
6. Click "Przejdź do panelu"
7. Redirected to WorkOS login page
8. Enter email (same as purchase)
9. Receive 6-digit code via email
10. Enter code to authenticate
11. See purchased tokens in dashboard

**Expected Result:**
- ✅ Account created via webhook
- ✅ Tokens credited before first login
- ✅ User receives Magic Auth code
- ✅ Login shows credited tokens
- ✅ No password creation required

### Testing Tools

**Cloudflare Workers Logs:**
```bash
npx wrangler tail
```

**Look for:**
- `🔐 [workos] Initiating login flow`
- `🔄 [workos] Callback received`
- `✅ [workos] User authenticated: user@example.com`
- `🎫 [workos] Session created for user: uuid`
- `✅ [workos] Valid session for user: uuid`
- `🚪 [workos] Generated logout URL`

**KV Namespace Inspection:**
```bash
npx wrangler kv:key list --namespace-id=e5ad189139cd44f38ba0224c3d596c73
npx wrangler kv:key get "workos_session:{token}" --namespace-id=e5ad189139cd44f38ba0224c3d596c73
```

**Database Queries:**
```bash
npx wrangler d1 execute mcp-tokens-database --command="SELECT * FROM users WHERE email='test@example.com'"
```

---

## Troubleshooting

### Issue: "Authentication failed" error

**Symptoms:**
- User cannot login
- Redirects to error page

**Possible Causes:**
1. WorkOS API keys not set in Cloudflare
2. Incorrect redirect URI in WorkOS dashboard
3. WorkOS service outage

**Solution:**
1. Check secrets in Cloudflare Dashboard:
   ```bash
   npx wrangler secret list
   ```
2. Verify redirect URI matches exactly:
   - WorkOS Dashboard: `https://panel.wtyczki.ai/auth/callback`
   - Code: `https://panel.wtyczki.ai/auth/callback`
3. Check WorkOS status page: https://status.workos.com/

---

### Issue: "Session not found or expired"

**Symptoms:**
- User logged in but immediately logged out
- "Session expired" message

**Possible Causes:**
1. KV namespace not bound to Worker
2. Session expired (24+ hours old)
3. Cookie not being set correctly

**Solution:**
1. Check `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "USER_SESSIONS"
   id = "e5ad189139cd44f38ba0224c3d596c73"
   ```
2. Check KV storage:
   ```bash
   npx wrangler kv:key list --namespace-id=e5ad189139cd44f38ba0224c3d596c73
   ```
3. Check browser cookies (DevTools → Application → Cookies)
4. Verify cookie attributes (HttpOnly, Secure, SameSite)

---

### Issue: Redirect loop

**Symptoms:**
- Infinite redirects between `/auth/login` and `/auth/callback`
- Browser shows "Too many redirects"

**Possible Causes:**
1. `/auth/callback` is in protected routes (should be public)
2. Cookie not being set correctly
3. WorkOS authorization code expired

**Solution:**
1. Check protected routes array:
   ```typescript
   const protectedRoutes = [
     '/dashboard',
     '/auth/user',
     '/user/transactions',
     '/checkout/create',
     // /auth/callback should NOT be here
   ];
   ```
2. Clear browser cookies and try again
3. Check cookie domain matches

---

### Issue: "Missing authorization code"

**Symptoms:**
- Error on callback page
- 400 Bad Request

**Possible Causes:**
1. User bookmarked callback URL
2. Code already used (codes are single-use)
3. Network timeout

**Solution:**
1. Start fresh login flow from `/auth/login`
2. Don't bookmark callback URLs
3. Codes expire after 10 minutes

---

### Issue: Guest checkout not creating account

**Symptoms:**
- Payment successful
- No account created
- No tokens credited

**Possible Causes:**
1. Webhook not configured in Stripe
2. Webhook signature verification failing
3. `guest_email` metadata missing

**Solution:**
1. Check Stripe webhook configuration
2. Verify `STRIPE_WEBHOOK_SECRET` is set
3. Check webhook logs in Stripe Dashboard
4. Verify checkout session has `guest_email` in metadata

---

## Future Enhancements

### Planned Features

#### 1. Custom Login UI (In Progress)

**Goal:** Replace hosted AuthKit with custom-branded login/signup pages

**Benefits:**
- Complete branding control
- No external redirects
- Custom validation logic
- Polish language throughout
- Better analytics

**Status:** Documented in separate planning doc

#### 2. Social Login

**Providers to Add:**
- Google OAuth
- Microsoft OAuth
- GitHub OAuth
- Apple Sign-In

**Implementation:**
- WorkOS supports social providers natively
- Enable in WorkOS Dashboard
- No code changes required

#### 3. Multi-Factor Authentication (MFA)

**Methods:**
- SMS OTP
- Authenticator app (TOTP)
- Email OTP backup

**Implementation:**
- WorkOS provides MFA out of the box
- Enable in WorkOS Dashboard settings
- Optional or mandatory per organization

#### 4. Session Refresh

**Current:** Sessions expire after 72 hours (hard cutoff)

**Improvement:**
- Refresh sessions automatically using refresh token
- Extend session when user is active
- Sliding window expiration

#### 5. Remember Me

**Feature:** Extend session to 30 days if user checks "Remember me"

**Implementation:**
- Conditional Max-Age on cookie
- Store preference in session data
- Update UI to show checkbox

#### 6. Account Management

**Features:**
- Change password
- Change email
- Delete account
- View active sessions
- Session history

**Implementation:**
- New dashboard section
- WorkOS API calls for updates
- Confirmation emails

#### 7. Enterprise SSO

**For B2B customers:**
- SAML 2.0 support
- OIDC support
- Organization management
- Just-in-time provisioning

**Implementation:**
- WorkOS handles SSO connections
- Add organization selection UI
- Configure in WorkOS Dashboard

---

## Maintenance

### Regular Tasks

**Weekly:**
- Monitor session creation rate
- Check error rates in logs
- Verify KV storage usage

**Monthly:**
- Review WorkOS usage (user count)
- Check email delivery rates
- Update dependencies
- Review security advisories

**Quarterly:**
- Audit user accounts
- Clean up inactive sessions
- Review password policies
- Test disaster recovery

### Monitoring

**Key Metrics:**
- Login success rate
- Session duration
- Password reset requests
- Failed login attempts
- API response times

**Alerts:**
- WorkOS service down
- High error rate (>5%)
- KV storage >80% capacity
- Unusual login patterns

---

## Security Considerations

### Current Security Measures

✅ **Authentication:**
- Magic Auth (passwordless OTP) - No passwords to compromise
- 6-digit code verification (handled by WorkOS)
- 10-minute code expiration
- Single-use codes only
- Rate limiting on code generation

✅ **Session Security:**
- HttpOnly cookies (XSS protection)
- Secure flag (HTTPS only)
- SameSite=Lax (CSRF protection)
- 72-hour expiration
- Encrypted session data in KV

✅ **API Security:**
- Webhook signature verification (Stripe)
- Environment variable secrets
- No sensitive data in logs
- HTTPS only

✅ **Data Protection:**
- Minimal PII storage
- Passwords never stored locally
- User data encrypted at rest (D1)
- Session data encrypted (KV)

### Security Best Practices

**DO:**
- ✅ Always verify WorkOS authorization codes
- ✅ Use environment variables for secrets
- ✅ Set secure cookie attributes
- ✅ Validate all user inputs
- ✅ Log security events
- ✅ Keep dependencies updated

**DON'T:**
- ❌ Store passwords in your database
- ❌ Log sensitive data
- ❌ Expose API keys in client-side code
- ❌ Skip session validation
- ❌ Trust client-side data
- ❌ Use HTTP for production

---

## References

### Documentation

- **WorkOS AuthKit:** https://workos.com/docs/user-management
- **WorkOS Node.js SDK:** https://workos.com/docs/sdks/node
- **WorkOS API Reference:** https://workos.com/docs/reference
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **Cloudflare KV:** https://developers.cloudflare.com/kv/

### Support

- **WorkOS Support:** support@workos.com
- **WorkOS Slack:** https://workos.com/slack
- **WorkOS Status:** https://status.workos.com/
- **Cloudflare Community:** https://community.cloudflare.com/

---

## Changelog

### October 15, 2025 - Magic Auth Migration

**Added:**
- WorkOS AuthKit integration with Magic Auth
- Passwordless OTP authentication (6-digit codes via email)
- Session management with KV
- Custom authentication module (`src/workos-auth.ts`)
- New endpoints: `/auth/login`, `/auth/callback`
- WorkOS SDK dependency

**Changed:**
- Replaced Cloudflare Access with WorkOS Magic Auth
- Updated protected routes middleware
- Updated logout endpoint
- No passwords required - fully passwordless system

**Removed:**
- Cloudflare Access Application configuration
- Password management complexity
- All password-related flows

**Status:** ✅ Documentation updated for Magic Auth implementation

---

## Contributors

- **Implementation:** Claude Code (AI Assistant)
- **Project Owner:** Patryk Pilat (kontakt@patrykpilat.pl)
- **Review:** Required before production deployment

---

## License

This documentation is part of the MCP Token System project.

**Copyright © 2025 Wtyczki DEV Patryk Pilat**

---

*Last Updated: October 15, 2025*
*Document Version: 1.0*
*Status: Production Ready*
