// pre_testing/api-keys/K1.3-key-revocation.test.ts
// Test: API key revocation

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, createTestApiKey, MockEnv } from '../test-utils';

describe('K1.3 - API Key Revocation', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should set is_active to 0 on revocation', async () => {
    const user = createTestUser();
    const key = createTestApiKey(user.user_id, { is_active: 1 });

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([key]);

    // Revoke key
    await env.DB.prepare(`
      UPDATE api_keys SET is_active = 0 WHERE api_key_id = ? AND user_id = ?
    `).bind(key.api_key_id, user.user_id).run();

    const result = await env.DB.prepare(`
      SELECT is_active FROM api_keys WHERE api_key_id = ?
    `).bind(key.api_key_id).first();

    expect(result?.is_active).toBe(0);
  });

  it('should only allow owner to revoke their key', async () => {
    const owner = createTestUser({ email: 'owner@example.com' });
    const attacker = createTestUser({ email: 'attacker@example.com' });
    const key = createTestApiKey(owner.user_id);

    env.DB.seedUsers([owner, attacker]);
    env.DB.seedApiKeys([key]);

    // Attacker tries to revoke owner's key
    const result = await env.DB.prepare(`
      UPDATE api_keys SET is_active = 0 WHERE api_key_id = ? AND user_id = ?
    `).bind(key.api_key_id, attacker.user_id).run();

    expect(result.meta.changes).toBe(0);

    // Key should still be active
    const keyStatus = await env.DB.prepare(`
      SELECT is_active FROM api_keys WHERE api_key_id = ?
    `).bind(key.api_key_id).first();

    expect(keyStatus?.is_active).toBe(1);
  });

  it('should return success when owner revokes key', async () => {
    const user = createTestUser();
    const key = createTestApiKey(user.user_id);

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([key]);

    const result = await env.DB.prepare(`
      UPDATE api_keys SET is_active = 0 WHERE api_key_id = ? AND user_id = ?
    `).bind(key.api_key_id, user.user_id).run();

    expect(result.meta.changes).toBe(1);
    expect(result.success).toBe(true);
  });

  it('should return failure for non-existent key', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const result = await env.DB.prepare(`
      UPDATE api_keys SET is_active = 0 WHERE api_key_id = ? AND user_id = ?
    `).bind(crypto.randomUUID(), user.user_id).run();

    expect(result.meta.changes).toBe(0);
  });

  it('should preserve key data after revocation (soft delete)', async () => {
    const user = createTestUser();
    const key = createTestApiKey(user.user_id, {
      name: 'Preserved Key',
      key_prefix: 'wtyk_preserved'
    });

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([key]);

    // Revoke key
    await env.DB.prepare(`
      UPDATE api_keys SET is_active = 0 WHERE api_key_id = ?
    `).bind(key.api_key_id).run();

    // Data should still exist
    const result = await env.DB.prepare(`
      SELECT name, key_prefix, api_key_hash FROM api_keys WHERE api_key_id = ?
    `).bind(key.api_key_id).first();

    expect(result?.name).toBe('Preserved Key');
    expect(result?.key_prefix).toBe('wtyk_preserved');
    expect(result?.api_key_hash).toBe(key.api_key_hash);
  });

  it('should allow re-revocation of already revoked key (idempotent)', async () => {
    const user = createTestUser();
    const key = createTestApiKey(user.user_id, { is_active: 0 });

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([key]);

    // Try to revoke already revoked key
    const result = await env.DB.prepare(`
      UPDATE api_keys SET is_active = 0 WHERE api_key_id = ? AND user_id = ?
    `).bind(key.api_key_id, user.user_id).run();

    // Changes might be 1 (value updated) or 0 (no actual change)
    // Either way, is_active should be 0
    const keyStatus = await env.DB.prepare(`
      SELECT is_active FROM api_keys WHERE api_key_id = ?
    `).bind(key.api_key_id).first();

    expect(keyStatus?.is_active).toBe(0);
  });

  it('should prevent revoked key from being used', async () => {
    const user = createTestUser();
    const key = createTestApiKey(user.user_id, { is_active: 0 });

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([key]);

    // Validation check
    const keyCheck = await env.DB.prepare(`
      SELECT is_active FROM api_keys WHERE api_key_id = ?
    `).bind(key.api_key_id).first();

    const isValid = keyCheck?.is_active === 1;
    expect(isValid).toBe(false);
  });

  it('should revoke all keys for a user', async () => {
    const user = createTestUser();
    const keys = [
      createTestApiKey(user.user_id, { name: 'Key 1' }),
      createTestApiKey(user.user_id, { name: 'Key 2' }),
      createTestApiKey(user.user_id, { name: 'Key 3' }),
    ];

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys(keys);

    // Revoke all user's keys
    const result = await env.DB.prepare(`
      UPDATE api_keys SET is_active = 0 WHERE user_id = ?
    `).bind(user.user_id).run();

    expect(result.meta.changes).toBe(3);

    // Verify all keys are revoked
    const activeKeys = await env.DB.prepare(`
      SELECT * FROM api_keys WHERE user_id = ? AND is_active = 1
    `).bind(user.user_id).all();

    expect(activeKeys.results.length).toBe(0);
  });
});
