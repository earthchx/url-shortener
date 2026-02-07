import {
  pgTable,
  bigserial,
  text,
  varchar,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * `links` — the core table for persisting shortened URLs.
 *
 * Design decisions:
 * ─────────────────
 * • `id` (bigserial)  — Auto-incrementing 64-bit PK. We don't rely on it for
 *   short-code generation (Redis INCR handles that), but it's useful for
 *   ordered inserts and potential future analytics queries.
 *
 * • `short_code`      — The Base62-encoded string derived from a Redis
 *   atomic counter. Has a UNIQUE index so lookups by code are O(log n).
 *
 * • `original_url`    — The destination URL. Indexed to quickly check
 *   if a URL has already been shortened (dedup optimisation).
 *
 * • `visits`          — Simple hit counter, incremented asynchronously
 *   on each redirect so it never blocks the user.
 *
 * • `created_at`      — Immutable creation timestamp, defaults to NOW().
 */
export const links = pgTable(
  "links",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    originalUrl: text("original_url").notNull(),
    shortCode: varchar("short_code", { length: 12 }).notNull(),
    visits: integer("visits").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Fast lookup when redirecting: GET /:shortCode
    uniqueIndex("links_short_code_idx").on(table.shortCode),
    // Optional dedup: check if URL was already shortened
    index("links_original_url_idx").on(table.originalUrl),
  ]
);

/** TypeScript type inferred from the table — use for insert payloads */
export type NewLink = typeof links.$inferInsert;

/** TypeScript type inferred from the table — use for select results */
export type Link = typeof links.$inferSelect;
