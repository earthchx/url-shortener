"use server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { links } from "@/lib/db/schema";
import { redis, REDIS_KEYS, CACHE_TTL_SECONDS } from "@/lib/redis";
import { generateShortCode } from "@/lib/short-code";
import { shortenSchema } from "@/lib/validations";
import { env } from "@/lib/env";
import type { ShortenResponse } from "@/lib/types";

/**
 * Server Action: shortenUrl
 * ─────────────────────────
 * Called directly from the client form — no fetch() needed.
 * Same logic as the API route, packaged as a Server Action
 * for the modern Next.js form pattern.
 */
export async function shortenUrl(formData: FormData): Promise<ShortenResponse> {
  try {
    const rawUrl = formData.get("url");

    // 1. Validate
    const parsed = shortenSchema.safeParse({ url: rawUrl });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { url } = parsed.data;

    // 2. Dedup — check Redis cache first
    const cachedCode = await redis.get<string>(REDIS_KEYS.urlPrefix(url));

    if (cachedCode) {
      return {
        success: true,
        shortUrl: `${env.NEXT_PUBLIC_BASE_URL}/${cachedCode}`,
        shortCode: cachedCode,
      };
    }

    // Dedup — check DB
    const existing = await db.query.links.findFirst({
      where: eq(links.originalUrl, url),
    });

    if (existing) {
      await Promise.all([
        redis.set(REDIS_KEYS.linkPrefix(existing.shortCode), url, {
          ex: CACHE_TTL_SECONDS,
        }),
        redis.set(REDIS_KEYS.urlPrefix(url), existing.shortCode, {
          ex: CACHE_TTL_SECONDS,
        }),
      ]);

      return {
        success: true,
        shortUrl: `${env.NEXT_PUBLIC_BASE_URL}/${existing.shortCode}`,
        shortCode: existing.shortCode,
      };
    }

    // 3. Generate short code
    const shortCode = await generateShortCode();

    // 4. Persist
    await db.insert(links).values({
      originalUrl: url,
      shortCode,
    });

    // 5. Cache
    await Promise.all([
      redis.set(REDIS_KEYS.linkPrefix(shortCode), url, {
        ex: CACHE_TTL_SECONDS,
      }),
      redis.set(REDIS_KEYS.urlPrefix(url), shortCode, {
        ex: CACHE_TTL_SECONDS,
      }),
    ]);

    // 6. Return
    return {
      success: true,
      shortUrl: `${env.NEXT_PUBLIC_BASE_URL}/${shortCode}`,
      shortCode,
    };
  } catch (error) {
    console.error("[Server Action: shortenUrl]", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
