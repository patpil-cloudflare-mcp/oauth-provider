# OAuth 2.1 Migration Guide for MCP Server Developers

**Audience:** MCP Server Developers integrating with wtyczki.ai Token System
**Priority:** HIGH - Breaking Change
**Status:** Pre-Deployment Notice

---

## 🚨 CRITICAL: Breaking Change Notice

We're upgrading our OAuth implementation to **OAuth 2.1 compliance** on **[DATE - TO BE ANNOUNCED]**.

**This requires ALL MCP servers to implement PKCE (Proof Key for Code Exchange).**

### What This Means for You

- ✅ **If you already use PKCE:** No action required (verify S256 method)
- ⚠️ **If you don't use PKCE:** You MUST update your code before [DATE]
- ❌ **After [DATE]:** OAuth requests without PKCE will be rejected with 400 error

---

## Why This Change?

**Security:** OAuth 2.1 is the latest security standard, requiring PKCE to prevent authorization code interception attacks.

**Standards Compliance:** PKCE is now mandatory in OAuth 2.1 (previously optional in OAuth 2.0).

**Future-Proofing:** Ensures compatibility with modern OAuth clients and security best practices.

---

## Required Changes

### 1. Generate PKCE Parameters

Before making an authorization request, you must:

1. Generate a **code_verifier** (random string, 43-128 characters)
2. Generate a **code_challenge** (SHA-256 hash of code_verifier, base64url-encoded)
3. Send **code_challenge** and **code_challenge_method=S256** in authorization URL

### 2. Update Authorization Request

**Before (OAuth 2.0 - Will STOP WORKING):**
```javascript
const authUrl = `https://panel.wtyczki.ai/oauth/authorize?` +
  `client_id=YOUR_CLIENT_ID&` +
  `redirect_uri=YOUR_REDIRECT&` +
  `response_type=code&` +
  `state=random_state`;
```

**After (OAuth 2.1 - REQUIRED):**
```javascript
// 1. Generate PKCE parameters
const codeVerifier = generateCodeVerifier(); // 32 random bytes, base64url
const codeChallenge = await generateCodeChallenge(codeVerifier); // SHA-256

// 2. Authorization request with PKCE
const authUrl = `https://panel.wtyczki.ai/oauth/authorize?` +
  `client_id=YOUR_CLIENT_ID&` +
  `redirect_uri=YOUR_REDIRECT&` +
  `response_type=code&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256&` +  // REQUIRED
  `state=random_state`;
```

### 3. Update Token Exchange

**Before (OAuth 2.0 - Will STOP WORKING):**
```javascript
const response = await fetch('https://panel.wtyczki.ai/oauth/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_SECRET',
    redirect_uri: 'YOUR_REDIRECT'
  })
});
```

**After (OAuth 2.1 - REQUIRED):**
```javascript
const response = await fetch('https://panel.wtyczki.ai/oauth/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_SECRET',
    redirect_uri: 'YOUR_REDIRECT',
    code_verifier: codeVerifier  // REQUIRED - Must match original
  })
});
```

---

## Reference Implementation

See our complete PKCE implementation: **PHASE_1_OAUTH_PKCE_REPORT.md** in the repository root.

### Helper Functions (TypeScript/JavaScript)

```typescript
/**
 * Generate cryptographically secure code_verifier
 * OAuth 2.1: 43-128 characters, base64url-encoded random string
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32); // 32 bytes = 256 bits
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate code_challenge from code_verifier
 * OAuth 2.1: SHA-256 hash, base64url-encoded
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hashBuffer));
}

/**
 * Base64-URL encode (RFC 7636)
 * Standard base64 with: + → -, / → _, remove padding =
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

### Storage Pattern

**CRITICAL:** Store `code_verifier` temporarily (only needed for token exchange)

```typescript
// 1. Before redirect - Store in KV/session
const codeVerifier = generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

await env.KV.put(`pkce:${state}`, codeVerifier, {
  expirationTtl: 600 // 10 minutes - same as authorization code
});

// Redirect to authorization endpoint with code_challenge...

// 2. After callback - Retrieve for token exchange
const codeVerifier = await env.KV.get(`pkce:${state}`);
await env.KV.delete(`pkce:${state}`); // Delete after use

// Exchange code for token with code_verifier...
```

---

## Testing Your Implementation

### 1. Test Checklist

- [ ] Authorization request includes `code_challenge` parameter
- [ ] Authorization request includes `code_challenge_method=S256`
- [ ] Token exchange includes `code_verifier` parameter
- [ ] SHA-256 hash verification works (code_challenge matches verifier)
- [ ] `code_verifier` is cryptographically random (32+ bytes)
- [ ] `code_verifier` is stored securely between authorization and token exchange

### 2. Test Scenarios

**Scenario A: Valid PKCE Flow**
```bash
# Expected: 302 redirect with authorization code
curl -X GET "https://panel.wtyczki.ai/oauth/authorize?client_id=test&redirect_uri=http://localhost&response_type=code&code_challenge=VALID_CHALLENGE&code_challenge_method=S256"

# Expected: 200 OK with access_token
curl -X POST "https://panel.wtyczki.ai/oauth/token" \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE" \
  -d "client_id=test" \
  -d "client_secret=secret" \
  -d "redirect_uri=http://localhost" \
  -d "code_verifier=MATCHING_VERIFIER"
```

**Scenario B: Missing PKCE (WILL FAIL after migration)**
```bash
# Expected: 400 Bad Request - "PKCE required"
curl -X GET "https://panel.wtyczki.ai/oauth/authorize?client_id=test&redirect_uri=http://localhost&response_type=code"
```

**Scenario C: Wrong code_challenge_method (WILL FAIL)**
```bash
# Expected: 400 Bad Request - "only S256 is supported"
curl -X GET "https://panel.wtyczki.ai/oauth/authorize?client_id=test&redirect_uri=http://localhost&response_type=code&code_challenge=ABC&code_challenge_method=plain"
```

**Scenario D: Missing code_verifier in token exchange (WILL FAIL)**
```bash
# Expected: 400 Bad Request - "code_verifier required"
curl -X POST "https://panel.wtyczki.ai/oauth/token" \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE" \
  -d "client_id=test" \
  -d "client_secret=secret" \
  -d "redirect_uri=http://localhost"
```

---

## Additional Changes (Non-Breaking)

### Access Token Lifetime Reduced

**Before:** 1 hour (3600 seconds)
**After:** 30 minutes (1800 seconds)

**Impact:** Tokens expire faster, improving security. Use refresh tokens for long sessions.

### Token Revocation Endpoint (NEW)

You can now explicitly revoke tokens:

```bash
curl -X POST "https://panel.wtyczki.ai/oauth/revoke" \
  -d "token=YOUR_ACCESS_TOKEN" \
  -d "token_type_hint=access_token"
```

**Use cases:**
- User logs out
- Token compromised
- Cleanup old tokens

### Refresh Token Rotation (NEW)

When using refresh tokens, both access token AND refresh token are rotated:

```bash
curl -X POST "https://panel.wtyczki.ai/oauth/token" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=OLD_REFRESH_TOKEN" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_SECRET"

# Response includes BOTH new access_token and new refresh_token
# Old refresh_token is immediately invalidated
```

**Security benefit:** Prevents refresh token replay attacks.

---

## FAQ

### Q: Do I need to change my redirect URIs?

**A:** No, redirect URIs must stay exactly the same. OAuth 2.1 now requires **exact matching** (no wildcards), but your registered URIs don't change.

### Q: Will existing access tokens continue to work?

**A:** Yes, existing tokens remain valid until they expire (30 minutes). Only NEW authorization requests require PKCE.


### Q: Do I need PKCE for API keys?

**A:** No! API keys are unaffected by this change. Only OAuth flows require PKCE.

---

## Technical Reference

### OAuth 2.1 Specification Changes

**What's new in OAuth 2.1:**
- PKCE is mandatory (not optional)
- Only S256 code_challenge_method allowed (plain deprecated)
- Exact redirect URI matching required
- Refresh token rotation recommended
- Shorter token lifetimes recommended (15-60 minutes)

**Official Specs:**
- OAuth 2.1: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1
- PKCE (RFC 7636): https://datatracker.ietf.org/doc/html/rfc7636
- Token Revocation (RFC 7009): https://datatracker.ietf.org/doc/html/rfc7009

### Updated OAuth Endpoints

All endpoints remain the same, only parameters change:

- **Authorization:** `GET https://panel.wtyczki.ai/oauth/authorize`
- **Token Exchange:** `POST https://panel.wtyczki.ai/oauth/token`
- **Token Revocation:** `POST https://panel.wtyczki.ai/oauth/revoke` (NEW)
- **User Info:** `GET https://panel.wtyczki.ai/oauth/userinfo`
- **Metadata:** `GET https://panel.wtyczki.ai/.well-known/oauth-authorization-server`
