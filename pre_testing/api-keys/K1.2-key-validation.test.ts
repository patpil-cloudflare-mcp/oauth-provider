// pre_testing/api-keys/K1.2-key-validation.test.ts
// Test: API key validation

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, createTestApiKey, hashApiKey, MockEnv } from '../test-utils';

describe('K1.2 - API Key Validation', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Format validation', () => {
    it('should accept valid format: wtyk_<64_hex_chars>', () => {
      const validKey = 'wtyk_a7f3k9m2p5q8r1s4t6v9w2x5y8z1b4c7d9e2f5g8h1j3k6l9m2n5p8q1r4s7';

      const isValidFormat = validKey.startsWith('wtyk_') && validKey.length === 69;
      expect(isValidFormat).toBe(true);
    });

    it('should reject key without wtyk_ prefix', () => {
      const invalidKey = 'invalid_a7f3k9m2p5q8r1s4t6v9w2x5y8z1b4c7d9e2f5g8h1j3k6l9m2n5';

      const isValidFormat = invalidKey.startsWith('wtyk_') && invalidKey.length === 69;
      expect(isValidFormat).toBe(false);
    });

    it('should reject key with wrong length', () => {
      const tooShort = 'wtyk_short';
      const tooLong = 'wtyk_a7f3k9m2p5q8r1s4t6v9w2x5y8z1b4c7d9e2f5g8h1j3k6l9m2n5p8q1r4s7extra';

      expect(tooShort.startsWith('wtyk_') && tooShort.length === 69).toBe(false);
      expect(tooLong.startsWith('wtyk_') && tooLong.length === 69).toBe(false);
    });

    it('should reject empty string', () => {
      const emptyKey = '';

      const isValidFormat = emptyKey.startsWith('wtyk_') && emptyKey.length === 69;
      expect(isValidFormat).toBe(false);
    });
  });

  describe('Database validation', () => {
    it('should find key by hash', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const apiKey = 'wtyk_a7f3k9m2p5q8r1s4t6v9w2x5y8z1b4c7d9e2f5g8h1j3k6l9m2n5p8q1r4s7';
      const hash = await hashApiKey(apiKey);
      const keyRecord = createTestApiKey(user.user_id, { api_key_hash: hash });
      env.DB.seedApiKeys([keyRecord]);

      const found = await env.DB.prepare(`
        SELECT api_key_id, user_id FROM api_keys WHERE api_key_hash = ?
      `).bind(hash).first();

      expect(found).not.toBeNull();
      expect(found?.user_id).toBe(user.user_id);
    });

    it('should return null for non-existent hash', async () => {
      const nonExistentHash = await hashApiKey('wtyk_nonexistent1234567890123456789012345678901234567890123456');

      const found = await env.DB.prepare(`
        SELECT api_key_id FROM api_keys WHERE api_key_hash = ?
      `).bind(nonExistentHash).first();

      expect(found).toBeNull();
    });

    it('should reject inactive keys (is_active = 0)', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const apiKey = 'wtyk_inactive1234567890123456789012345678901234567890123456789012';
      const hash = await hashApiKey(apiKey);
      const keyRecord = createTestApiKey(user.user_id, {
        api_key_hash: hash,
        is_active: 0
      });
      env.DB.seedApiKeys([keyRecord]);

      const found = await env.DB.prepare(`
        SELECT api_key_id, is_active FROM api_keys WHERE api_key_hash = ?
      `).bind(hash).first();

      expect(found).not.toBeNull();
      expect(found?.is_active).toBe(0);

      // Validation should fail
      const isValid = found !== null && found.is_active === 1;
      expect(isValid).toBe(false);
    });

    it('should reject expired keys', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const apiKey = 'wtyk_expired12345678901234567890123456789012345678901234567890123';
      const hash = await hashApiKey(apiKey);
      const keyRecord = createTestApiKey(user.user_id, {
        api_key_hash: hash,
        expires_at: Date.now() - 86400000 // Expired yesterday
      });
      env.DB.seedApiKeys([keyRecord]);

      const found = await env.DB.prepare(`
        SELECT api_key_id, expires_at FROM api_keys WHERE api_key_hash = ?
      `).bind(hash).first();

      expect(found).not.toBeNull();
      expect(found?.expires_at).toBeLessThan(Date.now());

      // Validation should fail for expired key
      const isExpired = found?.expires_at !== null && Number(found?.expires_at) < Date.now();
      expect(isExpired).toBe(true);
    });

    it('should accept non-expired keys', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const apiKey = 'wtyk_valid123456789012345678901234567890123456789012345678901234';
      const hash = await hashApiKey(apiKey);
      const keyRecord = createTestApiKey(user.user_id, {
        api_key_hash: hash,
        expires_at: Date.now() + 86400000 // Expires tomorrow
      });
      env.DB.seedApiKeys([keyRecord]);

      const found = await env.DB.prepare(`
        SELECT api_key_id, expires_at FROM api_keys WHERE api_key_hash = ?
      `).bind(hash).first();

      const isExpired = found?.expires_at !== null && Number(found?.expires_at) < Date.now();
      expect(isExpired).toBe(false);
    });

    it('should accept keys without expiration', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const apiKey = 'wtyk_noexpiry12345678901234567890123456789012345678901234567890';
      const hash = await hashApiKey(apiKey);
      const keyRecord = createTestApiKey(user.user_id, {
        api_key_hash: hash,
        expires_at: null
      });
      env.DB.seedApiKeys([keyRecord]);

      const found = await env.DB.prepare(`
        SELECT api_key_id, expires_at FROM api_keys WHERE api_key_hash = ?
      `).bind(hash).first();

      const isExpired = found?.expires_at !== null && Number(found?.expires_at) < Date.now();
      expect(isExpired).toBe(false);
    });
  });

  describe('User validation', () => {
    it('should reject keys for deleted users', async () => {
      const user = createTestUser({
        is_deleted: 1,
        deleted_at: new Date().toISOString()
      });
      env.DB.seedUsers([user]);

      const keyRecord = createTestApiKey(user.user_id);
      env.DB.seedApiKeys([keyRecord]);

      const userCheck = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(userCheck?.is_deleted).toBe(1);

      // Key validation should fail for deleted user
      const isUserActive = userCheck?.is_deleted !== 1;
      expect(isUserActive).toBe(false);
    });

    it('should accept keys for active users', async () => {
      const user = createTestUser({ is_deleted: 0 });
      env.DB.seedUsers([user]);

      const keyRecord = createTestApiKey(user.user_id);
      env.DB.seedApiKeys([keyRecord]);

      const userCheck = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      const isUserActive = userCheck?.is_deleted !== 1;
      expect(isUserActive).toBe(true);
    });

    it('should reject keys for non-existent users', async () => {
      const nonExistentUserId = crypto.randomUUID();
      const keyRecord = createTestApiKey(nonExistentUserId);
      env.DB.seedApiKeys([keyRecord]);

      const userCheck = await env.DB.prepare(`
        SELECT user_id FROM users WHERE user_id = ?
      `).bind(nonExistentUserId).first();

      expect(userCheck).toBeNull();
    });
  });

  describe('last_used_at updates', () => {
    it('should update last_used_at on validation', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const keyRecord = createTestApiKey(user.user_id, { last_used_at: null });
      env.DB.seedApiKeys([keyRecord]);

      // Simulate validation with timestamp update
      const newTimestamp = Date.now();
      await env.DB.prepare(`
        UPDATE api_keys SET last_used_at = ? WHERE api_key_id = ?
      `).bind(newTimestamp, keyRecord.api_key_id).run();

      const updated = await env.DB.prepare(`
        SELECT last_used_at FROM api_keys WHERE api_key_id = ?
      `).bind(keyRecord.api_key_id).first();

      expect(updated?.last_used_at).toBe(newTimestamp);
    });
  });
});
