// src/views/templates/auth/logoutSuccess.ts - Logout Success Page

export function renderLogoutSuccessPage(): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wylogowano | wtyczki.ai</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 100%;
      padding: 48px 40px;
      text-align: center;
    }

    .logo {
      width: 120px;
      height: auto;
      margin-bottom: 24px;
    }

    .success-icon {
      font-size: 72px;
      margin-bottom: 24px;
      animation: scaleIn 0.5s ease-out;
    }

    @keyframes scaleIn {
      from {
        transform: scale(0);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    h1 {
      font-size: 32px;
      color: #1f2937;
      margin-bottom: 16px;
      font-weight: 700;
    }

    .message {
      font-size: 16px;
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 40px;
    }

    .button-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 32px;
    }

    .button {
      display: inline-block;
      padding: 14px 28px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
      width: 100%;
    }

    .button-primary {
      background: #3b82f6;
      color: white;
    }

    .button-primary:hover {
      background: #2563eb;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    .button-secondary {
      background: white;
      color: #3b82f6;
      border: 2px solid #3b82f6;
    }

    .button-secondary:hover {
      background: #eff6ff;
      transform: translateY(-1px);
    }

    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #e5e7eb, transparent);
      margin: 32px 0;
    }

    .promo {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
    }

    .promo-title {
      font-size: 18px;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .promo-text {
      font-size: 14px;
      color: #78350f;
      margin-bottom: 16px;
    }

    .button-buy {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      display: inline-block;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .button-buy:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
    }

    .footer {
      font-size: 14px;
      color: #9ca3af;
      margin-top: 20px;
    }

    @media (max-width: 640px) {
      .container {
        padding: 32px 24px;
      }

      h1 {
        font-size: 24px;
      }

      .success-icon {
        font-size: 56px;
      }

      .button-group {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Logo -->
    <img src="/wtyczkiai_logo_panel.png" alt="wtyczki.ai" class="logo">

    <!-- Success Icon -->
    <div class="success-icon">✅</div>

    <!-- Title -->
    <h1>Wylogowano pomyślnie</h1>

    <!-- Message -->
    <p class="message">
      Zostałeś bezpiecznie wylogowany z konta wtyczki.ai.<br>
      Twoja sesja została zakończona.
    </p>

    <!-- Action Buttons -->
    <div class="button-group">
      <a href="https://panel.wtyczki.ai/auth/login-custom" class="button button-primary">
        🔐 Zaloguj się ponownie
      </a>
      <a href="https://wtyczki.ai" class="button button-secondary">
        🏠 Strona główna
      </a>
    </div>

    <!-- Divider -->
    <div class="divider"></div>

    <!-- Promo Section -->
    <div class="promo">
      <div class="promo-title">
        💡 Potrzebujesz więcej tokenów?
      </div>
      <p class="promo-text">
        Kup pakiet tokenów i korzystaj z serwerów MCP bez ograniczeń!
      </p>
      <a href="https://panel.wtyczki.ai" class="button-buy">
        Kup teraz →
      </a>
    </div>

    <!-- Footer -->
    <div class="footer">
      © 2025 wtyczki.ai - Wszystkie prawa zastrzeżone
    </div>
  </div>
</body>
</html>
`;
}
