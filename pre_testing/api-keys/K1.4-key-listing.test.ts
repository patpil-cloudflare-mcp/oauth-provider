// pre_testing/api-keys/K1.4-key-listing.test.ts
// Test: API key listing for users

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, createTestApiKey, MockEnv } from '../test-utils';

describe('K1.4 - API Key Listing', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should list all keys for a user', async () => {
    const user = createTestUser();
    const keys = [
      createTestApiKey(user.user_id, { name: 'Key 1' }),
      createTestApiKey(user.user_id, { name: 'Key 2' }),
      createTestApiKey(user.user_id, { name: 'Key 3' }),
    ];

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys(keys);

    const result = await env.DB.prepare(`
      SELECT api_key_id, name, key_prefix, created_at, is_active
      FROM api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.user_id).all();

    expect(result.results.length).toBe(3);
  });

  it('should not expose api_key_hash in listing', async () => {
    const user = createTestUser();
    const key = createTestApiKey(user.user_id);

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([key]);

    // Query without api_key_hash
    const result = await env.DB.prepare(`
      SELECT api_key_id, name, key_prefix, created_at, is_active, last_used_at, expires_at
      FROM api_keys
      WHERE user_id = ?
    `).bind(user.user_id).first();

    expect(result).not.toHaveProperty('api_key_hash');
  });

  it('should show key_prefix for identification', async () => {
    const user = createTestUser();
    const key = createTestApiKey(user.user_id, { key_prefix: 'wtyk_testprefix1' });

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([key]);

    const result = await env.DB.prepare(`
      SELECT key_prefix FROM api_keys WHERE user_id = ?
    `).bind(user.user_id).first();

    expect(result?.key_prefix).toBe('wtyk_testprefix1');
    expect((result?.key_prefix as string).length).toBe(16);
  });

  it('should only list keys owned by the user', async () => {
    const user1 = createTestUser({ email: 'user1@example.com' });
    const user2 = createTestUser({ email: 'user2@example.com' });

    const key1 = createTestApiKey(user1.user_id, { name: 'User1 Key' });
    const key2 = createTestApiKey(user2.user_id, { name: 'User2 Key' });

    env.DB.seedUsers([user1, user2]);
    env.DB.seedApiKeys([key1, key2]);

    // User1 should only see their key
    const user1Keys = await env.DB.prepare(`
      SELECT name FROM api_keys WHERE user_id = ?
    `).bind(user1.user_id).all();

    expect(user1Keys.results.length).toBe(1);
    expect(user1Keys.results[0].name).toBe('User1 Key');
  });

  it('should include both active and inactive keys', async () => {
    const user = createTestUser();
    const activeKey = createTestApiKey(user.user_id, { name: 'Active', is_active: 1 });
    const inactiveKey = createTestApiKey(user.user_id, { name: 'Inactive', is_active: 0 });

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([activeKey, inactiveKey]);

    const result = await env.DB.prepare(`
      SELECT name, is_active FROM api_keys WHERE user_id = ?
    `).bind(user.user_id).all();

    expect(result.results.length).toBe(2);

    const active = result.results.find((k: Record<string, unknown>) => k.name === 'Active');
    const inactive = result.results.find((k: Record<string, unknown>) => k.name === 'Inactive');

    expect(active?.is_active).toBe(1);
    expect(inactive?.is_active).toBe(0);
  });

  it('should show last_used_at timestamp', async () => {
    const user = createTestUser();
    const usedKey = createTestApiKey(user.user_id, {
      name: 'Used Key',
      last_used_at: Date.now() - 3600000 // 1 hour ago
    });
    const unusedKey = createTestApiKey(user.user_id, {
      name: 'Unused Key',
      last_used_at: null
    });

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([usedKey, unusedKey]);

    const result = await env.DB.prepare(`
      SELECT name, last_used_at FROM api_keys WHERE user_id = ?
    `).bind(user.user_id).all();

    const used = result.results.find((k: Record<string, unknown>) => k.name === 'Used Key');
    const unused = result.results.find((k: Record<string, unknown>) => k.name === 'Unused Key');

    expect(used?.last_used_at).not.toBeNull();
    expect(unused?.last_used_at).toBeNull();
  });

  it('should show expires_at for time-limited keys', async () => {
    const user = createTestUser();
    const expiringKey = createTestApiKey(user.user_id, {
      name: 'Expiring',
      expires_at: Date.now() + 86400000 // 24 hours
    });
    const permanentKey = createTestApiKey(user.user_id, {
      name: 'Permanent',
      expires_at: null
    });

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([expiringKey, permanentKey]);

    const result = await env.DB.prepare(`
      SELECT name, expires_at FROM api_keys WHERE user_id = ?
    `).bind(user.user_id).all();

    const expiring = result.results.find((k: Record<string, unknown>) => k.name === 'Expiring');
    const permanent = result.results.find((k: Record<string, unknown>) => k.name === 'Permanent');

    expect(expiring?.expires_at).not.toBeNull();
    expect(permanent?.expires_at).toBeNull();
  });

  it('should order keys by created_at descending', async () => {
    const user = createTestUser();
    const oldKey = createTestApiKey(user.user_id, {
      name: 'Old Key',
      created_at: Date.now() - 86400000 // Yesterday
    });
    const newKey = createTestApiKey(user.user_id, {
      name: 'New Key',
      created_at: Date.now()
    });

    env.DB.seedUsers([user]);
    env.DB.seedApiKeys([oldKey, newKey]);

    const result = await env.DB.prepare(`
      SELECT name FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
    `).bind(user.user_id).all();

    expect(result.results[0].name).toBe('New Key');
    expect(result.results[1].name).toBe('Old Key');
  });

  it('should return empty array for user with no keys', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const result = await env.DB.prepare(`
      SELECT * FROM api_keys WHERE user_id = ?
    `).bind(user.user_id).all();

    expect(result.results.length).toBe(0);
  });
});
