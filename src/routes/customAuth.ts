// src/routes/customAuth.ts - Custom Magic Auth Endpoints

import { WorkOS } from '@workos-inc/node';
import type { Env } from '../index';
import { renderLoginEmailForm, renderLoginCodeForm } from '../views/customLoginPage';
import { renderLoginSuccessPage } from '../views';

/**
 * Show email input form (Step 1)
 * OAuth 2.1: Generate CSRF token for protection against cross-site attacks
 */
export async function handleCustomLoginPage(request: Request): Promise<Response> {
  // Get return_to parameter from query string (for OAuth redirect after login)
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('return_to') || '/dashboard';

  // OAuth 2.1: Generate CSRF token
  const csrfToken = crypto.randomUUID();

  return new Response(renderLoginEmailForm(undefined, returnTo, csrfToken), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': `magic_auth_csrf=${csrfToken}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    }
  });
}

/**
 * Handle email submission - Check if user exists, then send Magic Auth code (Step 2)
 * OAuth 2.1: Validate CSRF token to prevent cross-site attacks
 */
export async function handleSendMagicAuthCode(request: Request, env: Env): Promise<Response> {
  try {
    // Parse form data
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim();
    const returnTo = formData.get('return_to')?.toString() || '/dashboard';
    const csrfToken = formData.get('csrf_token')?.toString();

    // OAuth 2.1: CSRF Protection
    const cookieHeader = request.headers.get('Cookie');
    const cookieCsrf = cookieHeader?.split(';')
      .find(c => c.trim().startsWith('magic_auth_csrf='))
      ?.split('=')[1];

    if (!csrfToken || !cookieCsrf || csrfToken !== cookieCsrf) {
      console.error('🔒 [magic-auth] CSRF validation failed');
      const newCsrf = crypto.randomUUID();
      return new Response(renderLoginEmailForm(
        'Nieprawidłowe żądanie. Odśwież stronę i spróbuj ponownie.',
        returnTo,
        newCsrf
      ), {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    if (!email) {
      const newCsrf = crypto.randomUUID();
      return new Response(renderLoginEmailForm('Proszę podać adres e-mail', returnTo, newCsrf), {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const newCsrf = crypto.randomUUID();
      return new Response(renderLoginEmailForm('Nieprawidłowy format adresu e-mail', returnTo, newCsrf), {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    console.log(`🔐 [custom-auth] Email submitted: ${email}`);

    // Check if user exists in D1 database
    let existingUser = await env.DB.prepare(`
      SELECT user_id, email FROM users WHERE email = ?
    `).bind(email).first();

    // REGISTRATION FLOW: If user doesn't exist, create new account in D1
    // This gives them access to MCP servers
    if (!existingUser) {
      console.log(`🆕 [custom-auth] New user registration: ${email}`);

      // Create new user in Cloudflare D1 database
      const userId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO users (user_id, email, created_at, last_login_at)
        VALUES (?, ?, ?, ?)
      `).bind(userId, email, timestamp, timestamp).run();

      console.log(`✅ [custom-auth] New user created in D1: ${userId}`);
      console.log(`   Email: ${email}`);
      console.log(`   User now has access to MCP servers`);

      existingUser = { user_id: userId, email };
    } else {
      console.log(`✅ [custom-auth] Existing user logging in: ${existingUser.user_id}`);
    }

    // User exists - send Magic Auth code via WorkOS
    const workos = new WorkOS(env.WORKOS_API_KEY);

    console.log(`🔄 [custom-auth] Sending Magic Auth code to: ${email}`);

    const magicAuth = await workos.userManagement.createMagicAuth({
      email,
    });

    console.log(`✅ [custom-auth] Magic Auth code created: ${magicAuth.id}`);
    console.log(`   Code expires at: ${magicAuth.expiresAt}`);

    // Show code input form with return_to parameter
    // Generate new CSRF token for code verification form
    const newCsrf = crypto.randomUUID();
    return new Response(renderLoginCodeForm(email, undefined, returnTo, newCsrf), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
      }
    });

  } catch (error) {
    console.error('❌ [custom-auth] Error sending Magic Auth code:', error);

    const returnTo = (await request.clone().formData()).get('return_to')?.toString() || '/dashboard';
    const newCsrf = crypto.randomUUID();

    return new Response(renderLoginEmailForm('Wystąpił błąd. Spróbuj ponownie później.', returnTo, newCsrf), {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
      }
    });
  }
}

/**
 * Handle code verification - Validate code and create session (Step 3)
 * OAuth 2.1: Validate CSRF token to prevent cross-site attacks
 */
export async function handleVerifyMagicAuthCode(request: Request, env: Env): Promise<Response> {
  try {
    // Parse form data
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim();
    const code = formData.get('code')?.toString().trim();
    const returnTo = formData.get('return_to')?.toString() || '/dashboard';
    const csrfToken = formData.get('csrf_token')?.toString();

    // OAuth 2.1: CSRF Protection
    const cookieHeader = request.headers.get('Cookie');
    const cookieCsrf = cookieHeader?.split(';')
      .find(c => c.trim().startsWith('magic_auth_csrf='))
      ?.split('=')[1];

    if (!csrfToken || !cookieCsrf || csrfToken !== cookieCsrf) {
      console.error('🔒 [magic-auth] CSRF validation failed in code verification');
      const newCsrf = crypto.randomUUID();
      return new Response(renderLoginCodeForm(
        email || '',
        'Nieprawidłowe żądanie. Odśwież stronę i spróbuj ponownie.',
        returnTo,
        newCsrf
      ), {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    if (!email || !code) {
      const newCsrf = crypto.randomUUID();
      return new Response(renderLoginCodeForm(email || '', 'Proszę podać kod weryfikacyjny', returnTo, newCsrf), {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      const newCsrf = crypto.randomUUID();
      return new Response(renderLoginCodeForm(email, 'Kod musi składać się z 6 cyfr', returnTo, newCsrf), {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    console.log(`🔐 [custom-auth] Verifying code for: ${email}`);

    // Authenticate with WorkOS using Magic Auth code
    const workos = new WorkOS(env.WORKOS_API_KEY);

    const { user: workosUser, accessToken, refreshToken } = await workos.userManagement.authenticateWithMagicAuth({
      clientId: env.WORKOS_CLIENT_ID,
      code,
      email,
    });

    console.log(`✅ [custom-auth] WorkOS authentication successful: ${workosUser.email}`);
    console.log(`   WorkOS user ID: ${workosUser.id}`);

    // Load user from D1 database
    const dbUser = await env.DB.prepare(`
      SELECT
        user_id,
        email,
        created_at,
        last_login_at
      FROM users
      WHERE email = ?
    `).bind(email).first();

    if (!dbUser) {
      console.error(`❌ [custom-auth] User not found in database: ${email}`);
      const newCsrf = crypto.randomUUID();
      return new Response(renderLoginCodeForm(email, 'Konto nie znalezione. Skontaktuj się z wsparciem.', returnTo, newCsrf), {
        status: 500,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    // Update last login timestamp
    await env.DB.prepare(
      'UPDATE users SET last_login_at = ? WHERE user_id = ?'
    ).bind(new Date().toISOString(), dbUser.user_id).run();

    console.log(`✅ [custom-auth] User loaded from database: ${dbUser.user_id}`);

    // Create session token
    const sessionToken = crypto.randomUUID();

    // Store session in KV
    const session = {
      user_id: dbUser.user_id,
      email: dbUser.email,
      workos_user_id: workosUser.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      created_at: Date.now(),
      expires_at: Date.now() + (72 * 60 * 60 * 1000), // 72 hours
    };

    await env.USER_SESSIONS.put(
      `workos_session:${sessionToken}`,
      JSON.stringify(session),
      { expirationTtl: 259200 } // 72 hours
    );

    console.log(`🎫 [custom-auth] Session created: ${sessionToken.substring(0, 8)}...`);
    console.log(`🔄 [custom-auth] Showing success page, then redirecting to: ${returnTo}`);

    // Show success page with session cookie (auto-redirects after 2.5 seconds)
    const successHtml = renderLoginSuccessPage({
      email: dbUser.email as string,
      redirectUrl: returnTo,
      redirectDelay: 2500,
    });

    return new Response(successHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `workos_session=${sessionToken}; Domain=.wtyczki.ai; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=259200`,
      },
    });

  } catch (error) {
    console.error('❌ [custom-auth] Error verifying code:', error);

    const formData = await request.clone().formData();
    const email = formData.get('email')?.toString() || '';
    const returnTo = formData.get('return_to')?.toString() || '/dashboard';

    // Check for specific WorkOS errors
    let errorMessage = 'Nieprawidłowy lub wygasły kod. Spróbuj ponownie.';

    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        errorMessage = 'Kod wygasł. Wróć i wyślij nowy kod.';
      } else if (error.message.includes('invalid')) {
        errorMessage = 'Nieprawidłowy kod. Sprawdź kod i spróbuj ponownie.';
      }
    }

    const newCsrf = crypto.randomUUID();
    return new Response(renderLoginCodeForm(email, errorMessage, returnTo, newCsrf), {
      status: 400,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
      }
    });
  }
}
