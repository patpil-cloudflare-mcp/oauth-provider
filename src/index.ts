// src/index.ts - Main Worker with Authentication & AuthKit MCP Auth
import { handleUserInfoEndpoint } from './routes/userinfo';
import {
  handleCallback,
  getLogoutUrl,
  getSessionTokenFromRequest,
} from './workos-auth';
import {
  renderDashboardPage,
  renderLogoutSuccessPage,
} from './views';
import { authenticateRequest } from './middleware/authMiddleware';
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
  OAUTH_KV: KVNamespace;
  USER_SESSIONS: KVNamespace;

  // Static Assets
  ASSETS: { fetch: typeof fetch };

  // WorkOS Configuration
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;

  // AuthKit MCP Auth
  AUTHKIT_DOMAIN: string;

  // Rate Limiting
  RATE_LIMIT_SEND_CODE: RateLimit;
  RATE_LIMIT_VERIFY_CODE: RateLimit;
  RATE_LIMIT_API_KEYS: RateLimit;
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
    if (url.pathname === '/auth/login' && request.method === 'GET') {
      console.log('Redirecting to unified auth page');
      const baseUrl = url.origin;
      return Response.redirect(`${baseUrl}/?tab=login`, 301);
    }

    // WorkOS Callback endpoint - Handle redirect from WorkOS
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      try {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state') || '/dashboard';

        console.log(`[workos] Callback received, state: ${state}`);

        if (!code) {
          console.error('[workos] Missing authorization code');
          return new Response('Missing authorization code', { status: 400 });
        }

        // Exchange code for user session
        const { user, sessionToken } = await handleCallback(code, env);

        console.log(`[workos] User authenticated: ${user.email}`);

        // Set session cookie
        const headers = new Headers();
        headers.append('Location', state);
        headers.append('Set-Cookie', `workos_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=259200`);

        return new Response(null, {
          status: 302,
          headers,
        });
      } catch (error) {
        console.error('[workos] Callback failed:', error);
        return new Response(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
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
    // AUTHENTICATION MIDDLEWARE FOR PROTECTED ROUTES
    // ============================================================

    const { user: authenticatedUser, response: authResponse } = await authenticateRequest(request, env);

    if (authResponse) {
      return authResponse;
    }

    // ============================================================
    // PROTECTED ENDPOINTS
    // ============================================================

    // Get current user info (API endpoint)
    if (url.pathname === '/auth/user' && request.method === 'GET') {
      return new Response(JSON.stringify({
        user: {
          user_id: authenticatedUser!.user_id,
          email: authenticatedUser!.email,
          created_at: authenticatedUser!.created_at,
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
      `).bind(authenticatedUser!.user_id).all();

      const apiKeys = apiKeysResult.results || [];

      return new Response(renderDashboardPage(authenticatedUser!, apiKeys as any), {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Settings page
    if (url.pathname === '/dashboard/settings' && request.method === 'GET') {
      return await handleSettingsPage(authenticatedUser!);
    }

    // ============================================================
    // API KEY MANAGEMENT ENDPOINTS
    // ============================================================

    if (url.pathname === '/api/keys/create' && request.method === 'POST') {
      return await handleCreateApiKey(request, env, authenticatedUser!);
    }

    if (url.pathname === '/api/keys/list' && request.method === 'GET') {
      return await handleListApiKeys(request, env, authenticatedUser!);
    }

    if (url.pathname.startsWith('/api/keys/') && request.method === 'DELETE') {
      const apiKeyId = url.pathname.split('/').pop();
      if (apiKeyId) {
        return await handleRevokeApiKey(request, env, authenticatedUser!, apiKeyId);
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
              'Set-Cookie': 'workos_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
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
          'Set-Cookie': 'workos_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
        }
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
    } catch (error) {
      console.log('Asset fetch failed:', error);
    }

    // ============================================================
    // ROOT PATH HANDLERS - Subdomain-aware routing
    // ============================================================

    const rootResponse = await handleRootPath(request);
    if (rootResponse) {
      return rootResponse;
    }

    // ============================================================
    // LEGAL PAGES
    // ============================================================

    if (url.pathname === '/privacy') {
      return await handlePrivacyPolicy();
    }

    if (url.pathname === '/terms') {
      return await handleTermsOfService();
    }

    return new Response('Not found', { status: 404 });
  },
};
