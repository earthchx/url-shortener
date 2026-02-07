import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "@/lib/rate-limit";

/**
 * Next.js Proxy — runs at the Edge before every matched request.
 * ──────────────────────────────────────────────────────────────
 * (Renamed from "middleware" → "proxy" in Next.js 16)
 *
 * Responsibilities:
 *  1. Rate-limit POST /api/shorten (prevents abuse of URL creation)
 *  2. Future: could add geo-headers, A/B flags, etc.
 *
 * We intentionally do NOT rate-limit redirect GETs (/:shortCode)
 * because those need to be as fast as possible and are read-only.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Only rate-limit the shorten endpoint
  if (
    request.nextUrl.pathname === "/api/shorten" &&
    request.method === "POST"
  ) {
    // Use the client IP as the rate-limit identifier.
    // x-forwarded-for is set by Vercel/reverse proxies.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "127.0.0.1";

    const { success, limit, remaining, reset } =
      await rateLimiter.limit(ip);

    // Always attach rate-limit headers so the client knows their quota
    const response = success
      ? NextResponse.next()
      : NextResponse.json(
          { success: false, error: "Too many requests. Please try again later." },
          { status: 429 }
        );

    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());

    return response;
  }

  return NextResponse.next();
}

/**
 * Matcher config — only invoke middleware on paths that need it.
 * This keeps redirect routes (/:shortCode) fast and unblocked.
 */
export const config = {
  matcher: ["/api/shorten"],
};
