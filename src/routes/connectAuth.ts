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
      return new Response(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Błąd połączenia - wtyczki.ai</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',-apple-system,sans-serif;background:#feffff;color:#222b4f;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{max-width:440px;background:#fff;border:2px solid #eff4f7;border-radius:16px;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,.1);text-align:center}h1{font-size:22px;margin-bottom:12px}p{color:rgba(34,43,79,.65);line-height:1.6;margin-bottom:20px}a{display:inline-block;padding:12px 24px;background:#3239e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}a:hover{background:#140f44}</style>
</head><body><div class="card">
<h1>Link autoryzacyjny wygasł</h1>
<p>Sesja połączenia z aplikacją (Claude, ChatGPT) wygasła. Wróć do aplikacji i spróbuj połączyć się ponownie.</p>
<a href="/dashboard">Przejdź do panelu</a>
</div></body></html>`, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
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
