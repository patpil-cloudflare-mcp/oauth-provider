// src/routes/apiKeySettings.ts - API Key Management Endpoints
// Allows users to generate, list, and revoke permanent API keys

import type { Env } from '../index';
import type { User } from '../types';
import {
  generateApiKey,
  listUserApiKeys,
  revokeApiKey,
  type ApiKey,
} from '../apiKeys';

/**
 * Handle POST /api/keys/create
 * Generate a new API key for the authenticated user
 *
 * Request body:
 * {
 *   "name": "AnythingLLM",
 *   "expiresInDays": 365  // optional
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "apiKey": "wtyk_...",  // ONLY TIME THIS IS SHOWN!
 *   "record": { ... }
 * }
 */
export async function handleCreateApiKey(
  request: Request,
  env: Env,
  user: User
): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json() as { name: string; expiresInDays?: number };

    // Validate name
    if (!body.name || body.name.trim().length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Name is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (body.name.length > 100) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Name must be 100 characters or less'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate expiration
    if (body.expiresInDays !== undefined) {
      if (body.expiresInDays < 1 || body.expiresInDays > 3650) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Expiration must be between 1 and 3650 days'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Check if user has too many active keys (limit: 10)
    const existingKeys = await listUserApiKeys(env, user.user_id);
    const activeKeys = existingKeys.filter(k => k.is_active === 1);

    if (activeKeys.length >= 10) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Maximum 10 active API keys allowed. Please revoke an existing key first.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate API key
    const result = await generateApiKey(
      env,
      user.user_id,
      body.name.trim(),
      body.expiresInDays
    );

    console.log(`✅ [API Endpoints] Created API key for user ${user.user_id}: ${body.name}`);

    return new Response(JSON.stringify({
      success: true,
      apiKey: result.apiKey, // ⚠️ SHOWN ONLY ONCE!
      record: {
        api_key_id: result.record.api_key_id,
        key_prefix: result.record.key_prefix,
        name: result.record.name,
        created_at: result.record.created_at,
        expires_at: result.record.expires_at,
        is_active: result.record.is_active,
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [API Endpoints] Create key error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create API key'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle GET /api/keys/list
 * List all API keys for the authenticated user
 *
 * Response:
 * {
 *   "success": true,
 *   "keys": [
 *     {
 *       "api_key_id": "...",
 *       "key_prefix": "wtyk_a7f3k9m2...",
 *       "name": "AnythingLLM",
 *       "last_used_at": 1234567890,
 *       "created_at": 1234567890,
 *       "expires_at": null,
 *       "is_active": 1
 *     }
 *   ]
 * }
 */
export async function handleListApiKeys(
  request: Request,
  env: Env,
  user: User
): Promise<Response> {
  try {
    const keys = await listUserApiKeys(env, user.user_id);

    // Remove api_key_hash from response for security
    const safeKeys = keys.map(k => ({
      api_key_id: k.api_key_id,
      key_prefix: k.key_prefix,
      name: k.name,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
      expires_at: k.expires_at,
      is_active: k.is_active,
    }));

    return new Response(JSON.stringify({
      success: true,
      keys: safeKeys
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [API Endpoints] List keys error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to list API keys'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle DELETE /api/keys/:id
 * Revoke an API key
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "API key revoked successfully"
 * }
 */
export async function handleRevokeApiKey(
  request: Request,
  env: Env,
  user: User,
  apiKeyId: string
): Promise<Response> {
  try {
    const success = await revokeApiKey(env, apiKeyId, user.user_id);

    if (!success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'API key not found or not owned by you'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [API Endpoints] Revoked API key ${apiKeyId} for user ${user.user_id}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'API key revoked successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [API Endpoints] Revoke key error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to revoke API key'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
