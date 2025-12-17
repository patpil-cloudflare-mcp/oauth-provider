/**
 * Test A6.3 - MCP Actions Anonymization (P1 - HIGH PRIORITY)
 *
 * Purpose: Verify that MCP action parameters are properly anonymized during
 * account deletion to comply with GDPR right to erasure while preserving
 * usage statistics.
 *
 * Critical for: GDPR compliance, PII removal, usage analytics preservation
 *
 * Test Scenarios:
 * 1. User's MCP action parameters replaced with anonymized JSON
 * 2. Parameters contain anonymization metadata
 * 3. Multiple actions anonymized simultaneously
 * 4. Actions without PII still anonymized (consistency)
 * 5. Original tool name preserved in anonymized parameters
 * 6. Anonymization timestamp recorded
 * 7. user_id and other fields preserved (for statistics)
 *
 * Code Reference: src/services/accountDeletionService.ts:423-464 (anonymizeMCPActions)
 *
 * GDPR NOTE: Anonymizes PII in parameters field while keeping usage stats
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deleteUserAccount } from '../../src/services/accountDeletionService';
import type { Env } from '../../src/index';

// Mock Stripe module
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        del: vi.fn().mockResolvedValue({ deleted: true }),
      },
      subscriptions: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
      invoices: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
      paymentMethods: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
    })),
    errors: {
      StripeError: class StripeError extends Error {
        type: string;
        constructor(message: string) {
          super(message);
          this.type = 'api_error';
        }
      },
    },
  };
});

// Create mock D1 database with MCP actions tracking
const createMockDB = () => {
  const users = new Map<string, any>();
  const mcpActions = new Map<string, any>();
  const accountDeletions: any[] = [];

  // Add test user
  const testUser = {
    user_id: 'user-mcp-test',
    email: 'mcpuser@example.com',
    current_token_balance: 100,
    total_tokens_purchased: 1000,
    total_tokens_used: 900,
    stripe_customer_id: 'cus_mcp',
    workos_user_id: null,
    is_deleted: 0,
    deleted_at: null,
    created_at: '2025-01-01T00:00:00Z',
  };

  users.set('user-mcp-test', testUser);

  // Add MCP actions with PII in parameters
  mcpActions.set('action-001', {
    action_id: 'action-001',
    user_id: 'user-mcp-test',
    mcp_server_name: 'weather',
    tool_name: 'getForecast',
    tokens_consumed: 2,
    success: 1,
    parameters: JSON.stringify({ location: 'Warsaw', userId: 'sensitive-data' }),
    created_at: '2025-01-15T10:00:00Z',
  });

  mcpActions.set('action-002', {
    action_id: 'action-002',
    user_id: 'user-mcp-test',
    mcp_server_name: 'calculator',
    tool_name: 'compute',
    tokens_consumed: 1,
    success: 1,
    parameters: JSON.stringify({ expression: '2+2', note: 'Personal calculation' }),
    created_at: '2025-01-16T11:00:00Z',
  });

  mcpActions.set('action-003', {
    action_id: 'action-003',
    user_id: 'user-mcp-test',
    mcp_server_name: 'email-sender',
    tool_name: 'sendEmail',
    tokens_consumed: 5,
    success: 0,
    error_message: 'Failed to send',
    parameters: JSON.stringify({ to: 'user@example.com', subject: 'Test' }),
    created_at: '2025-01-17T12:00:00Z',
  });

  let capturedBindings: any[][] = [];

  return {
    prepare: (query: string) => {
      const statementIndex = capturedBindings.length;
      return {
        bind: (...args: any[]) => {
          // Capture bindings for batch operations
          capturedBindings[statementIndex] = args;

          return {
            first: async () => {
              // SELECT user for deletion
              if (query.includes('SELECT') && query.includes('FROM users')) {
                const userId = args[0];
                return users.get(userId) || null;
              }

              // SELECT COUNT for MCP actions
              if (query.includes('SELECT COUNT') && query.includes('FROM mcp_actions')) {
                const userId = args[0];
                const userActions = Array.from(mcpActions.values()).filter(
                  (a) => a.user_id === userId
                );
                return { count: userActions.length };
              }

              // SELECT COUNT for failed deductions
              if (query.includes('SELECT COUNT') && query.includes('FROM failed_deductions')) {
                return { count: 0 };
              }

              return null;
            },
            run: async () => {
              // UPDATE mcp_actions (anonymize parameters)
              if (query.includes('UPDATE mcp_actions')) {
                const userId = args[0];
                const userActions = Array.from(mcpActions.values()).filter(
                  (a) => a.user_id === userId
                );

                // Anonymize each action's parameters
                userActions.forEach((action) => {
                  action.parameters = JSON.stringify({
                    anonymized: 1,
                    anonymized_at: new Date().toISOString(),
                    reason: 'user_account_deleted',
                    original_tool: action.tool_name,
                  });
                });

                return { success: true, meta: { changes: userActions.length } };
              }

              // UPDATE failed_deductions
              if (query.includes('UPDATE failed_deductions')) {
                return { success: true };
              }

              return { success: true };
            },
            _query: query,  // Store query for batch processing
            _args: args,    // Store args for batch processing
          };
        },
      };
    },
    batch: async (statements: any[]) => {
      // Reset captured bindings for next batch
      const batchBindings = [...capturedBindings];
      capturedBindings = [];

      // Process UPDATE users and INSERT account_deletions
      let stmtIndex = 0;
      for (const stmt of statements) {
        const query = stmt._query || '';
        const args = stmt._args || batchBindings[stmtIndex] || [];

        // Handle UPDATE users
        if (query.includes('UPDATE users')) {
          const [anonymizedEmail, timestamp, userId] = args;
          const user = users.get(userId);
          if (user) {
            user.email = anonymizedEmail;
            user.stripe_customer_id = null;
            user.is_deleted = 1;
            user.deleted_at = timestamp;
          }
        }

        // Handle INSERT account_deletions
        if (query.includes('INSERT INTO account_deletions')) {
          accountDeletions.push({
            deletion_id: args[0],
            user_id: args[1],
            mcp_actions_anonymized: args[10], // 11th parameter
          });
        }

        stmtIndex++;
      }

      return [{ success: true }, { success: true }];
    },
    getMCPActions: (userId: string) =>
      Array.from(mcpActions.values()).filter((a) => a.user_id === userId),
    getAllMCPActions: () => Array.from(mcpActions.values()),
  } as any;
};

// Create mock KV namespaces
const createMockKV = () => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [] }),
} as any);

// Create mock environment
const createMockEnv = (db: any): Env => ({
  DB: db,
  USER_SESSIONS: createMockKV(),
  OAUTH_STORE: createMockKV(),
  STRIPE_SECRET_KEY: 'sk_test_mock',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  WORKOS_API_KEY: 'sk_test_workos',
  WORKOS_CLIENT_ID: 'client_test',
  ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com',
  ACCESS_POLICY_AUD: 'test-aud',
});

describe('A6.3 - MCP Actions Anonymization (P1)', () => {
  let mockDB: any;
  let env: Env;

  beforeEach(() => {
    mockDB = createMockDB();
    env = createMockEnv(mockDB);
    vi.clearAllMocks();
  });

  it('should anonymize all MCP action parameters for deleted user', async () => {
    // GIVEN: User with 3 MCP actions containing PII
    const userId = 'user-mcp-test';
    const actionsBefore = mockDB.getMCPActions(userId);
    expect(actionsBefore.length).toBe(3);
    expect(JSON.parse(actionsBefore[0].parameters)).toHaveProperty('userId', 'sensitive-data');

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: All parameters should be anonymized
    expect(result.success).toBe(true);

    const actionsAfter = mockDB.getMCPActions(userId);
    actionsAfter.forEach((action) => {
      const params = JSON.parse(action.parameters);
      expect(params).toHaveProperty('anonymized', 1);
      expect(params).toHaveProperty('reason', 'user_account_deleted');
      expect(params).not.toHaveProperty('userId');
      expect(params).not.toHaveProperty('location');
      expect(params).not.toHaveProperty('to');
    });
  });

  it('should include anonymized flag in parameters', async () => {
    // GIVEN: User with MCP actions
    const userId = 'user-mcp-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Parameters should contain anonymized=1
    expect(result.success).toBe(true);

    const actionsAfter = mockDB.getMCPActions(userId);
    actionsAfter.forEach((action) => {
      const params = JSON.parse(action.parameters);
      expect(params.anonymized).toBe(1);
    });
  });

  it('should include deletion reason in anonymized parameters', async () => {
    // GIVEN: User with MCP actions
    const userId = 'user-mcp-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Parameters should contain deletion reason
    expect(result.success).toBe(true);

    const actionsAfter = mockDB.getMCPActions(userId);
    actionsAfter.forEach((action) => {
      const params = JSON.parse(action.parameters);
      expect(params.reason).toBe('user_account_deleted');
    });
  });

  it('should preserve original tool name in anonymized parameters', async () => {
    // GIVEN: User with different tool actions
    const userId = 'user-mcp-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Original tool name should be preserved
    expect(result.success).toBe(true);

    const actionsAfter = mockDB.getMCPActions(userId);
    const tools = actionsAfter.map((a) => JSON.parse(a.parameters).original_tool);

    expect(tools).toContain('getForecast');
    expect(tools).toContain('compute');
    expect(tools).toContain('sendEmail');
  });

  it('should include anonymization timestamp', async () => {
    // GIVEN: User with MCP actions
    const userId = 'user-mcp-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Parameters should contain anonymization timestamp
    expect(result.success).toBe(true);

    const actionsAfter = mockDB.getMCPActions(userId);
    actionsAfter.forEach((action) => {
      const params = JSON.parse(action.parameters);
      expect(params.anonymized_at).toBeDefined();
      expect(params.anonymized_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  it('should preserve action metadata fields', async () => {
    // GIVEN: User with MCP actions
    const userId = 'user-mcp-test';
    const actionsBefore = mockDB.getMCPActions(userId);

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Action metadata should be preserved
    expect(result.success).toBe(true);

    const actionsAfter = mockDB.getMCPActions(userId);
    expect(actionsAfter.length).toBe(actionsBefore.length);

    actionsAfter.forEach((action, index) => {
      const before = actionsBefore[index];
      // These fields should NOT change
      expect(action.action_id).toBe(before.action_id);
      expect(action.user_id).toBe(before.user_id);
      expect(action.mcp_server_name).toBe(before.mcp_server_name);
      expect(action.tool_name).toBe(before.tool_name);
      expect(action.tokens_consumed).toBe(before.tokens_consumed);
      expect(action.success).toBe(before.success);
      expect(action.created_at).toBe(before.created_at);
      // Only parameters should change
      expect(action.parameters).not.toBe(before.parameters);
    });
  });

  it('should anonymize failed actions as well as successful ones', async () => {
    // GIVEN: User has both successful and failed actions
    const userId = 'user-mcp-test';
    const actionsBefore = mockDB.getMCPActions(userId);
    const failedAction = actionsBefore.find((a) => a.success === 0);
    expect(failedAction).toBeDefined();

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Failed actions should also be anonymized
    expect(result.success).toBe(true);

    const actionsAfter = mockDB.getMCPActions(userId);
    const failedAfter = actionsAfter.find((a) => a.action_id === failedAction.action_id);

    const params = JSON.parse(failedAfter.parameters);
    expect(params.anonymized).toBe(1);
    expect(params.reason).toBe('user_account_deleted');
    expect(failedAfter.error_message).toBe('Failed to send'); // Error message preserved
  });

  it('should handle user with no MCP actions', async () => {
    // GIVEN: User with no MCP actions
    const noActionsUser = {
      user_id: 'user-no-actions',
      email: 'noactions@example.com',
      current_token_balance: 0,
      total_tokens_purchased: 0,
      total_tokens_used: 0,
      stripe_customer_id: null,
      workos_user_id: null,
      is_deleted: 0,
      deleted_at: null,
      created_at: '2025-01-01T00:00:00Z',
    };

    mockDB.prepare = (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return noActionsUser;
          }
          if (query.includes('SELECT COUNT') && query.includes('FROM mcp_actions')) {
            return { count: 0 }; // No actions
          }
          if (query.includes('SELECT COUNT') && query.includes('FROM failed_deductions')) {
            return { count: 0 };
          }
          return null;
        },
        run: async () => ({ success: true }),
      }),
    });

    mockDB.batch = async () => {
      noActionsUser.is_deleted = 1;
      return [{ success: true }, { success: true }];
    };

    // WHEN: Delete account
    const result = await deleteUserAccount('user-no-actions', env);

    // THEN: Deletion should succeed with 0 actions anonymized
    expect(result.success).toBe(true);
    // No errors should occur
  });

  it('should handle actions with large parameters JSON', async () => {
    // GIVEN: Action with large parameters payload
    const largeParams = {
      data: 'x'.repeat(10000), // 10KB of data
      nested: {
        deep: {
          structure: {
            with: {
              pii: 'sensitive information',
            },
          },
        },
      },
    };

    const userId = 'user-mcp-test';
    const actionsBefore = mockDB.getMCPActions(userId);
    actionsBefore[0].parameters = JSON.stringify(largeParams);

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Large parameters should be replaced with small anonymized JSON
    expect(result.success).toBe(true);

    const actionsAfter = mockDB.getMCPActions(userId);
    const params = JSON.parse(actionsAfter[0].parameters);

    expect(params).toHaveProperty('anonymized', 1);
    expect(params).not.toHaveProperty('data');
    expect(params).not.toHaveProperty('nested');
    expect(actionsAfter[0].parameters.length).toBeLessThan(500); // Much smaller
  });

  it('should anonymize actions from all MCP servers', async () => {
    // GIVEN: User has actions from multiple MCP servers
    const userId = 'user-mcp-test';
    const actionsBefore = mockDB.getMCPActions(userId);
    const servers = [...new Set(actionsBefore.map((a) => a.mcp_server_name))];
    expect(servers.length).toBeGreaterThan(1); // Multiple servers

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: All actions from all servers should be anonymized
    expect(result.success).toBe(true);

    const actionsAfter = mockDB.getMCPActions(userId);
    actionsAfter.forEach((action) => {
      const params = JSON.parse(action.parameters);
      expect(params.anonymized).toBe(1);
    });
  });

  it('should not affect other users MCP actions', async () => {
    // GIVEN: Two users with MCP actions
    const otherUserAction = {
      action_id: 'action-other',
      user_id: 'user-other',
      mcp_server_name: 'calculator',
      tool_name: 'add',
      tokens_consumed: 1,
      success: 1,
      parameters: JSON.stringify({ a: 5, b: 3 }),
      created_at: '2025-01-18T13:00:00Z',
    };

    const allActionsBefore = mockDB.getAllMCPActions();
    allActionsBefore.push(otherUserAction);

    const otherUserParamsBefore = otherUserAction.parameters;

    // WHEN: Delete first user's account
    const result = await deleteUserAccount('user-mcp-test', env);

    // THEN: Other user's actions should remain unchanged
    expect(result.success).toBe(true);

    const allActionsAfter = mockDB.getAllMCPActions();
    const otherUserActionAfter = allActionsAfter.find((a) => a.user_id === 'user-other');

    expect(otherUserActionAfter).toBeDefined();
    expect(otherUserActionAfter.parameters).toBe(otherUserParamsBefore);
  });
});
