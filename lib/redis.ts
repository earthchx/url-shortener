import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Upstash Redis client (HTTP-based).
 * Works everywhere: Edge Runtime, Serverless, Node.js.
 *
 * Used for:
 *  1. Atomic ID generation (INCR)
 *  2. Cache-aside pattern for short_code → url mappings
 *  3. Sliding-window rate limiting (Phase 3)
 */
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// ─── Redis key prefixes ────────────────────────────────────────
// Centralised here so every module uses the same namespace.

/** Counter key for atomic ID generation */
export const REDIS_KEYS = {
  /** Global auto-increment counter: INCR this to get the next ID */
  ID_COUNTER: "shortener:id_counter",

  /** Prefix for cached short_code → original_url mappings */
  linkPrefix: (shortCode: string) => `shortener:link:${shortCode}` as const,

  /** Prefix for dedup: original_url → short_code */
  urlPrefix: (url: string) => `shortener:url:${url}` as const,
} as const;

/** Default TTL for cached link mappings (24 hours in seconds) */
export const CACHE_TTL_SECONDS = 60 * 60 * 24;
