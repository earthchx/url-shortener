import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { links } from "@/lib/db/schema";
import { redis, REDIS_KEYS, CACHE_TTL_SECONDS } from "@/lib/redis";
import { generateShortCode } from "@/lib/short-code";
import { shortenSchema } from "@/lib/validations";
import { env } from "@/lib/env";
import type { ShortenResponse } from "@/lib/types";

/**
 * POST /api/shorten
 * ─────────────────
 * Accepts { url: string }, validates it, generates a short code,
 * persists to Neon, caches in Redis, and returns the short URL.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ShortenResponse>> {
  try {
    // 1. Parse & validate input
    const body: unknown = await request.json();
    const parsed = shortenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    // 2. Dedup check — has this URL already been shortened?
    //    Check Redis first (fast), then fall back to DB.
    const cachedCode = await redis.get<string>(REDIS_KEYS.urlPrefix(url));

    if (cachedCode) {
      return NextResponse.json({
        success: true,
        shortUrl: `${env.NEXT_PUBLIC_BASE_URL}/${cachedCode}`,
        shortCode: cachedCode,
      });
    }

    // Check the DB for an existing mapping
    const existing = await db.query.links.findFirst({
      where: eq(links.originalUrl, url),
    });

    if (existing) {
      // Re-populate Redis caches so next hit is fast
      await Promise.all([
        redis.set(REDIS_KEYS.linkPrefix(existing.shortCode), url, {
          ex: CACHE_TTL_SECONDS,
        }),
        redis.set(REDIS_KEYS.urlPrefix(url), existing.shortCode, {
          ex: CACHE_TTL_SECONDS,
        }),
      ]);

      return NextResponse.json({
        success: true,
        shortUrl: `${env.NEXT_PUBLIC_BASE_URL}/${existing.shortCode}`,
        shortCode: existing.shortCode,
      });
    }

    // 3. Generate a new short code (Redis INCR → Base62)
    const shortCode = await generateShortCode();

    // 4. Persist to Neon via Drizzle
    await db.insert(links).values({
      originalUrl: url,
      shortCode,
    });

    // 5. Populate Redis caches (Cache-Aside pattern)
    await Promise.all([
      // shortCode → url  (used by redirect lookup)
      redis.set(REDIS_KEYS.linkPrefix(shortCode), url, {
        ex: CACHE_TTL_SECONDS,
      }),
      // url → shortCode  (used by dedup check above)
      redis.set(REDIS_KEYS.urlPrefix(url), shortCode, {
        ex: CACHE_TTL_SECONDS,
      }),
    ]);

    // 6. Return the short URL
    return NextResponse.json(
      {
        success: true,
        shortUrl: `${env.NEXT_PUBLIC_BASE_URL}/${shortCode}`,
        shortCode,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/shorten]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
