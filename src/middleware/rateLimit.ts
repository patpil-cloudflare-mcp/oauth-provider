// src/middleware/rateLimit.ts - Rate limiting utilities using Cloudflare Workers Rate Limiting binding

/**
 * Check if a request is within the rate limit.
 * Fails open on errors to avoid blocking legitimate traffic.
 */
export async function checkRateLimit(limiter: RateLimit, key: string): Promise<boolean> {
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (error) {
    console.error('[rate-limit] Error checking rate limit:', error);
    return true; // fail open
  }
}

/**
 * Build a 429 JSON response for rate-limited API requests.
 */
export function rateLimitJsonResponse(message: string): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message,
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '60',
    },
  });
}
