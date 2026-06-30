// src/routes/accountSettings.ts - Account Settings Routes
import type { Env } from '../index';
import type { User } from '../types';
import { renderSettingsPage } from '../views';
import { getSessionTokenFromRequest } from '../workos-auth';

/**
 * Handle GET /dashboard/settings
 * Render settings page for authenticated user
 *
 * @param user - Authenticated user from middleware
 * @returns Response with settings page HTML
 */
export async function handleSettingsPage(user: User): Promise<Response> {
  return new Response(renderSettingsPage(user), {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

function deletionJson(data: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/**
 * Handle POST /account/delete/confirm — GDPR account deletion (soft delete).
 *
 * Contract (pre_testing/account-deletion):
 *   1. Write an immutable audit row to `account_deletions` (original_email + IP).
 *   2. Soft-delete the user: is_deleted = 1, deleted_at = now. Row & PII preserved.
 *   3. Invalidate the current session in KV and clear the cookie.
 *
 * Steps 1–2 run as a single D1 batch (atomic). Once is_deleted = 1, every session
 * validation fails (getUserById / authenticateBearer / connectAuth all filter it),
 * so other-device sessions become unusable even before their KV TTL expires.
 *
 * `user` comes from the auth middleware, so it is guaranteed active (is_deleted = 0)
 * at entry; the WHERE guard + changes check only defend against a double-submit race.
 */
export async function handleAccountDeletion(request: Request, env: Env, user: User): Promise<Response> {
  let body: { userId?: string; emailConfirmation?: string };
  try {
    body = await request.json();
  } catch {
    return deletionJson({ error: 'Nieprawidłowe żądanie.' }, 400);
  }

  // Ownership guard: the submitted identifiers must match the session user.
  if (
    body.userId !== user.user_id ||
    body.emailConfirmation?.trim().toLowerCase() !== user.email.toLowerCase()
  ) {
    return deletionJson({ error: 'Potwierdzenie nie zgadza się z kontem.' }, 403);
  }

  const deletedAt = new Date().toISOString();
  const deletedByIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';

  try {
    const auditStmt = env.TOKEN_DB.prepare(`
      INSERT INTO account_deletions (deletion_id, user_id, original_email, deletion_reason, deleted_at, deleted_by_ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), user.user_id, user.email, 'User requested via settings', deletedAt, deletedByIp);

    const softDeleteStmt = env.TOKEN_DB.prepare(`
      UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ? AND is_deleted = 0
    `).bind(deletedAt, user.user_id);

    const [, softDeleteResult] = await env.TOKEN_DB.batch([auditStmt, softDeleteStmt]);

    if (softDeleteResult.meta.changes === 0) {
      return deletionJson({ error: 'Konto zostało już usunięte.' }, 409);
    }
  } catch (error) {
    console.error('[account-deletion] Failed to delete account:', error);
    return deletionJson({ error: 'Nie udało się usunąć konta. Spróbuj ponownie później.' }, 500);
  }

  // Invalidate the current session and clear the cookie.
  const sessionToken = getSessionTokenFromRequest(request);
  if (sessionToken) {
    await env.USER_SESSIONS.delete(`workos_session:${sessionToken}`);
  }

  return deletionJson({ success: true, message: 'Konto zostało usunięte.' }, 200, {
    'Set-Cookie': 'workos_session=; Domain=.wtyczki.ai; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
  });
}
