import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 * Used by `drizzle-kit generate` and `drizzle-kit push` commands.
 *
 * We read DATABASE_URL directly from process.env here because
 * drizzle-kit runs outside the Next.js runtime (CLI tool).
 */
export default defineConfig({
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
