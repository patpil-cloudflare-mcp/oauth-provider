// src/durableObjects/FreeUsageLimiter.ts
// Per-(user × free MCP server) daily usage counter with lazy reset at Warsaw midnight.
//
// One DO instance per `${userId}:${serverName}` (constructed via idFromName).
// Storage holds { day, count }; on each call, if `day` differs from today's
// Warsaw date the counter resets (lazy — reliable across DST boundaries).
//
// Self-cleanup: each active instance arms ONE one-shot alarm for ~1 min after
// the next Warsaw midnight. When it fires, if the counter is no longer for
// today it is `deleteAll()`-ed, freeing the instance. This bounds total storage
// to instances used in the last ~24h — without it, every (user × server) pair
// that ever consumed a slot would retain ~12 KB of SQLite metadata forever.
// NOTE: this is NOT the "N×30 scheduled-event storm" the lazy design feared —
// it is at most one alarm per instance currently in use, hibernation-friendly,
// re-armed only on real consume calls.

import { DurableObject } from 'cloudflare:workers';
import { getWarsawDateKey, nextWarsawMidnightISO, secondsUntilWarsawMidnight } from '../utils/warsawDate';

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
    // Arm self-cleanup for shortly after midnight (overwrites any prior alarm).
    await this.ctx.storage.setAlarm(Date.now() + (secondsUntilWarsawMidnight() + 60) * 1000);
    return { allowed: true, remaining: limit - next, resetAt };
  }

  // Fires ~1 min after Warsaw midnight. If the stored counter is no longer for
  // today, it is stale → wipe storage so the instance stops consuming space.
  // If it was consumed again today (midnight-boundary race), re-arm instead of
  // deleting so we never drop a fresh same-day count.
  async alarm(): Promise<void> {
    const stored = await this.ctx.storage.get<UsageState>('state');
    if (!stored || stored.day !== getWarsawDateKey()) {
      await this.ctx.storage.deleteAll();
    } else {
      await this.ctx.storage.setAlarm(Date.now() + (secondsUntilWarsawMidnight() + 60) * 1000);
    }
  }
}
