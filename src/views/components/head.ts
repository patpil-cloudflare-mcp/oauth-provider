// src/views/components/head.ts - Shared HTML Head Generation

export interface HeadOptions {
  title: string;
  description: string;
  keywords?: string;
  noIndex?: boolean;
  includeGoogleFonts?: boolean;
}

/**
 * Generate common favicon links (using emoji)
 */
export function getFaviconLinks(): string {
  return `
  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🔌</text></svg>">
  <link rel="alternate icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAITSURBVFiF7ZbPaxNBFMe/b7KbTZs0aY0/qBWxRfHgQTx48OBN8OTRf8KbePTkH+HRk+DBg6AHQfCgCCKCWrFYLNJiG5ukSdpkd2Z2PN0km92ZTZqeBPvhwczOm/d9b96b92aB/3qsqgC6urr6AXwEcBpAE8ALAM+llLdXUdvmCO4B+CilzCilegD0A3gE4LmUcmndBBzHuQbguZTys2EY9wAcBXBQStkDoB/AcwAnAFw1DOPuOgl0dXVdBvAEwF0pZRaABqAJoAHgAIBuADcBvJJSPl4XgZ6enhsA3gC4KaWcBqADaAHwAVQB1AB8BfAOwIiU8s5aCFiW1QfgLYBbUsoJABqAEkAZQBXAbwBlABMA3gO4LqUcWjkBwzD6ALwH8EBKOQ5AA1AEUALwC8AXAF8AvARwRUp5e+UELMvqBzAG4J6UcgxAHcAvAN8BfALwGsBVKeWdtRCwbXsQwBsA94eiCSEAAA0ASURBVKWUY7ZtvwdwAMAvAJ8BfADwVkr5cC0EhoeHDwF4DeC6lDIzPj7u2PYo/JlfAPgAYATAIynl01UQOAygH8BDKWUW/sRnAYwC+AIgB38i7kkpn62SwEkAXQCuSymnAIzBX3l/4Lfg7oYEHA3A5wD8AlACMAPfgFEAI1LKp+sm0NnZeQrATQDnADQAvAPwSEr5Yl0EHA3AWQAXAJwF0ADwFsBDKeWL/1XgX/0Bl8LKBwDOaygAAAAASUVORK5CYII=">
  `;
}

/**
 * Generate Google Fonts link
 */
export function getGoogleFontsLink(): string {
  return `
  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  `;
}

/**
 * Generate Open Graph and Twitter Card meta tags
 */
export function getSocialMetaTags(title: string, description: string): string {
  return `
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://panel.wtyczki.ai/">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="https://panel.wtyczki.ai/og-image.png">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://panel.wtyczki.ai/">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${description}">
  <meta property="twitter:image" content="https://panel.wtyczki.ai/og-image.png">
  `;
}

/**
 * Generate complete HTML head element
 */
export function renderHead(options: HeadOptions): string {
  const {
    title,
    description,
    keywords = 'MCP, tokeny, AI, Model Context Protocol, wtyczki, API',
    noIndex = false,
    includeGoogleFonts = true,
  } = options;

  const robotsContent = noIndex ? 'noindex, nofollow' : 'index, follow';

  return `
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">
  <meta name="author" content="Wtyczki DEV Patryk Pilat">
  <meta name="robots" content="${robotsContent}">
  ${getSocialMetaTags(title, description)}
  ${getFaviconLinks()}
  ${includeGoogleFonts ? getGoogleFontsLink() : ''}
</head>
  `.trim();
}
