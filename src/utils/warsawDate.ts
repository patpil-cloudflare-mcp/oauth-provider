// src/utils/warsawDate.ts - Date helpers in Europe/Warsaw timezone (handles CET/CEST/DST)

const WARSAW_TZ = 'Europe/Warsaw';

/**
 * Returns current date in Warsaw timezone as ISO date string "YYYY-MM-DD".
 * Used as the day-bucket key for daily rate limit counters.
 *
 * Why en-CA: it formats dates as "YYYY-MM-DD" which is exactly what we need.
 */
export function getWarsawDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Returns ISO timestamp of the next midnight in Warsaw timezone.
 * Used as `reset_at` field in rate limit responses.
 */
export function nextWarsawMidnightISO(): string {
  return new Date(nextWarsawMidnightEpochMs()).toISOString();
}

/**
 * Returns seconds until next Warsaw midnight. Used as Retry-After header value.
 */
export function secondsUntilWarsawMidnight(): number {
  return Math.max(1, Math.ceil((nextWarsawMidnightEpochMs() - Date.now()) / 1000));
}

/**
 * Compute epoch ms of next midnight in Warsaw timezone.
 *
 * Approach: format `now` as Warsaw wall-clock, parse it back as UTC to learn the
 * UTC offset of Warsaw at this moment, then construct tomorrow's 00:00 Warsaw and
 * shift back to UTC. Handles DST transitions correctly because the offset is
 * sampled at "tonight's" wall clock — the same wall clock that the user lives in.
 */
function nextWarsawMidnightEpochMs(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)!.value;
  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  const h = Number(get('hour'));
  const mi = Number(get('minute'));
  const s = Number(get('second'));

  // Warsaw wall-clock interpreted as UTC (gives us a "fake UTC" stamp)
  const fakeUtc = Date.UTC(y, m - 1, d, h, mi, s);
  // Difference between fake UTC and real UTC = Warsaw offset (positive in summer/winter, both ahead of UTC)
  const offsetMs = fakeUtc - now.getTime();

  // Tomorrow midnight in Warsaw wall-clock, again expressed as fake UTC
  const tomorrowMidnightFakeUtc = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  // Convert fake UTC back to real UTC by removing the offset
  return tomorrowMidnightFakeUtc - offsetMs;
}
