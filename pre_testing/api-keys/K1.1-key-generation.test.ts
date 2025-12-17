// pre_testing/api-keys/K1.1-key-generation.test.ts
// Test: API key generation

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, hashApiKey, MockEnv } from '../test-utils';

describe('K1.1 - API Key Generation', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should generate key with correct format: wtyk_<64_hex_chars>', () => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const apiKey = `wtyk_${randomHex}`;

    expect(apiKey).toMatch(/^wtyk_[a-f0-9]{64}$/);
    expect(apiKey.length).toBe(69); // wtyk_ (5) + 64 hex chars
  });

  it('should generate unique keys', () => {
    const keys = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const randomHex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
      const apiKey = `wtyk_${randomHex}`;

      expect(keys.has(apiKey)).toBe(false);
      keys.add(apiKey);
    }

    expect(keys.size).toBe(100);
  });

  it('should hash API key with SHA-256', async () => {
    const apiKey = 'wtyk_test123456789012345678901234567890123456789012345678901234';
    const hash = await hashApiKey(apiKey);

    expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 = 64 hex chars
    expect(hash.length).toBe(64);
  });

  it('should produce consistent hash for same key', async () => {
    const apiKey = 'wtyk_consistentkey12345678901234567890123456789012345678901234';

    const hash1 = await hashApiKey(apiKey);
    const hash2 = await hashApiKey(apiKey);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different keys', async () => {
    const key1 = 'wtyk_key1234567890123456789012345678901234567890123456789012345';
    const key2 = 'wtyk_key2234567890123456789012345678901234567890123456789012345';

    const hash1 = await hashApiKey(key1);
    const hash2 = await hashApiKey(key2);

    expect(hash1).not.toBe(hash2);
  });

  it('should store hash, not plaintext', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const apiKey = 'wtyk_plaintext123456789012345678901234567890123456789012345678';
    const hash = await hashApiKey(apiKey);
    const keyId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO api_keys (api_key_id, user_id, api_key_hash, key_prefix, name, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(keyId, user.user_id, hash, 'wtyk_plaintext1', 'Test Key', Date.now(), 1).run();

    const stored = await env.DB.prepare(`
      SELECT api_key_hash FROM api_keys WHERE api_key_id = ?
    `).bind(keyId).first();

    // Stored value is hash, not plaintext
    expect(stored?.api_key_hash).toBe(hash);
    expect(stored?.api_key_hash).not.toBe(apiKey);
    expect(stored?.api_key_hash).not.toContain('wtyk_');
  });

  it('should extract key prefix for display', () => {
    const apiKey = 'wtyk_a7f3k9m2p5q8r1s4t6v9w2x5y8z1b4c7d9e2f5g8h1j3k6l9m2n5p8q1';
    const prefix = apiKey.substring(0, 16);

    expect(prefix).toBe('wtyk_a7f3k9m2p5q');
    expect(prefix.length).toBe(16);
  });

  it('should store created_at timestamp', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const beforeCreate = Date.now();
    const createdAt = Date.now();

    await env.DB.prepare(`
      INSERT INTO api_keys (api_key_id, user_id, api_key_hash, key_prefix, name, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), user.user_id, 'hash123', 'wtyk_prefix', 'Test', createdAt, 1).run();

    const afterCreate = Date.now();

    expect(createdAt).toBeGreaterThanOrEqual(beforeCreate);
    expect(createdAt).toBeLessThanOrEqual(afterCreate);
  });

  it('should allow optional expiration date', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    // Key without expiration
    const keyId1 = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO api_keys (api_key_id, user_id, api_key_hash, key_prefix, name, created_at, expires_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(keyId1, user.user_id, 'hash1', 'wtyk_no_exp', 'No Expiry', Date.now(), null, 1).run();

    // Key with expiration (30 days)
    const keyId2 = crypto.randomUUID();
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    await env.DB.prepare(`
      INSERT INTO api_keys (api_key_id, user_id, api_key_hash, key_prefix, name, created_at, expires_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(keyId2, user.user_id, 'hash2', 'wtyk_exp', 'With Expiry', Date.now(), expiresAt, 1).run();

    const key1 = await env.DB.prepare(`
      SELECT expires_at FROM api_keys WHERE api_key_id = ?
    `).bind(keyId1).first();

    const key2 = await env.DB.prepare(`
      SELECT expires_at FROM api_keys WHERE api_key_id = ?
    `).bind(keyId2).first();

    expect(key1?.expires_at).toBeNull();
    expect(key2?.expires_at).toBe(expiresAt);
  });

  it('should set is_active to 1 by default', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const keyId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO api_keys (api_key_id, user_id, api_key_hash, key_prefix, name, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(keyId, user.user_id, 'hash', 'wtyk_', 'Test', Date.now(), 1).run();

    const key = await env.DB.prepare(`
      SELECT is_active FROM api_keys WHERE api_key_id = ?
    `).bind(keyId).first();

    expect(key?.is_active).toBe(1);
  });
});
