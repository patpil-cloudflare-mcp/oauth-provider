// src/routes/connectAuth.ts - WorkOS Standalone Connect handler
// Enables MCP clients to use our custom Magic Auth login instead of AuthKit's native UI

import type { Env } from '../index';
import { getSessionTokenFromRequest } from '../workos-auth';

interface KVSession {
  user_id: string;
  email: string;
  workos_user_id: string;
  access_token: string;
  refresh_token: string;
  created_at: number;
  expires_at: number;
}

/**
 * Handle /auth/connect-login — AuthKit redirects here with external_auth_id
 *
 * Flow A: User has active session → call completion API → redirect
 * Flow B: No session → redirect to login page with return_to
 */
export async function handleConnectLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const externalAuthId = url.searchParams.get('external_auth_id');

  if (!externalAuthId) {
    return new Response('Missing external_auth_id parameter', { status: 400 });
  }

  // Check for existing session
  const sessionToken = getSessionTokenFromRequest(request);

  if (!sessionToken) {
    return redirectToLogin(url, externalAuthId);
  }

  // Validate session by reading KV directly (we need workos_user_id + email)
  const sessionData = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`, 'json') as KVSession | null;

  if (!sessionData || sessionData.expires_at < Date.now()) {
    return redirectToLogin(url, externalAuthId);
  }

  if (!sessionData.workos_user_id) {
    return redirectToLogin(url, externalAuthId);
  }

  // Call AuthKit completion API
  try {
    const completionResponse = await fetch('https://api.workos.com/authkit/oauth2/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
      },
      body: JSON.stringify({
        external_auth_id: externalAuthId,
        user: {
          id: sessionData.workos_user_id,
          email: sessionData.email,
        },
      }),
    });

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      console.error(`[connect-auth] Completion API failed (${completionResponse.status}): ${errorText}`);
      return new Response('Authentication completion failed', { status: 502 });
    }

    const { redirect_uri } = await completionResponse.json() as { redirect_uri: string };

    return new Response(null, {
      status: 302,
      headers: { 'Location': redirect_uri },
    });
  } catch (error) {
    console.error('[connect-auth] Completion API error:', error);
    return new Response('Authentication completion failed', { status: 502 });
  }
}

function redirectToLogin(url: URL, externalAuthId: string): Response {
  const connectReturnPath = `/auth/connect-login?external_auth_id=${encodeURIComponent(externalAuthId)}`;
  const loginUrl = `${url.origin}/?tab=login&return_to=${encodeURIComponent(connectReturnPath)}`;

  return new Response(null, {
    status: 302,
    headers: { 'Location': loginUrl },
  });
}
