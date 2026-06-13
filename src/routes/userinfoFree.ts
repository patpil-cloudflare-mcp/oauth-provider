// src/routes/userinfoFree.ts
// Combined endpoint for free (non-billable) MCP servers.
// Authenticates the Bearer token AND atomically consumes one daily quota slot
// for `(user_id × X-MCP-Server)`. Free servers call this in place of /oauth/userinfo.
//
// Flow:
//   1. Read X-MCP-Server header → look up limit in env.FREE_SERVERS registry
//   2. Validate Bearer (API key or AuthKit JWT) via shared authenticateBearer()
//   3. Get DO stub keyed by `${userId}:${serverName}`, call tryConsume(limit)
//   4. Return 200 {sub, email, remaining, reset_at} or 429 daily_limit_exceeded
//
// Fail-open if DO unreachable: returns 200 with remaining=-1 (consistent with
// existing rateLimit.ts behavior) — better UX than blocking all free servers
// on DO downtime; throttling is not a hard security boundary.

import { authenticateBearer, type BearerAuthEnv } from '../auth/authenticateBearer';
import { secondsUntilWarsawMidnight } from '../utils/warsawDate';
import type { ConsumeResult } from '../durableObjects/FreeUsageLimiter';

export interface UserinfoFreeEnv extends BearerAuthEnv {
  FREE_SERVERS: string;
  FREE_USAGE_LIMITER: DurableObjectNamespace;
  // Workers Analytics Engine — central per-(user × server × tool) usage stream.
  USAGE: AnalyticsEngineDataset;
}

export async function handleUserinfoFree(
  request: Request,
  env: UserinfoFreeEnv,
): Promise<Response> {
  const serverName = request.headers.get('X-MCP-Server');
  if (!serverName) {
    return jsonError(400, 'missing_x_mcp_server', 'X-MCP-Server header is required');
  }

  let registry: Record<string, number>;
  try {
    registry = JSON.parse(env.FREE_SERVERS) as Record<string, number>;
  } catch {
    console.error('[userinfo-free] FREE_SERVERS env var is not valid JSON');
    return jsonError(500, 'misconfigured_registry', 'FREE_SERVERS env var malformed');
  }

  const limit = registry[serverName];
  if (typeof limit !== 'number') {
    return jsonError(403, 'server_not_in_free_registry', `Server "${serverName}" is not registered as free`);
  }

  const auth = await authenticateBearer(request, env);
  if (!auth) {
    return jsonError(401, 'invalid_token', 'Bearer token missing or invalid');
  }

  let result: ConsumeResult;
  try {
    const id = env.FREE_USAGE_LIMITER.idFromName(`${auth.sub}:${serverName}`);
    const stub = env.FREE_USAGE_LIMITER.get(id) as DurableObjectStub & {
      tryConsume(limit: number): Promise<ConsumeResult>;
    };
    result = await stub.tryConsume(limit);
  } catch (err) {
    console.error('[userinfo-free] DO call failed, failing open:', err);
    return Response.json({ sub: auth.sub, email: auth.email, remaining: -1, reset_at: null });
  }

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'daily_limit_exceeded',
        error_description: `Daily limit of ${limit} requests for "${serverName}" exhausted`,
        remaining: 0,
        reset_at: result.resetAt,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(secondsUntilWarsawMidnight()),
        },
      },
    );
  }

  // Central usage write RETIRED 2026-06-13: every free server now self-reports one
  // row per tools/call to the `mcp_usage` dataset via its own recordToolUsage()
  // helper (Option B), which carries the tool name (this endpoint never received
  // X-MCP-Tool, so it wrote empty-tool rows and fired only intermittently/fail-open
  // → it double-counted). The `USAGE` binding is left inert here; safe to drop later.

  return Response.json({
    sub: auth.sub,
    email: auth.email,
    remaining: result.remaining,
    reset_at: result.resetAt,
  });
}

function jsonError(status: number, error: string, description: string): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
