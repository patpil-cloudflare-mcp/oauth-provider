// src/routes/customAuth.ts - Custom Magic Auth Endpoints

import { WorkOS } from '@workos-inc/node';
import type { Env } from '../index';
import { renderLoginCodeForm } from '../views/customLoginPage';
import { renderLoginSuccessPage } from '../views';
import { checkRateLimit } from '../middleware/rateLimit';
import { safeRedirectPath } from '../utils/safeRedirect';

/**
 * Handle email submission - Check if user exists, then send Magic Auth code (Step 2)
 * OAuth 2.1: Validate CSRF token to prevent cross-site attacks
 */
export async function handleSendMagicAuthCode(request: Request, env: Env): Promise<Response> {
  const secureAttr = new URL(request.url).protocol === 'https:' ? '; Secure' : '';

  // Parse form data FIRST (outside try-catch so variables are accessible in catch)
  const formData = await request.formData();
  const email = formData.get('email')?.toString().trim();
  const returnTo = safeRedirectPath(formData.get('return_to')?.toString() || '/dashboard');
  const csrfToken = formData.get('csrf_token')?.toString();
  const mode = formData.get('mode')?.toString() || 'login'; // 'login' or 'register'

  try {

    // OAuth 2.1: CSRF Protection
    const cookieHeader = request.headers.get('Cookie');
    const cookieCsrf = cookieHeader?.split(';')
      .find(c => c.trim().startsWith('magic_auth_csrf='))
      ?.split('=')[1];

    // Helper to build error redirects preserving return_to
    const baseUrl = new URL(request.url).origin;
    const buildErrorRedirect = (tab: string, errorMsg: string) => {
      const params = new URLSearchParams({ tab, error: errorMsg });
      if (returnTo && returnTo !== '/dashboard') {
        params.set('return_to', returnTo);
      }
      return Response.redirect(`${baseUrl}/?${params.toString()}`, 303);
    };

    if (!csrfToken || !cookieCsrf || csrfToken !== cookieCsrf) {
      console.error('🔒 [magic-auth] CSRF validation failed');
      const tab = mode === 'register' ? 'register' : 'login';
      return buildErrorRedirect(tab, 'Nieprawidłowe żądanie. Odśwież stronę i spróbuj ponownie.');
    }

    if (!email) {
      const tab = mode === 'register' ? 'register' : 'login';
      return buildErrorRedirect(tab, 'Proszę podać adres e-mail.');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const tab = mode === 'register' ? 'register' : 'login';
      return buildErrorRedirect(tab, 'Nieprawidłowy format adresu e-mail.');
    }

    // Rate limit: max 5 requests per 60s per email
    const withinLimit = await checkRateLimit(env.RATE_LIMIT_SEND_CODE, `send-code:${email.toLowerCase()}`);
    if (!withinLimit) {
      console.warn(`⚠️ [rate-limit] send-code rate limit exceeded for: ${email}`);
      const tab = mode === 'register' ? 'register' : 'login';
      return buildErrorRedirect(tab, 'Zbyt wiele prób. Poczekaj minutę i spróbuj ponownie.');
    }

    console.log(`🔐 [custom-auth] Email submitted: ${email}`);

    // Check if user exists in D1 database
    let existingUser = await env.TOKEN_DB.prepare(`
      SELECT user_id, email FROM users WHERE email = ?
    `).bind(email).first();

    // Handle based on mode (login vs register)
    if (mode === 'register') {
      // REGISTRATION MODE: Create new user, reject if exists
      if (existingUser) {
        console.log(`ℹ️ [custom-auth] Registration rejected - user exists: ${existingUser.user_id}`);
        return buildErrorRedirect('register', 'Konto z tym adresem email już istnieje. Przejdź do zakładki Logowanie.');
      }

      // Create new user
      console.log(`🆕 [custom-auth] New user registration: ${email}`);
      const userId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      await env.TOKEN_DB.prepare(`
        INSERT INTO users (user_id, email, created_at, last_login_at)
        VALUES (?, ?, ?, ?)
      `).bind(userId, email, timestamp, timestamp).run();

      console.log(`✅ [custom-auth] New user created in D1: ${userId}`);
      existingUser = { user_id: userId, email };

    } else {
      // LOGIN MODE: Send code to existing user, reject if not exists
      if (!existingUser) {
        console.log(`❌ [custom-auth] Login rejected - user not found: ${email}`);
        return buildErrorRedirect('login', 'Nie znaleziono konta z tym adresem email. Przejdź do zakładki Rejestracja.');
      }
      console.log(`✅ [custom-auth] Login - user found: ${existingUser.user_id}`);
    }

    // Create Magic Auth code via WorkOS API
    console.log(`🔄 [custom-auth] Creating Magic Auth code for: ${email}`);

    const magicAuthResponse = await fetch('https://api.workos.com/user_management/magic_auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!magicAuthResponse.ok) {
      const errorText = await magicAuthResponse.text();
      console.error(`[custom-auth] Magic Auth API failed (${magicAuthResponse.status}): ${errorText}`);
      throw new Error(`Magic Auth creation failed: ${magicAuthResponse.status}`);
    }

    const magicAuth = await magicAuthResponse.json() as {
      id: string;
      user_id: string;
      email: string;
      code: string;
      expires_at: string;
    };

    console.log(`✅ [custom-auth] Magic Auth code created: ${magicAuth.id}`);

    // Send verification code email in Polish via Resend
    await sendVerificationEmail(env.RESEND_API_KEY, email, magicAuth.code);

    // Show code input form with return_to parameter
    // Generate new CSRF token for code verification form
    const newCsrf = crypto.randomUUID();
    return new Response(renderLoginCodeForm(email, undefined, returnTo, newCsrf), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${secureAttr}`
      }
    });

  } catch (error) {
    console.error('❌ [custom-auth] Error sending Magic Auth code:', error);

    // Show more specific error message for API key issues
    let errorMessage = 'Wystąpił błąd. Spróbuj ponownie później.';
    if (error instanceof Error && error.message.includes('authorize')) {
      errorMessage = 'Błąd konfiguracji serwera. Skontaktuj się z administratorem.';
    }

    const baseUrl = new URL(request.url).origin;
    const params = new URLSearchParams({ error: errorMessage });
    if (returnTo && returnTo !== '/dashboard') {
      params.set('return_to', returnTo);
    }
    return Response.redirect(`${baseUrl}/?${params.toString()}`, 303);
  }
}

/**
 * Handle code verification - Validate code and create session (Step 3)
 * OAuth 2.1: Validate CSRF token to prevent cross-site attacks
 */
export async function handleVerifyMagicAuthCode(request: Request, env: Env): Promise<Response> {
  const secureAttr = new URL(request.url).protocol === 'https:' ? '; Secure' : '';

  // Parse form data FIRST (outside try-catch so variables are accessible in catch)
  const formData = await request.formData();
  const email = formData.get('email')?.toString().trim() || '';
  const code = formData.get('code')?.toString().trim() || '';
  const returnTo = safeRedirectPath(formData.get('return_to')?.toString() || '/dashboard');
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
      email,
      'Nieprawidłowe żądanie. Odśwież stronę i spróbuj ponownie.',
      returnTo,
      newCsrf
    ), {
      status: 400,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${secureAttr}`
      }
    });
  }

  if (!email || !code) {
    const newCsrf = crypto.randomUUID();
    return new Response(renderLoginCodeForm(email, 'Proszę podać kod weryfikacyjny', returnTo, newCsrf), {
      status: 400,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${secureAttr}`
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
        'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${secureAttr}`
      }
    });
  }

  // Rate limit: max 10 requests per 60s per email
  const withinLimit = await checkRateLimit(env.RATE_LIMIT_VERIFY_CODE, `verify-code:${email.toLowerCase()}`);
  if (!withinLimit) {
    console.warn(`⚠️ [rate-limit] verify-code rate limit exceeded for: ${email}`);
    const newCsrf = crypto.randomUUID();
    return new Response(renderLoginCodeForm(email, 'Zbyt wiele prób weryfikacji. Poczekaj minutę i spróbuj ponownie.', returnTo, newCsrf), {
      status: 429,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `magic_auth_csrf=${newCsrf}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${secureAttr}`
      }
    });
  }

  try {
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
    // Primary lookup: by workos_user_id (handles email changes in WorkOS)
    let dbUser = await env.TOKEN_DB.prepare(`
      SELECT user_id, email, created_at, last_login_at, workos_user_id
      FROM users
      WHERE workos_user_id = ?
    `).bind(workosUser.id).first();

    // Fallback: lookup by email (for users without workos_user_id yet)
    if (!dbUser) {
      dbUser = await env.TOKEN_DB.prepare(`
        SELECT user_id, email, created_at, last_login_at, workos_user_id
        FROM users
        WHERE email = ?
      `).bind(email).first();
    }

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

    // Update email (syncs from WorkOS), login timestamp, and WorkOS user ID
    await env.TOKEN_DB.prepare(
      'UPDATE users SET email = ?, last_login_at = ?, workos_user_id = ? WHERE user_id = ?'
    ).bind(workosUser.email, new Date().toISOString(), workosUser.id, dbUser.user_id).run();

    console.log(`✅ [custom-auth] User loaded from database: ${dbUser.user_id}`);
    console.log(`   Email synced: ${workosUser.email}, WorkOS ID: ${workosUser.id}`);

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

    // For OAuth flows, redirect immediately without showing success page
    // (the OAuth consent page will appear next)
    const isOAuthFlow = returnTo.startsWith('/oauth/authorize') || returnTo.startsWith('/auth/connect-login');

    if (isOAuthFlow) {
      console.log(`🔄 [custom-auth] OAuth flow detected, redirecting immediately to: ${returnTo}`);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': returnTo,
          'Set-Cookie': `workos_session=${sessionToken}; Domain=.wtyczki.ai; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=259200`,
        },
      });
    }

    // For regular logins, show success page with auto-redirect after 2.5 seconds
    console.log(`🔄 [custom-auth] Showing success page, then redirecting to: ${returnTo}`);
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

    // email and returnTo are accessible from outer scope (parsed before try block)
    let errorMessage = 'Nieprawidłowy lub wygasły kod. Spróbuj ponownie.';

    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        errorMessage = 'Kod wygasł. Wróć i wyślij nowy kod.';
      } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
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

/**
 * Send verification code email in Polish via Resend API.
 * Throws on failure so the caller can show an error to the user.
 */
async function sendVerificationEmail(apiKey: string, to: string, code: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'wtyczki.ai <noreply@wtyczki.ai>',
      to,
      subject: `${code} — kod logowania do wtyczki.ai`,
      html: `
<div style="font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#222b4f">
  <div style="text-align:center;margin-bottom:24px">
    <h2 style="font-size:22px;font-weight:700;margin:0">Logowanie do wtyczki.ai</h2>
  </div>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
    Otrzymaliśmy prośbę o zalogowanie się na konto powiązane z adresem <strong>${to}</strong>.
    Użyj poniższego kodu, aby dokończyć logowanie:
  </p>
  <div style="text-align:center;margin:0 0 24px">
    <span style="display:inline-block;font-size:36px;font-weight:700;letter-spacing:8px;background:#f0f1fe;color:#3239e5;padding:16px 32px;border-radius:12px">${code}</span>
  </div>
  <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 8px">
    Kod wygasa za <strong>10 minut</strong>.
  </p>
  <p style="font-size:14px;color:#666;line-height:1.6;margin:0">
    Jeśli nie próbujesz się zalogować, zignoruj tę wiadomość.
  </p>
  <hr style="border:none;border-top:1px solid #eff4f7;margin:32px 0 16px">
  <p style="font-size:12px;color:#999;text-align:center;margin:0">
    wtyczki.ai — Panel klienta
  </p>
</div>`,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[custom-auth] Resend email failed (${res.status}): ${errorText}`);
    throw new Error(`Email sending failed: ${res.status}`);
  }

  console.log(`✅ [custom-auth] Verification email sent via Resend to: ${to}`);
}
