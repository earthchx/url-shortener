import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

/**
 * Sliding-window rate limiter backed by Upstash Redis.
 * ────────────────────────────────────────────────────
 *
 * Config: 10 requests per 60-second sliding window, per IP.
 *
 * Why sliding window?
 *  • Fixed window has a burst problem at window boundaries
 *    (e.g., 10 reqs at :59 + 10 reqs at :00 = 20 in 1s).
 *  • Sliding window smooths this out — it's the best trade-off
 *    between accuracy and Redis command count.
 *
 * Cost: ~2 Redis commands per check (fits well within Upstash free tier).
 */
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  analytics: true,
  prefix: "shortener:ratelimit",
});
