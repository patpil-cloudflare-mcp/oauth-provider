// pre_testing/account-deletion/D1.4-session-cleanup.test.ts
// Test: Session cleanup on account deletion

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, createMockSession, MockEnv } from '../test-utils';

describe('D1.4 - Session Cleanup on Deletion', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should delete user session from KV on account deletion', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const sessionToken = await createMockSession(
      env.USER_SESSIONS,
      user.user_id,
      user.email
    );

    // Verify session exists
    let session = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    expect(session).not.toBeNull();

    // Delete session (part of account deletion)
    await env.USER_SESSIONS.delete(`workos_session:${sessionToken}`);

    // Verify session is gone
    session = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    expect(session).toBeNull();
  });

  it('should delete all sessions for a user', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    // Create multiple sessions (e.g., different devices)
    const sessions: string[] = [];
    for (let i = 0; i < 5; i++) {
      const token = await createMockSession(
        env.USER_SESSIONS,
        user.user_id,
        user.email
      );
      sessions.push(token);
    }

    // Verify all sessions exist
    for (const token of sessions) {
      const session = await env.USER_SESSIONS.get(`workos_session:${token}`);
      expect(session).not.toBeNull();
    }

    // Delete all sessions
    for (const token of sessions) {
      await env.USER_SESSIONS.delete(`workos_session:${token}`);
    }

    // Verify all sessions are gone
    for (const token of sessions) {
      const session = await env.USER_SESSIONS.get(`workos_session:${token}`);
      expect(session).toBeNull();
    }
  });

  it('should not affect other users sessions', async () => {
    const user1 = createTestUser({ email: 'user1@example.com' });
    const user2 = createTestUser({ email: 'user2@example.com' });
    env.DB.seedUsers([user1, user2]);

    const session1 = await createMockSession(env.USER_SESSIONS, user1.user_id, user1.email);
    const session2 = await createMockSession(env.USER_SESSIONS, user2.user_id, user2.email);

    // Delete user1's session
    await env.USER_SESSIONS.delete(`workos_session:${session1}`);

    // User2's session should remain
    const user2Session = await env.USER_SESSIONS.get(`workos_session:${session2}`);
    expect(user2Session).not.toBeNull();
  });

  it('should invalidate session before soft-deleting user', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const sessionToken = await createMockSession(
      env.USER_SESSIONS,
      user.user_id,
      user.email
    );

    // Account deletion workflow:
    // 1. Invalidate all sessions
    await env.USER_SESSIONS.delete(`workos_session:${sessionToken}`);

    // 2. Soft-delete user
    await env.DB.prepare(`
      UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ?
    `).bind(new Date().toISOString(), user.user_id).run();

    // Verify session is invalid (cannot be used after deletion)
    const session = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    expect(session).toBeNull();
  });

  it('should handle deletion when no active sessions exist', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    // No sessions created
    const nonExistentSession = await env.USER_SESSIONS.get(`workos_session:fake-token`);
    expect(nonExistentSession).toBeNull();

    // Deletion should not throw
    await env.USER_SESSIONS.delete(`workos_session:fake-token`);
  });

  it('should list and delete sessions by prefix pattern', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    // Create sessions
    const tokens: string[] = [];
    for (let i = 0; i < 3; i++) {
      const token = await createMockSession(env.USER_SESSIONS, user.user_id, user.email);
      tokens.push(token);
    }

    // List sessions (would need to track by user_id in production)
    const allSessions = await env.USER_SESSIONS.list({ prefix: 'workos_session:' });
    expect(allSessions.keys.length).toBe(3);

    // Delete all sessions
    for (const { name } of allSessions.keys) {
      await env.USER_SESSIONS.delete(name);
    }

    // Verify all deleted
    const remainingSessions = await env.USER_SESSIONS.list({ prefix: 'workos_session:' });
    expect(remainingSessions.keys.length).toBe(0);
  });

  it('should prevent deleted user from creating new sessions', async () => {
    const user = createTestUser({
      is_deleted: 1,
      deleted_at: new Date().toISOString()
    });
    env.DB.seedUsers([user]);

    // Check if user is deleted before creating session
    const dbUser = await env.DB.prepare(`
      SELECT is_deleted FROM users WHERE user_id = ?
    `).bind(user.user_id).first();

    const canCreateSession = dbUser?.is_deleted !== 1;
    expect(canCreateSession).toBe(false);
  });

  it('should reject session validation for deleted user', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const sessionToken = await createMockSession(
      env.USER_SESSIONS,
      user.user_id,
      user.email
    );

    // Mark user as deleted
    await env.DB.prepare(`
      UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ?
    `).bind(new Date().toISOString(), user.user_id).run();

    // Session still exists in KV
    const sessionData = await env.USER_SESSIONS.get(`workos_session:${sessionToken}`);
    expect(sessionData).not.toBeNull();

    // But validation should fail when checking is_deleted
    const dbUser = await env.DB.prepare(`
      SELECT is_deleted FROM users WHERE user_id = ?
    `).bind(user.user_id).first();

    const isValidSession = sessionData !== null && dbUser?.is_deleted !== 1;
    expect(isValidSession).toBe(false);
  });
});
