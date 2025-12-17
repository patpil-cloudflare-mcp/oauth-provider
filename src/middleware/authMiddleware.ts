// src/middleware/authMiddleware.ts - Authentication Middleware
import type { Env } from '../index';
import type { User } from '../types';
import {
  validateSession,
  getSessionTokenFromRequest,
} from '../workos-auth';

// Protected routes that require WorkOS authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/auth/user',
  '/api/keys',           // API key management endpoints
];

/**
 * Authentication middleware result
 * - If user is authenticated: returns { user: User, response: null }
 * - If authentication fails: returns { user: null, response: Response } (redirect to login)
 * - If route doesn't require auth: returns { user: null, response: null }
 */
export interface AuthResult {
  user: User | null;
  response: Response | null;
}

/**
 * Check if a route requires authentication
 */
export function requiresAuthentication(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Authentication middleware
 * Validates session for protected routes and returns authenticated user or redirect response
 *
 * @param request - The incoming request
 * @param env - Cloudflare Worker environment bindings
 * @returns AuthResult object containing either user or redirect response
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult> {
  const url = new URL(request.url);

  // Check if current route requires authentication
  if (!requiresAuthentication(url.pathname)) {
    return { user: null, response: null };
  }

  // Get session token from cookie
  const sessionToken = getSessionTokenFromRequest(request);

  if (!sessionToken) {
    // No session - redirect to login
    console.log(`❌ [workos] No session found, redirecting to login`);
    const returnUrl = encodeURIComponent(url.pathname + url.search);
    return {
      user: null,
      response: Response.redirect(`https://panel.wtyczki.ai/auth/login?return_to=${returnUrl}`, 302)
    };
  }

  // Validate session
  const sessionResult = await validateSession(sessionToken, env);

  if (!sessionResult.success || !sessionResult.user) {
    // Invalid session - redirect to login
    console.error(`❌ [workos] Session validation failed: ${sessionResult.error}`);
    const returnUrl = encodeURIComponent(url.pathname + url.search);
    return {
      user: null,
      response: Response.redirect(`https://panel.wtyczki.ai/auth/login?return_to=${returnUrl}`, 302)
    };
  }

  // Session valid - return authenticated user
  console.log(`✅ [workos] Authenticated user: ${sessionResult.user.email}`);
  return {
    user: sessionResult.user,
    response: null
  };
}
