// src/routes/tokenRevocation.ts - OAuth Token Revocation (RFC 7009)

import type { Env } from '../index';

/**
 * OAuth 2.1 Token Revocation Endpoint (RFC 7009)
 * POST /oauth/revoke
 *
 * Allows clients to invalidate access tokens and refresh tokens.
 * This is critical for security when users log out or tokens are compromised.
 *
 * RFC 7009 Requirements:
 * - MUST return 200 OK even if token doesn't exist (prevents information disclosure)
 * - SHOULD support both access_token and refresh_token revocation
 * - Client authentication is OPTIONAL but RECOMMENDED
 */
export async function handleTokenRevocation(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await request.formData();
    const token = formData.get('token')?.toString();
    const tokenTypeHint = formData.get('token_type_hint')?.toString(); // Optional hint

    // RFC 7009: Token parameter is REQUIRED
    if (!token) {
      return jsonResponse({
        error: 'invalid_request',
        error_description: 'token parameter is required'
      }, 400);
    }

    console.log(`🗑️ [oauth] Token revocation request, hint: ${tokenTypeHint || 'none'}`);

    // Try to revoke as access token first (or if hint suggests access_token)
    if (!tokenTypeHint || tokenTypeHint === 'access_token') {
      const accessTokenData = await env.OAUTH_STORE.get(`access_token:${token}`, 'json');
      if (accessTokenData) {
        await env.OAUTH_STORE.delete(`access_token:${token}`);
        console.log('✅ [oauth] Access token revoked');
        return new Response('', { status: 200 });
      }
    }

    // Try to revoke as refresh token (or if hint suggests refresh_token)
    if (!tokenTypeHint || tokenTypeHint === 'refresh_token') {
      const refreshTokenData = await env.OAUTH_STORE.get(`refresh_token:${token}`, 'json');
      if (refreshTokenData) {
        await env.OAUTH_STORE.delete(`refresh_token:${token}`);
        console.log('✅ [oauth] Refresh token revoked');
        return new Response('', { status: 200 });
      }
    }

    // RFC 7009: Return 200 even if token not found (prevents enumeration attacks)
    console.log('⚠️ [oauth] Token not found or already revoked');
    return new Response('', { status: 200 });

  } catch (error) {
    console.error('❌ [oauth] Token revocation error:', error);

    // RFC 7009: Return 503 for server errors
    return jsonResponse({
      error: 'temporarily_unavailable',
      error_description: 'Token revocation service temporarily unavailable'
    }, 503);
  }
}

/**
 * Helper: JSON response
 */
function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
