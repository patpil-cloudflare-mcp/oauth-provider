// src/views/components/styles.ts - Shared CSS Styles

/**
 * Shared color palette for consistent theming
 */
export const colors = {
  primaryBlue: '#3239e5',
  darkBlue: '#140f44',
  purple: '#7a0bc0',
  lightPurple: '#b2478f',
  red: '#e6174b',
  darkRed: '#b71338',
  green: '#10b981',
  darkGreen: '#059669',
  orange: '#f59e0b',
  darkOrange: '#d97706',
  textDark: '#222b4f',
  textMedium: 'rgba(34, 43, 79, 0.8)',
  textLight: 'rgba(34, 43, 79, 0.65)',
  textMuted: 'rgba(34, 43, 79, 0.5)',
  textGray: '#666',
  backgroundLight: '#feffff',
  backgroundPurple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

/**
 * Base CSS reset and common styles
 */
export function getBaseStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${colors.backgroundLight};
      min-height: 100vh;
      padding: 20px;
      color: ${colors.textDark};
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
  `;
}

/**
 * Centered container styles (for auth and error pages)
 */
export function getCenteredContainerStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${colors.backgroundPurple};
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
    h1 { color: ${colors.textDark}; margin-bottom: 16px; font-size: 28px; }
    p { color: ${colors.textGray}; line-height: 1.6; margin-bottom: 24px; }
    .icon { font-size: 64px; margin-bottom: 20px; }
  `;
}

/**
 * Button styles
 */
export function getButtonStyles(): string {
  return `
    .btn {
      display: inline-block;
      background: ${colors.primaryBlue};
      color: white;
      padding: 14px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn:hover {
      background: ${colors.darkBlue};
      transform: translateY(-2px);
    }
    .buy-button {
      width: 100%;
      padding: 12px;
      background: ${colors.primaryBlue};
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .buy-button:hover {
      background: ${colors.darkBlue};
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(50, 57, 229, 0.4);
    }
    .buy-button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
    }
  `;
}

/**
 * Card styles for packages
 */
export function getPackageCardStyles(): string {
  return `
    .packages {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
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
      border-color: ${colors.primaryBlue};
    }
    .package-name {
      font-size: 20px;
      font-weight: 600;
      color: ${colors.textDark};
      margin-bottom: 8px;
      background: ${colors.red};
      color: white;
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      border: 2px solid ${colors.darkRed};
      margin-bottom: 12px;
    }
    .package-price {
      font-size: 32px;
      font-weight: 700;
      color: ${colors.primaryBlue};
      margin-bottom: 4px;
    }
    .package-tokens {
      color: ${colors.textMedium};
      font-size: 14px;
      margin-bottom: 16px;
    }
    .package-value {
      color: ${colors.textLight};
      font-size: 12px;
      margin-bottom: 16px;
    }
  `;
}

/**
 * Badge styles for promotional and best-value indicators
 */
export function getBadgeStyles(): string {
  return `
    .promo-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      background: linear-gradient(135deg, ${colors.green} 0%, ${colors.darkGreen} 100%);
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
    .promo-badge-gold {
      background: linear-gradient(135deg, ${colors.orange} 0%, ${colors.darkOrange} 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }
    .best-value-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.lightPurple} 100%);
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
    @keyframes pulse {
      0%, 100% { transform: rotate(5deg) scale(1); }
      50% { transform: rotate(5deg) scale(1.05); }
    }
  `;
}

/**
 * Info box styles for messages and alerts
 */
export function getInfoBoxStyles(): string {
  return `
    .info-box {
      background: #f0f7ff;
      border-left: 4px solid ${colors.primaryBlue};
      padding: 16px;
      margin: 24px 0;
      text-align: left;
      border-radius: 4px;
    }
    .info-box h3 {
      color: ${colors.primaryBlue};
      font-size: 14px;
      margin-bottom: 8px;
    }
    .info-box p {
      font-size: 13px;
      margin: 0;
    }
    .error-details {
      background: #fff3f3;
      border-left: 4px solid ${colors.red};
      padding: 16px;
      margin: 24px 0;
      text-align: left;
      border-radius: 4px;
    }
    .success-notice {
      background: #f0fdf4;
      border-left: 4px solid ${colors.green};
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .guest-notice {
      background: #f9f5ff;
      border-left: 4px solid ${colors.purple};
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
    }
  `;
}

/**
 * Dashboard-specific styles
 */
export function getDashboardStyles(): string {
  return `
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
    h1 {
      color: ${colors.textDark};
      font-size: 24px;
      font-weight: 600;
    }
    .user-email {
      color: ${colors.textLight};
      font-size: 14px;
      margin-top: 4px;
    }
    .settings-link {
      color: ${colors.purple};
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
      color: ${colors.lightPurple};
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
    .balance-label {
      color: ${colors.textLight};
      font-size: 18px;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .balance-value {
      font-size: 48px;
      font-weight: 700;
      background: linear-gradient(135deg, ${colors.primaryBlue} 0%, ${colors.darkBlue} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .balance-unit {
      font-size: 24px;
      color: ${colors.textMuted};
      margin-left: 8px;
    }
  `;
}

/**
 * Complete styles for a specific page type
 */
export function getCompleteStyles(type: 'centered' | 'dashboard' | 'public'): string {
  const baseStyles = type === 'centered'
    ? getCenteredContainerStyles()
    : getBaseStyles();

  let additionalStyles = '';

  if (type === 'dashboard') {
    additionalStyles = getDashboardStyles();
  }

  return `
    ${baseStyles}
    ${getButtonStyles()}
    ${type !== 'centered' ? getPackageCardStyles() : ''}
    ${getBadgeStyles()}
    ${getInfoBoxStyles()}
    ${additionalStyles}
  `;
}
