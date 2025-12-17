// src/views/templates/auth/loginSuccess.ts - Login Success Page

export interface LoginSuccessData {
  email: string;
  redirectUrl: string;
  redirectDelay?: number; // milliseconds, default 2500
}

export function renderLoginSuccessPage(data: LoginSuccessData): string {
  const { email, redirectUrl, redirectDelay = 2500 } = data;

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zalogowano | wtyczki.ai</title>
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
      margin-bottom: 24px;
    }

    .email {
      font-weight: 600;
      color: #3b82f6;
    }

    .redirect-info {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .redirect-text {
      font-size: 14px;
      color: #166534;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #bbf7d0;
      border-top-color: #22c55e;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
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
      background: #3b82f6;
      color: white;
    }

    .button:hover {
      background: #2563eb;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    .footer {
      font-size: 14px;
      color: #9ca3af;
      margin-top: 32px;
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
    <h1>Zalogowano pomyślnie!</h1>

    <!-- Message -->
    <p class="message">
      Witaj ponownie! Zalogowano jako<br>
      <span class="email">${escapeHtml(email)}</span>
    </p>

    <!-- Redirect Info -->
    <div class="redirect-info">
      <div class="redirect-text">
        <div class="spinner"></div>
        <span>Przekierowanie do panelu...</span>
      </div>
    </div>

    <!-- Manual Button (fallback) -->
    <a href="${escapeHtml(redirectUrl)}" class="button">
      Przejdź do panelu
    </a>

    <!-- Footer -->
    <div class="footer">
      © 2025 wtyczki.ai - Wszystkie prawa zastrzeżone
    </div>
  </div>

  <script>
    // Auto-redirect after delay
    setTimeout(function() {
      window.location.href = '${escapeJs(redirectUrl)}';
    }, ${redirectDelay});
  </script>
</body>
</html>
`;
}

// Helper function to escape HTML special characters
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper function to escape JavaScript string
function escapeJs(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}
