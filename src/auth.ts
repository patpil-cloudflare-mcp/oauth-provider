// src/auth.ts - Authentication Module for Cloudflare Access JWT Validation

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import type {
  User,
  AccessTokenPayload,
  AuthResult,
  UserSession
} from './types';

/**
 * Environment interface for authentication module
 */
export interface AuthEnv {
  DB: D1Database;
  USER_SESSIONS: KVNamespace;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_POLICY_AUD: string;
}

/**
 * Validates Cloudflare Access JWT and returns authenticated user
 *
 * Flow:
 * 1. Extract JWT from Cf-Access-Jwt-Assertion header
 * 2. Verify JWT signature against Cloudflare public keys
 * 3. Validate issuer, audience, and expiration
 * 4. Extract email from payload
 * 5. Get or create user in database
 * 6. Cache validation result in KV for performance
 *
 * @param request - Incoming HTTP request
 * @param env - Worker environment with Access configuration
 * @returns AuthResult with user object or error
 */
export async function validateAccessToken(
  request: Request,
  env: AuthEnv
): Promise<AuthResult> {
  try {
    // Extract JWT from header
    const token = request.headers.get('cf-access-jwt-assertion');

    if (!token) {
      console.log('❌ [auth] No JWT token in request headers');
      return {
        success: false,
        error: 'Missing authentication token'
      };
    }

    // Check cache first (avoid repeated JWT verification)
    const tokenHash = await hashToken(token);
    const cachedSession = await getCachedSession(tokenHash, env.USER_SESSIONS);

    if (cachedSession) {
      console.log(`✅ [auth] Using cached session for user: ${cachedSession.email}`);

      // Load user from database
      const user = await getUserById(cachedSession.user_id, env.DB);

      if (user) {
        return { success: true, user };
      }

      // Cache invalid, continue to full validation
      console.log('⚠️  [auth] Cached session invalid, re-validating');
    }

    // Verify JWT signature
    console.log('🔍 [auth] Verifying JWT signature...');

    const JWKS = createRemoteJWKSet(
      new URL(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)
    );

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_POLICY_AUD,
    }) as { payload: JWTPayload & AccessTokenPayload };

    console.log(`✅ [auth] JWT verified for email: ${payload.email}`);

    // Extract user info
    const email = payload.email;
    if (!email) {
      return {
        success: false,
        error: 'No email in JWT payload'
      };
    }

    // Get or create user
    const { user, isNewUser } = await getOrCreateUser(email, env);

    if (isNewUser) {
      console.log(`🆕 [auth] New user created during authentication: ${user.user_id}`);
    }

    // Cache the validated session
    await cacheSession(
      tokenHash,
      {
        user_id: user.user_id,
        email: user.email,
        jwt_hash: tokenHash,
        created_at: Date.now(),
        expires_at: payload.exp * 1000, // Convert to milliseconds
      },
      env.USER_SESSIONS
    );

    console.log(`🎉 [auth] Authentication successful for user: ${user.user_id}`);

    return { success: true, user };

  } catch (error) {
    console.error('❌ [auth] JWT validation failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
}

/**
 * Gets or creates a user account on first login
 *
 * Flow:
 * 1. Query database for user by email
 * 2. If exists: Update last_login_at, return user with isNewUser=false
 * 3. If not exists: Create new user account, return with isNewUser=true
 *
 * @param email - User email from JWT
 * @param env - Worker environment
 * @returns Object with user and isNewUser flag
 */
export async function getOrCreateUser(
  email: string,
  env: { DB: D1Database }
): Promise<{ user: User; isNewUser: boolean }> {
  // Check if user exists
  const existingUser = await getUserByEmail(email, env.DB);

  if (existingUser) {
    // Update last login timestamp
    await env.DB.prepare(
      'UPDATE users SET last_login_at = ? WHERE user_id = ?'
    ).bind(new Date().toISOString(), existingUser.user_id).run();

    console.log(`👤 [auth] Returning existing user: ${existingUser.user_id}`);
    return { user: existingUser, isNewUser: false };
  }

  // Create new user
  console.log(`🆕 [auth] Creating new user for email: ${email}`);

  const userId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // Insert user into database
  await env.DB.prepare(`
    INSERT INTO users (
      user_id,
      email,
      created_at,
      last_login_at
    ) VALUES (?, ?, ?, ?)
  `).bind(
    userId,
    email,
    timestamp,
    timestamp
  ).run();

  console.log(`✅ [auth] New user created: ${userId}`);
  console.log(`   Email: ${email}`);

  // Return newly created user with isNewUser flag
  const newUser: User = {
    user_id: userId,
    email,
    created_at: timestamp,
    last_login_at: timestamp,
  };

  return { user: newUser, isNewUser: true };
}

/**
 * Get user by user_id from database
 */
async function getUserById(userId: string, db: D1Database): Promise<User | null> {
  const result = await db.prepare(`
    SELECT
      user_id,
      email,
      created_at,
      last_login_at
    FROM users
    WHERE user_id = ?
  `).bind(userId).first();

  return result as User | null;
}

/**
 * Get user by email from database
 */
async function getUserByEmail(email: string, db: D1Database): Promise<User | null> {
  const result = await db.prepare(`
    SELECT
      user_id,
      email,
      created_at,
      last_login_at
    FROM users
    WHERE email = ?
  `).bind(email).first();

  return result as User | null;
}

/**
 * Hash token for cache lookup (SHA-256)
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get cached session from KV
 */
async function getCachedSession(
  tokenHash: string,
  kv: KVNamespace
): Promise<UserSession | null> {
  const cached = await kv.get(`session:${tokenHash}`, 'json');

  if (!cached) {
    return null;
  }

  const session = cached as UserSession;

  // Check if expired
  if (session.expires_at < Date.now()) {
    await kv.delete(`session:${tokenHash}`);
    return null;
  }

  return session;
}

/**
 * Cache validated session in KV
 */
async function cacheSession(
  tokenHash: string,
  session: UserSession,
  kv: KVNamespace
): Promise<void> {
  const ttl = Math.floor((session.expires_at - Date.now()) / 1000);

  if (ttl > 0) {
    await kv.put(
      `session:${tokenHash}`,
      JSON.stringify(session),
      { expirationTtl: ttl }
    );
  }
}

/**
 * Clear user session (logout)
 */
export async function clearSession(
  tokenHash: string,
  kv: KVNamespace
): Promise<void> {
  await kv.delete(`session:${tokenHash}`);
}
