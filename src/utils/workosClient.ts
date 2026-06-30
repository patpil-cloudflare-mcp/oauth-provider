// src/utils/workosClient.ts - Memoized WorkOS client.
//
// The WorkOS client holds only stateless config (no sockets/connections), so a
// single instance can be safely reused across requests within a Workers isolate.
// Memoized by API key so a secret rotation is picked up without relying on an
// isolate restart.

import { WorkOS } from '@workos-inc/node';

let cached: { apiKey: string; client: WorkOS } | null = null;

export function getWorkOS(apiKey: string): WorkOS {
  if (!cached || cached.apiKey !== apiKey) {
    cached = { apiKey, client: new WorkOS(apiKey) };
  }
  return cached.client;
}
