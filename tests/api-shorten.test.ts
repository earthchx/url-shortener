import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ShortenResponse } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Mock external dependencies BEFORE importing the route handler.
// vi.mock() is hoisted to the top of the file by Vitest.
// ─────────────────────────────────────────────────────────────

// Mock env — provide fake values so the env validation doesn't throw
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://fake:fake@localhost/fake",
    UPSTASH_REDIS_REST_URL: "https://fake.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "fake-token",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

// Mock Redis — all calls return controlled values
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisIncr = vi.fn();

vi.mock("@/lib/redis", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    incr: (...args: unknown[]) => mockRedisIncr(...args),
  },
  REDIS_KEYS: {
    ID_COUNTER: "shortener:id_counter",
    linkPrefix: (code: string) => `shortener:link:${code}`,
    urlPrefix: (url: string) => `shortener:url:${url}`,
  },
  CACHE_TTL_SECONDS: 86400,
}));

// Mock Drizzle DB — insert and query
const mockInsert = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => mockInsert(...args),
    }),
    query: {
      links: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

vi.mock("@/lib/db/schema", () => ({
  links: {
    originalUrl: "original_url",
    shortCode: "short_code",
  },
}));

// Mock short-code generator to return a predictable value
vi.mock("@/lib/short-code", () => ({
  generateShortCode: vi.fn().mockResolvedValue("aBc123"),
}));

// ─────────────────────────────────────────────────────────────
// NOW import the handler (after all mocks are set up)
// ─────────────────────────────────────────────────────────────
import { POST } from "@/app/api/shorten/route";
import { NextRequest } from "next/server";

/** Helper to create a NextRequest with a JSON body */
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/shorten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/shorten", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no cache hit, no DB hit → forces new code generation
    mockRedisGet.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
    mockInsert.mockResolvedValue(undefined);
  });

  // ─── Validation ──────────────────────────────────────────

  it("returns 400 for missing URL", async () => {
    const res = await POST(makeRequest({}));
    const json = (await res.json()) as ShortenResponse;

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("returns 400 for invalid URL", async () => {
    const res = await POST(makeRequest({ url: "not-a-url" }));
    const json = (await res.json()) as ShortenResponse;

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("returns 400 for non-http URL", async () => {
    const res = await POST(makeRequest({ url: "ftp://example.com" }));
    const json = (await res.json()) as ShortenResponse;

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  // ─── New URL (cache miss + DB miss) ──────────────────────

  it("creates a new short URL for a valid input", async () => {
    const res = await POST(makeRequest({ url: "https://example.com/long" }));
    const json = (await res.json()) as ShortenResponse;

    expect(res.status).toBe(201);
    expect(json).toEqual({
      success: true,
      shortUrl: "http://localhost:3000/aBc123",
      shortCode: "aBc123",
    });
  });

  it("inserts the link into the database", async () => {
    await POST(makeRequest({ url: "https://example.com/long" }));

    expect(mockInsert).toHaveBeenCalledWith({
      originalUrl: "https://example.com/long",
      shortCode: "aBc123",
    });
  });

  it("populates both Redis caches after creation", async () => {
    await POST(makeRequest({ url: "https://example.com/long" }));

    // Should set code→url and url→code
    expect(mockRedisSet).toHaveBeenCalledTimes(2);

    const calls = mockRedisSet.mock.calls;
    const keys = calls.map((c: unknown[]) => c[0]);
    expect(keys).toContain("shortener:link:aBc123");
    expect(keys).toContain("shortener:url:https://example.com/long");
  });

  // ─── Dedup: Redis cache hit ──────────────────────────────

  it("returns cached code when Redis has the URL", async () => {
    mockRedisGet.mockResolvedValue("existingCode");

    const res = await POST(makeRequest({ url: "https://example.com/cached" }));
    const json = (await res.json()) as ShortenResponse;

    expect(res.status).toBe(200);
    expect(json).toEqual({
      success: true,
      shortUrl: "http://localhost:3000/existingCode",
      shortCode: "existingCode",
    });

    // Should NOT touch the DB at all
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // ─── Dedup: DB hit (cache miss) ─────────────────────────

  it("returns existing code from DB and re-populates cache", async () => {
    mockRedisGet.mockResolvedValue(null); // cache miss
    mockFindFirst.mockResolvedValue({
      id: 1,
      originalUrl: "https://example.com/db-hit",
      shortCode: "dbCode",
      visits: 5,
      createdAt: new Date(),
    });

    const res = await POST(makeRequest({ url: "https://example.com/db-hit" }));
    const json = (await res.json()) as ShortenResponse;

    expect(res.status).toBe(200);
    expect(json).toEqual({
      success: true,
      shortUrl: "http://localhost:3000/dbCode",
      shortCode: "dbCode",
    });

    // Should NOT generate a new code or insert
    expect(mockInsert).not.toHaveBeenCalled();
    // Should re-populate Redis
    expect(mockRedisSet).toHaveBeenCalledTimes(2);
  });
});
