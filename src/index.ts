// src/index.ts - Main Worker with Authentication & AuthKit MCP Auth
import { handleUserInfoEndpoint } from './routes/userinfo';
import { handleUserinfoFree } from './routes/userinfoFree';
export { FreeUsageLimiter } from './durableObjects/FreeUsageLimiter';
import {
  handleCallback,
  getLogoutUrl,
  getSessionTokenFromRequest,
  validateSession,
} from './workos-auth';
import {
  renderDashboardPage,
  renderLogoutSuccessPage,
} from './views';
import { authenticateRequest, requiresAuthentication } from './middleware/authMiddleware';
import { safeRedirectPath } from './utils/safeRedirect';
import {
  handleRootPath,
  handlePrivacyPolicy,
  handleTermsOfService,
} from './routes/staticPages';
import {
  handleSendMagicAuthCode,
  handleVerifyMagicAuthCode,
} from './routes/customAuth';
import { handleConnectLogin } from './routes/connectAuth';
import {
  handleSettingsPage,
} from './routes/accountSettings';

export interface Env {
  // Database
  TOKEN_DB: D1Database;

  // KV Namespaces
  USER_SESSIONS: KVNamespace;

  // Static Assets
  ASSETS: { fetch: typeof fetch };

  // WorkOS Configuration
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;

  // AuthKit MCP Auth
  AUTHKIT_DOMAIN: string;

  // Resend (transactional email)
  RESEND_API_KEY: string;

  // Rate Limiting
  RATE_LIMIT_SEND_CODE: RateLimit;
  RATE_LIMIT_VERIFY_CODE: RateLimit;

  // Free MCP server registry: JSON map { "<server-name>": <daily-limit> }
  FREE_SERVERS: string;

  // Daily usage limiter for free MCP servers (per user × server)
  FREE_USAGE_LIMITER: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ============================================================
    // OAUTH USERINFO ENDPOINT (AuthKit JWTs)
    // ============================================================

    if (url.pathname === '/oauth/userinfo') {
      return await handleUserInfoEndpoint(request, env);
    }

    // Free MCP servers: combined auth + daily quota check
    if (url.pathname === '/oauth/userinfo-free') {
      return await handleUserinfoFree(request, env);
    }

    // ============================================================
    // MCP DISCOVERY ENDPOINTS (Public - OAuth 2.0 Metadata)
    // ============================================================

    // MCP Protected Resource Metadata (RFC 8707)
    // Points MCP clients to AuthKit as the authorization server
    if (url.pathname === '/.well-known/oauth-protected-resource') {
      const baseUrl = new URL(request.url).origin;

      return new Response(JSON.stringify({
        resource: baseUrl,
        authorization_servers: [env.AUTHKIT_DOMAIN],
        bearer_methods_supported: ['header'],
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // OAuth Authorization Server Metadata (RFC 8414)
    // Proxy to AuthKit for compatibility with older MCP clients
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      try {
        const authkitMetadata = await fetch(
          `${env.AUTHKIT_DOMAIN}/.well-known/oauth-authorization-server`
        );
        const metadata = await authkitMetadata.json();

        return new Response(JSON.stringify(metadata), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (error) {
        console.error('Failed to proxy AuthKit metadata:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch authorization server metadata' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ============================================================
    // WORKOS AUTHENTICATION ENDPOINTS (Public)
    // ============================================================

    // WorkOS Login endpoint - Redirect to unified auth page
    // MUST be 302 (not 301) — 301 is cached permanently by browsers, breaking return_to
    if (url.pathname === '/auth/login' && request.method === 'GET') {
      const baseUrl = url.origin;
      const returnTo = url.searchParams.get('return_to');
      const params = new URLSearchParams({ tab: 'login' });
      if (returnTo) {
        params.set('return_to', returnTo);
      }
      return Response.redirect(`${baseUrl}/?${params.toString()}`, 302);
    }

    // WorkOS Callback endpoint - Handle redirect from WorkOS
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      try {
        const code = url.searchParams.get('code');
        const state = safeRedirectPath(url.searchParams.get('state') || '/dashboard');

        if (!code) {
          return new Response('Missing authorization code', { status: 400 });
        }

        // Exchange code for user session
        const { user, sessionToken } = await handleCallback(code, env);

        // Set session cookie
        const headers = new Headers();
        headers.append('Location', state);
        headers.append('Set-Cookie', `workos_session=${sessionToken}; Domain=.wtyczki.ai; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=259200`);

        return new Response(null, {
          status: 302,
          headers,
        });
      } catch (error) {
        console.error('[workos] Callback error:', error);
        return new Response('Authentication failed. Please try again.', { status: 500 });
      }
    }

    // ============================================================
    // CUSTOM MAGIC AUTH LOGIN (Public - Better UX)
    // ============================================================

    // Redirect old login page to unified auth page (preserve return_to for OAuth flow)
    if (url.pathname === '/auth/login-custom' && request.method === 'GET') {
      const baseUrl = url.origin;
      const returnTo = url.searchParams.get('return_to');
      let redirectUrl = `${baseUrl}/?tab=login`;
      if (returnTo) {
        redirectUrl += `&return_to=${encodeURIComponent(returnTo)}`;
      }
      return Response.redirect(redirectUrl, 302);
    }

    // Custom login - Step 2: Send Magic Auth code
    if (url.pathname === '/auth/login-custom/send-code' && request.method === 'POST') {
      return await handleSendMagicAuthCode(request, env);
    }

    // Custom login - Step 3: Verify code and create session
    if (url.pathname === '/auth/login-custom/verify-code' && request.method === 'POST') {
      return await handleVerifyMagicAuthCode(request, env);
    }

    // ============================================================
    // STANDALONE CONNECT (Public - AuthKit redirects here for custom login)
    // ============================================================

    if (url.pathname === '/auth/connect-login' && request.method === 'GET') {
      return await handleConnectLogin(request, env);
    }

    // ============================================================
    // LOGOUT SUCCESS PAGE (Public - shown after WorkOS logout redirect)
    // ============================================================

    if (url.pathname === '/auth/logout-success' && request.method === 'GET') {
      return new Response(renderLogoutSuccessPage(), {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // ============================================================
    // STATIC ASSETS - Serve images, CSS, JS from /public directory
    // ============================================================

    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    } catch {
      // Asset not found, continue to routing
    }

    // ============================================================
    // ROOT PATH HANDLERS - Subdomain-aware routing (Public)
    // If user already has a valid session, redirect to dashboard
    // ============================================================

    if (url.pathname === '/' || url.pathname === '') {
      const sessionToken = getSessionTokenFromRequest(request);
      if (sessionToken) {
        const sessionResult = await validateSession(sessionToken, env);
        if (sessionResult.success && sessionResult.user) {
          // Respect return_to param (e.g. OAuth connect-login flow)
          const returnTo = safeRedirectPath(url.searchParams.get('return_to') || '/dashboard');
          return new Response(null, {
            status: 302,
            headers: {
              'Location': returnTo,
              'Cache-Control': 'no-store',
            },
          });
        }
      }
    }

    const rootResponse = await handleRootPath(request);
    if (rootResponse) {
      return rootResponse;
    }

    // ============================================================
    // LEGAL PAGES (Public)
    // ============================================================

    if (url.pathname === '/privacy') {
      return await handlePrivacyPolicy();
    }

    if (url.pathname === '/terms') {
      return await handleTermsOfService();
    }

    // ============================================================
    // AUTHENTICATION MIDDLEWARE FOR PROTECTED ROUTES
    // ============================================================

    const { user: authenticatedUser, response: authResponse } = await authenticateRequest(request, env);

    if (authResponse) {
      return authResponse;
    }

    // Guard: if route required auth but no user, return 401
    // Non-protected routes that reach here are unknown — return 404
    if (!authenticatedUser) {
      if (requiresAuthentication(url.pathname)) {
        return new Response('Unauthorized', { status: 401 });
      }
      return new Response('Not found', { status: 404 });
    }

    // ============================================================
    // PROTECTED ENDPOINTS
    // ============================================================

    // Get current user info (API endpoint)
    if (url.pathname === '/auth/user' && request.method === 'GET') {
      return new Response(JSON.stringify({
        user: {
          user_id: authenticatedUser.user_id,
          email: authenticatedUser.email,
          created_at: authenticatedUser.created_at,
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Dashboard page
    if (url.pathname === '/dashboard' && request.method === 'GET') {
      return new Response(renderDashboardPage(authenticatedUser), {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Settings page
    if (url.pathname === '/dashboard/settings' && request.method === 'GET') {
      return await handleSettingsPage(authenticatedUser);
    }

    // Logout endpoint
    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      const sessionToken = getSessionTokenFromRequest(request);

      if (sessionToken) {
        try {
          const logoutUrl = await getLogoutUrl(sessionToken, env);

          // Delete session from KV immediately so the token can't be reused
          await env.USER_SESSIONS.delete(`workos_session:${sessionToken}`);

          return new Response(JSON.stringify({
            success: true,
            logoutUrl,
            message: 'Logged out successfully'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': 'workos_session=; Domain=.wtyczki.ai; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
            }
          });
        } catch (error) {
          console.error('[workos] Logout failed:', error);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'workos_session=; Domain=.wtyczki.ai; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
        }
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
