import { z } from "zod";

/**
 * Validation schema for the URL shorten request.
 * Ensures the input is a well-formed HTTP(S) URL and not absurdly long.
 */
export const shortenSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .max(2048, "URL must be under 2048 characters")
    .refine(
      (u) => u.startsWith("http://") || u.startsWith("https://"),
      "URL must start with http:// or https://"
    ),
});

export type ShortenInput = z.infer<typeof shortenSchema>;
