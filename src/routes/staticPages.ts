// src/routes/staticPages.ts - Static Page Handlers
import { renderUnifiedAuthPage, type AuthTab } from '../views';

/**
 * Handle root path (/) with subdomain-aware routing
 * - panel.wtyczki.ai: Serve unified auth page (login/registration tabs)
 * - api.wtyczki.ai: Show API status page
 */
export async function handleRootPath(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  // Only handle root path
  if (url.pathname !== '/' && url.pathname !== '') {
    return null;
  }

  const hostname = request.headers.get('host') || '';

  // Dashboard subdomain - serve unified auth page with tabs
  if (hostname.includes('panel.wtyczki.ai')) {
    const csrfToken = crypto.randomUUID();
    const secureAttr = url.protocol === 'https:' ? '; Secure' : '';

    // Determine active tab from URL param (default: login)
    const tabParam = url.searchParams.get('tab');
    const activeTab: AuthTab = tabParam === 'register' ? 'register' : 'login';

    // Get error message from URL param (if any)
    const errorParam = url.searchParams.get('error');

    // Get return_to from URL param (for OAuth flow continuation)
    const returnTo = url.searchParams.get('return_to') || '/dashboard';

    return new Response(renderUnifiedAuthPage(csrfToken, activeTab, errorParam || undefined, returnTo), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `magic_auth_csrf=${csrfToken}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${secureAttr}`,
      }
    });
  }

  // API subdomain - show API status page
  if (hostname.includes('api.wtyczki.ai')) {
    return new Response(JSON.stringify({
      service: 'MCP OAuth Provider',
      status: 'operational',
      version: '3.0.0',
      auth: 'WorkOS AuthKit MCP Auth',
      endpoints: {
        oauth_userinfo: '/oauth/userinfo',
        well_known_protected_resource: '/.well-known/oauth-protected-resource',
        well_known_authorization_server: '/.well-known/oauth-authorization-server',
      },
      documentation: 'https://wtyczki.ai/docs'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Unknown subdomain - return null to allow 404 handling
  return null;
}
