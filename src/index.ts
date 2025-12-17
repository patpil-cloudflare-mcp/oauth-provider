// src/index.ts - Main Worker with Authentication & OAuth
import {
  handleAuthorizeEndpoint,
  handleTokenEndpoint,
  handleUserInfoEndpoint,
} from './oauth';
import { handleTokenRevocation } from './routes/tokenRevocation';
import {
  getAuthorizationUrl,
  handleCallback,
  validateSession,
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
  handleCustomLoginPage,
  handleSendMagicAuthCode,
  handleVerifyMagicAuthCode,
} from './routes/customAuth';
import {
  handleSettingsPage,
} from './routes/accountSettings';
import {
  handleCreateApiKey,
  handleListApiKeys,
  handleRevokeApiKey,
} from './routes/apiKeySettings';
import type { User } from './types';

export interface Env {
  // Database
  DB: D1Database;

  // KV Namespaces
  OAUTH_STORE: KVNamespace;
  USER_SESSIONS: KVNamespace;

  // Static Assets
  ASSETS: { fetch: typeof fetch };

  // WorkOS Configuration
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;

  // Cloudflare Access Configuration (deprecated - keeping for backward compatibility)
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_POLICY_AUD: string;

  // OAuth 2.1 Configuration
  OAUTH_BASE_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ============================================================
    // OAUTH ENDPOINTS (Public but secured by OAuth flow)
    // ============================================================

    // OAuth Authorization Endpoint
    if (url.pathname === '/oauth/authorize') {
      return await handleAuthorizeEndpoint(request, env);
    }

    // OAuth Token Endpoint
    if (url.pathname === '/oauth/token') {
      return await handleTokenEndpoint(request, env);
    }

    // OAuth User Info Endpoint
    if (url.pathname === '/oauth/userinfo') {
      return await handleUserInfoEndpoint(request, env);
    }

    // OAuth Token Revocation Endpoint (RFC 7009)
    if (url.pathname === '/oauth/revoke' && request.method === 'POST') {
      return await handleTokenRevocation(request, env);
    }

    // ============================================================
    // MCP DISCOVERY ENDPOINTS (Public - OAuth 2.0 Metadata)
    // ============================================================

    // MCP Protected Resource Metadata (RFC 8707)
    // Tells MCP clients where to find the authorization server
    // IMPORTANT: Points to OUR Worker, not WorkOS, so we control the login UI
    if (url.pathname === '/.well-known/oauth-protected-resource') {
      const baseUrl = new URL(request.url).origin;

      return new Response(JSON.stringify({
        resource: baseUrl,
        authorization_servers: [baseUrl], // Our Worker is the authorization server
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
    // For compatibility with older MCP clients that don't support Protected Resource Metadata
    // Returns metadata about OUR OAuth implementation
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      const baseUrl = new URL(request.url).origin;

      return new Response(JSON.stringify({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
        revocation_endpoint: `${baseUrl}/oauth/revoke`, // RFC 7009
        registration_endpoint: `${baseUrl}/oauth/register`, // TODO: Implement if needed
        scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
        response_types_supported: ['code'],
        response_modes_supported: ['query'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
        revocation_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
        code_challenge_methods_supported: ['S256'],
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // ============================================================
    // WORKOS AUTHENTICATION ENDPOINTS (Public)
    // ============================================================

    // WorkOS Login endpoint - Redirect to custom Magic Auth login
    if (url.pathname === '/auth/login' && request.method === 'GET') {
      console.log('🔐 Redirecting to custom Magic Auth login');
      // Preserve return_to query parameter (Response.redirect requires absolute URL)
      const returnTo = url.searchParams.get('return_to');
      const baseUrl = url.origin;
      const redirectUrl = returnTo
        ? `${baseUrl}/auth/login-custom?return_to=${encodeURIComponent(returnTo)}`
        : `${baseUrl}/auth/login-custom`;
      return Response.redirect(redirectUrl, 302);
    }

    // WorkOS Callback endpoint - Handle redirect from WorkOS
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      try {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state') || '/dashboard';

        console.log(`🔄 [workos] Callback received, state: ${state}`);
        console.log(`🔄 [workos] Authorization code present: ${!!code}`);

        if (!code) {
          console.error('❌ [workos] Missing authorization code');
          console.error('❌ [workos] Query params:', Object.fromEntries(url.searchParams));
          return new Response('Missing authorization code', { status: 400 });
        }

        console.log(`🔄 [workos] Calling handleCallback with code...`);

        // Exchange code for user session
        const { user, sessionToken } = await handleCallback(code, env);

        console.log(`✅ [workos] User authenticated: ${user.email}`);
        console.log(`✅ [workos] Session token generated: ${sessionToken.substring(0, 8)}...`);

        // Set session cookie
        const headers = new Headers();
        headers.append('Location', state);
        headers.append('Set-Cookie', `workos_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=259200`);

        console.log(`✅ [workos] Redirecting to: ${state}`);

        return new Response(null, {
          status: 302,
          headers,
        });
      } catch (error) {
        console.error('❌ [workos] Callback failed:', error);
        console.error('❌ [workos] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        });
        return new Response(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
      }
    }

    // ============================================================
    // CUSTOM MAGIC AUTH LOGIN (Public - Better UX)
    // ============================================================

    // Custom login page - Step 1: Email input
    if (url.pathname === '/auth/login-custom' && request.method === 'GET') {
      return await handleCustomLoginPage(request);
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
    // LOGOUT SUCCESS PAGE (Public - shown after WorkOS logout redirect)
    // ============================================================

    // Logout success page (public - shown after WorkOS logout redirect)
    // IMPORTANT: Must be BEFORE authentication middleware because users are logged out
    // when WorkOS redirects here after completing the logout flow
    if (url.pathname === '/auth/logout-success' && request.method === 'GET') {
      return new Response(renderLogoutSuccessPage(), {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // ============================================================
    // AUTHENTICATION MIDDLEWARE FOR PROTECTED ROUTES
    // ============================================================

    // Authenticate request (if protected route)
    const { user: authenticatedUser, response: authResponse } = await authenticateRequest(request, env);

    // If authentication failed, return redirect response
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
      // Fetch user's API keys
      const apiKeysResult = await env.DB.prepare(`
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

    // Create new API key
    if (url.pathname === '/api/keys/create' && request.method === 'POST') {
      return await handleCreateApiKey(request, env, authenticatedUser!);
    }

    // List user's API keys
    if (url.pathname === '/api/keys/list' && request.method === 'GET') {
      return await handleListApiKeys(request, env, authenticatedUser!);
    }

    // Revoke API key
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

          // Clear cookie and redirect to WorkOS logout
          const headers = new Headers();
          headers.append('Set-Cookie', 'workos_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

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
          console.error('❌ [workos] Logout failed:', error);
        }
      }

      // No session or logout failed, just clear cookie
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

    // Try to serve static assets first (logo, images, etc.)
    // This will return the asset if found, otherwise return null
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    } catch (error) {
      // Asset not found or ASSETS binding not available, continue to other routes
      console.log('Asset fetch failed:', error);
    }

    // ============================================================
    // ROOT PATH HANDLERS - Subdomain-aware routing
    // ============================================================

    // Handle root path based on subdomain
    const rootResponse = await handleRootPath(request);
    if (rootResponse) {
      return rootResponse;
    }

    // ============================================================
    // LEGAL PAGES
    // ============================================================

    // Privacy Policy
    if (url.pathname === '/privacy') {
      return await handlePrivacyPolicy();
    }

    // Terms of Service
    if (url.pathname === '/terms') {
      return await handleTermsOfService();
    }

    // Default response for non-webhook routes
    return new Response('Not found', { status: 404 });
  }, // Close async fetch()
}; // Close export default
