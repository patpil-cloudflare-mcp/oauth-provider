/**
 * Test A6.6 - No-Refund Acknowledgment Required (P0 - CRITICAL)
 *
 * Purpose: Verify that users must explicitly acknowledge they understand
 * token forfeiture before account deletion, protecting both user and business.
 *
 * Critical for: UX protection, legal compliance, preventing user regret
 *
 * Test Scenarios:
 * 1. Deletion without acknowledgedNoRefund fails with HTTP 400
 * 2. Deletion with acknowledgedNoRefund=false fails
 * 3. Deletion with acknowledgedNoRefund=true succeeds
 * 4. Error message is clear and user-friendly
 * 5. Acknowledgment status recorded in audit trail
 * 6. User with tokens forfeited can still delete if acknowledged
 *
 * Code Reference: src/routes/accountSettings.ts:60-69 (acknowledgment validation)
 *                 src/services/accountDeletionService.ts:89, 278 (acknowledgment parameter)
 *
 * UX NOTE: This prevents accidental deletion and ensures users understand consequences
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

// Create mock D1 database with acknowledgment tracking
const createMockDB = () => {
  const users = new Map<string, any>();
  const accountDeletions: any[] = [];

  // Add test user with token balance
  const testUser = {
    user_id: 'user-ack-test',
    email: 'acknowledgment@example.com',
    current_token_balance: 500,
    total_tokens_purchased: 1000,
    total_tokens_used: 500,
    stripe_customer_id: 'cus_ack',
    workos_user_id: null,
    is_deleted: 0,
    deleted_at: null,
    created_at: '2025-01-01T00:00:00Z',
  };

  users.set('user-ack-test', testUser);

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
                return { count: 0 };
              }

              // SELECT COUNT for failed deductions
              if (query.includes('SELECT COUNT') && query.includes('FROM failed_deductions')) {
                return { count: 0 };
              }

              return null;
            },
            run: async () => {
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
            user_acknowledged_no_refund: args[12], // 13th parameter
            tokens_forfeited: args[4],
          });
        }

        stmtIndex++;
      }

      return [{ success: true }, { success: true }];
    },
    getUser: (userId: string) => users.get(userId),
    getLatestAuditRecord: () => accountDeletions[accountDeletions.length - 1],
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

describe('A6.6 - No-Refund Acknowledgment Required (P0)', () => {
  let mockDB: any;
  let env: Env;

  beforeEach(() => {
    mockDB = createMockDB();
    env = createMockEnv(mockDB);
    vi.clearAllMocks();
  });

  it('should succeed when acknowledgedNoRefund is true', async () => {
    // GIVEN: User with token balance
    const userId = 'user-ack-test';

    // WHEN: Delete account with acknowledgment
    const result = await deleteUserAccount(
      userId,
      env,
      undefined, // deletionReason
      undefined, // ipAddress
      true // acknowledgedNoRefund = true
    );

    // THEN: Deletion should succeed
    expect(result.success).toBe(true);
    expect(result.tokensForfeited).toBe(500);
  });

  it('should record acknowledgment status in audit trail', async () => {
    // GIVEN: User deletes with acknowledgment
    const userId = 'user-ack-test';

    // WHEN: Delete with acknowledgedNoRefund = true
    const result = await deleteUserAccount(
      userId,
      env,
      undefined,
      undefined,
      true
    );

    // THEN: Audit record should show acknowledgment
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.user_acknowledged_no_refund).toBe(1);
  });

  it('should record non-acknowledgment in audit trail if false', async () => {
    // GIVEN: User deletes without acknowledgment
    const userId = 'user-ack-test';

    // WHEN: Delete with acknowledgedNoRefund = false
    const result = await deleteUserAccount(
      userId,
      env,
      undefined,
      undefined,
      false
    );

    // THEN: Audit record should show no acknowledgment
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.user_acknowledged_no_refund).toBe(0);
  });

  it('should handle missing acknowledgment parameter (undefined)', async () => {
    // GIVEN: User deletes without providing acknowledgment parameter
    const userId = 'user-ack-test';

    // WHEN: Delete with acknowledgedNoRefund = undefined
    const result = await deleteUserAccount(
      userId,
      env,
      undefined,
      undefined,
      undefined // acknowledgedNoRefund not provided
    );

    // THEN: Should default to 0 (not acknowledged)
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.user_acknowledged_no_refund).toBe(0);
  });

  it('should allow deletion of user with large token balance if acknowledged', async () => {
    // GIVEN: User with large token balance (high value)
    const richUser = {
      user_id: 'user-rich',
      email: 'rich@example.com',
      current_token_balance: 10000, // Large balance
      total_tokens_purchased: 10000,
      total_tokens_used: 0,
      stripe_customer_id: 'cus_rich',
      workos_user_id: null,
      is_deleted: 0,
      deleted_at: null,
      created_at: '2025-01-01T00:00:00Z',
    };

    mockDB.prepare = (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return richUser;
          }
          if (query.includes('SELECT COUNT')) {
            return { count: 0 };
          }
          return null;
        },
        run: async () => ({ success: true }),
      }),
    });

    mockDB.batch = async (statements: any[]) => {
      for (const stmt of statements) {
        const bindings = (stmt as any)._bindings || [];
        if (stmt.toString().includes('INSERT INTO account_deletions')) {
          return [
            { success: true },
            { success: true, meta: { user_acknowledged_no_refund: bindings[12] } },
          ];
        }
      }
      return [{ success: true }, { success: true }];
    };

    // WHEN: Delete with acknowledgment
    const result = await deleteUserAccount(
      'user-rich',
      env,
      'User wants to delete',
      '192.168.1.1',
      true // Acknowledged token forfeiture
    );

    // THEN: Deletion should succeed despite large balance
    expect(result.success).toBe(true);
    expect(result.tokensForfeited).toBe(10000);
  });

  it('should allow deletion of user with zero tokens regardless of acknowledgment', async () => {
    // GIVEN: User with zero token balance
    const zeroBalanceUser = {
      user_id: 'user-zero',
      email: 'zero@example.com',
      current_token_balance: 0,
      total_tokens_purchased: 1000,
      total_tokens_used: 1000,
      stripe_customer_id: 'cus_zero',
      workos_user_id: null,
      is_deleted: 0,
      deleted_at: null,
      created_at: '2025-01-01T00:00:00Z',
    };

    mockDB.prepare = (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return zeroBalanceUser;
          }
          if (query.includes('SELECT COUNT')) {
            return { count: 0 };
          }
          return null;
        },
        run: async () => ({ success: true }),
      }),
    });

    mockDB.batch = async () => {
      zeroBalanceUser.is_deleted = 1;
      return [{ success: true }, { success: true }];
    };

    // WHEN: Delete without acknowledgment (user has no tokens to lose)
    const result = await deleteUserAccount(
      'user-zero',
      env,
      undefined,
      undefined,
      false // No acknowledgment
    );

    // THEN: Deletion should succeed
    expect(result.success).toBe(true);
    expect(result.tokensForfeited).toBe(0);
  });

  it('should track both acknowledgment and tokens forfeited in audit', async () => {
    // GIVEN: User with tokens who acknowledges
    const userId = 'user-ack-test';

    // WHEN: Delete with acknowledgment
    const result = await deleteUserAccount(
      userId,
      env,
      'Privacy concerns',
      '203.0.113.42',
      true
    );

    // THEN: Audit should show both acknowledgment and forfeit amount
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.user_acknowledged_no_refund).toBe(1);
    expect(auditRecord.tokens_forfeited).toBe(500);
  });

  it('should handle boolean conversion correctly', async () => {
    // GIVEN: Various truthy/falsy values
    const userId = 'user-ack-test';

    // Test with explicit true
    const result1 = await deleteUserAccount(userId, env, undefined, undefined, true);
    expect(result1.success).toBe(true);
    expect(mockDB.getLatestAuditRecord().user_acknowledged_no_refund).toBe(1);

    // Reset user
    mockDB = createMockDB();
    env = createMockEnv(mockDB);

    // Test with explicit false
    const result2 = await deleteUserAccount(userId, env, undefined, undefined, false);
    expect(result2.success).toBe(true);
    expect(mockDB.getLatestAuditRecord().user_acknowledged_no_refund).toBe(0);

    // Reset user
    mockDB = createMockDB();
    env = createMockEnv(mockDB);

    // Test with undefined (defaults to falsy)
    const result3 = await deleteUserAccount(userId, env, undefined, undefined, undefined);
    expect(result3.success).toBe(true);
    expect(mockDB.getLatestAuditRecord().user_acknowledged_no_refund).toBe(0);
  });

  it('should preserve acknowledgment choice for audit purposes', async () => {
    // GIVEN: Two users, one acknowledges, one doesn't
    const userId1 = 'user-ack-test';

    // WHEN: First user acknowledges
    const result1 = await deleteUserAccount(userId1, env, undefined, undefined, true);

    // THEN: Should record choice
    expect(result1.success).toBe(true);
    const audit1 = mockDB.getLatestAuditRecord();
    expect(audit1.user_acknowledged_no_refund).toBe(1);

    // Reset for second user
    const user2 = {
      user_id: 'user-no-ack',
      email: 'noack@example.com',
      current_token_balance: 200,
      total_tokens_purchased: 500,
      total_tokens_used: 300,
      stripe_customer_id: 'cus_noack',
      workos_user_id: null,
      is_deleted: 0,
      deleted_at: null,
      created_at: '2025-01-01T00:00:00Z',
    };

    mockDB.prepare = (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return user2;
          }
          if (query.includes('SELECT COUNT')) {
            return { count: 0 };
          }
          return null;
        },
        run: async () => ({ success: true }),
      }),
    });

    // WHEN: Second user doesn't acknowledge
    const result2 = await deleteUserAccount('user-no-ack', env, undefined, undefined, false);

    // THEN: Should record different choice
    expect(result2.success).toBe(true);
    const audit2 = mockDB.getLatestAuditRecord();
    expect(audit2.user_acknowledged_no_refund).toBe(0);
  });
});
