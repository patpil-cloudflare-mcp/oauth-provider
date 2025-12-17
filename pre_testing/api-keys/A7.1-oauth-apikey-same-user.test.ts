/**
 * Test A7.1 - OAuth + API Key Same User Integration (P0 - CRITICAL)
 *
 * Purpose: Verify that OAuth and API key authentication resolve to the same user_id
 * for a given email, ensuring tokens are deducted from the correct account regardless
 * of authentication method.
 *
 * Critical for: User requirement - "tokens should be correctly deducted for a user
 * with a given email when using the MCP server, regardless of the chosen authentication
 * method, device, and MCP client"
 *
 * Test Scenarios:
 * 1. User ID Resolution Verification - Both methods return same user_id
 * 2. UserInfo Endpoint Consistency - Both auths return same user data
 * 3. Token Deduction from Same Account - Balance changes affect same account
 * 4. Transaction History Verification - Both deductions logged to same user
 *
 * Code References:
 * - src/apiKeys.ts:129-201 (validateApiKey)
 * - src/oauth.ts:426-458 (validateOAuthToken)
 * - src/oauth.ts:353-420 (handleUserInfoEndpoint)
 * - src/tokenConsumption.ts:109-297 (consumeTokens)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateApiKey, validateApiKey, type ApiKeyEnv } from '../../src/apiKeys';
import { validateOAuthToken, handleUserInfoEndpoint, type OAuthEnv } from '../../src/oauth';
import { consumeTokens } from '../../src/tokenConsumption';
import type { OAuthAccessToken, User } from '../../src/types';

// ============================================================
// MOCK DATABASE IMPLEMENTATION
// ============================================================

const createMockDB = () => {
  const users = new Map<string, any>();
  const apiKeys = new Map<string, any>();
  const transactions = new Map<string, any>();
  const mcpActions = new Map<string, any>();

  // Initialize test user with 1000 tokens
  const testUser = {
    user_id: 'integration-test-user-001',
    email: 'oauth-apikey-test@example.com',
    current_token_balance: 1000,
    total_tokens_purchased: 1000,
    total_tokens_used: 0,
    is_deleted: 0,
    created_at: Date.now(),
  };

  users.set(testUser.user_id, testUser);

  return {
    prepare: (query: string) => {
      return {
        bind: (...args: any[]) => {
          const preparedStmt = {
            query,
            args,
            first: async () => {
              // SELECT is_deleted FROM users WHERE user_id = ?
              if (query.includes('SELECT is_deleted FROM users')) {
                const userId = args[0];
                const user = users.get(userId);
                return user ? { is_deleted: user.is_deleted } : null;
              }

              // SELECT current_token_balance FROM users WHERE user_id = ? AND is_deleted = 0
              // OR: SELECT current_token_balance FROM users WHERE user_id = ? (after batch)
              if (query.includes('SELECT current_token_balance FROM users')) {
                const userId = args[0];
                const user = users.get(userId);
                // Check is_deleted if query includes it
                if (query.includes('is_deleted') && (!user || user.is_deleted === 1)) return null;
                // Otherwise return balance even for queries without is_deleted check
                if (!user) return null;
                return { current_token_balance: user.current_token_balance };
              }

              // SELECT user_id, email, current_token_balance FROM users WHERE user_id = ? AND is_deleted = 0
              if (query.includes('SELECT user_id, email, current_token_balance FROM users')) {
                const userId = args[0];
                const user = users.get(userId);
                if (!user || user.is_deleted === 1) return null;
                return {
                  user_id: user.user_id,
                  email: user.email,
                  current_token_balance: user.current_token_balance,
                };
              }

              // SELECT * FROM api_keys WHERE api_key_hash = ?
              if (query.includes('SELECT') && query.includes('api_keys') && query.includes('api_key_hash')) {
                const hash = args[0];
                for (const [keyId, key] of apiKeys.entries()) {
                  if (key.api_key_hash === hash) {
                    return key;
                  }
                }
                return null;
              }

              // SELECT action_id FROM mcp_actions WHERE action_id = ? (idempotency check)
              if (query.includes('SELECT') && query.includes('mcp_actions') && query.includes('action_id')) {
                const actionId = args[0];
                return mcpActions.get(actionId) || null;
              }

              return null;
            },
            run: async () => {
              // INSERT INTO api_keys
              if (query.includes('INSERT INTO api_keys')) {
                const [api_key_id, user_id, api_key_hash, key_prefix, name, last_used_at, created_at, expires_at, is_active] = args;
                apiKeys.set(api_key_id, {
                  api_key_id,
                  user_id,
                  api_key_hash,
                  key_prefix,
                  name,
                  last_used_at,
                  created_at,
                  expires_at,
                  is_active,
                });
                return { meta: { changes: 1 } };
              }

              // UPDATE api_keys SET last_used_at = ? WHERE api_key_id = ?
              if (query.includes('UPDATE api_keys') && query.includes('last_used_at')) {
                const last_used_at = args[0];
                const api_key_id = args[1];
                const key = apiKeys.get(api_key_id);
                if (key) {
                  key.last_used_at = last_used_at;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }

              return { meta: { changes: 0 } };
            },
          };
          return preparedStmt;
        },
      };
    },
    batch: async (statements: any[]) => {
      // Execute atomic transaction for token consumption
      const results = [];

      for (const stmt of statements) {
        const { query, args } = stmt;

        // 1. UPDATE users SET current_token_balance = current_token_balance - ?, total_tokens_used = total_tokens_used + ?
        if (query.includes('UPDATE users') && query.includes('current_token_balance')) {
          const tokenAmount = args[0];
          const userId = args[2];
          const user = users.get(userId);

          if (!user || user.is_deleted === 1) {
            throw new Error('User not found or deleted');
          }

          user.current_token_balance -= tokenAmount;
          user.total_tokens_used += tokenAmount;
          results.push({ meta: { changes: 1 } });
        }

        // 2. INSERT INTO transactions
        else if (query.includes('INSERT INTO transactions')) {
          // Args order: transaction_id, user_id, token_amount, userId (for subquery), description, created_at
          // Note: 'usage' type is hardcoded in the query, not in args
          const transaction_id = args[0];
          const user_id = args[1];
          const token_amount = args[2]; // Already negative for usage
          // args[3] is userId for balance_after subquery - calculate manually
          const balance_after = users.get(user_id)?.current_token_balance || 0;
          const description = args[4];
          const created_at = args[5];

          transactions.set(transaction_id, {
            transaction_id,
            user_id,
            type: 'usage',
            token_amount,
            balance_after,
            description,
            created_at,
          });
          results.push({ meta: { changes: 1 } });
        }

        // 3. INSERT INTO mcp_actions
        else if (query.includes('INSERT INTO mcp_actions')) {
          const [action_id, user_id, mcp_server_name, tool_name, parameters, tokens_consumed, success, created_at] = args;
          mcpActions.set(action_id, {
            action_id,
            user_id,
            mcp_server_name,
            tool_name,
            parameters,
            tokens_consumed,
            success,
            created_at,
          });
          results.push({ meta: { changes: 1 } });
        }
      }

      return results;
    },
    // Expose internal state for testing
    _getUsers: () => users,
    _getApiKeys: () => apiKeys,
    _getTransactions: () => transactions,
    _getMcpActions: () => mcpActions,
  } as any;
};

// ============================================================
// MOCK KV NAMESPACES
// ============================================================

const createMockOAuthKV = () => {
  const store = new Map<string, string>();

  return {
    get: async (key: string, type?: 'json' | 'text') => {
      const value = store.get(key);
      if (!value) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string, options?: any) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  } as any;
};

const createMockSessionKV = () => {
  const store = new Map<string, string>();

  return {
    get: async (key: string, type?: 'json' | 'text') => {
      const value = store.get(key);
      if (!value) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string, options?: any) => {
      store.set(key, value);
    },
  } as any;
};

// ============================================================
// MOCK ENVIRONMENT
// ============================================================

const createMockEnv = (db: any, oauthKV: any, sessionKV: any): OAuthEnv => ({
  DB: db,
  USER_SESSIONS: sessionKV,
  OAUTH_STORE: oauthKV,
  ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com',
  ACCESS_POLICY_AUD: 'test-policy-aud',
  STRIPE_SECRET_KEY: 'sk_test_mock',
  STRIPE_WEBHOOK_SECRET: 'whsec_mock',
  WORKOS_API_KEY: 'sk_test_mock',
  WORKOS_CLIENT_ID: 'client_mock',
  ASSETS: { fetch: () => Promise.resolve(new Response()) } as any,
});

// ============================================================
// TEST SUITE
// ============================================================

describe('A7.1 - OAuth + API Key Same User Integration (P0)', () => {
  let mockDB: any;
  let mockOAuthKV: any;
  let mockSessionKV: any;
  let env: OAuthEnv;
  let testUserId: string;
  let testUserEmail: string;

  beforeEach(() => {
    mockDB = createMockDB();
    mockOAuthKV = createMockOAuthKV();
    mockSessionKV = createMockSessionKV();
    env = createMockEnv(mockDB, mockOAuthKV, mockSessionKV);
    testUserId = 'integration-test-user-001';
    testUserEmail = 'oauth-apikey-test@example.com';
  });

  // ============================================================
  // SCENARIO 1: USER ID RESOLUTION VERIFICATION
  // ============================================================

  it('should resolve to same user_id for OAuth token and API key', async () => {
    // GIVEN: User exists in database
    const users = mockDB._getUsers();
    const user = users.get(testUserId);
    expect(user).toBeDefined();
    expect(user.email).toBe(testUserEmail);

    // AND: OAuth access token is created for user
    const oauthToken = 'oauth-token-test-123';
    const oauthTokenData: OAuthAccessToken = {
      access_token: oauthToken,
      token_type: 'Bearer',
      user_id: testUserId,
      client_id: 'test-client',
      scopes: ['read', 'write'],
      expires_at: Date.now() + (60 * 60 * 1000), // 1 hour
      created_at: Date.now(),
    };
    await mockOAuthKV.put(`access_token:${oauthToken}`, JSON.stringify(oauthTokenData));

    // AND: API key is generated for same user
    const apiKeyResult = await generateApiKey(env, testUserId, 'Integration Test Key');
    const apiKey = apiKeyResult.apiKey;
    expect(apiKey).toMatch(/^wtyk_[a-f0-9]{64}$/);

    // WHEN: Validate OAuth token
    const userIdFromOAuth = await validateOAuthToken(oauthToken, env);

    // AND: Validate API key
    const userIdFromApiKey = await validateApiKey(apiKey, env);

    // THEN: Both should return the same user_id
    expect(userIdFromOAuth).toBe(testUserId);
    expect(userIdFromApiKey).toBe(testUserId);
    expect(userIdFromOAuth).toBe(userIdFromApiKey);

    console.log('✅ OAuth and API key both resolve to user_id:', testUserId);
  });

  // ============================================================
  // SCENARIO 2: USERINFO ENDPOINT CONSISTENCY
  // ============================================================

  it('should return same user data from /oauth/userinfo for both auth methods', async () => {
    // GIVEN: OAuth token and API key for same user
    const oauthToken = 'oauth-token-test-456';
    const oauthTokenData: OAuthAccessToken = {
      access_token: oauthToken,
      token_type: 'Bearer',
      user_id: testUserId,
      client_id: 'test-client',
      scopes: ['read'],
      expires_at: Date.now() + (60 * 60 * 1000),
      created_at: Date.now(),
    };
    await mockOAuthKV.put(`access_token:${oauthToken}`, JSON.stringify(oauthTokenData));

    const apiKeyResult = await generateApiKey(env, testUserId, 'UserInfo Test Key');
    const apiKey = apiKeyResult.apiKey;

    // WHEN: Call /oauth/userinfo with OAuth token
    const oauthRequest = new Request('https://test.com/oauth/userinfo', {
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
      },
    });
    const oauthResponse = await handleUserInfoEndpoint(oauthRequest, env);
    const oauthData = await oauthResponse.json();

    // AND: Call /oauth/userinfo with API key
    const apiKeyRequest = new Request('https://test.com/oauth/userinfo', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    const apiKeyResponse = await handleUserInfoEndpoint(apiKeyRequest, env);
    const apiKeyData = await apiKeyResponse.json();

    // THEN: Both responses should be identical
    expect(oauthResponse.status).toBe(200);
    expect(apiKeyResponse.status).toBe(200);
    expect(oauthData.sub).toBe(testUserId);
    expect(apiKeyData.sub).toBe(testUserId);
    expect(oauthData.email).toBe(testUserEmail);
    expect(apiKeyData.email).toBe(testUserEmail);
    expect(oauthData.token_balance).toBe(1000);
    expect(apiKeyData.token_balance).toBe(1000);

    // Verify complete data structure match
    expect(oauthData).toEqual(apiKeyData);

    console.log('✅ Both auth methods return identical user data:', oauthData);
  });

  // ============================================================
  // SCENARIO 3: TOKEN DEDUCTION FROM SAME ACCOUNT
  // ============================================================

  it('should deduct tokens from same account for both auth methods', async () => {
    // GIVEN: OAuth token and API key for same user
    const oauthToken = 'oauth-token-test-789';
    const oauthTokenData: OAuthAccessToken = {
      access_token: oauthToken,
      token_type: 'Bearer',
      user_id: testUserId,
      client_id: 'test-client',
      scopes: ['read', 'write'],
      expires_at: Date.now() + (60 * 60 * 1000),
      created_at: Date.now(),
    };
    await mockOAuthKV.put(`access_token:${oauthToken}`, JSON.stringify(oauthTokenData));

    const apiKeyResult = await generateApiKey(env, testUserId, 'Deduction Test Key');
    const apiKey = apiKeyResult.apiKey;

    // AND: User has initial balance of 1000 tokens
    const users = mockDB._getUsers();
    const user = users.get(testUserId);
    expect(user.current_token_balance).toBe(1000);

    // WHEN: Consume 100 tokens via OAuth authentication
    const userIdFromOAuth = await validateOAuthToken(oauthToken, env);
    expect(userIdFromOAuth).toBe(testUserId);

    const oauthConsumptionResult = await consumeTokens(
      mockDB,
      userIdFromOAuth!,
      100,
      'test-mcp-server',
      'oauth-test-tool',
      { test: 'oauth-params' },
      { result: 'oauth-success' },
      true,
      'oauth-action-001'
    );

    expect(oauthConsumptionResult.success).toBe(true);
    expect(oauthConsumptionResult.newBalance).toBe(900);

    // AND: Consume 150 tokens via API key authentication
    const userIdFromApiKey = await validateApiKey(apiKey, env);
    expect(userIdFromApiKey).toBe(testUserId);

    const apiKeyConsumptionResult = await consumeTokens(
      mockDB,
      userIdFromApiKey!,
      150,
      'test-mcp-server',
      'apikey-test-tool',
      { test: 'apikey-params' },
      { result: 'apikey-success' },
      true,
      'apikey-action-001'
    );

    expect(apiKeyConsumptionResult.success).toBe(true);
    expect(apiKeyConsumptionResult.newBalance).toBe(750);

    // THEN: Final balance should be 1000 - 100 - 150 = 750
    const finalUser = users.get(testUserId);
    expect(finalUser.current_token_balance).toBe(750);
    expect(finalUser.total_tokens_used).toBe(250);

    console.log('✅ Tokens deducted from same account:');
    console.log('   Initial: 1000 tokens');
    console.log('   After OAuth consumption: 900 tokens');
    console.log('   After API key consumption: 750 tokens');
    console.log('   Total used: 250 tokens');
  });

  // ============================================================
  // SCENARIO 4: TRANSACTION HISTORY VERIFICATION
  // ============================================================

  it('should log both deductions to same user transaction history', async () => {
    // GIVEN: OAuth token and API key for same user
    const oauthToken = 'oauth-token-test-history';
    const oauthTokenData: OAuthAccessToken = {
      access_token: oauthToken,
      token_type: 'Bearer',
      user_id: testUserId,
      client_id: 'test-client',
      scopes: ['read'],
      expires_at: Date.now() + (60 * 60 * 1000),
      created_at: Date.now(),
    };
    await mockOAuthKV.put(`access_token:${oauthToken}`, JSON.stringify(oauthTokenData));

    const apiKeyResult = await generateApiKey(env, testUserId, 'History Test Key');
    const apiKey = apiKeyResult.apiKey;

    // WHEN: Perform consumption via both methods
    const userIdFromOAuth = await validateOAuthToken(oauthToken, env);
    await consumeTokens(
      mockDB,
      userIdFromOAuth!,
      50,
      'test-mcp-server',
      'tool-1',
      {},
      {},
      true,
      'history-action-001'
    );

    const userIdFromApiKey = await validateApiKey(apiKey, env);
    await consumeTokens(
      mockDB,
      userIdFromApiKey!,
      75,
      'test-mcp-server',
      'tool-2',
      {},
      {},
      true,
      'history-action-002'
    );

    // THEN: Both transactions should be in same user's history
    const transactions = mockDB._getTransactions();
    const userTransactions = Array.from(transactions.values()).filter(
      (t: any) => t.user_id === testUserId
    );

    expect(userTransactions.length).toBe(2);
    expect(userTransactions[0].user_id).toBe(testUserId);
    expect(userTransactions[1].user_id).toBe(testUserId);
    expect(userTransactions[0].token_amount).toBe(-50);
    expect(userTransactions[1].token_amount).toBe(-75);

    // AND: Both MCP actions should be logged for same user
    const mcpActions = mockDB._getMcpActions();
    const userActions = Array.from(mcpActions.values()).filter(
      (a: any) => a.user_id === testUserId
    );

    expect(userActions.length).toBe(2);
    expect(userActions[0].user_id).toBe(testUserId);
    expect(userActions[1].user_id).toBe(testUserId);
    expect(userActions[0].tokens_consumed).toBe(50);
    expect(userActions[1].tokens_consumed).toBe(75);

    console.log('✅ Transaction history verification:');
    console.log('   Total transactions for user:', userTransactions.length);
    console.log('   Total MCP actions for user:', userActions.length);
    console.log('   All transactions belong to same user_id:', testUserId);
  });
});
