# ✂️ Snip — High-Performance URL Shortener

A production-ready, serverless URL shortener built with **Next.js**, **Neon Postgres**, **Upstash Redis**, and **Drizzle ORM**. Runs entirely on free-tier infrastructure.

---

## 🏗️ Architecture

```
┌──────────────┐     ┌────────────────────┐     ┌──────────────┐
│   Browser    │────▶│   Edge Middleware   │────▶│  Next.js App │
│              │     │  (Rate Limiting)    │     │  (App Router)│
└──────────────┘     └────────────────────┘     └──────┬───────┘
                                                       │
                              ┌─────────────────────────┤
                              │                         │
                     ┌────────▼────────┐     ┌──────────▼──────────┐
                     │  Upstash Redis  │     │   Neon Postgres     │
                     │  • ID Counter   │     │   • links table     │
                     │  • URL Cache    │     │   • Persistent store │
                     │  • Rate Limits  │     │                     │
                     └─────────────────┘     └─────────────────────┘
```

### Request Flows

**Shorten a URL (`POST /api/shorten`):**
```
Client → Edge Middleware (rate limit check)
  → Server Action / API Route
    → Redis: dedup check (url → code)
    → DB: dedup check (fallback)
    → Redis INCR → Base62 encode → short code
    → DB INSERT (persist)
    → Redis SET (cache both directions)
  → Return short URL
```

**Redirect (`GET /:shortCode`):**
```
Client → Route Handler
  → Redis GET (cache hit? → 302 redirect, ~1ms)
  → DB SELECT  (cache miss? → populate cache → 302 redirect)
  → visits++ (fire-and-forget, non-blocking)
```

---

## 🧠 Key Design Decisions

### Why Base62 + Redis `INCR`?

| Approach | Collision Risk | Speed | Length |
|---|---|---|---|
| UUID v4 | None | Fast | 36 chars ❌ |
| nanoid | Tiny but real | Fast | 21 chars |
| **Redis INCR + Base62** | **Zero** | **O(1)** | **3-6 chars ✅** |

Redis `INCR` is **atomic** — even under 10K concurrent requests, every caller gets a unique integer. Converting to Base62 gives us short, URL-safe strings: 6 characters can encode **~56 billion** unique IDs.

The counter starts at `10,000` so the very first short code is 3 characters (`2Bi`).

### Why Cache-Aside Pattern?

- **Write path:** After creating a link, we cache `code→url` AND `url→code` in Redis.
- **Read path:** Redirect checks Redis first (sub-ms). On a miss, it queries Neon, then back-fills the cache with a 24h TTL.
- **Dedup:** If the same URL is submitted again, we return the existing code instantly from cache.

### Why Sliding Window Rate Limiting?

Fixed-window rate limiting has a burst problem at boundaries (e.g., 10 reqs at second 59 + 10 at second 0 = 20 in 1 real second). Sliding window smooths this out with only ~2 Redis commands per check.

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js (App Router) | Server Actions, Edge Middleware, file-based routing |
| Language | TypeScript (strict) | No `any`, fully typed API responses |
| Database | Neon Postgres | Serverless, scales to zero, free tier |
| ORM | Drizzle ORM | Type-safe, lightweight, great DX |
| Cache & IDs | Upstash Redis | HTTP-based, Edge-compatible, atomic INCR |
| Rate Limiting | @upstash/ratelimit | Sliding window, built on Redis |
| Validation | Zod | Runtime schema validation for env + input |
| UI | shadcn/ui + Tailwind CSS | Accessible components, utility-first styling |
| Deployment | Vercel | Edge Runtime, zero-config, free tier |

---

## 📁 Project Structure

```
├── app/
│   ├── [shortCode]/route.ts    # GET /:code → Redis/DB lookup → 302 redirect
│   ├── api/shorten/route.ts    # POST /api/shorten (REST endpoint)
│   ├── actions.ts              # Server Action (form submission)
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page (ShortenForm)
│   └── not-found.tsx           # Custom 404 page
├── components/
│   ├── shorten-form.tsx        # Client component — URL input + result display
│   └── ui/                     # shadcn/ui primitives (Button, Input, Card, etc.)
├── lib/
│   ├── db/
│   │   ├── index.ts            # Drizzle + Neon HTTP connection
│   │   └── schema.ts           # `links` table definition
│   ├── base62.ts               # Base62 encode/decode
│   ├── env.ts                  # Zod-validated environment variables
│   ├── rate-limit.ts           # Upstash sliding-window rate limiter
│   ├── redis.ts                # Redis client + key namespace
│   ├── short-code.ts           # Redis INCR → Base62 short code generator
│   ├── types.ts                # Shared API response types
│   ├── utils.ts                # cn() utility for Tailwind
│   └── validations.ts          # Zod schema for URL input
├── middleware.ts                # Edge middleware (rate limiting)
├── drizzle.config.ts           # Drizzle Kit configuration
└── .env.example                # Template for environment variables
```

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Neon](https://console.neon.tech/) account (free tier)
- [Upstash](https://console.upstash.com/) account (free tier)

### 1. Clone & Install

```bash
git clone <your-repo-url> url-shortener
cd url-shortener
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in your credentials:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | [Neon Console](https://console.neon.tech/) → Connection string |
| `UPSTASH_REDIS_REST_URL` | [Upstash Console](https://console.upstash.com/) → REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | [Upstash Console](https://console.upstash.com/) → REST API Token |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` for dev, your domain for prod |

### 3. Push Database Schema

```bash
bun run db:push
```

### 4. Run Development Server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Open Drizzle Studio

```bash
bun run db:studio
```

---

## 📡 API Reference

### `POST /api/shorten`

Shorten a URL.

**Request:**
```json
{ "url": "https://example.com/very/long/path" }
```

**Success (201):**
```json
{
  "success": true,
  "shortUrl": "http://localhost:3000/2Bi",
  "shortCode": "2Bi"
}
```

**Validation Error (400):**
```json
{ "success": false, "error": "Please enter a valid URL" }
```

**Rate Limited (429):**
```json
{ "success": false, "error": "Too many requests. Please try again later." }
```

Rate limit headers are always included:
- `X-RateLimit-Limit` — Max requests per window
- `X-RateLimit-Remaining` — Remaining requests
- `X-RateLimit-Reset` — Window reset timestamp

### `GET /:shortCode`

Redirects to the original URL (302) or returns 302 to `/?error=not-found`.

---

## 🚢 Deploy to Vercel

1. Push your code to GitHub.
2. Import the repo on [vercel.com/new](https://vercel.com/new).
3. Add the environment variables in the Vercel dashboard.
4. Deploy — done.

The app works with Vercel's Edge Runtime out of the box. Both Neon and Upstash use HTTP-based drivers, so no TCP connections are needed.

---

## 📄 License

MIT
