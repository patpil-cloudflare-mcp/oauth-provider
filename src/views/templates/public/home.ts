// src/views/templates/public/home.ts - Public Home Page (Registration/Login)

export function renderPublicHomePage(csrfToken: string): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel MCP | wtyczki.ai</title>

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
      margin-bottom: 32px;
    }
    .logo img {
      height: 48px;
      width: auto;
    }
    h1 {
      color: #222b4f;
      font-size: 28px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 12px;
    }
    .subtitle {
      color: rgba(34, 43, 79, 0.65);
      font-size: 16px;
      text-align: center;
      margin-bottom: 32px;
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
    .divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #eff4f7;
    }
    .divider span {
      padding: 0 16px;
      color: rgba(34, 43, 79, 0.5);
      font-size: 13px;
    }
    .info-box {
      background: #f5f3ff;
      border-radius: 10px;
      padding: 16px;
      text-align: center;
    }
    .info-box p {
      color: rgba(34, 43, 79, 0.7);
      font-size: 14px;
      line-height: 1.5;
    }
    .dashboard-link {
      display: inline-block;
      margin-top: 8px;
      color: #7a0bc0;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }
    .dashboard-link:hover {
      color: #b2478f;
      text-decoration: underline;
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

    @media (max-width: 480px) {
      body { padding: 16px; }
      .card { padding: 28px 20px; }
      h1 { font-size: 24px; }
      .subtitle { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <img src="/wtyczkiai_logo_panel.png" alt="wtyczki.ai" />
      </div>

      <h1>Zarejestruj się w wtyczki.ai</h1>
      <p class="subtitle">Utwórz konto, aby zarządzać swoimi aplikacjami MCP i kluczami API</p>

      <div id="errorMessage" class="error-message"></div>

      <form id="loginForm" action="/auth/login-custom/send-code" method="POST" onsubmit="handleSubmit(event)">
        <input type="hidden" name="csrf_token" id="csrfToken" value="${csrfToken}">
        <input type="hidden" name="return_to" value="/dashboard">
        <input type="hidden" name="mode" value="register">

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
          />
        </div>

        <button type="submit" id="submitButton" class="submit-button">
          Zarejestruj się
        </button>
      </form>

      <div class="divider"><span>lub</span></div>

      <div class="info-box">
        <p>Masz już konto?</p>
        <a href="/dashboard" class="dashboard-link">Zaloguj się →</a>
      </div>
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
    document.addEventListener('DOMContentLoaded', function() {
      const csrfToken = document.getElementById('csrfToken').value;
      if (!csrfToken) {
        const fallback = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        document.getElementById('csrfToken').value = fallback;
      }
    });

    async function handleSubmit(event) {
      event.preventDefault();

      const form = event.target;
      const submitButton = document.getElementById('submitButton');
      const errorMessage = document.getElementById('errorMessage');
      const email = document.getElementById('email').value.trim();

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
      submitButton.disabled = true;
      submitButton.textContent = 'Rejestracja...';
      errorMessage.classList.remove('visible');

      try {
        // Submit the form
        form.submit();
      } catch (error) {
        showError('Wystąpił błąd. Spróbuj ponownie.');
        submitButton.disabled = false;
        submitButton.textContent = 'Zarejestruj się';
      }
    }

    function showError(message) {
      const errorMessage = document.getElementById('errorMessage');
      errorMessage.textContent = message;
      errorMessage.classList.add('visible');
    }

    // Reset button state when page is restored from cache
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        const submitButton = document.getElementById('submitButton');
        submitButton.disabled = false;
        submitButton.textContent = 'Zarejestruj się';
      }
    });
  </script>
</body>
</html>
  `;
}
