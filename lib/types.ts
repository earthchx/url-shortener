/**
 * Shared TypeScript types for API request/response payloads.
 * Used by both server actions and API routes to keep things DRY.
 */

/** Successful response from the shorten endpoint */
export interface ShortenSuccess {
  success: true;
  shortUrl: string;
  shortCode: string;
}

/** Error response from the shorten endpoint */
export interface ShortenError {
  success: false;
  error: string;
}

/** Union type for the shorten API response */
export type ShortenResponse = ShortenSuccess | ShortenError;

/** Shape of a link record returned to the client */
export interface LinkRecord {
  id: number;
  originalUrl: string;
  shortCode: string;
  visits: number;
  createdAt: string;
}
