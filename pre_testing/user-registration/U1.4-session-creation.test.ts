// pre_testing/user-registration/U1.4-session-creation.test.ts
// Test: Session creation after successful registration

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, createMockSession, MockEnv } from '../test-utils';

describe('U1.4 - Session Creation', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should create session in KV store', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const sessionToken = await createMockSession(
      env.USER_SESSIONS,
      user.user_id,
      user.email
    );

    const sessionData = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    expect(sessionData).not.toBeNull();

    const session = JSON.parse(sessionData!);
    expect(session.user_id).toBe(user.user_id);
    expect(session.email).toBe(user.email);
  });

  it('should generate unique session tokens', async () => {
    const user = createTestUser();
    const tokens = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const token = await createMockSession(
        env.USER_SESSIONS,
        user.user_id,
        user.email
      );
      expect(tokens.has(token)).toBe(false);
      tokens.add(token);
    }

    expect(tokens.size).toBe(100);
  });

  it('should set 72-hour TTL on session', async () => {
    const user = createTestUser();
    const sessionToken = await createMockSession(
      env.USER_SESSIONS,
      user.user_id,
      user.email
    );

    const sessionData = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    const session = JSON.parse(sessionData!);

    const expectedExpiry = session.created_at + (72 * 60 * 60 * 1000);
    expect(session.expires_at).toBe(expectedExpiry);
  });

  it('should store all required session fields', async () => {
    const user = createTestUser();
    const sessionToken = await createMockSession(
      env.USER_SESSIONS,
      user.user_id,
      user.email
    );

    const sessionData = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    const session = JSON.parse(sessionData!);

    expect(session).toHaveProperty('user_id');
    expect(session).toHaveProperty('email');
    expect(session).toHaveProperty('workos_user_id');
    expect(session).toHaveProperty('access_token');
    expect(session).toHaveProperty('refresh_token');
    expect(session).toHaveProperty('created_at');
    expect(session).toHaveProperty('expires_at');
  });

  it('should use correct key prefix for sessions', async () => {
    const user = createTestUser();
    const sessionToken = await createMockSession(
      env.USER_SESSIONS,
      user.user_id,
      user.email
    );

    const expectedKey = `workos_session:${sessionToken}`;
    const sessionData = await env.USER_SESSIONS.get(expectedKey);

    expect(sessionData).not.toBeNull();
  });

  it('should validate session retrieval', async () => {
    const user = createTestUser();
    const sessionToken = await createMockSession(
      env.USER_SESSIONS,
      user.user_id,
      user.email
    );

    // Valid session
    const validSession = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    expect(validSession).not.toBeNull();

    // Invalid session
    const invalidSession = await env.USER_SESSIONS.get('workos_session:invalid-token');
    expect(invalidSession).toBeNull();
  });

  it('should allow session deletion on logout', async () => {
    const user = createTestUser();
    const sessionToken = await createMockSession(
      env.USER_SESSIONS,
      user.user_id,
      user.email
    );

    // Verify session exists
    let session = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    expect(session).not.toBeNull();

    // Delete session (logout)
    await env.USER_SESSIONS.delete(`workos_session:${sessionToken}`);

    // Verify session is gone
    session = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    expect(session).toBeNull();
  });

  it('should update last_login_at on successful login', async () => {
    const user = createTestUser();
    const originalLoginTime = user.last_login_at;
    env.DB.seedUsers([user]);

    // Simulate login - update last_login_at
    const newLoginTime = new Date().toISOString();
    await env.DB.prepare(
      'UPDATE users SET last_login_at = ? WHERE user_id = ?'
    ).bind(newLoginTime, user.user_id).run();

    const updatedUser = await env.DB.prepare(
      'SELECT last_login_at FROM users WHERE user_id = ?'
    ).bind(user.user_id).first();

    expect(updatedUser?.last_login_at).toBe(newLoginTime);
    expect(updatedUser?.last_login_at).not.toBe(originalLoginTime);
  });
});
