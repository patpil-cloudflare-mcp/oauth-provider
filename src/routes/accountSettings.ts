// src/routes/accountSettings.ts - Account Settings Routes
import type { User } from '../types';
import { renderSettingsPage } from '../views';

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
