// src/views/customLoginPage.ts - Custom Magic Auth Login UI

export function renderLoginEmailForm(
  error?: string,
  returnTo: string = '/dashboard',
  csrfToken: string = ''  // OAuth 2.1: CSRF protection
): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zaloguj się - wtyczki.ai</title>

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #feffff;
      color: #222b4f;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      max-width: 400px;
      width: 100%;
    }

    .logo {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #222b4f;
    }

    .logo p {
      color: rgba(34, 43, 79, 0.65);
      font-size: 20px;
      font-weight: 600;
    }

    .logo img {
      max-width: 144px;
      height: auto;
      margin-bottom: 12px;
    }

    .card {
      background: white;
      border: 2px solid #eff4f7;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.1);
    }

    h2 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 24px;
      text-align: center;
      color: #222b4f;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      color: #222b4f;
    }

    input[type="email"] {
      width: 100%;
      padding: 14px 16px;
      font-size: 16px;
      background: white;
      border: 2px solid #eff4f7;
      border-radius: 8px;
      color: #222b4f;
      outline: none;
      transition: all 0.2s;
      font-family: 'DM Sans', sans-serif;
    }

    input[type="email"]:focus {
      border-color: #3239e5;
      box-shadow: 0 0 0 3px rgba(50, 57, 229, 0.1);
    }

    button {
      width: 100%;
      padding: 14px 16px;
      font-size: 16px;
      font-weight: 600;
      background: #3239e5;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'DM Sans', sans-serif;
    }

    button:hover {
      background: #140f44;
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(50, 57, 229, 0.3);
    }

    button:active {
      transform: translateY(0);
    }

    .error {
      background: #fee2e2;
      border: 2px solid #fecaca;
      color: #991b1b;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .error a {
      color: #991b1b;
      font-weight: 600;
      text-decoration: underline;
    }

    .info {
      background: #eff4f7;
      border: 2px solid #e0e7ef;
      color: #222b4f;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .info a {
      color: #7a0bc0;
      font-weight: 600;
      text-decoration: none;
    }

    .info a:hover {
      text-decoration: underline;
    }

    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 14px;
      color: rgba(34, 43, 79, 0.65);
    }

    .footer a {
      color: #7a0bc0;
      text-decoration: none;
      font-weight: 600;
    }

    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="/wtyczkiai_logo_panel.png" alt="wtyczki.ai" />
      <p>Panel klienta</p>
    </div>

    <div class="card">
      <h2>Zaloguj się</h2>

      ${error ? `
        <div class="error">
          ⚠️ ${error}
        </div>
      ` : ''}

      <div class="info">
        💡 Nie masz jeszcze konta? Użyj tego samego formularza, aby się zarejestrować.
      </div>

      <form method="POST" action="/auth/login-custom/send-code">
        <input type="hidden" name="csrf_token" value="${csrfToken}" />
        <input type="hidden" name="return_to" value="${returnTo}" />

        <div class="form-group">
          <label for="email">Adres e-mail</label>
          <input
            type="email"
            name="email"
            id="email"
            placeholder="twoj@email.pl"
            autocomplete="username"
            autofocus
            required
          />
        </div>

        <button type="submit">Wyślij kod weryfikacyjny</button>
      </form>
    </div>

    <div class="footer">
      Pierwszy raz tutaj? Podaj email - konto zostanie utworzone automatycznie.
    </div>
  </div>
</body>
</html>
  `;
}

export function renderLoginCodeForm(
  email: string,
  error?: string,
  returnTo: string = '/dashboard',
  csrfToken: string = ''  // OAuth 2.1: CSRF protection
): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wprowadź kod - wtyczki.ai</title>

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #feffff;
      color: #222b4f;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      max-width: 400px;
      width: 100%;
    }

    .logo {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #222b4f;
    }

    .logo p {
      color: rgba(34, 43, 79, 0.65);
      font-size: 20px;
      font-weight: 600;
    }

    .logo img {
      max-width: 144px;
      height: auto;
      margin-bottom: 12px;
    }

    .card {
      background: white;
      border: 2px solid #eff4f7;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.1);
    }

    h2 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
      text-align: center;
      color: #222b4f;
    }

    .subtitle {
      text-align: center;
      color: rgba(34, 43, 79, 0.65);
      font-size: 14px;
      margin-bottom: 24px;
    }

    .subtitle strong {
      color: #222b4f;
      font-weight: 600;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      color: #222b4f;
    }

    input[type="text"] {
      width: 100%;
      padding: 16px;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 8px;
      text-align: center;
      background: white;
      border: 2px solid #eff4f7;
      border-radius: 8px;
      color: #222b4f;
      outline: none;
      transition: all 0.2s;
      font-family: 'DM Sans', monospace;
    }

    input[type="text"]:focus {
      border-color: #3239e5;
      box-shadow: 0 0 0 3px rgba(50, 57, 229, 0.1);
    }

    button {
      width: 100%;
      padding: 14px 16px;
      font-size: 16px;
      font-weight: 600;
      background: #3239e5;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'DM Sans', sans-serif;
    }

    button:hover {
      background: #140f44;
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(50, 57, 229, 0.3);
    }

    button:active {
      transform: translateY(0);
    }

    .error {
      background: #fee2e2;
      border: 2px solid #fecaca;
      color: #991b1b;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .success {
      background: #d1fae5;
      border: 2px solid #a7f3d0;
      color: #065f46;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .info {
      background: #eff4f7;
      border: 2px solid #e0e7ef;
      color: #222b4f;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
      text-align: center;
    }

    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 14px;
      color: rgba(34, 43, 79, 0.65);
    }

    .footer a {
      color: #7a0bc0;
      text-decoration: none;
      font-weight: 600;
    }

    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="/wtyczkiai_logo_panel.png" alt="wtyczki.ai" />
      <p>Panel klienta</p>
    </div>

    <div class="card">
      <h2>Wprowadź kod weryfikacyjny</h2>
      <p class="subtitle">Wysłany na <strong>${email}</strong></p>

      ${error ? `
        <div class="error">
          ⚠️ ${error}
        </div>
      ` : ''}

      <div class="success">
        ✅ Kod został wysłany! Sprawdź swoją skrzynkę e-mail.
      </div>

      <div class="info">
        ⏱️ Kod wygasa po 10 minutach
      </div>

      <form method="POST" action="/auth/login-custom/verify-code">
        <input type="hidden" name="csrf_token" value="${csrfToken}" />
        <input type="hidden" name="email" value="${email}" />
        <input type="hidden" name="return_to" value="${returnTo}" />

        <div class="form-group">
          <label for="code">6-cyfrowy kod</label>
          <input
            type="text"
            name="code"
            id="code"
            placeholder="000000"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="^\\d{6}$"
            maxlength="6"
            autofocus
            required
          />
        </div>

        <button type="submit">Zaloguj się</button>
      </form>
    </div>

    <div class="footer">
      Nie otrzymałeś kodu? <a href="/auth/login-custom">Wyślij ponownie</a>
    </div>
  </div>
</body>
</html>
  `;
}
