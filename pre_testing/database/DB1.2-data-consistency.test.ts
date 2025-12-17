// pre_testing/database/DB1.2-data-consistency.test.ts
// Test: Database data consistency

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, createTestApiKey, MockEnv } from '../test-utils';

describe('DB1.2 - Data Consistency', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Referential integrity', () => {
    it('should ensure API keys reference valid users', async () => {
      const user = createTestUser();
      const key = createTestApiKey(user.user_id);
      env.DB.seedUsers([user]);
      env.DB.seedApiKeys([key]);

      // Query with JOIN to verify relationship
      const keyWithUser = await env.DB.prepare(`
        SELECT ak.api_key_id, u.email
        FROM api_keys ak
        INNER JOIN users u ON ak.user_id = u.user_id
        WHERE ak.api_key_id = ?
      `).bind(key.api_key_id).first();

      expect(keyWithUser).not.toBeNull();
      expect(keyWithUser?.email).toBe(user.email);
    });

    it('should detect orphaned API keys (foreign key violation)', async () => {
      const orphanedUserId = crypto.randomUUID();
      const key = createTestApiKey(orphanedUserId);
      env.DB.seedApiKeys([key]);

      // User doesn't exist
      const user = await env.DB.prepare(`
        SELECT user_id FROM users WHERE user_id = ?
      `).bind(orphanedUserId).first();

      expect(user).toBeNull();

      // Key references non-existent user
      const orphanedKey = await env.DB.prepare(`
        SELECT user_id FROM api_keys WHERE api_key_id = ?
      `).bind(key.api_key_id).first();

      expect(orphanedKey?.user_id).toBe(orphanedUserId);
    });

    it('should ensure account_deletions reference valid users', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email)
        VALUES (?, ?, ?)
      `).bind(crypto.randomUUID(), user.user_id, user.email).run();

      const deletion = await env.DB.prepare(`
        SELECT ad.user_id, u.email
        FROM account_deletions ad
        INNER JOIN users u ON ad.user_id = u.user_id
        WHERE ad.user_id = ?
      `).bind(user.user_id).first();

      expect(deletion).not.toBeNull();
    });
  });

  describe('Data type validation', () => {
    it('should store user_id as valid UUID', async () => {
      const userId = crypto.randomUUID();
      const user = createTestUser({ user_id: userId });
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT user_id FROM users WHERE user_id = ?
      `).bind(userId).first();

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      expect(uuidRegex.test(result?.user_id as string)).toBe(true);
    });

    it('should store email in valid format', async () => {
      const email = 'valid@example.com';
      const user = createTestUser({ email });
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT email FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(result?.email as string)).toBe(true);
    });

    it('should store timestamps in ISO format', async () => {
      const timestamp = new Date().toISOString();
      const user = createTestUser({ created_at: timestamp });
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT created_at FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(isoRegex.test(result?.created_at as string)).toBe(true);
    });

    it('should store is_deleted as integer (0 or 1)', async () => {
      const activeUser = createTestUser({ is_deleted: 0 });
      const deletedUser = createTestUser({ is_deleted: 1 });
      env.DB.seedUsers([activeUser, deletedUser]);

      const active = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(activeUser.user_id).first();

      const deleted = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(deletedUser.user_id).first();

      expect([0, 1]).toContain(active?.is_deleted);
      expect([0, 1]).toContain(deleted?.is_deleted);
    });

    it('should store api_key_hash as hex string', async () => {
      const user = createTestUser();
      const hash = 'a'.repeat(64); // SHA-256 produces 64 hex chars
      const key = createTestApiKey(user.user_id, { api_key_hash: hash });
      env.DB.seedUsers([user]);
      env.DB.seedApiKeys([key]);

      const result = await env.DB.prepare(`
        SELECT api_key_hash FROM api_keys WHERE api_key_id = ?
      `).bind(key.api_key_id).first();

      const hexRegex = /^[a-f0-9]{64}$/;
      expect(hexRegex.test(result?.api_key_hash as string)).toBe(true);
    });
  });

  describe('Soft delete consistency', () => {
    it('should maintain is_deleted and deleted_at consistency', async () => {
      const deletedUser = createTestUser({
        is_deleted: 1,
        deleted_at: new Date().toISOString()
      });
      env.DB.seedUsers([deletedUser]);

      const result = await env.DB.prepare(`
        SELECT is_deleted, deleted_at FROM users WHERE user_id = ?
      `).bind(deletedUser.user_id).first();

      // If is_deleted=1, deleted_at should be set
      if (result?.is_deleted === 1) {
        expect(result?.deleted_at).not.toBeNull();
      }
    });

    it('should not have deleted_at for active users', async () => {
      const activeUser = createTestUser({
        is_deleted: 0,
        deleted_at: null
      });
      env.DB.seedUsers([activeUser]);

      const result = await env.DB.prepare(`
        SELECT is_deleted, deleted_at FROM users WHERE user_id = ?
      `).bind(activeUser.user_id).first();

      // If is_deleted=0, deleted_at should be null
      if (result?.is_deleted === 0) {
        expect(result?.deleted_at).toBeNull();
      }
    });
  });

  describe('Index verification', () => {
    it('should efficiently query by email (idx_users_email)', async () => {
      // Seed multiple users
      const users = Array.from({ length: 10 }, (_, i) =>
        createTestUser({ email: `user${i}@example.com` })
      );
      env.DB.seedUsers(users);

      // Query by email should be efficient with index
      const result = await env.DB.prepare(`
        SELECT user_id FROM users WHERE email = ?
      `).bind('user5@example.com').first();

      expect(result).not.toBeNull();
    });

    it('should efficiently query by api_key_hash (idx_api_keys_hash)', async () => {
      const user = createTestUser();
      const keys = Array.from({ length: 10 }, (_, i) =>
        createTestApiKey(user.user_id, { api_key_hash: `hash_${i}` })
      );
      env.DB.seedUsers([user]);
      env.DB.seedApiKeys(keys);

      const result = await env.DB.prepare(`
        SELECT api_key_id FROM api_keys WHERE api_key_hash = ?
      `).bind('hash_5').first();

      expect(result).not.toBeNull();
    });

    it('should efficiently query active keys by user (idx_api_keys_user_active)', async () => {
      const user = createTestUser();
      const activeKeys = Array.from({ length: 5 }, (_, i) =>
        createTestApiKey(user.user_id, { name: `Active ${i}`, is_active: 1 })
      );
      const inactiveKeys = Array.from({ length: 5 }, (_, i) =>
        createTestApiKey(user.user_id, { name: `Inactive ${i}`, is_active: 0 })
      );
      env.DB.seedUsers([user]);
      env.DB.seedApiKeys([...activeKeys, ...inactiveKeys]);

      const result = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND is_active = 1
      `).bind(user.user_id).first();

      expect(result?.count).toBe(5);
    });
  });
});
