import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Create a Neon HTTP client.
 * This uses Neon's serverless driver which works over HTTP —
 * perfect for Vercel Edge / Serverless functions (no persistent TCP needed).
 */
const sql = neon(env.DATABASE_URL);

/**
 * Drizzle ORM instance bound to the Neon HTTP driver.
 * The `schema` import gives us typed, auto-completed query builders.
 */
export const db = drizzle(sql, { schema });
