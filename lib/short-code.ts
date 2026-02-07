import { redis, REDIS_KEYS } from "@/lib/redis";
import { encodeBase62 } from "@/lib/base62";

/**
 * Generate a unique short code using Redis atomic INCR + Base62.
 * ──────────────────────────────────────────────────────────────
 *
 * Strategy:
 *  1. `INCR shortener:id_counter` — Redis guarantees this is atomic,
 *     so even under high concurrency, every caller gets a unique integer.
 *  2. Convert that integer to a Base62 string.
 *
 * Why not UUID / nanoid?
 *  • UUIDs are 36 chars — terrible for short URLs.
 *  • nanoid has a (tiny) collision probability.
 *  • Redis INCR is O(1), zero collision, monotonically increasing.
 *
 * The counter starts at 10000 (set on first use) so the very first
 * short code is 3 characters long ("2Bi") instead of just "1".
 *
 * @returns A unique, compact Base62 short code (e.g. "2Bi", "q0U")
 */

const COUNTER_START = 10_000;

export async function generateShortCode(): Promise<string> {
  // INCR is atomic — safe under concurrent requests
  const nextId = await redis.incr(REDIS_KEYS.ID_COUNTER);

  // On first-ever call the counter would be 1.
  // Seed it to COUNTER_START so codes are at least 3 chars.
  if (nextId < COUNTER_START) {
    await redis.set(REDIS_KEYS.ID_COUNTER, COUNTER_START);
    return encodeBase62(COUNTER_START);
  }

  return encodeBase62(nextId);
}
