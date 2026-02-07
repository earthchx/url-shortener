import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { links } from "@/lib/db/schema";
import { redis, REDIS_KEYS, CACHE_TTL_SECONDS } from "@/lib/redis";

/**
 * GET /[shortCode]
 * ────────────────
 * The hot path — this is what runs on every redirect.
 * Optimised for speed using a 2-tier lookup:
 *
 *   1. Redis cache  (sub-ms, regional)
 *   2. Neon DB      (single-digit ms via serverless driver)
 *
 * The `visits` counter is incremented asynchronously using
 * waitUntil (or fire-and-forget) so the user gets their
 * redirect without waiting for the DB write.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
): Promise<NextResponse> {
  const { shortCode } = await params;

  // ── Step 1: Check Redis cache (fastest) ──────────────────────
  const cachedUrl = await redis.get<string>(REDIS_KEYS.linkPrefix(shortCode));

  if (cachedUrl) {
    // Fire-and-forget: increment visits without blocking the redirect
    incrementVisits(shortCode);

    return NextResponse.redirect(cachedUrl, { status: 302 });
  }

  // ── Step 2: Cache miss → query Neon DB ───────────────────────
  const link = await db.query.links.findFirst({
    where: eq(links.shortCode, shortCode),
  });

  if (!link) {
    // Short code doesn't exist — redirect to the home page
    const url = new URL("/", _request.url);
    url.searchParams.set("error", "not-found");
    return NextResponse.redirect(url, { status: 302 });
  }

  // ── Step 3: Populate Redis cache for next time (TTL 24h) ─────
  await redis.set(REDIS_KEYS.linkPrefix(shortCode), link.originalUrl, {
    ex: CACHE_TTL_SECONDS,
  });

  // Fire-and-forget: increment visits
  incrementVisits(shortCode);

  return NextResponse.redirect(link.originalUrl, { status: 302 });
}

/**
 * Increment the `visits` counter in Neon DB.
 * This is intentionally fire-and-forget — we don't await it
 * in the redirect handler so the user isn't blocked.
 *
 * Uses raw SQL increment (`visits = visits + 1`) to avoid
 * race conditions under concurrent requests.
 */
function incrementVisits(shortCode: string): void {
  db.update(links)
    .set({ visits: sql`${links.visits} + 1` })
    .where(eq(links.shortCode, shortCode))
    .execute()
    .catch((err) => {
      // Log but never throw — this must not break the redirect
      console.error("[incrementVisits]", err);
    });
}
