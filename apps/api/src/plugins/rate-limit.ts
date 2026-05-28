import type { preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';

import { RateLimitError } from '../lib/errors.js';

/**
 * Per-user rate limit (in-memory, sliding window co dinh 1 phut).
 *
 * - Chay nhu preHandler => phai dat SAU authenticate de doc request.user.id.
 *   Neu chua co user (route public), fallback ve request.ip.
 * - Phu hop cho 1 instance + Cloudflare phia truoc (Phase 5).
 *   Production multi-instance se can store dung chung (Redis) o Phase sau.
 * - Throw RateLimitError (429 RATE_LIMITED) khi vuot.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Quet cu cac bucket het han mot cach lazy moi lan check. */
function check(key: string): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(key, fresh);
    return { ok: true, remaining: MAX_REQUESTS - 1, resetAt: fresh.resetAt };
  }
  existing.count += 1;
  return {
    ok: existing.count <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Reset toan bo bucket (dung cho test). KHONG export ngoai test. */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: throw 429 neu user/IP vuot ngung trong cua so 1 phut. */
    rateLimitPerUser: preHandlerHookHandler;
  }
}

export default fp(
  async (fastify) => {
    const handler: preHandlerHookHandler = async (request, reply) => {
      const key = request.user?.id ?? request.ip;
      const { ok, remaining, resetAt } = check(key);
      void reply.header('x-ratelimit-limit', MAX_REQUESTS);
      void reply.header('x-ratelimit-remaining', remaining);
      void reply.header('x-ratelimit-reset', Math.ceil(resetAt / 1000));
      if (!ok) {
        throw new RateLimitError('Too many requests, try again shortly');
      }
    };
    fastify.decorate('rateLimitPerUser', handler);
  },
  { name: 'rate-limit' },
);
