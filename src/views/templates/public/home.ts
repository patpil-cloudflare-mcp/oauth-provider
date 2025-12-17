// src/views/templates/public/home.ts - Public Home Page (Guest Checkout)

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
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .header-logo {
      flex-shrink: 0;
    }
    .header-logo img {
      height: 50px;
      width: auto;
    }
    .header-content {
      flex: 1;
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
      .header {
        padding: 20px;
        margin-bottom: 12px;
        flex-direction: column;
        text-align: center;
      }
      .header-logo img {
        height: 40px;
      }
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
      <div class="header-logo">
        <img src="/wtyczkiai_logo_panel.png" alt="wtyczki.ai" />
      </div>
      <div class="header-content">
        <h1>Rejestracja</h1>
        <p class="subtitle">Kup tokeny i korzystaj z zaawansowanych wtyczek do narzędzi AI</p>
      </div>
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
