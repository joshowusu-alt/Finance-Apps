import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── In-memory fallback (used when Upstash env vars are not configured) ───────
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

function inMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = inMemoryStore.get(key);
  if (!entry || now > entry.resetTime) {
    inMemoryStore.set(key, { count: 1, resetTime: now + windowMs });
    return true; // allowed
  }
  if (entry.count >= limit) return false; // blocked
  entry.count++;
  return true; // allowed
}

// ─── Upstash Redis limiter (distributed, works across serverless instances) ───
let redisClient: Redis | null = null;
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  if (upstashLimiters.has(cacheKey)) return upstashLimiters.get(cacheKey)!;

  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs / 1000} s`),
    analytics: false,
    prefix: "cf_rl",
  });

  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

const useUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a rate-limit checker function for a given limit config.
 * Uses Upstash Redis (distributed) if configured, in-memory fallback otherwise.
 *
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function createRateLimiter(
  limit: number,
  windowMs: number
): (identifier: string) => Promise<boolean> {
  return async (identifier: string): Promise<boolean> => {
    if (!useUpstash) {
      return inMemoryRateLimit(identifier, limit, windowMs);
    }
    const limiter = getUpstashLimiter(limit, windowMs);
    const { success } = await limiter.limit(identifier);
    return success;
  };
}
