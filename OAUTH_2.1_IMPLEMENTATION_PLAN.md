# OAuth 2.1 Compliance Implementation Plan
## MCP Token Payment System - Security Upgrade

**Project:** wtyczki.ai MCP Token System
**Date:** 2025-11-29
**Status:** Ready for Implementation
**Priority:** HIGH (Security & Standards Compliance)

---

## Executive Summary

This plan upgrades the Cloudflare Workers payment system to full OAuth 2.1 compliance following the WorkOS blog post guidance and PHASE_1_OAUTH_PKCE_REPORT.md patterns.

### Critical Context

**Two Distinct OAuth Flows:**
1. **MCP Servers → This Payment System** (PKCE exists but NOT enforced)
2. **This Payment System → WorkOS AuthKit** (Custom Magic Auth - no traditional OAuth)

**Key Decisions Made:**
- ✅ Immediate PKCE enforcement (breaking change accepted)
- ✅ Access token lifetime: 30 minutes (compromise)
- ✅ Two deployment cycles: Phase 1+2 first, then Phase 3+4
- ⚠️ **CRITICAL:** Live MCP servers exist - coordination required

---

## 🚨 CRITICAL: MCP Server Coordination Strategy

**BEFORE implementing Phase 1, you MUST:**

### Pre-Implementation Steps

1. **Audit existing MCP servers** (1-2 days before deployment)
   ```bash
   # Check OAUTH_STORE for active clients
   wrangler kv:key list --binding=OAUTH_STORE --prefix="access_token:"
   ```
   - Identify all active MCP server integrations
   - Contact each MCP server developer
   - Verify PKCE implementation status

2. **Communication Plan** (3-5 days before deployment)
   - Email all MCP server developers about upcoming changes
   - Provide migration guide (see Appendix A)
   - Set deployment date with 1-week notice minimum
   - Offer testing environment access

3. **Testing Coordination** (2-3 days before deployment)
   - Each MCP server must test PKCE flow in staging
   - Verify S256 code_challenge_method support
   - Confirm no hardcoded redirect URIs

4. **Rollback Plan**
   - Keep previous Worker version deployable
   - Monitor error rates for 48 hours post-deployment
   - If >5% OAuth errors, rollback immediately

**Deployment Criteria:**
- [ ] All MCP servers confirmed PKCE-ready
- [ ] At least 80% of MCP servers tested in staging
- [ ] Communication sent with 1-week notice
- [ ] Rollback procedure tested

---

## Implementation Phases

### Phase 1+2: Core OAuth 2.1 Compliance (Week 1)
**Deployment:** Single release
**Risk:** MEDIUM-HIGH (breaking change for unprepared MCP servers)

**Objectives:**
1. Enforce mandatory PKCE for all OAuth flows
2. Add CSRF protection to Magic Auth
3. Exact redirect URI matching
4. Environment-based configuration
5. Token lifetime optimization (30 minutes)

**Breaking Changes:**
- OAuth requests without PKCE will be rejected (400 error)
- Redirect URIs must match exactly (no wildcards)
- Access tokens expire in 30 minutes (down from 1 hour)

### Phase 3+4: Enhanced Security Features (Week 3-4)
**Deployment:** Separate release after Phase 1+2 stabilizes
**Risk:** LOW (additive features only)

**Objectives:**
1. Token revocation endpoint (RFC 7009)
2. Refresh token rotation (OAuth 2.1 best practice)
3. Comprehensive testing suite
4. Documentation updates
5. Monitoring and alerting

**No Breaking Changes:** All features are additive

---

## Phase 1+2 Detailed Implementation

### 1.1 Enforce Mandatory PKCE

**File:** `src/oauth.ts`

**Change 1: Authorization Endpoint (after line 52)**

```typescript
// Extract PKCE parameters
const codeChallenge = url.searchParams.get('code_challenge');
const codeChallengeMethod = url.searchParams.get('code_challenge_method');

// OAuth 2.1: PKCE is MANDATORY
if (!codeChallenge || !codeChallengeMethod) {
  console.error('🔒 [oauth] PKCE missing - OAuth 2.1 violation');
  return new Response(
    JSON.stringify({
      error: 'invalid_request',
      error_description: 'PKCE is required. Include code_challenge and code_challenge_method=S256 parameters.'
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// OAuth 2.1: Only S256 method allowed (plain is deprecated)
if (codeChallengeMethod !== 'S256') {
  console.error('🔒 [oauth] Invalid PKCE method:', codeChallengeMethod);
  return new Response(
    JSON.stringify({
      error: 'invalid_request',
      error_description: 'code_challenge_method must be S256 (SHA-256)'
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

**Change 2: Token Endpoint (replace lines 280-301)**

```typescript
// OAuth 2.1: Validate PKCE (MANDATORY)
if (!authCode.code_challenge) {
  return jsonResponse({
    error: 'server_error',
    error_description: 'Authorization code missing PKCE challenge'
  }, 500);
}

if (!codeVerifier) {
  return jsonResponse({
    error: 'invalid_request',
    error_description: 'code_verifier required for PKCE'
  }, 400);
}

const isValid = await validatePKCE(
  codeVerifier,
  authCode.code_challenge,
  authCode.code_challenge_method || 'S256'
);

if (!isValid) {
  console.error('🔒 [oauth] PKCE verification failed');
  return jsonResponse({
    error: 'invalid_grant',
    error_description: 'PKCE verification failed'
  }, 400);
}

console.log('✅ [oauth] PKCE verification passed');
```

---

### 1.2 CSRF Protection for Magic Auth

**File:** `src/routes/customAuth.ts`

**Change 1: Login Page (handleCustomLoginPage - around line 11)**

```typescript
export async function handleCustomLoginPage(
  request: Request,
  env?: Env
): Promise<Response> {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('return_to') || '/dashboard';

  // Generate CSRF token
  const csrfToken = crypto.randomUUID();

  return new Response(renderLoginEmailForm(undefined, returnTo, csrfToken), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': `magic_auth_csrf=${csrfToken}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    }
  });
}
```

**Change 2: Send Code Handler (handleSendMagicAuthCode - around line 25)**

```typescript
export async function handleSendMagicAuthCode(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim();
    const returnTo = formData.get('return_to')?.toString() || '/dashboard';
    const csrfToken = formData.get('csrf_token')?.toString();

    // CSRF Protection
    const cookieHeader = request.headers.get('Cookie');
    const cookieCsrf = cookieHeader?.split(';')
      .find(c => c.trim().startsWith('magic_auth_csrf='))
      ?.split('=')[1];

    if (!csrfToken || !cookieCsrf || csrfToken !== cookieCsrf) {
      console.error('🔒 [magic-auth] CSRF validation failed');
      const newCsrf = crypto.randomUUID();
      return new Response(renderLoginEmailForm(
        'Nieprawidłowe żądanie. Odśwież stronę i spróbuj ponownie.',
        returnTo,
        newCsrf
      ), {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    // ... rest of existing validation and logic
  } catch (error) {
    // ... existing error handling
  }
}
```

**Change 3: Verify Code Handler (handleVerifyMagicAuthCode - around line 103)**

Add same CSRF validation as in handleSendMagicAuthCode before processing the verification.

---

### 1.3 Update View Templates

**File:** `src/views/customLoginPage.ts`

**Update renderLoginEmailForm function signature:**

```typescript
export function renderLoginEmailForm(
  error?: string,
  returnTo: string = '/dashboard',
  csrfToken: string = ''  // NEW parameter
): string {
  return `
    <!DOCTYPE html>
    <!-- ... existing HTML ... -->
    <form method="POST" action="/auth/login-custom/send-code">
      <input type="hidden" name="csrf_token" value="${csrfToken}">
      <input type="hidden" name="return_to" value="${returnTo}">
      <!-- ... rest of form ... -->
    </form>
  `;
}
```

**File:** `src/views/customCodeVerificationPage.ts`

Similarly add CSRF token to code verification form.

---

### 1.4 Environment Configuration

**File:** `wrangler.toml`

Add after line 19 (after ACCESS_POLICY_AUD):

```toml
# OAuth 2.1 Configuration
OAUTH_BASE_URL = "https://panel.wtyczki.ai"
```

**File:** `.dev.vars`

Add:

```bash
OAUTH_BASE_URL=http://localhost:8787
```

**File:** `src/index.ts`

Update Env interface (around line 77):

```typescript
export interface Env {
  // ... existing fields

  // OAuth 2.1 Configuration
  OAUTH_BASE_URL?: string;
}
```

---

### 1.5 Exact Redirect URI Matching

**File:** `src/oauth.ts`

**Add validation function (before handleAuthorizeEndpoint):**

```typescript
/**
 * OAuth 2.1: Exact redirect URI matching
 * No wildcards, no partial matches, no query parameter differences
 */
function validateRedirectURI(provided: string, allowed: string[]): boolean {
  try {
    const providedUrl = new URL(provided);

    return allowed.some(allowedUri => {
      try {
        const allowedUrl = new URL(allowedUri);

        // Exact match: protocol, host, port, pathname
        // Note: Search params and hash are ignored per OAuth 2.1
        return providedUrl.protocol === allowedUrl.protocol &&
               providedUrl.host === allowedUrl.host &&
               providedUrl.pathname === allowedUrl.pathname;
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error('🔒 [oauth] Invalid redirect_uri format:', error);
    return false;
  }
}
```

**Replace line 67:**

```typescript
// OAuth 2.1: Exact redirect URI matching
if (!validateRedirectURI(redirectUri, client.redirect_uris)) {
  console.error('🔒 [oauth] Redirect URI mismatch:', redirectUri);
  console.error('🔒 [oauth] Allowed URIs:', client.redirect_uris);
  return new Response(
    JSON.stringify({
      error: 'invalid_request',
      error_description: 'redirect_uri does not match registered URI (exact match required)'
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

---

### 1.6 Token Lifetime Optimization

**File:** `src/oauth.ts`

**Update lines 310-334 in handleTokenEndpoint:**

```typescript
const tokenData: OAuthAccessToken = {
  access_token: accessToken,
  refresh_token: refreshToken,
  token_type: 'Bearer',
  expires_in: 1800, // 30 minutes (compromise between security and UX)
  user_id: authCode.user_id,
  client_id: authCode.client_id,
  scopes: authCode.scopes,
  created_at: Date.now(),
  expires_at: Date.now() + 1800 * 1000, // 30 minutes
};

// Store access token with 30-minute TTL
await env.OAUTH_STORE.put(
  `access_token:${accessToken}`,
  JSON.stringify(tokenData),
  { expirationTtl: 1800 } // 30 minutes
);

// Store refresh token (30 days)
await env.OAUTH_STORE.put(
  `refresh_token:${refreshToken}`,
  JSON.stringify(tokenData),
  { expirationTtl: 30 * 24 * 3600 }
);

console.log(`✅ [oauth] Access token issued (30-min TTL) for user: ${authCode.user_id}`);
```

---

### 1.7 Update Type Definitions

**File:** `src/types.ts`

**Change 1: Make PKCE fields required (around line 50-60)**

```typescript
export interface OAuthAuthorizationCode {
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scopes: string[];
  code_challenge: string;        // REQUIRED (was optional)
  code_challenge_method: string; // REQUIRED (was optional, always 'S256')
  expires_at: number;
  created_at: number;
}
```

**Change 2: Update OAuth metadata (around line 140)**

Update `.well-known/oauth-authorization-server` response in `src/index.ts`:

```typescript
code_challenge_methods_supported: ['S256'], // Only S256, not 'plain'
```

---

## Phase 3+4 Detailed Implementation

### 3.1 Token Revocation Endpoint

**New File:** `src/routes/tokenRevocation.ts`

```typescript
import type { Env } from '../index';
import type { OAuthAccessToken } from '../types';

/**
 * OAuth 2.0 Token Revocation (RFC 7009)
 * POST /oauth/revoke
 */
export async function handleTokenRevocation(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const formData = await request.formData();
  const token = formData.get('token')?.toString();
  const tokenTypeHint = formData.get('token_type_hint')?.toString();

  if (!token) {
    return jsonResponse({
      error: 'invalid_request',
      error_description: 'token parameter required'
    }, 400);
  }

  console.log(`🗑️ [oauth] Token revocation requested`);

  // Try access token first
  if (!tokenTypeHint || tokenTypeHint === 'access_token') {
    const accessTokenData = await env.OAUTH_STORE.get(`access_token:${token}`, 'json');
    if (accessTokenData) {
      const tokenObj = accessTokenData as OAuthAccessToken;
      await env.OAUTH_STORE.delete(`access_token:${token}`);

      // Also revoke associated refresh token
      if (tokenObj.refresh_token) {
        await env.OAUTH_STORE.delete(`refresh_token:${tokenObj.refresh_token}`);
      }

      console.log('✅ [oauth] Access token revoked');
      return new Response('', { status: 200 });
    }
  }

  // Try refresh token
  if (!tokenTypeHint || tokenTypeHint === 'refresh_token') {
    const refreshTokenData = await env.OAUTH_STORE.get(`refresh_token:${token}`, 'json');
    if (refreshTokenData) {
      await env.OAUTH_STORE.delete(`refresh_token:${token}`);
      console.log('✅ [oauth] Refresh token revoked');
      return new Response('', { status: 200 });
    }
  }

  // RFC 7009: Return 200 even if token not found
  console.log('⚠️ [oauth] Token not found or already revoked');
  return new Response('', { status: 200 });
}

function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Register endpoint in `src/index.ts` (after line 107):**

```typescript
import { handleTokenRevocation } from './routes/tokenRevocation';

// OAuth Token Revocation Endpoint (RFC 7009)
if (url.pathname === '/oauth/revoke' && request.method === 'POST') {
  return await handleTokenRevocation(request, env);
}
```

---

### 3.2 Refresh Token Rotation

**File:** `src/oauth.ts`

**Add after line 224 in handleTokenEndpoint:**

```typescript
// OAuth 2.1: Support refresh_token grant type
if (grantType === 'refresh_token') {
  const refreshToken = formData.get('refresh_token')?.toString();
  const clientId = formData.get('client_id')?.toString();
  const clientSecret = formData.get('client_secret')?.toString();

  if (!refreshToken || !clientId || !clientSecret) {
    return jsonResponse({
      error: 'invalid_request',
      error_description: 'Missing required parameters for refresh_token grant'
    }, 400);
  }

  // Validate client
  const client = OAUTH_CLIENTS[clientId];
  if (!client) {
    return jsonResponse({ error: 'invalid_client' }, 401);
  }

  // TODO: Verify client_secret (bcrypt comparison)

  // Retrieve refresh token
  const oldTokenData = await env.OAUTH_STORE.get(`refresh_token:${refreshToken}`, 'json');

  if (!oldTokenData) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Refresh token not found or expired'
    }, 400);
  }

  const oldToken = oldTokenData as OAuthAccessToken;

  // Validate client_id
  if (oldToken.client_id !== clientId) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Refresh token issued to different client'
    }, 400);
  }

  // OAuth 2.1: Refresh token rotation
  const newAccessToken = generateRandomString(64);
  const newRefreshToken = generateRandomString(64);

  const newTokenData: OAuthAccessToken = {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    token_type: 'Bearer',
    expires_in: 1800, // 30 minutes
    user_id: oldToken.user_id,
    client_id: oldToken.client_id,
    scopes: oldToken.scopes,
    created_at: Date.now(),
    expires_at: Date.now() + 1800 * 1000,
  };

  // Store new tokens
  await env.OAUTH_STORE.put(
    `access_token:${newAccessToken}`,
    JSON.stringify(newTokenData),
    { expirationTtl: 1800 }
  );

  await env.OAUTH_STORE.put(
    `refresh_token:${newRefreshToken}`,
    JSON.stringify(newTokenData),
    { expirationTtl: 30 * 24 * 3600 }
  );

  // CRITICAL: Delete old refresh token (prevent reuse)
  await env.OAUTH_STORE.delete(`refresh_token:${refreshToken}`);

  console.log(`✅ [oauth] Refresh token rotated for user: ${oldToken.user_id}`);

  return jsonResponse({
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: 1800,
    refresh_token: newRefreshToken,
    scope: oldToken.scopes.join(' '),
  }, 200);
}
```

**Update grant_type validation (line 220):**

```typescript
if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
  return jsonResponse({
    error: 'unsupported_grant_type',
    error_description: 'grant_type must be authorization_code or refresh_token'
  }, 400);
}
```

---

## Testing Strategy

### Phase 1+2 Testing Checklist

**Pre-Deployment (Staging Environment):**

```bash
# 1. Test PKCE enforcement
curl -X GET "https://staging-panel.wtyczki.ai/oauth/authorize?client_id=test&redirect_uri=http://localhost&response_type=code"
# Expected: 400 error (missing PKCE)

# 2. Test with PKCE
# (Generate code_challenge using MCP server test script)
curl -X GET "https://staging-panel.wtyczki.ai/oauth/authorize?client_id=test&redirect_uri=http://localhost&response_type=code&code_challenge=xyz&code_challenge_method=S256"
# Expected: 302 redirect or consent page

# 3. Test token exchange without code_verifier
curl -X POST "https://staging-panel.wtyczki.ai/oauth/token" \
  -d "grant_type=authorization_code&code=ABC&client_id=test&client_secret=secret&redirect_uri=http://localhost"
# Expected: 400 error (missing code_verifier)

# 4. Test token lifetime
# Issue token, wait 31 minutes, try to use it
# Expected: 401 error (token expired)
```

**CSRF Protection Tests:**

- [ ] Login form displays without CSRF token → Fails
- [ ] Form submission with missing CSRF → 400 error
- [ ] Form submission with wrong CSRF → 400 error
- [ ] Form submission with valid CSRF → Success

**Redirect URI Tests:**

- [ ] Redirect URI with different domain → 400 error
- [ ] Redirect URI with different path → 400 error
- [ ] Redirect URI with additional query params → 400 error
- [ ] Exact redirect URI match → Success

### Phase 3+4 Testing Checklist

**Token Revocation:**

```bash
# 1. Revoke valid access token
curl -X POST "https://panel.wtyczki.ai/oauth/revoke" \
  -d "token=ACCESS_TOKEN&token_type_hint=access_token"
# Expected: 200 OK

# 2. Try to use revoked token
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://panel.wtyczki.ai/oauth/userinfo"
# Expected: 401 error

# 3. Revoke non-existent token
curl -X POST "https://panel.wtyczki.ai/oauth/revoke" \
  -d "token=FAKE_TOKEN"
# Expected: 200 OK (RFC 7009 compliance)
```

**Refresh Token Rotation:**

- [ ] Refresh token exchange → New access + refresh tokens
- [ ] Old refresh token cannot be reused → 400 error
- [ ] New access token works → Success
- [ ] New refresh token works → Success

---

## Deployment Plan

### Phase 1+2 Deployment (Week 1)

**Day -7: Communication**
- Email all MCP server developers
- Announce in Slack/Discord
- Update documentation

**Day -3 to -1: Pre-deployment**
- Deploy to staging environment
- Coordinate testing with MCP developers
- Verify all MCP servers PKCE-ready

**Day 0: Deployment**

```bash
# 1. Apply database migrations (if any)
# None needed for Phase 1+2

# 2. Deploy to production
git add .
git commit -m "feat: OAuth 2.1 compliance - enforce PKCE, add CSRF protection"
git push origin main
# (Auto-deploys via Cloudflare Workers Builds)

# 3. Monitor logs
wrangler tail --format pretty

# 4. Watch error rates
# Cloudflare dashboard → Analytics → Errors by status code
```

**Day 0-2: Post-deployment Monitoring**
- Monitor 400 errors (should be <1%)
- Track OAuth success rate (target: >99%)
- Contact MCP developers if issues arise
- Prepare rollback if >5% error rate

**Rollback Procedure:**

```bash
# If critical issues occur
wrangler rollback
```

### Phase 3+4 Deployment (Week 3)

**Prerequisites:**
- Phase 1+2 stable for at least 2 weeks
- No outstanding OAuth errors
- All MCP servers successfully using PKCE

**Deployment:**

```bash
git add .
git commit -m "feat: Add token revocation and refresh rotation (OAuth 2.1)"
git push origin main
```

**Post-deployment:**
- Test token revocation endpoint
- Verify refresh token rotation
- Monitor refresh_token grant usage

---

## Success Criteria

### Phase 1+2 Complete When:
- [ ] All OAuth requests enforce PKCE (100%)
- [ ] Only S256 code_challenge_method accepted
- [ ] Magic Auth has CSRF protection
- [ ] Access tokens expire in 30 minutes
- [ ] Exact redirect URI matching works
- [ ] OAuth error rate <1%
- [ ] Zero complaints from MCP developers

### Phase 3+4 Complete When:
- [ ] Token revocation endpoint functional
- [ ] Refresh token rotation working
- [ ] Old refresh tokens invalidated
- [ ] Comprehensive test suite passes
- [ ] Documentation updated

---

## Critical Files to Modify

### Phase 1+2 Files

| Priority | File | Changes | Risk |
|----------|------|---------|------|
| P0 | `src/oauth.ts` | Enforce PKCE, exact URI matching, 30-min tokens | HIGH |
| P0 | `src/routes/customAuth.ts` | Add CSRF protection | MEDIUM |
| P0 | `src/views/customLoginPage.ts` | Add CSRF token to forms | LOW |
| P0 | `src/views/customCodeVerificationPage.ts` | Add CSRF token | LOW |
| P1 | `src/types.ts` | Update interfaces | LOW |
| P1 | `wrangler.toml` | Add environment variables | LOW |
| P1 | `.dev.vars` | Add local variables | LOW |
| P1 | `src/index.ts` | Update Env interface, metadata endpoint | LOW |

### Phase 3+4 Files

| Priority | File | Changes | Risk |
|----------|------|---------|------|
| P1 | `src/routes/tokenRevocation.ts` | NEW FILE | LOW |
| P1 | `src/oauth.ts` | Add refresh_token grant | MEDIUM |
| P1 | `src/index.ts` | Register /oauth/revoke endpoint | LOW |

---

## Rollback Strategy

### If Phase 1+2 Fails

**Trigger Conditions:**
- OAuth error rate >5% within 6 hours
- Multiple MCP servers reporting failures
- Critical bug discovered

**Rollback Steps:**

```bash
# 1. Immediate rollback via Cloudflare
wrangler rollback

# 2. Notify MCP developers
# Email/Slack: "Rolled back OAuth 2.1 changes due to [REASON]"

# 3. Investigate root cause
wrangler tail --format json > logs.json
# Analyze error patterns

# 4. Fix and redeploy when ready
```

### If Phase 3+4 Fails

**Lower risk** - can disable new endpoints without affecting core OAuth flow:

```typescript
// In src/index.ts, comment out:
// if (url.pathname === '/oauth/revoke') { ... }
```

Deploy hotfix without rolling back Phase 1+2 changes.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MCP servers break on PKCE enforcement | MEDIUM | HIGH | Pre-deployment communication, testing window |
| CSRF breaks Magic Auth login | LOW | HIGH | Thorough testing, fallback to old flow if needed |
| 30-minute tokens cause UX issues | LOW | MEDIUM | Implement refresh rotation in Phase 3 |
| Exact URI matching too strict | LOW | LOW | Clear error messages, documentation |

---

## Appendix A: MCP Server Migration Guide

**Email Template for MCP Developers:**

```
Subject: Required Action: OAuth 2.1 PKCE Enforcement - Deploy by [DATE]

Hi [Developer Name],

We're upgrading our OAuth implementation to OAuth 2.1 compliance on [DATE].
This requires ALL MCP servers to implement PKCE (Proof Key for Code Exchange).

REQUIRED CHANGES:

1. Generate code_verifier and code_challenge before authorization request
2. Send code_challenge + code_challenge_method=S256 in authorization URL
3. Send code_verifier in token exchange request

REFERENCE IMPLEMENTATION:
See PHASE_1_OAUTH_PKCE_REPORT.md in our repo for complete examples.

CODE EXAMPLE:
```typescript
// 1. Generate PKCE parameters
const codeVerifier = generateCodeVerifier(); // 32 random bytes, base64url
const codeChallenge = await generateCodeChallenge(codeVerifier); // SHA-256

// 2. Authorization request
const authUrl = `https://panel.wtyczki.ai/oauth/authorize?` +
  `client_id=YOUR_CLIENT_ID&` +
  `redirect_uri=YOUR_REDIRECT&` +
  `response_type=code&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256`;

// 3. Token exchange
const response = await fetch('https://panel.wtyczki.ai/oauth/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_SECRET',
    redirect_uri: 'YOUR_REDIRECT',
    code_verifier: codeVerifier  // Required!
  })
});
```

TESTING:
Staging environment available at: https://staging-panel.wtyczki.ai

DEADLINE: [DATE - 1 week before deployment]

Please confirm PKCE implementation by replying to this email.

Questions? Reply or contact us at: [CONTACT]
```

---

## Appendix B: Environment Variables Reference

**Production (`wrangler.toml`):**

```toml
[vars]
ACCESS_TEAM_DOMAIN = "https://wtyczkiai.cloudflareaccess.com"
ACCESS_POLICY_AUD = "e8769203aae02341bd6e811a27dbb8c7c256a35c7f6247524b2b4a35f42ee009"
OAUTH_BASE_URL = "https://panel.wtyczki.ai"
```

**Development (`.dev.vars`):**

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
OAUTH_BASE_URL=http://localhost:8787
```

---

## Conclusion

This plan provides a comprehensive, phased approach to OAuth 2.1 compliance that:
- ✅ Enforces modern security standards (PKCE, CSRF protection)
- ✅ Maintains coordination with live MCP server integrations
- ✅ Balances security with UX (30-minute tokens, refresh rotation)
- ✅ Provides clear rollback strategy
- ✅ Includes comprehensive testing and monitoring
