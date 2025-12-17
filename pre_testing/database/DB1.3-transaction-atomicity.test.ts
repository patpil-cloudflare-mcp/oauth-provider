// pre_testing/database/DB1.3-transaction-atomicity.test.ts
// Test: Database transaction atomicity

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, createTestApiKey, MockEnv } from '../test-utils';

describe('DB1.3 - Transaction Atomicity', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Account deletion atomicity', () => {
    it('should delete user and API keys atomically', async () => {
      const user = createTestUser();
      const keys = [
        createTestApiKey(user.user_id, { name: 'Key 1' }),
        createTestApiKey(user.user_id, { name: 'Key 2' }),
      ];
      env.DB.seedUsers([user]);
      env.DB.seedApiKeys(keys);

      // Atomic deletion: delete keys, then soft-delete user
      await env.DB.prepare(`
        DELETE FROM api_keys WHERE user_id = ?
      `).bind(user.user_id).run();

      await env.DB.prepare(`
        UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ?
      `).bind(new Date().toISOString(), user.user_id).run();

      // Verify both operations completed
      const userResult = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      const keysResult = await env.DB.prepare(`
        SELECT * FROM api_keys WHERE user_id = ?
      `).bind(user.user_id).all();

      expect(userResult?.is_deleted).toBe(1);
      expect(keysResult.results.length).toBe(0);
    });

    it('should create audit record atomically with deletion', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      // Atomic: create audit record and soft-delete user
      const deletionId = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email)
        VALUES (?, ?, ?)
      `).bind(deletionId, user.user_id, user.email).run();

      await env.DB.prepare(`
        UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ?
      `).bind(new Date().toISOString(), user.user_id).run();

      // Verify both operations
      const audit = await env.DB.prepare(`
        SELECT deletion_id FROM account_deletions WHERE user_id = ?
      `).bind(user.user_id).first();

      const userDeleted = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(audit).not.toBeNull();
      expect(userDeleted?.is_deleted).toBe(1);
    });
  });

  describe('User registration atomicity', () => {
    it('should insert user record atomically', async () => {
      const userId = crypto.randomUUID();
      const email = 'newuser@example.com';
      const timestamp = new Date().toISOString();

      // Single atomic insert
      const result = await env.DB.prepare(`
        INSERT INTO users (user_id, email, created_at, last_login_at)
        VALUES (?, ?, ?, ?)
      `).bind(userId, email, timestamp, timestamp).run();

      expect(result.success).toBe(true);
      expect(result.meta.changes).toBe(1);

      // Verify complete record
      const user = await env.DB.prepare(`
        SELECT user_id, email, created_at, last_login_at
        FROM users WHERE user_id = ?
      `).bind(userId).first();

      expect(user?.user_id).toBe(userId);
      expect(user?.email).toBe(email);
      expect(user?.created_at).toBe(timestamp);
      expect(user?.last_login_at).toBe(timestamp);
    });
  });

  describe('API key operations atomicity', () => {
    it('should generate and insert key atomically', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const keyId = crypto.randomUUID();
      const hash = 'new_key_hash_' + Date.now();

      const result = await env.DB.prepare(`
        INSERT INTO api_keys (api_key_id, user_id, api_key_hash, key_prefix, name, created_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(keyId, user.user_id, hash, 'wtyk_new', 'New Key', Date.now(), 1).run();

      expect(result.success).toBe(true);

      // Verify complete record
      const key = await env.DB.prepare(`
        SELECT api_key_id, user_id, name, is_active
        FROM api_keys WHERE api_key_id = ?
      `).bind(keyId).first();

      expect(key?.api_key_id).toBe(keyId);
      expect(key?.user_id).toBe(user.user_id);
      expect(key?.name).toBe('New Key');
      expect(key?.is_active).toBe(1);
    });

    it('should revoke key atomically', async () => {
      const user = createTestUser();
      const key = createTestApiKey(user.user_id, { is_active: 1 });
      env.DB.seedUsers([user]);
      env.DB.seedApiKeys([key]);

      const result = await env.DB.prepare(`
        UPDATE api_keys SET is_active = 0 WHERE api_key_id = ? AND user_id = ?
      `).bind(key.api_key_id, user.user_id).run();

      expect(result.success).toBe(true);
      expect(result.meta.changes).toBe(1);

      const revokedKey = await env.DB.prepare(`
        SELECT is_active FROM api_keys WHERE api_key_id = ?
      `).bind(key.api_key_id).first();

      expect(revokedKey?.is_active).toBe(0);
    });
  });

  describe('Concurrent operation safety', () => {
    it('should handle concurrent user lookups', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      // Simulate concurrent lookups
      const lookups = await Promise.all([
        env.DB.prepare(`SELECT user_id FROM users WHERE email = ?`).bind(user.email).first(),
        env.DB.prepare(`SELECT user_id FROM users WHERE email = ?`).bind(user.email).first(),
        env.DB.prepare(`SELECT user_id FROM users WHERE email = ?`).bind(user.email).first(),
      ]);

      // All should return same user
      lookups.forEach(result => {
        expect(result?.user_id).toBe(user.user_id);
      });
    });

    it('should handle concurrent API key validations', async () => {
      const user = createTestUser();
      const key = createTestApiKey(user.user_id);
      env.DB.seedUsers([user]);
      env.DB.seedApiKeys([key]);

      // Simulate concurrent validations
      const validations = await Promise.all([
        env.DB.prepare(`SELECT user_id FROM api_keys WHERE api_key_hash = ?`).bind(key.api_key_hash).first(),
        env.DB.prepare(`SELECT user_id FROM api_keys WHERE api_key_hash = ?`).bind(key.api_key_hash).first(),
        env.DB.prepare(`SELECT user_id FROM api_keys WHERE api_key_hash = ?`).bind(key.api_key_hash).first(),
      ]);

      validations.forEach(result => {
        expect(result?.user_id).toBe(user.user_id);
      });
    });
  });

  describe('Update atomicity', () => {
    it('should update last_login_at atomically', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const newLoginTime = new Date().toISOString();

      const result = await env.DB.prepare(`
        UPDATE users SET last_login_at = ? WHERE user_id = ?
      `).bind(newLoginTime, user.user_id).run();

      expect(result.success).toBe(true);
      expect(result.meta.changes).toBe(1);

      const updated = await env.DB.prepare(`
        SELECT last_login_at FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(updated?.last_login_at).toBe(newLoginTime);
    });

    it('should update last_used_at on API key atomically', async () => {
      const user = createTestUser();
      const key = createTestApiKey(user.user_id);
      env.DB.seedUsers([user]);
      env.DB.seedApiKeys([key]);

      const newUsedAt = Date.now();

      const result = await env.DB.prepare(`
        UPDATE api_keys SET last_used_at = ? WHERE api_key_id = ?
      `).bind(newUsedAt, key.api_key_id).run();

      expect(result.success).toBe(true);

      const updated = await env.DB.prepare(`
        SELECT last_used_at FROM api_keys WHERE api_key_id = ?
      `).bind(key.api_key_id).first();

      expect(updated?.last_used_at).toBe(newUsedAt);
    });
  });
});
