// src/auth/authenticateBearer.ts
// Single source of truth for Bearer token validation across /oauth/userinfo
// and /oauth/userinfo-free. AuthKit JWT only — verified via JWKS, mapped to
// local user via workos_user_id.
//
// Returns { sub, email } on success or null on any failure (caller decides response).

import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { User } from '../types';

export interface BearerAuthEnv {
  TOKEN_DB: D1Database;
  AUTHKIT_DOMAIN: string;
  WORKOS_CLIENT_ID: string;
}

export interface AuthenticatedSubject {
  sub: string;
  email: string;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(authkitDomain: string) {
  let jwks = jwksCache.get(authkitDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${authkitDomain}/oauth2/jwks`));
    jwksCache.set(authkitDomain, jwks);
  }
  return jwks;
}

export async function authenticateBearer(
  request: Request,
  env: BearerAuthEnv,
): Promise<AuthenticatedSubject | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const userId = await verifyAuthKitJwtToUserId(token, env);

  if (!userId) return null;

  const user = await env.TOKEN_DB.prepare(
    'SELECT user_id, email FROM users WHERE user_id = ? AND is_deleted = 0',
  ).bind(userId).first<Pick<User, 'user_id' | 'email'>>();

  if (!user) return null;
  return { sub: user.user_id, email: user.email };
}

async function verifyAuthKitJwtToUserId(
  token: string,
  env: BearerAuthEnv,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJWKS(env.AUTHKIT_DOMAIN), {
      issuer: env.AUTHKIT_DOMAIN,
    });

    if (payload.aud) {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(env.WORKOS_CLIENT_ID)) {
        console.warn('[authenticateBearer] JWT audience mismatch');
        return null;
      }
    }

    const workosUserId = payload.sub;
    if (!workosUserId) return null;

    const userRecord = await env.TOKEN_DB.prepare(
      'SELECT user_id FROM users WHERE workos_user_id = ? AND is_deleted = 0',
    ).bind(workosUserId).first<{ user_id: string }>();

    return userRecord?.user_id ?? null;
  } catch (error) {
    console.error('[authenticateBearer] JWT verification failed:', error);
    return null;
  }
}
