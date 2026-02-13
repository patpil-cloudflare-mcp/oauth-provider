// src/routes/userinfo.ts - OAuth UserInfo Endpoint (AuthKit + API Keys)
// Supports two auth paths:
// 1. API keys (wtyk_ prefix) - validated via SHA-256 hash lookup
// 2. AuthKit JWTs - verified via JWKS from AuthKit domain

import { jwtVerify, createRemoteJWKSet } from 'jose';
import { validateApiKey } from '../apiKeys';
import type { User } from '../types';

interface UserinfoEnv {
  TOKEN_DB: D1Database;
  AUTHKIT_DOMAIN: string;
}

// Cache JWKS keyset per AuthKit domain (survives across requests in same isolate)
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(authkitDomain: string) {
  let jwks = jwksCache.get(authkitDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${authkitDomain}/oauth2/jwks`));
    jwksCache.set(authkitDomain, jwks);
  }
  return jwks;
}

/**
 * Build WWW-Authenticate header for 401 responses.
 * MCP clients use the resource_metadata parameter to discover the authorization server.
 * See: https://modelcontextprotocol.io/ and RFC 9728
 */
function buildWwwAuthenticate(request: Request, error?: string, errorDescription?: string): string {
  const baseUrl = new URL(request.url).origin;
  const parts = ['Bearer'];

  if (error) {
    parts[0] += ` error="${error}"`;
  }
  if (errorDescription) {
    parts.push(`error_description="${errorDescription}"`);
  }
  parts.push(`resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`);

  return parts.join(', ');
}

/**
 * GET /oauth/userinfo
 * Returns user profile for authenticated API key or AuthKit JWT
 */
export async function handleUserInfoEndpoint(
  request: Request,
  env: UserinfoEnv
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse(
      { error: 'invalid_token' },
      401,
      { 'WWW-Authenticate': buildWwwAuthenticate(request, 'unauthorized', 'Authorization needed') },
    );
  }

  const token = authHeader.substring(7);

  let userId: string | null = null;

  if (token.startsWith('wtyk_')) {
    // API key authentication
    userId = await validateApiKey(token, env);

    if (!userId) {
      return jsonResponse(
        { error: 'invalid_token', error_description: 'Invalid or revoked API key' },
        401,
        { 'WWW-Authenticate': buildWwwAuthenticate(request, 'invalid_token', 'Invalid or revoked API key') },
      );
    }
  } else {
    // AuthKit JWT authentication
    try {
      const JWKS = getJWKS(env.AUTHKIT_DOMAIN);

      const { payload } = await jwtVerify(token, JWKS, {
        issuer: env.AUTHKIT_DOMAIN,
      });

      const workosUserId = payload.sub;
      if (!workosUserId) {
        return jsonResponse(
          { error: 'invalid_token', error_description: 'JWT missing sub claim' },
          401,
          { 'WWW-Authenticate': buildWwwAuthenticate(request, 'invalid_token', 'JWT missing sub claim') },
        );
      }

      // Look up local user by WorkOS user ID
      const userRecord = await env.TOKEN_DB.prepare(
        'SELECT user_id FROM users WHERE workos_user_id = ? AND is_deleted = 0'
      ).bind(workosUserId).first<{ user_id: string }>();

      if (!userRecord) {
        return jsonResponse(
          { error: 'invalid_token', error_description: 'User not found' },
          401,
          { 'WWW-Authenticate': buildWwwAuthenticate(request, 'invalid_token', 'User not found') },
        );
      }

      userId = userRecord.user_id;
    } catch (error) {
      console.error('JWT verification failed:', error);
      const desc = error instanceof Error ? error.message : 'JWT verification failed';
      return jsonResponse(
        { error: 'invalid_token', error_description: desc },
        401,
        { 'WWW-Authenticate': buildWwwAuthenticate(request, 'invalid_token', desc) },
      );
    }
  }

  // Fetch user from database
  const user = await env.TOKEN_DB.prepare(
    'SELECT user_id, email FROM users WHERE user_id = ? AND is_deleted = 0'
  ).bind(userId).first<Pick<User, 'user_id' | 'email'>>();

  if (!user) {
    return jsonResponse(
      { error: 'invalid_token' },
      401,
      { 'WWW-Authenticate': buildWwwAuthenticate(request, 'invalid_token') },
    );
  }

  return jsonResponse({
    sub: user.user_id,
    email: user.email,
  }, 200);
}

function jsonResponse(data: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
