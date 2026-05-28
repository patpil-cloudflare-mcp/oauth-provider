// src/routes/userinfo.ts - OAuth UserInfo Endpoint (AuthKit + API Keys)
// Thin wrapper around shared authenticateBearer(). For free MCP servers with
// daily rate limits use /oauth/userinfo-free instead.

import { authenticateBearer, type BearerAuthEnv } from '../auth/authenticateBearer';

/**
 * Build WWW-Authenticate header for 401 responses.
 * MCP clients use the resource_metadata parameter to discover the authorization server.
 * See: https://modelcontextprotocol.io/ and RFC 9728
 */
function buildWwwAuthenticate(request: Request, error?: string, errorDescription?: string): string {
  const baseUrl = new URL(request.url).origin;
  const parts = ['Bearer'];

  if (error) {
    parts[0] += ` error="${error}"`;
  }
  if (errorDescription) {
    parts.push(`error_description="${errorDescription}"`);
  }
  parts.push(`resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`);

  return parts.join(', ');
}

/**
 * GET /oauth/userinfo
 * Returns user profile for authenticated API key or AuthKit JWT
 */
export async function handleUserInfoEndpoint(
  request: Request,
  env: BearerAuthEnv,
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse(
      { error: 'invalid_token' },
      401,
      { 'WWW-Authenticate': buildWwwAuthenticate(request, 'unauthorized', 'Authorization needed') },
    );
  }

  const auth = await authenticateBearer(request, env);
  if (!auth) {
    return jsonResponse(
      { error: 'invalid_token', error_description: 'Invalid or expired credentials' },
      401,
      { 'WWW-Authenticate': buildWwwAuthenticate(request, 'invalid_token', 'Invalid or expired credentials') },
    );
  }

  return jsonResponse({ sub: auth.sub, email: auth.email }, 200);
}

function jsonResponse(data: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
