// src/views/components/layout.ts - Shared HTML Layout Wrapper

import { renderHead, type HeadOptions } from './head';

export interface LayoutOptions extends HeadOptions {
  styles: string;
  bodyContent: string;
}

/**
 * Render complete HTML document with head, styles, and body
 */
export function renderLayout(options: LayoutOptions): string {
  const { styles, bodyContent, ...headOptions } = options;

  return `
<!DOCTYPE html>
<html lang="pl">
${renderHead(headOptions)}
<body>
  <style>
    ${styles}
  </style>
  ${bodyContent}
</body>
</html>
  `.trim();
}
