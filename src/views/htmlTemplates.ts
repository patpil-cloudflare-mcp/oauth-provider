// src/views/htmlTemplates.ts - HTML Template Rendering Functions
import type { User } from '../types';

// Authentication error page helpers
export function renderAuthRequiredPage(requestedPath: string): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wymagane logowanie | wtyczki.ai</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      text-align: center;
    }
    h1 { color: #222b4f; margin-bottom: 16px; font-size: 28px; }
    p { color: #666; line-height: 1.6; margin-bottom: 24px; }
    .icon { font-size: 64px; margin-bottom: 20px; }
    .btn {
      display: inline-block;
      background: #3239e5;
      color: white;
      padding: 14px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn:hover { background: #140f44; transform: translateY(-2px); }
    .info-box {
      background: #f0f7ff;
      border-left: 4px solid #3239e5;
      padding: 16px;
      margin: 24px 0;
      text-align: left;
      border-radius: 4px;
    }
    .info-box h3 { color: #3239e5; font-size: 14px; margin-bottom: 8px; }
    .info-box p { font-size: 13px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔒</div>
    <h1>Wymagane logowanie</h1>
    <p>Ta strona wymaga uwierzytelnienia. Cloudflare Access powinien automatycznie przekierować Cię do strony logowania.</p>

    <div class="info-box">
      <h3>⚠️ Problem z konfiguracją</h3>
      <p>Cloudflare Access nie jest poprawnie skonfigurowany dla tej ścieżki: <code>${requestedPath}</code></p>
      <p style="margin-top: 8px;">Administrator powinien skonfigurować Cloudflare Access w Dashboard → Zero Trust → Access → Applications</p>
    </div>

    <a href="/" class="btn">← Powrót na stronę główną</a>

    <p style="margin-top: 24px; font-size: 13px; color: #999;">
      Próbujesz zalogować się do: ${requestedPath}
    </p>
  </div>
</body>
</html>
  `;
}

export function renderAuthErrorPage(error: string): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Błąd uwierzytelniania | wtyczki.ai</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      text-align: center;
    }
    h1 { color: #e6174b; margin-bottom: 16px; font-size: 28px; }
    p { color: #666; line-height: 1.6; margin-bottom: 24px; }
    .icon { font-size: 64px; margin-bottom: 20px; }
    .btn {
      display: inline-block;
      background: #3239e5;
      color: white;
      padding: 14px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s;
      margin: 8px;
    }
    .btn:hover { background: #140f44; transform: translateY(-2px); }
    .error-details {
      background: #fff3f3;
      border-left: 4px solid #e6174b;
      padding: 16px;
      margin: 24px 0;
      text-align: left;
      border-radius: 4px;
    }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❌</div>
    <h1>Błąd uwierzytelniania</h1>
    <p>Nie udało się zweryfikować Twojej tożsamości. Spróbuj zalogować się ponownie.</p>

    <div class="error-details">
      <strong>Szczegóły błędu:</strong><br>
      <code>${error}</code>
    </div>

    <a href="/" class="btn">← Powrót na stronę główną</a>
    <a href="/dashboard" class="btn">Spróbuj ponownie</a>
  </div>
</body>
</html>
  `;
}

// HTML rendering functions
export function renderSuccessPage(data: {
  tokensAdded: number;
  newBalance: number;
  alreadyProcessed: boolean;
  isGuest?: boolean;
  guestEmail?: string;
  isFirstPurchase?: boolean;  // TRUE if this is the user's first token purchase
}): string {
  const statusMessage = data.alreadyProcessed
    ? '<p class="success">Płatność zakończona pomyślnie! Twoje tokeny zostały już dodane do konta.</p>'
    : '<p class="success">Płatność zakończona pomyślnie! Tokeny zostały dodane do Twojego konta.</p>';

  // Show different messages based on whether this is the user's first purchase
  const guestMessage = data.isGuest && data.guestEmail
    ? (data.isFirstPurchase
        // FIRST PURCHASE: User's first token purchase ever
        ? `<div class="guest-notice">
             <h3 style="color: #7a0bc0; font-size: 16px; margin-bottom: 8px;">🎉 Pierwsze zakupy!</h3>
             <p style="font-size: 14px; line-height: 1.6; color: rgba(34, 43, 79, 0.8);">
               Twoje konto zostało utworzone dla adresu <strong>${data.guestEmail}</strong>.<br>
               Kliknij przycisk poniżej, aby zalogować się i zobaczyć swoje tokeny.<br>
               <em style="font-size: 13px; color: rgba(34, 43, 79, 0.65);">
                 (Po kliknięciu otrzymasz kod weryfikacyjny na email)
               </em>
             </p>
           </div>`
        // RETURNING PURCHASE: User has purchased tokens before
        : `<div class="guest-notice">
             <h3 style="color: #10b981; font-size: 16px; margin-bottom: 8px;">✅ Kolejny zakup zakończony pomyślnie!</h3>
             <p style="font-size: 14px; line-height: 1.6; color: rgba(34, 43, 79, 0.8);">
               Tokeny zostały dodane do Twojego istniejącego konta <strong>${data.guestEmail}</strong>.<br>
               Zaloguj się do panelu, aby zobaczyć zaktualizowany stan tokenów.<br>
               <em style="font-size: 13px; color: rgba(34, 43, 79, 0.65);">
                 (Po kliknięciu otrzymasz kod weryfikacyjny na email)
               </em>
             </p>
           </div>`)
    : '';

  // Determine the button URL based on whether user is a guest
  const buttonUrl = data.isGuest
    ? 'https://panel.wtyczki.ai/auth/login-custom'  // Guest users → Magic Auth login
    : 'https://panel.wtyczki.ai/dashboard';          // Authenticated users → Dashboard

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Płatność zakończona - wtyczki.ai</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="Płatność zakończona pomyślnie. Tokeny zostały dodane do Twojego konta.">
  <meta name="robots" content="noindex, nofollow">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>✅</text></svg>">

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: #feffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.1);
      border: 2px solid #eff4f7;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #222b4f;
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .success {
      color: #10b981;
      font-size: 16px;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .info {
      color: #3b82f6;
      font-size: 16px;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .stats {
      background: #eff4f7;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    .stat {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid rgba(34, 43, 79, 0.1);
    }
    .stat:last-child {
      border-bottom: none;
    }
    .stat-label {
      color: rgba(34, 43, 79, 0.65);
      font-size: 14px;
    }
    .stat-value {
      color: #222b4f;
      font-size: 18px;
      font-weight: 600;
    }
    .button {
      display: inline-block;
      background: #3239e5;
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      margin-top: 20px;
      transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
    }
    .button:hover {
      background: #140f44;
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(50, 57, 229, 0.3);
    }
    .guest-notice {
      background: linear-gradient(135deg, #f3e8ff 0%, #fce7f3 100%);
      border: 2px solid #e9d5ff;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🎉</div>
    <h1>Płatność zakończona pomyślnie!</h1>
    ${statusMessage}

    ${guestMessage}

    <div class="stats">
      <div class="stat">
        <span class="stat-label">Dodane tokeny</span>
        <span class="stat-value">+${data.tokensAdded}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Nowy stan konta</span>
        <span class="stat-value">${data.newBalance} tokenów</span>
      </div>
    </div>

    <a href="${buttonUrl}" class="button">Przejdź do panelu</a>
  </div>
</body>
</html>
  `;
}

export function renderErrorPage(message: string): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Błąd płatności - wtyczki.ai</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="Wystąpił błąd podczas przetwarzania płatności.">
  <meta name="robots" content="noindex, nofollow">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>❌</text></svg>">

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: #feffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.1);
      border: 2px solid #fee2e2;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #222b4f;
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .error {
      color: #ef4444;
      font-size: 16px;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      background: #3239e5;
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      margin-top: 20px;
      transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
    }
    .button:hover {
      background: #140f44;
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(50, 57, 229, 0.3);
    }
    .support {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #eff4f7;
      color: rgba(34, 43, 79, 0.65);
      font-size: 14px;
    }
    .support a {
      color: #7a0bc0;
      text-decoration: none;
    }
    .support a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❌</div>
    <h1>Błąd płatności</h1>
    <p class="error">${message}</p>

    <a href="https://panel.wtyczki.ai" class="button">Spróbuj ponownie</a>

    <div class="support">
      Potrzebujesz pomocy? Napisz do nas: <a href="mailto:support@wtyczki.pl" style="color: #7a0bc0; text-decoration: none;">support@wtyczki.pl</a>
    </div>
  </div>
</body>
</html>
  `;
}

export function renderDashboardPage(user: User): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel - System Tokenów MCP | wtyczki.ai</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="Panel zarządzania tokenami MCP. Kup tokeny i korzystaj z zaawansowanych serwerów AI opartych na protokole Model Context Protocol.">
  <meta name="keywords" content="MCP, tokeny, AI, Model Context Protocol, wtyczki, API">
  <meta name="author" content="Wtyczki DEV Patryk Pilat">
  <meta name="robots" content="noindex, nofollow">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://panel.wtyczki.ai/">
  <meta property="og:title" content="System Tokenów MCP | wtyczki.ai">
  <meta property="og:description" content="System prepaid tokenów dla dostępu do serwerów AI opartych na protokole MCP">
  <meta property="og:image" content="https://panel.wtyczki.ai/og-image.png">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://panel.wtyczki.ai/">
  <meta property="twitter:title" content="System Tokenów MCP | wtyczki.ai">
  <meta property="twitter:description" content="System prepaid tokenów dla dostępu do serwerów AI opartych na protokole MCP">
  <meta property="twitter:image" content="https://panel.wtyczki.ai/og-image.png">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🔌</text></svg>">
  <link rel="alternate icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAITSURBVFiF7ZbPaxNBFMe/b7KbTZs0aY0/qBWxRfHgQTx48OBN8OTRf8KbePTkH+HRk+DBg6AHQfCgCCKCWrFYLNJiG5ukSdpkd2Z2PN0km92ZTZqeBPvhwczOm/d9b96b92aB/3qsqgC6urr6AXwEcBpAE8ALAM+llLdXUdvmCO4B+CilzCilegD0A3gE4LmUcmndBBzHuQbguZTys2EY9wAcBXBQStkDoB/AcwAnAFw1DOPuOgl0dXVdBvAEwF0pZRaABqAJoAHgAIBuADcBvJJSPl4XgZ6enhsA3gC4KaWcBqADaAHwAVQB1AB8BfAOwIiU8s5aCFiW1QfgLYBbUsoJABqAEkAZQBXAbwBlABMA3gO4LqUcWjkBwzD6ALwH8EBKOQ5AA1AEUALwC8AXAF8AvARwRUp5e+UELMvqBzAG4J6UcgxAHcAvAN8BfALwGsBVKeWdtRCwbXsQwBsA94eiCSEAAA0ASURBVKWUY7ZtvwdwAMAvAJ8BfADwVkr5cC0EhoeHDwF4DeC6lDIzPj7u2PYo/JlfAPgAYATAIynl01UQOAygH8BDKWUW/sRnAYwC+AIgB38i7kkpn62SwEkAXQCuSymnAIzBX3l/4Lfg7oYEHA3A5wD8AlACMAPfgFEAI1LKp+sm0NnZeQrATQDnADQAvAPwSEr5Yl0EHA3AWQAXAJwF0ADwFsBDKeWL/1XgX/0Bl8LKBwDOaygAAAAASUVORK5CYII=">

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wgt@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: #feffff;
      min-height: 100vh;
      padding: 20px;
      color: #222b4f;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h1 { color: #222b4f; font-size: 24px; font-weight: 600; }
    .user-email { color: rgba(34, 43, 79, 0.65); font-size: 14px; margin-top: 4px; }
    .settings-link {
      color: #7a0bc0;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .settings-link:hover {
      background: #f3e8ff;
      color: #b2478f;
      transform: translateY(-2px);
    }
    .balance-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
    }
    .balance-label { color: rgba(34, 43, 79, 0.65); font-size: 18px; margin-bottom: 8px; font-weight: 500; }
    .balance-value {
      font-size: 48px;
      font-weight: 700;
      background: linear-gradient(135deg, #3239e5 0%, #140f44 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .balance-unit { font-size: 24px; color: rgba(34, 43, 79, 0.5); margin-left: 8px; }
    .packages {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    @media (max-width: 1400px) {
      .packages {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 768px) {
      .packages {
        grid-template-columns: 1fr;
      }
    }
    .package-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
      border: 2px solid transparent;
    }
    .package-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(50, 57, 229, 0.15);
      border-color: #3239e5;
    }
    .package-name {
      font-size: 20px;
      font-weight: 600;
      color: #222b4f;
      margin-bottom: 8px;
      background: #e6174b;
      color: white;
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      border: 2px solid #b71338;
      margin-bottom: 12px;
    }
    .package-price { font-size: 32px; font-weight: 700; color: #3239e5; margin-bottom: 4px; }
    .package-tokens { color: rgba(34, 43, 79, 0.7); font-size: 14px; margin-bottom: 16px; }
    .buy-button {
      width: 100%;
      padding: 12px;
      background: #3239e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .buy-button:hover {
      background: #140f44;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(50, 57, 229, 0.4);
    }

    /* Promotional Badge */
    .promo-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      border: 3px solid white;
      transform: rotate(5deg);
      animation: pulse 2s infinite;
      z-index: 10;
      white-space: nowrap;
    }
    @keyframes pulse {
      0%, 100% { transform: rotate(5deg) scale(1); }
      50% { transform: rotate(5deg) scale(1.05); }
    }
    .promo-badge-gold {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }

    /* Best Value Badge (Pro Package) */
    .best-value-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      background: linear-gradient(135deg, #7a0bc0 0%, #b2478f 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.4);
      border: 3px solid white;
      transform: rotate(5deg);
      animation: pulse 2s infinite;
      z-index: 10;
      white-space: nowrap;
    }

    /* Package Value (Cost per Token) */
    .package-value {
      color: rgba(34, 43, 79, 0.65);
      font-size: 13px;
      margin-bottom: 8px;
      font-weight: 500;
    }

    /* Package Savings */
    .package-savings {
      background: #d1fae5;
      color: #065f46;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      display: inline-block;
      margin-bottom: 12px;
    }

    /* Featured Package Card (Pro) */
    .package-card-featured {
      transform: scale(1.05);
      border: 3px solid #7a0bc0;
      box-shadow: 0 8px 24px rgba(122, 11, 192, 0.25);
      background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
    }
    .package-card-featured:hover {
      transform: scale(1.05) translateY(-4px);
      box-shadow: 0 12px 32px rgba(122, 11, 192, 0.35);
      border-color: #b2478f;
    }

    .stats {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eff4f7;
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: rgba(34, 43, 79, 0.65); }
    .stat-value { font-weight: 600; color: #222b4f; }

    /* Transaction History Styles */
    .transactions-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #222b4f;
    }
    .filter-buttons {
      display: flex;
      gap: 8px;
    }
    .filter-btn {
      padding: 6px 16px;
      border: 1px solid #eff4f7;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      color: #222b4f;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      border-color: #7a0bc0;
      color: #7a0bc0;
    }
    .filter-btn.active {
      background: #3239e5;
      color: white;
      border-color: #3239e5;
    }
    .transactions-table {
      width: 100%;
      border-collapse: collapse;
    }
    .transactions-table th {
      text-align: left;
      padding: 12px;
      border-bottom: 2px solid #eff4f7;
      color: rgba(34, 43, 79, 0.65);
      font-size: 14px;
      font-weight: 600;
    }
    .transactions-table td {
      padding: 12px;
      border-bottom: 1px solid #eff4f7;
      font-size: 14px;
      color: #222b4f;
    }
    .transactions-table tr:hover {
      background: #eff4f7;
    }
    .type-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .type-purchase {
      background: #d1fae5;
      color: #065f46;
    }
    .type-usage {
      background: #fee2e2;
      color: #991b1b;
    }
    .amount-positive {
      color: #059669;
      font-weight: 600;
    }
    .amount-negative {
      color: #dc2626;
      font-weight: 600;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: rgba(34, 43, 79, 0.65);
    }
    .error-message {
      background: #fee2e2;
      color: #991b1b;
      padding: 12px;
      border-radius: 8px;
      margin: 12px 0;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: rgba(34, 43, 79, 0.65);
    }

    /* Footer Styles */
    .footer {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-top: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .footer-link {
      color: #222b4f;
      text-decoration: none;
      font-size: 14px;
      transition: color 0.2s;
    }
    .footer-link:hover {
      color: #7a0bc0;
      text-decoration: underline;
    }
    .footer-link:visited {
      color: #b2478f;
    }
    .footer-text {
      color: rgba(34, 43, 79, 0.65);
      font-size: 13px;
      margin-top: 8px;
    }

    /* Mobile Responsive Styles */
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }

      .container {
        padding: 0;
      }

      .header {
        padding: 16px;
        margin-bottom: 12px;
      }

      h1 {
        font-size: 20px;
      }

      .user-email {
        font-size: 12px;
      }

      .balance-card {
        padding: 24px 16px;
        margin-bottom: 12px;
      }

      .balance-value {
        font-size: 36px;
      }

      .balance-unit {
        font-size: 18px;
      }

      .packages {
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 12px;
      }

      .package-card {
        padding: 20px;
      }

      /* Featured package - reduce scale on mobile */
      .package-card-featured {
        transform: scale(1);
        border: 2px solid #7a0bc0;
      }
      .package-card-featured:hover {
        transform: translateY(-4px);
      }

      .stats {
        padding: 16px;
        margin-bottom: 12px;
      }

      .transactions-section {
        padding: 16px;
      }

      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .section-title {
        font-size: 18px;
      }

      .filter-buttons {
        width: 100%;
        justify-content: space-between;
      }

      .filter-btn {
        flex: 1;
        padding: 8px 12px;
        font-size: 13px;
      }

      .transactions-table {
        font-size: 12px;
      }

      .transactions-table th,
      .transactions-table td {
        padding: 8px 4px;
      }

      .transactions-table th:nth-child(3),
      .transactions-table td:nth-child(3) {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .footer {
        padding: 16px;
        margin-top: 12px;
      }

      .footer-links {
        flex-direction: column;
        gap: 12px;
      }

      .footer-text {
        font-size: 12px;
      }
    }

    @media (max-width: 480px) {
      .balance-value {
        font-size: 32px;
      }

      .package-name {
        font-size: 18px;
      }

      .package-price {
        font-size: 28px;
      }

      /* Make table scrollable on very small screens */
      .transactions-table {
        display: block;
        overflow-x: auto;
        white-space: nowrap;
      }

      .transactions-table thead,
      .transactions-table tbody,
      .transactions-table tr {
        display: table;
        width: 100%;
        table-layout: fixed;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>System tokenów wtyczki.ai</h1>
        <div class="user-email">${user.email}</div>
      </div>
      <a href="/dashboard/settings" class="settings-link">⚙️ Ustawienia</a>
    </div>

    <div class="balance-card">
      <div class="balance-label">Aktualny stan tokenów</div>
      <div>
        <span class="balance-value">${user.current_token_balance}</span>
        <span class="balance-unit">tokenów</span>
      </div>
    </div>

    <div class="packages">
      <div class="package-card">
        <div class="package-name">Starter</div>
        <div class="package-price">10 zł</div>
        <div class="package-tokens">500 tokenów</div>
        <div class="package-value">2 grosze za token</div>
        <button class="buy-button" onclick="buyPackage('starter')">Kup teraz</button>
      </div>

      <div class="package-card">
        <div class="package-name">Plus</div>
        <div class="package-price">25 zł</div>
        <div class="package-tokens">2 000 tokenów</div>
        <div class="package-value">1,25 grosza za token</div>
        <button class="buy-button" onclick="buyPackage('plus')">Kup teraz</button>
      </div>

      <div class="package-card package-card-featured">
        <div class="best-value-badge">⭐ Najpopularniejszy</div>
        <div class="package-name">Pro</div>
        <div class="package-price">59 zł</div>
        <div class="package-tokens">5 500 tokenów</div>
        <div class="package-value">1,07 grosza za token</div>
        <div class="package-savings">500 tokenów gratis!</div>
        <button class="buy-button" onclick="buyPackage('pro')">Kup teraz</button>
      </div>

      <div class="package-card">
        <div class="promo-badge promo-badge-gold">💎 Superpakiet</div>
        <div class="package-name">Gold</div>
        <div class="package-price">119 zł</div>
        <div class="package-tokens">12 000 tokenów</div>
        <div class="package-value">0,99 grosza za token</div>
        <div class="package-savings">2 000 tokenów gratis!</div>
        <button class="buy-button" onclick="buyPackage('gold')">Kup teraz</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat-row">
        <span class="stat-label">Zakupione tokeny (łącznie)</span>
        <span class="stat-value">${user.total_tokens_purchased} tokenów</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Wykorzystane tokeny (łącznie)</span>
        <span class="stat-value">${user.total_tokens_used} tokenów</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Konto utworzone</span>
        <span class="stat-value">${new Date(user.created_at).toLocaleDateString('pl-PL')}</span>
      </div>
    </div>

    <!-- Transaction History Section -->
    <div class="transactions-section">
      <div class="section-header">
        <h2 class="section-title">Historia transakcji</h2>
        <div class="filter-buttons">
          <button class="filter-btn active" data-filter="all">Wszystkie</button>
          <button class="filter-btn" data-filter="purchase">Zakupy</button>
          <button class="filter-btn" data-filter="usage">Użycie</button>
        </div>
      </div>

      <div id="transactions-content">
        <div class="loading">Ładowanie historii transakcji...</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="/privacy" class="footer-link">Polityka Prywatności</a>
        <a href="/terms" class="footer-link">Regulamin</a>
        <a href="mailto:support@wtyczki.pl" class="footer-link">Kontakt</a>
      </div>
      <div class="footer-text">
        © 2025 Wtyczki DEV Patryk Pilat<br>
        NIP: [DO_UZUPEŁNIENIA] | Adres: [DO_UZUPEŁNIENIA]<br>
        System Tokenów MCP - Płatności obsługiwane przez Stripe
      </div>
    </div>
  </div>

  <script>
    // State management
    let currentFilter = 'all';
    const userId = '${user.user_id}';

    // Fetch and display transactions
    async function loadTransactions(type = 'all') {
      const content = document.getElementById('transactions-content');
      content.innerHTML = '<div class="loading">Ładowanie...</div>';

      try {
        const response = await fetch(\`/user/transactions?type=\${type}&limit=20&offset=0\`);

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();

        if (data.transactions.length === 0) {
          content.innerHTML = '<div class="empty-state">Brak transakcji</div>';
          return;
        }

        // Render transactions table
        let html = \`
          <table class="transactions-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Typ</th>
                <th>Opis</th>
                <th>Kwota</th>
                <th>Saldo po</th>
              </tr>
            </thead>
            <tbody>
        \`;

        data.transactions.forEach(tx => {
          const date = new Date(tx.created_at);
          const dateStr = date.toLocaleString('pl-PL', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const typeBadge = tx.type === 'purchase'
            ? '<span class="type-badge type-purchase">Zakup</span>'
            : '<span class="type-badge type-usage">Użycie</span>';

          const amountClass = tx.token_amount > 0 ? 'amount-positive' : 'amount-negative';
          const amountStr = tx.token_amount > 0 ? \`+\${tx.token_amount}\` : tx.token_amount;

          html += \`
            <tr>
              <td>\${dateStr}</td>
              <td>\${typeBadge}</td>
              <td>\${tx.description || 'Brak opisu'}</td>
              <td class="\${amountClass}">\${amountStr} tokenów</td>
              <td>\${tx.balance_after} tokenów</td>
            </tr>
          \`;
        });

        html += \`
            </tbody>
          </table>
        \`;

        content.innerHTML = html;

      } catch (error) {
        console.error('Error loading transactions:', error);
        content.innerHTML = '<div class="error-message">Nie udało się załadować historii transakcji. Spróbuj ponownie.</div>';
      }
    }

    // Filter button handlers
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Load filtered transactions
        const filter = btn.dataset.filter;
        currentFilter = filter;
        loadTransactions(filter);
      });
    });

    // Purchase flow - Create Stripe checkout session
    async function buyPackage(tier) {
      try {
        // Map tier to price ID (from Stripe Dashboard)
        const priceIds = {
          starter: 'price_1SJdj8CxCMDDEXzpiZ9SYQ7x',  // 10 PLN - 500 tokens
          plus: 'price_1SIlbLCxCMDDEXzpnDMP47aj',     // 25 PLN - 2000 tokens
          pro: 'price_1SIlbLCxCMDDEXzpBbdn6o22',      // 59 PLN - 5500 tokens
          gold: 'price_1SIlbLCxCMDDEXzpf7YBJcBY'     // 119 PLN - 12000 tokens (Gold)
        };

        const priceId = priceIds[tier];
        if (!priceId) {
          alert('Nieprawidłowy pakiet');
          return;
        }

        // Disable button during checkout creation
        const button = event.target;
        button.disabled = true;
        button.textContent = 'Tworzenie płatności...';

        // Create Stripe checkout session
        const response = await fetch('/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            priceId: priceId
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create checkout session');
        }

        const data = await response.json();

        // Redirect to Stripe Checkout
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL returned');
        }

      } catch (error) {
        console.error('Checkout error:', error);
        alert('Nie udało się rozpocząć płatności: ' + error.message);
        // Re-enable button
        if (event && event.target) {
          event.target.disabled = false;
          event.target.textContent = 'Kup teraz';
        }
      }
    }

    // Load transactions on page load
    loadTransactions('all');
  </script>
</body>
</html>
  `;
}

// Public home page (no authentication required)
export function renderPublicHomePage(): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kup tokeny MCP | wtyczki.ai</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="System prepaid tokenów dla dostępu do serwerów AI opartych na protokole MCP. Kup tokeny i zacznij korzystać z zaawansowanych narzędzi AI.">
  <meta name="keywords" content="MCP, tokeny, AI, Model Context Protocol, wtyczki, API, zakup tokenów">
  <meta name="author" content="Wtyczki DEV Patryk Pilat">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://panel.wtyczki.ai/">
  <meta property="og:title" content="System Tokenów MCP | wtyczki.ai">
  <meta property="og:description" content="System prepaid tokenów dla dostępu do serwerów AI opartych na protokole MCP">
  <meta property="og:image" content="https://panel.wtyczki.ai/og-image.png">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://panel.wtyczki.ai/">
  <meta property="twitter:title" content="System Tokenów MCP | wtyczki.ai">
  <meta property="twitter:description" content="System prepaid tokenów dla dostępu do serwerów AI opartych na protokole MCP">
  <meta property="twitter:image" content="https://panel.wtyczki.ai/og-image.png">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🔌</text></svg>">

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: #feffff;
      min-height: 100vh;
      padding: 20px;
      color: #222b4f;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
    }
    h1 { color: #222b4f; font-size: 32px; font-weight: 700; margin-bottom: 8px; }
    .subtitle { color: rgba(34, 43, 79, 0.65); font-size: 16px; }

    /* Email Input Card */
    .email-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
      position: relative;
    }
    .email-label {
      font-size: 18px;
      font-weight: 600;
      color: #222b4f;
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .email-label::after {
      content: '👇';
      font-size: 20px;
      animation: arrowBounce 1.5s ease-in-out infinite;
    }
    @keyframes arrowBounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(4px);
      }
    }
    .email-input {
      width: 100%;
      max-width: 400px;
      padding: 14px 20px;
      border: 2px solid #eff4f7;
      border-radius: 8px;
      font-size: 16px;
      font-family: 'DM Sans', sans-serif;
      transition: all 0.3s ease;
      background: linear-gradient(180deg, #ffffff 0%, #f9f5fc 100%);
      margin-top: 4px;
    }
    .email-input:hover {
      border-color: #b2478f;
      box-shadow: 0 2px 8px rgba(122, 11, 192, 0.15);
    }
    .email-input:focus {
      outline: none;
      border-color: #7a0bc0;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.25);
      background: white;
    }
    .email-hint {
      color: rgba(34, 43, 79, 0.5);
      font-size: 13px;
      margin-top: 8px;
    }

    .packages {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    @media (max-width: 1400px) {
      .packages {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 768px) {
      .packages {
        grid-template-columns: 1fr;
      }
    }
    .package-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
      border: 2px solid transparent;
    }
    .package-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(50, 57, 229, 0.15);
      border-color: #3239e5;
    }
    .package-name {
      font-size: 20px;
      font-weight: 600;
      color: #222b4f;
      margin-bottom: 8px;
      background: #e6174b;
      color: white;
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      border: 2px solid #b71338;
      margin-bottom: 12px;
    }
    .package-price { font-size: 32px; font-weight: 700; color: #3239e5; margin-bottom: 4px; }
    .package-tokens { color: rgba(34, 43, 79, 0.7); font-size: 14px; margin-bottom: 16px; }
    .buy-button {
      width: 100%;
      padding: 12px;
      background: #3239e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .buy-button:hover {
      background: #140f44;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(50, 57, 229, 0.4);
    }
    .buy-button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
    }

    /* Promotional Badge */
    .promo-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      border: 3px solid white;
      transform: rotate(5deg);
      animation: pulse 2s infinite;
      z-index: 10;
      white-space: nowrap;
    }
    @keyframes pulse {
      0%, 100% { transform: rotate(5deg) scale(1); }
      50% { transform: rotate(5deg) scale(1.05); }
    }
    .promo-badge-gold {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }

    /* Best Value Badge (Pro Package) */
    .best-value-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      background: linear-gradient(135deg, #7a0bc0 0%, #b2478f 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.4);
      border: 3px solid white;
      transform: rotate(5deg);
      animation: pulse 2s infinite;
      z-index: 10;
      white-space: nowrap;
    }

    /* Package Value (Cost per Token) */
    .package-value {
      color: rgba(34, 43, 79, 0.65);
      font-size: 13px;
      margin-bottom: 8px;
      font-weight: 500;
    }

    /* Package Savings */
    .package-savings {
      background: #d1fae5;
      color: #065f46;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      display: inline-block;
      margin-bottom: 12px;
    }

    /* Featured Package Card (Pro) */
    .package-card-featured {
      transform: scale(1.05);
      border: 3px solid #7a0bc0;
      box-shadow: 0 8px 24px rgba(122, 11, 192, 0.25);
      background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
    }
    .package-card-featured:hover {
      transform: scale(1.05) translateY(-4px);
      box-shadow: 0 12px 32px rgba(122, 11, 192, 0.35);
      border-color: #b2478f;
    }

    /* Trust Badges */
    .trust-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
    }
    .trust-badges {
      display: flex;
      justify-content: center;
      gap: 24px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .trust-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(34, 43, 79, 0.7);
      font-size: 14px;
    }
    .trust-badge svg {
      width: 20px;
      height: 20px;
      fill: #10b981;
    }

    /* Login Link */
    .login-card {
      background: #eff4f7;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    .login-link {
      color: #7a0bc0;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }
    .login-link:hover {
      color: #b2478f;
      text-decoration: underline;
    }

    /* Footer Styles */
    .footer {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .footer-link {
      color: #222b4f;
      text-decoration: none;
      font-size: 14px;
      transition: color 0.2s;
    }
    .footer-link:hover {
      color: #7a0bc0;
      text-decoration: underline;
    }
    .footer-text {
      color: rgba(34, 43, 79, 0.65);
      font-size: 13px;
      margin-top: 8px;
    }

    /* Mobile Responsive Styles */
    @media (max-width: 768px) {
      body { padding: 10px; }
      .container { padding: 0; }
      .header { padding: 20px; margin-bottom: 12px; }
      h1 { font-size: 24px; }
      .email-card {
        padding: 24px 16px;
        margin-bottom: 12px;
      }
      .email-label {
        font-size: 16px;
        flex-direction: column;
        gap: 4px;
      }
      .email-label::after {
        font-size: 18px;
      }
      .email-input {
        max-width: 100%;
        font-size: 16px;
      }
      .packages { grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px; }
      .package-card { padding: 20px; }
      .package-card-featured {
        transform: scale(1);
        border: 2px solid #7a0bc0;
      }
      .package-card-featured:hover {
        transform: translateY(-4px);
      }
      .trust-section { padding: 20px; margin-bottom: 12px; }
      .trust-badges { gap: 16px; }
      .footer { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>System tokenów wtyczki.ai</h1>
      <p class="subtitle">Kup tokeny i korzystaj z zaawansowanych wtyczek do narzędzi AI</p>
    </div>

    <div class="email-card">
      <div class="email-label">Podaj swój email, aby rozpocząć i kupić tokeny</div>
      <input
        type="email"
        id="guestEmail"
        class="email-input"
        placeholder="twoj@email.com"
        required
      />
      <p class="email-hint">Po zakupie ten mail posłuży Ci do zalogowania się do Panelu Klienta</p>
    </div>

    <div class="login-card">
      Masz już konto? <a href="/auth/login-custom" class="login-link">Zaloguj się tutaj</a>
    </div>

    <div class="packages">
      <div class="package-card">
        <div class="package-name">Starter</div>
        <div class="package-price">10 zł</div>
        <div class="package-tokens">500 tokenów</div>
        <div class="package-value">2 grosze za token</div>
        <button class="buy-button" onclick="buyPackageGuest('starter')">Kup teraz</button>
      </div>

      <div class="package-card">
        <div class="package-name">Plus</div>
        <div class="package-price">25 zł</div>
        <div class="package-tokens">2 000 tokenów</div>
        <div class="package-value">1,25 grosza za token</div>
        <button class="buy-button" onclick="buyPackageGuest('plus')">Kup teraz</button>
      </div>

      <div class="package-card package-card-featured">
        <div class="best-value-badge">⭐ Najpopularniejszy</div>
        <div class="package-name">Pro</div>
        <div class="package-price">59 zł</div>
        <div class="package-tokens">5 500 tokenów</div>
        <div class="package-value">1,07 grosza za token</div>
        <div class="package-savings">500 tokenów gratis!</div>
        <button class="buy-button" onclick="buyPackageGuest('pro')">Kup teraz</button>
      </div>

      <div class="package-card">
        <div class="promo-badge promo-badge-gold">💎 Superpakiet</div>
        <div class="package-name">Gold</div>
        <div class="package-price">119 zł</div>
        <div class="package-tokens">12 000 tokenów</div>
        <div class="package-value">0,99 grosza za token</div>
        <div class="package-savings">2 000 tokenów gratis!</div>
        <button class="buy-button" onclick="buyPackageGuest('gold')">Kup teraz</button>
      </div>
    </div>

    <div class="trust-section">
      <div class="trust-badges">
        <div class="trust-badge">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Bezpieczne płatności przez Stripe
        </div>
        <div class="trust-badge">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L12 10.66 10.48 12h.01L7.8 14.39c-.64.64-1.49.99-2.4.99-1.87 0-3.39-1.51-3.39-3.38S3.53 8.62 5.4 8.62c.91 0 1.76.35 2.44 1.03l.96.96 1.41-1.41-.96-.96c-1.1-1.1-2.56-1.7-4.12-1.7C2.14 6.54 0 8.68 0 11.62s2.14 5.08 5.08 5.08c1.56 0 3.02-.6 4.12-1.7l2.68-2.68.01-.01.01.01 2.68 2.68c1.1 1.1 2.56 1.7 4.12 1.7 2.94 0 5.08-2.14 5.08-5.08s-2.14-5.08-5.08-5.08zm0 8.16c-.91 0-1.76-.35-2.44-1.03l-2.67-2.67 2.67-2.67c.68-.68 1.53-1.03 2.44-1.03 1.87 0 3.39 1.51 3.39 3.38s-1.52 3.39-3.39 3.39z"/></svg>
          Tokeny bez daty ważności
        </div>
        <div class="trust-badge">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
          Natychmiastowy dostęp po płatności
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="/privacy" class="footer-link">Polityka Prywatności</a>
        <a href="/terms" class="footer-link">Regulamin</a>
        <a href="mailto:support@wtyczki.pl" class="footer-link">Kontakt</a>
      </div>
      <div class="footer-text">
        © 2025 Wtyczki DEV Patryk Pilat<br>
        NIP: [DO_UZUPEŁNIENIA] | Adres: [DO_UZUPEŁNIENIA]<br>
        System Tokenów MCP - Płatności obsługiwane przez Stripe
      </div>
    </div>
  </div>

  <script>
    // Guest purchase flow - Create Stripe checkout session without user account
    async function buyPackageGuest(tier) {
      try {
        // Get and validate email
        const emailInput = document.getElementById('guestEmail');
        const email = emailInput.value.trim();

        if (!email) {
          alert('Proszę podać adres email');
          emailInput.focus();
          return;
        }

        // Basic email validation
        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!emailRegex.test(email)) {
          alert('Proszę podać poprawny adres email');
          emailInput.focus();
          return;
        }

        // Map tier to price ID (from Stripe Dashboard)
        const priceIds = {
          starter: 'price_1SJdj8CxCMDDEXzpiZ9SYQ7x',  // 10 PLN - 500 tokens
          plus: 'price_1SIlbLCxCMDDEXzpnDMP47aj',     // 25 PLN - 2000 tokens
          pro: 'price_1SIlbLCxCMDDEXzpBbdn6o22',      // 59 PLN - 5500 tokens
          gold: 'price_1SIlbLCxCMDDEXzpf7YBJcBY'     // 119 PLN - 12000 tokens (Gold)
        };

        const priceId = priceIds[tier];
        if (!priceId) {
          alert('Nieprawidłowy pakiet');
          return;
        }

        // Disable all buttons during checkout creation
        const buttons = document.querySelectorAll('.buy-button');
        const clickedButton = event.target;
        buttons.forEach(btn => {
          btn.disabled = true;
          if (btn === clickedButton) {
            btn.textContent = 'Tworzenie płatności...';
          }
        });

        // Create Stripe checkout session
        const response = await fetch('/checkout/create-guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            priceId: priceId
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create checkout session');
        }

        const data = await response.json();

        // Redirect to Stripe Checkout
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL returned');
        }

      } catch (error) {
        console.error('Checkout error:', error);
        alert('Nie udało się rozpocząć płatności: ' + error.message);

        // Re-enable buttons
        const buttons = document.querySelectorAll('.buy-button');
        buttons.forEach(btn => {
          btn.disabled = false;
          btn.textContent = 'Kup teraz';
        });
      }
    }

    // Reset buttons when user returns via back button (browser cache)
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        // Page restored from cache - reset all buttons
        console.log('Page restored from cache - resetting buttons');
        const buttons = document.querySelectorAll('.buy-button');
        buttons.forEach(btn => {
          btn.disabled = false;
          btn.textContent = 'Kup teraz';
        });
      }
    });

    // Also reset when page is about to unload (extra safety)
    window.addEventListener('beforeunload', function() {
      const buttons = document.querySelectorAll('.buy-button');
      buttons.forEach(btn => {
        btn.disabled = false;
        btn.textContent = 'Kup teraz';
      });
    });
  </script>
</body>
</html>
  `;
}

// Settings page with account deletion feature
export function renderSettingsPage(user: User): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ustawienia konta | wtyczki.ai</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="Ustawienia konta - zarządzaj swoim kontem">
  <meta name="robots" content="noindex, nofollow">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>⚙️</text></svg>">

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: #feffff;
      min-height: 100vh;
      padding: 20px;
      color: #222b4f;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h1 { color: #222b4f; font-size: 24px; font-weight: 600; }
    .back-link {
      color: #7a0bc0;
      text-decoration: none;
      font-size: 14px;
      transition: color 0.2s;
    }
    .back-link:hover {
      color: #b2478f;
      text-decoration: underline;
    }

    /* Account Information Card */
    .info-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #222b4f;
      margin-bottom: 16px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eff4f7;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: rgba(34, 43, 79, 0.65); }
    .info-value { font-weight: 600; color: #222b4f; }

    /* Logout Button */
    .logout-button {
      width: 100%;
      padding: 12px;
      background: #3239e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 12px;
    }
    .logout-button:hover {
      background: #140f44;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(50, 57, 229, 0.4);
    }

    /* Danger Zone */
    .danger-zone {
      background: white;
      border: 2px solid #fee2e2;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .danger-title {
      font-size: 18px;
      font-weight: 600;
      color: #dc2626;
      margin-bottom: 8px;
    }
    .danger-subtitle {
      color: rgba(34, 43, 79, 0.65);
      font-size: 14px;
      margin-bottom: 16px;
    }
    .warning-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }
    .warning-box ul {
      margin-left: 20px;
      margin-top: 8px;
    }
    .warning-box li {
      margin: 4px 0;
      color: #78350f;
    }
    .delete-button {
      width: 100%;
      padding: 12px;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .delete-button:hover {
      background: #991b1b;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
    }

    /* Modal Styles */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .modal-title {
      font-size: 24px;
      font-weight: 600;
      color: #dc2626;
      margin-bottom: 16px;
    }
    .modal-content {
      color: #222b4f;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .modal-warning {
      background: #fee2e2;
      border-left: 4px solid #dc2626;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
      color: #991b1b;
    }
    .modal-buttons {
      display: flex;
      gap: 12px;
    }
    .modal-button {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .modal-button-cancel {
      background: #eff4f7;
      color: #222b4f;
    }
    .modal-button-cancel:hover {
      background: #e2e8f0;
    }
    .modal-button-confirm {
      background: #dc2626;
      color: white;
    }
    .modal-button-confirm:hover {
      background: #991b1b;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
    }
    .modal-button-proceed {
      background: #f59e0b;
      color: white;
    }
    .modal-button-proceed:hover {
      background: #d97706;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }

    /* Confirmation Input */
    .confirmation-input {
      width: 100%;
      padding: 12px;
      border: 2px solid #eff4f7;
      border-radius: 8px;
      font-size: 16px;
      font-family: 'DM Sans', sans-serif;
      margin: 16px 0;
      text-align: center;
      font-weight: 600;
      letter-spacing: 2px;
    }
    .confirmation-input:focus {
      outline: none;
      border-color: #dc2626;
    }
    .confirmation-input.valid {
      border-color: #10b981;
      background: #d1fae5;
    }
    .confirmation-input.invalid {
      border-color: #dc2626;
      background: #fee2e2;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      body { padding: 10px; }
      .container { padding: 0; }
      .header { padding: 16px; margin-bottom: 12px; }
      h1 { font-size: 20px; }
      .info-card, .danger-zone { padding: 16px; margin-bottom: 12px; }
      .modal { padding: 24px; width: 95%; }
      .modal-buttons { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>Ustawienia konta</h1>
      <a href="/dashboard" class="back-link">← Powrót do panelu</a>
    </div>

    <!-- Account Information -->
    <div class="info-card">
      <h2 class="section-title">Informacje o koncie</h2>
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${user.email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Aktualny stan tokenów</span>
        <span class="info-value">${user.current_token_balance} tokenów</span>
      </div>
      <div class="info-row">
        <span class="info-label">Konto utworzone</span>
        <span class="info-value">${new Date(user.created_at).toLocaleDateString('pl-PL')}</span>
      </div>

      <!-- Logout Button -->
      <button class="logout-button" onclick="handleLogout()">Wyloguj się</button>
    </div>

    <!-- Danger Zone -->
    <div class="danger-zone">
      <h2 class="danger-title">⚠️ Strefa niebezpieczna</h2>
      <p class="danger-subtitle">Działania w tej sekcji są nieodwracalne</p>

      <div class="warning-box">
        <strong>⚠️ Uwaga! Usunięcie konta jest trwałe i nieodwracalne.</strong>
        <ul>
          <li><strong>Utracisz dostęp</strong> do swojego konta i wszystkich tokenów</li>
          <li><strong>Wszystkie niewykorzystane tokeny</strong> (${user.current_token_balance} tokenów) zostaną przepadnięte</li>
          <li><strong>Nie ma możliwości zwrotu</strong> środków za niewykorzystane tokeny</li>
          <li><strong>Twoje dane osobowe</strong> zostaną zanonimizowane zgodnie z GDPR</li>
          <li><strong>Historia transakcji</strong> zostanie zachowana dla celów księgowych (zanonimizowana)</li>
        </ul>
      </div>

      <button class="delete-button" onclick="showDeleteWarning()">Usuń moje konto</button>
    </div>
  </div>

  <!-- Modal: Step 1 - Warning -->
  <div id="modal-warning" class="modal-overlay">
    <div class="modal">
      <h2 class="modal-title">⚠️ Czy na pewno chcesz usunąć konto?</h2>
      <div class="modal-content">
        <p><strong>Ta operacja jest nieodwracalna.</strong></p>
        <div class="modal-warning">
          <p><strong>Utracisz:</strong></p>
          <ul>
            <li>Dostęp do swojego konta</li>
            <li><strong>${user.current_token_balance} tokenów</strong> (bez zwrotu)</li>
            <li>Całą historię zakupów i użycia</li>
          </ul>
        </div>
        <p>Jeśli jesteś pewien, kliknij "Kontynuuj", aby przejść do ostatecznego potwierdzenia.</p>
      </div>
      <div class="modal-buttons">
        <button class="modal-button modal-button-cancel" onclick="closeModal('modal-warning')">Anuluj</button>
        <button class="modal-button modal-button-proceed" onclick="showDeleteConfirmation()">Kontynuuj</button>
      </div>
    </div>
  </div>

  <!-- Modal: Step 2 - Final Confirmation -->
  <div id="modal-confirmation" class="modal-overlay">
    <div class="modal">
      <h2 class="modal-title">🔐 Ostateczne potwierdzenie</h2>
      <div class="modal-content">
        <p><strong>Aby potwierdzić usunięcie konta, wpisz słowo:</strong></p>
        <p style="text-align: center; font-size: 24px; font-weight: 700; color: #dc2626; margin: 16px 0;">DELETE</p>
        <input
          type="text"
          id="confirmation-input"
          class="confirmation-input"
          placeholder="Wpisz DELETE"
          autocomplete="off"
        />
        <div class="modal-warning">
          <p><strong>Po usunięciu konta:</strong></p>
          <ul>
            <li>Twój email zostanie zanonimizowany</li>
            <li>Wszystkie sesje zostaną zakończone</li>
            <li>Tokeny (${user.current_token_balance}) zostaną przepadnięte</li>
            <li>Nie będzie możliwości odzyskania konta</li>
          </ul>
        </div>
      </div>
      <div class="modal-buttons">
        <button class="modal-button modal-button-cancel" onclick="closeModal('modal-confirmation')">Anuluj</button>
        <button class="modal-button modal-button-confirm" id="final-delete-button" disabled onclick="confirmAccountDeletion()">Usuń konto na zawsze</button>
      </div>
    </div>
  </div>

  <script>
    const userId = '${user.user_id}';

    // Show warning modal
    function showDeleteWarning() {
      document.getElementById('modal-warning').classList.add('active');
    }

    // Show confirmation modal
    function showDeleteConfirmation() {
      closeModal('modal-warning');
      document.getElementById('modal-confirmation').classList.add('active');
      document.getElementById('confirmation-input').focus();
    }

    // Close modal
    function closeModal(modalId) {
      document.getElementById(modalId).classList.remove('active');
      if (modalId === 'modal-confirmation') {
        document.getElementById('confirmation-input').value = '';
        document.getElementById('final-delete-button').disabled = true;
      }
    }

    // Validation for confirmation input
    const confirmationInput = document.getElementById('confirmation-input');
    const finalDeleteButton = document.getElementById('final-delete-button');

    confirmationInput.addEventListener('input', () => {
      const value = confirmationInput.value.trim();

      if (value === 'DELETE') {
        confirmationInput.classList.add('valid');
        confirmationInput.classList.remove('invalid');
        finalDeleteButton.disabled = false;
      } else if (value.length > 0) {
        confirmationInput.classList.add('invalid');
        confirmationInput.classList.remove('valid');
        finalDeleteButton.disabled = true;
      } else {
        confirmationInput.classList.remove('valid', 'invalid');
        finalDeleteButton.disabled = true;
      }
    });

    // Final account deletion
    async function confirmAccountDeletion() {
      try {
        finalDeleteButton.disabled = true;
        finalDeleteButton.textContent = 'Usuwanie konta...';

        const response = await fetch('/account/delete/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            confirmation: 'DELETE'
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Nie udało się usunąć konta');
        }

        // Success - redirect to goodbye page
        alert('Twoje konto zostało usunięte. Zostaniesz przekierowany na stronę główną.');
        window.location.href = '/';

      } catch (error) {
        console.error('Deletion error:', error);
        alert('Wystąpił błąd podczas usuwania konta: ' + error.message);
        finalDeleteButton.disabled = false;
        finalDeleteButton.textContent = 'Usuń konto na zawsze';
      }
    }

    // Logout handler
    async function handleLogout() {
      try {
        const response = await fetch('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.logoutUrl) {
          // Redirect to WorkOS logout URL
          window.location.href = data.logoutUrl;
        } else {
          // Just redirect to home page
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Logout error:', error);
        // Fallback: just redirect to home
        window.location.href = '/';
      }
    }

    // Close modal when clicking outside
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(overlay.id);
        }
      });
    });
  </script>
</body>
</html>
  `;
}

