// src/views/templates/public/unifiedAuth.ts - Unified Login/Registration Page with Tabs

export type AuthTab = 'login' | 'register';

export function renderUnifiedAuthPage(csrfToken: string, activeTab: AuthTab = 'login', error?: string): string {
  const isLogin = activeTab === 'login';

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isLogin ? 'Zaloguj się' : 'Zarejestruj się'} | wtyczki.ai</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="Zarządzaj swoimi aplikacjami MCP i kluczami API. Bezpieczne uwierzytelnianie OAuth 2.1 dla serwerów Model Context Protocol.">
  <meta name="keywords" content="MCP, OAuth, API, Model Context Protocol, wtyczki, uwierzytelnianie">
  <meta name="author" content="Wtyczki DEV Patryk Pilat">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://panel.wtyczki.ai/">
  <meta property="og:title" content="Panel MCP | wtyczki.ai">
  <meta property="og:description" content="Zarządzaj swoimi aplikacjami MCP i kluczami API">
  <meta property="og:image" content="https://panel.wtyczki.ai/og-image.png">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://panel.wtyczki.ai/">
  <meta property="twitter:title" content="Panel MCP | wtyczki.ai">
  <meta property="twitter:description" content="Zarządzaj swoimi aplikacjami MCP i kluczami API">
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
      background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #f5f3ff 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #222b4f;
    }
    .container {
      max-width: 480px;
      width: 100%;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 10px 40px rgba(122, 11, 192, 0.15);
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo img {
      height: 48px;
      width: auto;
    }

    /* Tabs */
    .auth-tabs {
      display: flex;
      margin-bottom: 32px;
      border-bottom: 2px solid #eff4f7;
    }
    .tab {
      flex: 1;
      padding: 14px 24px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      color: #6b7280;
      transition: all 0.2s ease;
      position: relative;
    }
    .tab:hover {
      color: #7a0bc0;
    }
    .tab.active {
      color: #7a0bc0;
    }
    .tab.active::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(135deg, #7a0bc0 0%, #b2478f 100%);
    }

    h1 {
      color: #222b4f;
      font-size: 26px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 12px;
    }
    .subtitle {
      color: rgba(34, 43, 79, 0.65);
      font-size: 15px;
      text-align: center;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    .form-group {
      margin-bottom: 24px;
    }
    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #222b4f;
      margin-bottom: 8px;
    }
    .email-input {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #eff4f7;
      border-radius: 10px;
      font-size: 16px;
      font-family: 'DM Sans', sans-serif;
      transition: all 0.3s ease;
      background: #fafafa;
    }
    .email-input:hover {
      border-color: #b2478f;
    }
    .email-input:focus {
      outline: none;
      border-color: #7a0bc0;
      box-shadow: 0 0 0 3px rgba(122, 11, 192, 0.15);
      background: white;
    }
    .submit-button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #7a0bc0 0%, #b2478f 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .submit-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(122, 11, 192, 0.35);
    }
    .submit-button:active {
      transform: translateY(0);
    }
    .submit-button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .error-message {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      display: none;
    }
    .error-message.visible {
      display: block;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    .footer-link {
      color: rgba(34, 43, 79, 0.65);
      text-decoration: none;
      font-size: 13px;
      transition: color 0.2s;
    }
    .footer-link:hover {
      color: #7a0bc0;
      text-decoration: underline;
    }
    .footer-text {
      color: rgba(34, 43, 79, 0.5);
      font-size: 12px;
      margin-top: 12px;
    }

    @media (max-width: 480px) {
      body { padding: 16px; }
      .card { padding: 28px 20px; }
      h1 { font-size: 22px; }
      .subtitle { font-size: 14px; }
      .tab { padding: 12px 16px; font-size: 15px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <img src="/wtyczkiai_logo_panel.png" alt="wtyczki.ai" />
      </div>

      <div class="auth-tabs">
        <button type="button" class="tab${isLogin ? ' active' : ''}" data-tab="login">Logowanie</button>
        <button type="button" class="tab${!isLogin ? ' active' : ''}" data-tab="register">Rejestracja</button>
      </div>

      <h1 id="heading">${isLogin ? 'Zaloguj się do wtyczki.ai' : 'Utwórz konto w wtyczki.ai'}</h1>
      <p class="subtitle" id="subtitle">${isLogin
        ? 'Wprowadź email, aby otrzymać kod weryfikacyjny'
        : 'Zarejestruj się, aby zarządzać aplikacjami MCP i kluczami API'}</p>

      <div id="errorMessage" class="error-message${error ? ' visible' : ''}">${error || ''}</div>

      <form id="authForm" action="/auth/login-custom/send-code" method="POST" onsubmit="handleSubmit(event)">
        <input type="hidden" name="csrf_token" id="csrfToken" value="${csrfToken}">
        <input type="hidden" name="return_to" value="/dashboard">
        <input type="hidden" name="mode" id="mode" value="${activeTab}">

        <div class="form-group">
          <label for="email" class="form-label">Adres e-mail</label>
          <input
            type="email"
            id="email"
            name="email"
            class="email-input"
            placeholder="twoj@email.com"
            required
            autocomplete="email"
            autofocus
          />
        </div>

        <button type="submit" id="submitButton" class="submit-button">
          ${isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
        </button>
      </form>
    </div>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy" class="footer-link">Polityka Prywatności</a>
        <a href="/terms" class="footer-link">Regulamin</a>
        <a href="mailto:support@wtyczki.pl" class="footer-link">Kontakt</a>
      </div>
      <p class="footer-text">© 2025 Wtyczki DEV Patryk Pilat</p>
    </div>
  </div>

  <script>
    // Tab switching logic
    const tabs = document.querySelectorAll('.tab');
    const modeInput = document.getElementById('mode');
    const submitBtn = document.getElementById('submitButton');
    const heading = document.getElementById('heading');
    const subtitle = document.getElementById('subtitle');
    const errorMessage = document.getElementById('errorMessage');

    const content = {
      login: {
        heading: 'Zaloguj się do wtyczki.ai',
        subtitle: 'Wprowadź email, aby otrzymać kod weryfikacyjny',
        button: 'Zaloguj się',
        loading: 'Logowanie...'
      },
      register: {
        heading: 'Utwórz konto w wtyczki.ai',
        subtitle: 'Zarejestruj się, aby zarządzać aplikacjami MCP i kluczami API',
        button: 'Zarejestruj się',
        loading: 'Rejestracja...'
      }
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const mode = tab.dataset.tab;
        const c = content[mode];

        // Update form
        modeInput.value = mode;
        submitBtn.textContent = c.button;
        heading.textContent = c.heading;
        subtitle.textContent = c.subtitle;

        // Clear error
        errorMessage.classList.remove('visible');
        errorMessage.textContent = '';

        // Update URL without reload
        const newUrl = mode === 'login' ? '/' : '/?tab=register';
        history.replaceState(null, '', newUrl);

        // Update page title
        document.title = (mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się') + ' | wtyczki.ai';
      });
    });

    // CSRF token fallback
    document.addEventListener('DOMContentLoaded', function() {
      const csrfToken = document.getElementById('csrfToken').value;
      if (!csrfToken) {
        const fallback = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        document.getElementById('csrfToken').value = fallback;
      }
    });

    // Form submission
    async function handleSubmit(event) {
      event.preventDefault();

      const form = event.target;
      const email = document.getElementById('email').value.trim();
      const mode = modeInput.value;
      const c = content[mode];

      // Validate email
      if (!email) {
        showError('Proszę podać adres e-mail');
        return;
      }

      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      if (!emailRegex.test(email)) {
        showError('Proszę podać poprawny adres e-mail');
        return;
      }

      // Disable button and show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = c.loading;
      errorMessage.classList.remove('visible');

      try {
        form.submit();
      } catch (error) {
        showError('Wystąpił błąd. Spróbuj ponownie.');
        submitBtn.disabled = false;
        submitBtn.textContent = c.button;
      }
    }

    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.classList.add('visible');
    }

    // Reset button state when page is restored from cache
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        const mode = modeInput.value;
        submitBtn.disabled = false;
        submitBtn.textContent = content[mode].button;
      }
    });
  </script>
</body>
</html>
  `;
}
