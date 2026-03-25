// src/index.ts - Main Worker with Authentication & AuthKit MCP Auth
import { handleUserInfoEndpoint } from './routes/userinfo';
import {
  handleCallback,
  getLogoutUrl,
  getSessionTokenFromRequest,
  validateSession,
} from './workos-auth';
import {
  renderDashboardPage,
  renderLogoutSuccessPage,
  renderPricingPage,
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
import {
  handleCreateApiKey,
  handleListApiKeys,
  handleRevokeApiKey,
} from './routes/apiKeySettings';

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
  RATE_LIMIT_API_KEYS: RateLimit;

  // Service Binding to mcp-token-system
  BILLING_API: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ============================================================
    // OAUTH USERINFO ENDPOINT (API keys + AuthKit JWTs)
    // ============================================================

    if (url.pathname === '/oauth/userinfo') {
      return await handleUserInfoEndpoint(request, env);
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
    // PRICING PAGE (Public)
    // ============================================================

    if (url.pathname === '/pricing' && request.method === 'GET') {
      return new Response(renderPricingPage(), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
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
      const apiKeysResult = await env.TOKEN_DB.prepare(`
        SELECT api_key_id, name, key_prefix, created_at, last_used_at, is_active
        FROM api_keys
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `).bind(authenticatedUser.user_id).all();

      const apiKeys = (apiKeysResult.results || []) as Array<{
        api_key_id: string;
        name: string;
        key_prefix: string;
        created_at: string;
        last_used_at: string | null;
        is_active: number;
      }>;

      return new Response(renderDashboardPage(authenticatedUser, apiKeys), {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Settings page
    if (url.pathname === '/dashboard/settings' && request.method === 'GET') {
      return await handleSettingsPage(authenticatedUser);
    }

    // ============================================================
    // BILLING PROXY (forwards to api.wtyczki.ai server-side)
    // Avoids cross-origin issues with SameSite=Lax cookies
    // ============================================================

    if (url.pathname.startsWith('/api/billing/')) {
      const billingPath = url.pathname.replace('/api/billing', '');

      const pathMap: Record<string, string> = {
        '/user': '/auth/user',
        '/transactions': '/user/transactions',
        '/checkout': '/checkout/create',
      };

      const targetPath = pathMap[billingPath];
      if (!targetPath) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Use Service Binding (env.BILLING_API.fetch) — direct Worker-to-Worker, no HTTP overhead
      // Per CF docs: domain in URL is ignored, only path matters
      const queryString = billingPath === '/transactions' ? url.search : '';
      const serviceUrl = `https://billing.internal${targetPath}${queryString}`;
      const sessionToken = getSessionTokenFromRequest(request);

      try {
        // Build body for POST from known data (avoids reading request body stream)
        let proxyBody: string | undefined;
        if (request.method === 'POST' && billingPath === '/checkout') {
          const priceId = url.searchParams.get('priceId') || '';
          proxyBody = JSON.stringify({
            userId: authenticatedUser!.user_id,
            priceId,
          });
        }

        const billingResponse = await env.BILLING_API.fetch(serviceUrl, {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { 'Cookie': `workos_session=${sessionToken}` } : {}),
          },
          body: proxyBody,
        });

        const body = await billingResponse.text();

        return new Response(body || JSON.stringify({ error: 'Empty response' }), {
          status: billingResponse.status,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[billing-proxy] Service binding failed: ${errMsg}`);
        return new Response(JSON.stringify({ error: 'Billing service unavailable', detail: errMsg }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ============================================================
    // API KEY MANAGEMENT ENDPOINTS
    // ============================================================

    if (url.pathname === '/api/keys/create' && request.method === 'POST') {
      return await handleCreateApiKey(request, env, authenticatedUser);
    }

    if (url.pathname === '/api/keys/list' && request.method === 'GET') {
      return await handleListApiKeys(request, env, authenticatedUser);
    }

    if (url.pathname.startsWith('/api/keys/') && request.method === 'DELETE') {
      const apiKeyId = url.pathname.split('/').pop();
      if (apiKeyId) {
        return await handleRevokeApiKey(request, env, authenticatedUser, apiKeyId);
      }
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
