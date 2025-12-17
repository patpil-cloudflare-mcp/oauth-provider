// src/oauth.ts - OAuth 2.1 Provider for MCP Server Authorization

import type {
  OAuthClient,
  OAuthAuthorizationRequest,
  OAuthTokenRequest,
  OAuthAuthorizationCode,
  OAuthAccessToken,
  User
} from './types';
import { validateAccessToken, type AuthEnv } from './auth';
import { validateApiKey } from './apiKeys';

/**
 * OAuth environment interface
 */
export interface OAuthEnv extends AuthEnv {
  OAUTH_STORE: KVNamespace;
}

/**
 * Pre-configured OAuth clients (MCP servers)
 * In production, these would be stored in KV or D1
 */
const OAUTH_CLIENTS: Record<string, OAuthClient> = {
  // Add MCP server clients here as needed
};

/**
 * Handles OAuth authorization endpoint
 * GET /oauth/authorize
 *
 * User flow:
 * 1. MCP client redirects user here with client_id, redirect_uri, etc.
 * 2. User already authenticated via Cloudflare Access (reuse validateAccessToken)
 * 3. Show consent page
 * 4. User approves → generate authorization code
 * 5. Redirect back to MCP client with code
 */
export async function handleAuthorizeEndpoint(
  request: Request,
  env: OAuthEnv
): Promise<Response> {
  const url = new URL(request.url);

  // Parse OAuth parameters
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const responseType = url.searchParams.get('response_type');
  const scope = url.searchParams.get('scope') || '';
  const state = url.searchParams.get('state') || '';
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');

  // Validate required parameters
  if (!clientId || !redirectUri || responseType !== 'code') {
    return new Response('Invalid OAuth request', { status: 400 });
  }

  // Validate client
  const client = OAUTH_CLIENTS[clientId];
  if (!client) {
    return new Response('Unknown client', { status: 400 });
  }

  // Validate redirect URI (OAuth 2.1: exact matching required)
  if (!isExactRedirectUriMatch(redirectUri, client.redirect_uris)) {
    return new Response('Invalid redirect_uri', { status: 400 });
  }

  // OAuth 2.1: PKCE is MANDATORY (not optional)
  if (!codeChallenge || !codeChallengeMethod) {
    return new Response('PKCE required: code_challenge and code_challenge_method are mandatory', { status: 400 });
  }

  // OAuth 2.1: Only S256 method allowed (plain is deprecated)
  if (codeChallengeMethod !== 'S256') {
    return new Response('Invalid code_challenge_method: only S256 is supported', { status: 400 });
  }

  // Check if user is authenticated via WorkOS session
  // First, try to get session from cookie
  const cookieHeader = request.headers.get('Cookie');
  let sessionToken: string | null = null;

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    sessionToken = cookies['workos_session'] || null;
  }

  // If no session, redirect to custom login with return URL
  if (!sessionToken) {
    console.log('🔐 [oauth] No session found, redirecting to custom login');
    const loginUrl = new URL('/auth/login-custom', request.url);
    loginUrl.searchParams.set('return_to', url.pathname + url.search);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Validate session and get user
  const sessionData = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`, 'json');

  if (!sessionData) {
    console.log('🔐 [oauth] Invalid session, redirecting to custom login');
    const loginUrl = new URL('/auth/login-custom', request.url);
    loginUrl.searchParams.set('return_to', url.pathname + url.search);
    return Response.redirect(loginUrl.toString(), 302);
  }

  const session = sessionData as {
    user_id: string;
    email: string;
    expires_at: number;
  };

  // Check if session expired
  if (session.expires_at < Date.now()) {
    console.log('🔐 [oauth] Session expired, redirecting to custom login');
    const loginUrl = new URL('/auth/login-custom', request.url);
    loginUrl.searchParams.set('return_to', url.pathname + url.search);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Load user from database
  const userResult = await env.DB.prepare(`
    SELECT
      user_id,
      email,
      current_token_balance,
      total_tokens_purchased,
      total_tokens_used,
      stripe_customer_id,
      created_at,
      last_login_at
    FROM users
    WHERE user_id = ?
  `).bind(session.user_id).first();

  if (!userResult) {
    console.log('🔐 [oauth] User not found, redirecting to custom login');
    const loginUrl = new URL('/auth/login-custom', request.url);
    loginUrl.searchParams.set('return_to', url.pathname + url.search);
    return Response.redirect(loginUrl.toString(), 302);
  }

  const user = userResult as User;

  // Handle POST (user approved)
  if (request.method === 'POST') {
    const formData = await request.formData();
    const approved = formData.get('approved');

    if (approved !== 'true') {
      // User denied
      const deniedUrl = new URL(redirectUri);
      deniedUrl.searchParams.set('error', 'access_denied');
      deniedUrl.searchParams.set('state', state);
      return Response.redirect(deniedUrl.toString(), 302);
    }

    // Generate authorization code
    const code = generateRandomString(32);
    const authCode: OAuthAuthorizationCode = {
      code,
      client_id: clientId,
      user_id: user.user_id,
      redirect_uri: redirectUri,
      scopes: scope.split(' ').filter(s => s.length > 0),
      code_challenge: codeChallenge, // OAuth 2.1: PKCE is mandatory
      code_challenge_method: 'S256',  // OAuth 2.1: Only S256 allowed
      expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes
      created_at: Date.now(),
    };

    // Store authorization code in KV
    await env.OAUTH_STORE.put(
      `auth_code:${code}`,
      JSON.stringify(authCode),
      { expirationTtl: 600 } // 10 minutes
    );

    console.log(`✅ [oauth] Authorization code generated for user: ${user.user_id}`);

    // Redirect back with code
    const successUrl = new URL(redirectUri);
    successUrl.searchParams.set('code', code);
    successUrl.searchParams.set('state', state);

    return Response.redirect(successUrl.toString(), 302);
  }

  // GET: Show consent page
  return new Response(renderConsentPage({
    clientName: client.name,
    scopes: scope.split(' ').filter(s => s.length > 0),
    userEmail: user.email,
    authorizeUrl: url.pathname + url.search,
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

/**
 * Handles OAuth token endpoint
 * POST /oauth/token
 *
 * Exchanges authorization code for access token
 */
export async function handleTokenEndpoint(
  request: Request,
  env: OAuthEnv
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const formData = await request.formData();
  const grantType = formData.get('grant_type')?.toString();
  const code = formData.get('code')?.toString();
  const clientId = formData.get('client_id')?.toString();
  const clientSecret = formData.get('client_secret')?.toString();
  const redirectUri = formData.get('redirect_uri')?.toString();
  const codeVerifier = formData.get('code_verifier')?.toString();

  // Validate grant type (OAuth 2.1: support both authorization_code and refresh_token)
  if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
    return jsonResponse({
      error: 'unsupported_grant_type',
      error_description: 'grant_type must be authorization_code or refresh_token'
    }, 400);
  }

  // ============================================================
  // REFRESH TOKEN GRANT TYPE (OAuth 2.1 Token Rotation)
  // ============================================================
  if (grantType === 'refresh_token') {
    const refreshToken = formData.get('refresh_token')?.toString();

    // Validate required fields for refresh_token grant
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

    // TODO: Verify client_secret against bcrypt hash
    // For now, skip validation since no clients are configured

    // Retrieve refresh token from KV
    const oldTokenData = await env.OAUTH_STORE.get(`refresh_token:${refreshToken}`, 'json');

    if (!oldTokenData) {
      return jsonResponse({
        error: 'invalid_grant',
        error_description: 'Refresh token not found or expired'
      }, 400);
    }

    const oldToken = oldTokenData as OAuthAccessToken;

    // Validate client_id matches
    if (oldToken.client_id !== clientId) {
      return jsonResponse({
        error: 'invalid_grant',
        error_description: 'Refresh token issued to different client'
      }, 400);
    }

    // OAuth 2.1: Token Rotation - Generate NEW access token AND refresh token
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
      expires_at: Date.now() + 1800 * 1000, // 30 minutes
    };

    // Store new access token
    await env.OAUTH_STORE.put(
      `access_token:${newAccessToken}`,
      JSON.stringify(newTokenData),
      { expirationTtl: 1800 } // 30 minutes
    );

    // Store new refresh token
    await env.OAUTH_STORE.put(
      `refresh_token:${newRefreshToken}`,
      JSON.stringify(newTokenData),
      { expirationTtl: 30 * 24 * 3600 } // 30 days
    );

    // CRITICAL: Delete old refresh token to prevent reuse (security requirement)
    await env.OAUTH_STORE.delete(`refresh_token:${refreshToken}`);

    console.log(`✅ [oauth] Refresh token rotated for user: ${oldToken.user_id}`);

    return jsonResponse({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 1800, // 30 minutes
      refresh_token: newRefreshToken,
      scope: oldToken.scopes.join(' '),
    }, 200);
  }

  // ============================================================
  // AUTHORIZATION CODE GRANT TYPE (Original implementation)
  // ============================================================

  // Validate required fields for authorization_code grant
  if (!code || !clientId || !clientSecret || !redirectUri) {
    return jsonResponse({
      error: 'invalid_request',
      error_description: 'Missing required parameters'
    }, 400);
  }

  // Validate client credentials
  const client = OAUTH_CLIENTS[clientId];
  if (!client) {
    return jsonResponse({
      error: 'invalid_client'
    }, 401);
  }

  // TODO: Verify client_secret against bcrypt hash stored in client config
  // For now, no validation since no clients are configured
  // When adding MCP clients, implement proper bcrypt validation here

  // Retrieve authorization code
  const authCodeData = await env.OAUTH_STORE.get(`auth_code:${code}`, 'json');

  if (!authCodeData) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authorization code not found or expired'
    }, 400);
  }

  const authCode = authCodeData as OAuthAuthorizationCode;

  // Validate authorization code
  if (authCode.client_id !== clientId) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Code issued to different client'
    }, 400);
  }

  // OAuth 2.1: Redirect URI must match exactly what was used in authorization request
  if (authCode.redirect_uri !== redirectUri) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Redirect URI mismatch'
    }, 400);
  }

  if (authCode.expires_at < Date.now()) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authorization code expired'
    }, 400);
  }

  // OAuth 2.1: PKCE is MANDATORY (authorization code must have code_challenge)
  if (!authCode.code_challenge) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authorization code missing PKCE challenge'
    }, 400);
  }

  // OAuth 2.1: code_verifier is required
  if (!codeVerifier) {
    return jsonResponse({
      error: 'invalid_request',
      error_description: 'code_verifier required for PKCE'
    }, 400);
  }

  // Validate PKCE (always S256 method in OAuth 2.1)
  const isValid = await validatePKCE(
    codeVerifier,
    authCode.code_challenge,
    authCode.code_challenge_method
  );

  if (!isValid) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'PKCE verification failed'
    }, 400);
  }

  // Delete authorization code (single use)
  await env.OAUTH_STORE.delete(`auth_code:${code}`);

  // Generate access token
  const accessToken = generateRandomString(64);
  const refreshToken = generateRandomString(64);

  const tokenData: OAuthAccessToken = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 1800, // OAuth 2.1: 30 minutes (security vs UX compromise)
    user_id: authCode.user_id,
    client_id: authCode.client_id,
    scopes: authCode.scopes,
    created_at: Date.now(),
    expires_at: Date.now() + 1800 * 1000, // 30 minutes
  };

  // Store access token
  await env.OAUTH_STORE.put(
    `access_token:${accessToken}`,
    JSON.stringify(tokenData),
    { expirationTtl: 1800 } // 30 minutes
  );

  // Store refresh token (longer TTL)
  await env.OAUTH_STORE.put(
    `refresh_token:${refreshToken}`,
    JSON.stringify(tokenData),
    { expirationTtl: 30 * 24 * 3600 } // 30 days
  );

  console.log(`✅ [oauth] Access token issued for user: ${authCode.user_id}`);

  return jsonResponse({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 1800, // 30 minutes
    refresh_token: refreshToken,
    scope: authCode.scopes.join(' '),
  }, 200);
}

/**
 * Handles user info endpoint
 * GET /oauth/userinfo
 *
 * Returns user profile for authenticated OAuth token OR API key
 */
export async function handleUserInfoEndpoint(
  request: Request,
  env: OAuthEnv
): Promise<Response> {
  // Extract access token from Authorization header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({
      error: 'invalid_token'
    }, 401);
  }

  const token = authHeader.substring(7);

  // Try validating as OAuth token first
  let userId: string | null = null;

  // Check if it's an API key (starts with 'wtyk_')
  if (token.startsWith('wtyk_')) {
    userId = await validateApiKey(token, env);

    if (!userId) {
      return jsonResponse({
        error: 'invalid_token',
        error_description: 'Invalid or revoked API key'
      }, 401);
    }
  } else {
    // Try OAuth token validation
    const tokenData = await env.OAUTH_STORE.get(`access_token:${token}`, 'json');

    if (!tokenData) {
      return jsonResponse({
        error: 'invalid_token'
      }, 401);
    }

    const oauthToken = tokenData as OAuthAccessToken;

    if (oauthToken.expires_at < Date.now()) {
      return jsonResponse({
        error: 'invalid_token',
        error_description: 'Token expired'
      }, 401);
    }

    userId = oauthToken.user_id;
  }

  // Get user from database
  // SECURITY: Check is_deleted to prevent deleted users from accessing userinfo
  const user = await env.DB.prepare(
    'SELECT user_id, email FROM users WHERE user_id = ? AND is_deleted = 0'
  ).bind(userId).first() as User | null;

  if (!user) {
    return jsonResponse({
      error: 'invalid_token'
    }, 401);
  }

  return jsonResponse({
    sub: user.user_id,
    email: user.email,
  }, 200);
}

/**
 * Validates OAuth access token and returns user_id
 * Used by MCP servers to authenticate requests
 */
export async function validateOAuthToken(
  token: string,
  env: OAuthEnv
): Promise<string | null> {
  const tokenData = await env.OAUTH_STORE.get(`access_token:${token}`, 'json');

  if (!tokenData) {
    return null;
  }

  const tokenObj = tokenData as OAuthAccessToken;

  if (tokenObj.expires_at < Date.now()) {
    await env.OAUTH_STORE.delete(`access_token:${token}`);
    return null;
  }

  // ============================================================
  // SECURITY FIX: Verify user is not deleted
  // ============================================================
  // Check database to ensure user account still exists and is not deleted
  const user = await env.DB.prepare(
    'SELECT is_deleted FROM users WHERE user_id = ?'
  ).bind(tokenObj.user_id).first<{ is_deleted: number }>();

  if (!user || user.is_deleted === 1) {
    // User account deleted - revoke token immediately
    await env.OAUTH_STORE.delete(`access_token:${token}`);
    return null;
  }

  return tokenObj.user_id;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Exact redirect URI matching (OAuth 2.1 requirement)
 * No wildcards, no pattern matching - must match exactly
 *
 * @param providedUri - URI from the OAuth request
 * @param registeredUris - List of pre-registered redirect URIs for the client
 * @returns true if exact match found, false otherwise
 */
function isExactRedirectUriMatch(providedUri: string, registeredUris: string[]): boolean {
  // OAuth 2.1: Redirect URIs must match exactly (case-sensitive)
  // No pattern matching, no wildcards, no substring matching
  return registeredUris.includes(providedUri);
}

/**
 * Generate cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate PKCE code verifier against challenge
 */
async function validatePKCE(
  verifier: string,
  challenge: string,
  method: 'S256' | 'plain'
): Promise<boolean> {
  if (method === 'plain') {
    return verifier === challenge;
  }

  // S256: SHA-256 hash of verifier
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computed = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return computed === challenge;
}

/**
 * Return JSON response
 */
function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Render OAuth consent page
 */
function renderConsentPage(params: {
  clientName: string;
  scopes: string[];
  userEmail: string;
  authorizeUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize ${params.clientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 500px;
      width: 100%;
    }
    .icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
    h1 { color: #333; font-size: 24px; margin-bottom: 16px; text-align: center; }
    .client-name { color: #667eea; font-weight: 600; }
    .info { color: #666; font-size: 14px; margin-bottom: 24px; text-align: center; }
    .user-badge {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 24px;
      text-align: center;
      font-size: 14px;
      color: #374151;
    }
    .permissions {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .permissions h3 {
      font-size: 14px;
      color: #374151;
      margin-bottom: 12px;
    }
    .permission-item {
      padding: 8px 0;
      color: #6b7280;
      font-size: 14px;
    }
    .permission-item:before {
      content: "✓ ";
      color: #10b981;
      font-weight: 600;
    }
    .actions {
      display: flex;
      gap: 12px;
    }
    button {
      flex: 1;
      padding: 14px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .approve {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .approve:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    }
    .deny {
      background: #f3f4f6;
      color: #6b7280;
    }
    .deny:hover {
      background: #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔐</div>
    <h1>Authorize <span class="client-name">${params.clientName}</span></h1>
    <p class="info">This application is requesting access to your account</p>

    <div class="user-badge">
      Logged in as: <strong>${params.userEmail}</strong>
    </div>

    <div class="permissions">
      <h3>This application will be able to:</h3>
      ${params.scopes.map(scope => `
        <div class="permission-item">${formatScope(scope)}</div>
      `).join('')}
    </div>

    <form method="POST" action="${params.authorizeUrl}">
      <div class="actions">
        <button type="submit" name="approved" value="false" class="deny">
          Deny
        </button>
        <button type="submit" name="approved" value="true" class="approve">
          Approve
        </button>
      </div>
    </form>
  </div>
</body>
</html>
  `;
}

/**
 * Format scope for display
 */
function formatScope(scope: string): string {
  const scopeNames: Record<string, string> = {
    'mcp_access': 'Access MCP servers and use your tokens',
    'user_info': 'View your email and account information',
    'token_balance': 'View your token balance',
  };

  return scopeNames[scope] || scope;
}
