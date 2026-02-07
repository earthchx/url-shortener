import { z } from "zod";

/**
 * Server-side environment variables schema.
 * Validated at import time — the app will crash fast
 * if any required variable is missing or malformed.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid Neon connection string"),

  // Upstash Redis — used for caching, rate limiting, and ID generation
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(1, "UPSTASH_REDIS_REST_TOKEN is required"),

  // The public base URL of the app (e.g. https://sho.rt)
  NEXT_PUBLIC_BASE_URL: z
    .string()
    .url("NEXT_PUBLIC_BASE_URL must be a valid URL")
    .default("http://localhost:3000"),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and freeze environment variables once.
 * Any misconfiguration throws immediately at startup.
 */
function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:\n",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment variables");
  }

  return Object.freeze(parsed.data);
}

export const env = validateEnv();
