// src/routes/oauthGrants.ts - OAuth Authorization Grants API
// Manages user's authorized MCP applications

import type { User } from '../types';

interface Env {
  TOKEN_DB: D1Database;
  OAUTH_KV: KVNamespace;
}

/**
 * OAuth authorization grant with client details
 */
interface OAuthGrant {
  authorization_id: string;
  client_id: string;
  client_name: string;
  client_description: string | null;
  client_icon_url: string | null;
  scopes: string[];
  authorized_at: string;
  last_used_at: string | null;
}

/**
 * Database row for authorization with joined client data
 */
interface AuthorizationRow {
  authorization_id: string;
  client_id: string;
  scopes: string;
  authorized_at: string;
  last_used_at: string | null;
  client_name: string;
  client_description: string | null;
  client_icon_url: string | null;
}

/**
 * GET /api/oauth/grants
 * List all OAuth applications authorized by the current user
 */
export async function handleListOAuthGrants(
  request: Request,
  env: Env,
  user: User
): Promise<Response> {
  try {
    const result = await env.TOKEN_DB.prepare(`
      SELECT
        a.authorization_id,
        a.client_id,
        a.scopes,
        a.authorized_at,
        a.last_used_at,
        c.name as client_name,
        c.description as client_description,
        c.icon_url as client_icon_url
      FROM oauth_authorizations a
      JOIN oauth_clients c ON a.client_id = c.client_id
      WHERE a.user_id = ? AND c.is_active = 1
      ORDER BY a.authorized_at DESC
    `).bind(user.user_id).all<AuthorizationRow>();

    const grants: OAuthGrant[] = (result.results || []).map(row => ({
      authorization_id: row.authorization_id,
      client_id: row.client_id,
      client_name: row.client_name,
      client_description: row.client_description,
      client_icon_url: row.client_icon_url,
      scopes: JSON.parse(row.scopes),
      authorized_at: row.authorized_at,
      last_used_at: row.last_used_at,
    }));

    return new Response(JSON.stringify({ grants }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ [oauth-grants] Failed to list grants:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch authorized applications'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /api/oauth/grants/:id
 * Revoke an OAuth authorization (remove user's consent for an application)
 */
export async function handleRevokeOAuthGrant(
  request: Request,
  env: Env,
  user: User,
  authorizationId: string
): Promise<Response> {
  try {
    // Verify the authorization belongs to the user
    const existing = await env.TOKEN_DB.prepare(`
      SELECT authorization_id, client_id
      FROM oauth_authorizations
      WHERE authorization_id = ? AND user_id = ?
    `).bind(authorizationId, user.user_id).first<{ authorization_id: string; client_id: string }>();

    if (!existing) {
      return new Response(JSON.stringify({
        error: 'Authorization not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete the authorization record
    await env.TOKEN_DB.prepare(`
      DELETE FROM oauth_authorizations
      WHERE authorization_id = ? AND user_id = ?
    `).bind(authorizationId, user.user_id).run();

    console.log(`✅ [oauth-grants] User ${user.user_id} revoked authorization for client ${existing.client_id}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Authorization revoked successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ [oauth-grants] Failed to revoke grant:', error);
    return new Response(JSON.stringify({
      error: 'Failed to revoke authorization'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
