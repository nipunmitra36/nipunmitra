// Best-effort, in-memory rate limiter (fixed window per client key).
//
// This is a second line of defence only: memory is per function instance, so limits reset on cold
// starts and aren't shared between instances. The primary protection is Netlify's platform rate
// limiting (the `rateLimit` block in each function's config) plus CDN caching of results.

export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }) {
  const hits = new Map(); // key -> { count, resetAt }

  return {
    check(key, now = Date.now()) {
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
          if (hits.size >= maxKeys) hits.delete(hits.keys().next().value); // drop the oldest key
        }
        entry = { count: 0, resetAt: now + windowMs };
        hits.set(key, entry);
      }
      entry.count++;
      return entry.count <= limit
        ? { allowed: true, remaining: limit - entry.count }
        : { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    },
  };
}
