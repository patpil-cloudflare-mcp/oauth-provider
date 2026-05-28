// src/durableObjects/FreeUsageLimiter.ts
// Per-(user × free MCP server) daily usage counter with lazy reset at Warsaw midnight.
//
// One DO instance per `${userId}:${serverName}` (constructed via idFromName).
// Storage holds { day, count }; on each call, if `day` differs from today's
// Warsaw date the counter resets. No alarms, no scheduling — lazy is reliable
// across DST boundaries and avoids N×M scheduled events daily.

import { DurableObject } from 'cloudflare:workers';
import { getWarsawDateKey, nextWarsawMidnightISO } from '../utils/warsawDate';

interface UsageState {
  day: string;
  count: number;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

export class FreeUsageLimiter extends DurableObject {
  async tryConsume(limit: number): Promise<ConsumeResult> {
    const today = getWarsawDateKey();
    const stored = await this.ctx.storage.get<UsageState>('state');
    const count = stored?.day === today ? stored.count : 0;
    const resetAt = nextWarsawMidnightISO();

    if (count >= limit) {
      return { allowed: false, remaining: 0, resetAt };
    }

    const next = count + 1;
    await this.ctx.storage.put<UsageState>('state', { day: today, count: next });
    return { allowed: true, remaining: limit - next, resetAt };
  }
}
