/**
 * createRateLimiter — in-memory, per-identifier rate limiting.
 *
 * Returns a `check(identifier)` function. Call it at the start of each
 * request handler; returns `true` when the request is allowed and `false`
 * when the limit has been exceeded for the current window.
 *
 * Note: the store is module-level, so it persists across requests inside a
 * single Node.js process instance ("warm" serverless function). This is
 * intentional and matches the pattern already used in /api/ai/chat.
 */
export function createRateLimiter(
  limit: number,
  windowMs: number
): (identifier: string) => boolean {
  const store = new Map<string, { count: number; resetTime: number }>();

  return function check(identifier: string): boolean {
    const now = Date.now();
    const entry = store.get(identifier);

    if (!entry || now > entry.resetTime) {
      store.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (entry.count >= limit) return false;
    entry.count++;
    return true;
  };
}
