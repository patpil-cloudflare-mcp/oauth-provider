// src/workos-auth.ts - WorkOS Authentication Module for Cloudflare Workers

import { WorkOS } from '@workos-inc/node';
import { decodeJwt } from 'jose';
import type { User } from './types';

/**
 * Environment interface for WorkOS authentication
 */
export interface WorkOSAuthEnv {
  TOKEN_DB: D1Database;
  USER_SESSIONS: KVNamespace;
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;
}

/**
 * Session data stored in KV
 */
interface WorkOSSession {
  user_id: string;
  email: string;
  workos_user_id: string;
  access_token: string;
  refresh_token: string;
  created_at: number;
  expires_at: number;
}

/**
 * Result of session validation
 */
export interface SessionResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Generate WorkOS authorization URL to start login flow
 *
 * @param env - Worker environment
 * @param redirectUri - Where to redirect after authentication
 * @param state - Optional state parameter to restore app state
 * @returns Authorization URL to redirect user to
 */
export async function getAuthorizationUrl(
  env: WorkOSAuthEnv,
  redirectUri: string,
  state?: string
): Promise<string> {
  const workos = new WorkOS(env.WORKOS_API_KEY);

  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    clientId: env.WORKOS_CLIENT_ID,
    redirectUri,
    state,
  });

  console.log('🔐 [workos] Generated authorization URL');
  return authorizationUrl;
}

/**
 * Handle callback from WorkOS after user authentication
 *
 * Exchanges authorization code for user profile and tokens
 *
 * @param code - Authorization code from WorkOS
 * @param env - Worker environment
 * @returns User object and session token
 */
export async function handleCallback(
  code: string,
  env: WorkOSAuthEnv
): Promise<{ user: User; sessionToken: string }> {
  const workos = new WorkOS(env.WORKOS_API_KEY);

  console.log('🔄 [workos] Exchanging authorization code for user profile');

  // Exchange authorization code for authenticated user
  const { user: workosUser, accessToken, refreshToken } = await workos.userManagement.authenticateWithCode({
    clientId: env.WORKOS_CLIENT_ID,
    code,
  });

  console.log(`✅ [workos] Authenticated user: ${workosUser.email}`);
  console.log(`   WorkOS user ID: ${workosUser.id}`);

  // Get or create user in our database
  const { user } = await getOrCreateUser(workosUser.email, workosUser.id, env);

  // Create session token
  const sessionToken = crypto.randomUUID();

  // Store session in KV
  const session: WorkOSSession = {
    user_id: user.user_id,
    email: user.email,
    workos_user_id: workosUser.id,
    access_token: accessToken,
    refresh_token: refreshToken,
    created_at: Date.now(),
    expires_at: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  };

  await env.USER_SESSIONS.put(
    `workos_session:${sessionToken}`,
    JSON.stringify(session),
    { expirationTtl: 86400 } // 24 hours
  );

  console.log(`🎫 [workos] Session created for user: ${user.user_id}`);

  return { user, sessionToken };
}

/**
 * Validate session token and return authenticated user
 *
 * @param sessionToken - Session token from cookie
 * @param env - Worker environment
 * @returns Session validation result
 */
export async function validateSession(
  sessionToken: string,
  env: WorkOSAuthEnv
): Promise<SessionResult> {
  try {
    // Retrieve session from KV
    const sessionData = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`, 'json');

    if (!sessionData) {
      console.log('❌ [workos] Session not found or expired');
      return {
        success: false,
        error: 'Session not found or expired'
      };
    }

    const session = sessionData as WorkOSSession;

    // Check if session expired
    if (session.expires_at < Date.now()) {
      console.log('❌ [workos] Session expired');
      await env.USER_SESSIONS.delete(`workos_session:${sessionToken}`);
      return {
        success: false,
        error: 'Session expired'
      };
    }

    // Load user from database
    const user = await getUserById(session.user_id, env.TOKEN_DB);

    if (!user) {
      console.log('❌ [workos] User not found in database');
      return {
        success: false,
        error: 'User not found'
      };
    }

    console.log(`✅ [workos] Valid session for user: ${user.user_id}`);

    return {
      success: true,
      user
    };

  } catch (error) {
    console.error('❌ [workos] Session validation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Session validation failed'
    };
  }
}

/**
 * Clear user session (logout)
 *
 * @param sessionToken - Session token to clear
 * @param env - Worker environment
 */
export async function clearSession(
  sessionToken: string,
  env: WorkOSAuthEnv
): Promise<void> {
  await env.USER_SESSIONS.delete(`workos_session:${sessionToken}`);
  console.log('🔓 [workos] Session cleared');
}

/**
 * Get logout URL from WorkOS
 *
 * IMPORTANT: WorkOS requires the session ID from the JWT 'sid' claim, not our internal token
 * See: https://docs.workos.com/user-management/sessions
 *
 * @param sessionToken - Current session token (our internal KV key)
 * @param env - Worker environment
 * @returns Logout URL to redirect to
 */
export async function getLogoutUrl(
  sessionToken: string,
  env: WorkOSAuthEnv
): Promise<string> {
  const workos = new WorkOS(env.WORKOS_API_KEY);

  // Retrieve session from KV to get access token
  const sessionData = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`, 'json');

  if (!sessionData) {
    console.error('❌ [workos] Session not found in KV, cannot generate logout URL');
    throw new Error('Session not found');
  }

  const session = sessionData as WorkOSSession;

  // Extract WorkOS session ID from JWT access token
  // The 'sid' claim contains the actual WorkOS session ID
  const decoded = decodeJwt(session.access_token);
  const workosSessionId = decoded.sid as string;

  console.log(`🔍 [workos] Extracted session ID from JWT: ${workosSessionId.substring(0, 8)}...`);

  // Clear session from our KV
  await clearSession(sessionToken, env);

  // Generate WorkOS logout URL with CORRECT session ID
  // After WorkOS clears its session, user will be redirected to our logout success page
  const logoutUrl = workos.userManagement.getLogoutUrl({
    sessionId: workosSessionId,  // ✅ Use WorkOS session ID from JWT, not our internal token
    returnTo: 'https://panel.wtyczki.ai/auth/logout-success',
  });

  console.log('🚪 [workos] Generated logout URL with returnTo: /auth/logout-success');
  return logoutUrl;
}

/**
 * Extract session token from cookie
 *
 * @param request - Incoming HTTP request
 * @returns Session token or null
 */
export function getSessionTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');

  if (!cookieHeader) {
    return null;
  }

  // Parse cookies
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies['workos_session'] || null;
}

/**
 * Helper: Get user by user_id from database
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
 * Helper: Get user by email from database
 */
async function getUserByEmail(email: string, db: D1Database): Promise<User | null> {
  const result = await db.prepare(`
    SELECT
      user_id,
      email,
      created_at,
      last_login_at,
      workos_user_id
    FROM users
    WHERE email = ?
  `).bind(email).first();

  return result as User | null;
}

/**
 * Helper: Get user by WorkOS user ID from database
 * Primary lookup method — prevents duplicate records when email changes in WorkOS
 */
async function getUserByWorkosId(workosUserId: string, db: D1Database): Promise<User | null> {
  const result = await db.prepare(`
    SELECT
      user_id,
      email,
      created_at,
      last_login_at,
      workos_user_id
    FROM users
    WHERE workos_user_id = ?
  `).bind(workosUserId).first();

  return result as User | null;
}

/**
 * Get or create user in database
 *
 * @param email - User email address
 * @param workosUserId - WorkOS user identifier
 * @param env - Worker environment with DB
 * @returns User object and whether it was newly created
 */
export async function getOrCreateUser(
  email: string,
  workosUserId: string,
  env: { TOKEN_DB: D1Database }
): Promise<{ user: User; isNewUser: boolean }> {
  const timestamp = new Date().toISOString();

  // Primary lookup: by workos_user_id (handles email changes in WorkOS)
  let existingUser = await getUserByWorkosId(workosUserId, env.TOKEN_DB);

  // Fallback lookup: by email (for users who don't have workos_user_id yet)
  if (!existingUser) {
    existingUser = await getUserByEmail(email, env.TOKEN_DB);
  }

  if (existingUser) {
    // Update existing user: sync email from WorkOS + update login timestamp
    await env.TOKEN_DB.prepare(`
      UPDATE users
      SET email = ?, last_login_at = ?, workos_user_id = ?
      WHERE user_id = ?
    `).bind(email, timestamp, workosUserId, existingUser.user_id).run();

    console.log(`👤 [auth] Existing user updated: ${existingUser.user_id}`);
    console.log(`   Email synced: ${email}, WorkOS ID: ${workosUserId}`);

    const user: User = {
      user_id: existingUser.user_id,
      email,
      created_at: existingUser.created_at,
      last_login_at: timestamp,
    };

    return { user, isNewUser: false };
  }

  // Create new user
  const userId = crypto.randomUUID();

  await env.TOKEN_DB.prepare(`
    INSERT INTO users (user_id, email, created_at, last_login_at, workos_user_id)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userId, email, timestamp, timestamp, workosUserId).run();

  console.log(`🆕 [auth] New user created: ${userId}`);
  console.log(`   Email: ${email}, WorkOS ID: ${workosUserId}`);

  const user: User = {
    user_id: userId,
    email,
    created_at: timestamp,
    last_login_at: timestamp,
  };

  return { user, isNewUser: true };
}
