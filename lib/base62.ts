/**
 * Base62 Encoder
 * ──────────────
 * Converts a positive integer into a short, URL-safe string using
 * the character set: 0-9, a-z, A-Z  (62 characters).
 *
 * Why Base62?
 * • URL-safe without encoding (no +, /, = like Base64)
 * • Compact: 6 chars can represent ~56 billion unique IDs (62^6)
 * • Deterministic & reversible (we can decode back if needed)
 *
 * Example mappings:
 *   10000  → "2Bi"
 *   100000 → "q0U"
 *   1      → "1"
 */

const CHARSET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = CHARSET.length; // 62

/**
 * Encode a positive integer to a Base62 string.
 * @param num - Must be a positive integer (>= 1)
 * @returns The Base62-encoded string
 * @throws If num is not a positive integer
 */
export function encodeBase62(num: number): string {
  if (!Number.isInteger(num) || num < 1) {
    throw new Error(`encodeBase62: expected positive integer, got ${num}`);
  }

  let result = "";
  let n = num;

  while (n > 0) {
    result = CHARSET[n % BASE] + result;
    n = Math.floor(n / BASE);
  }

  return result;
}

/**
 * Decode a Base62 string back to a positive integer.
 * Useful for debugging or analytics — not needed in the hot path.
 */
export function decodeBase62(str: string): number {
  let result = 0;

  for (const char of str) {
    const index = CHARSET.indexOf(char);
    if (index === -1) {
      throw new Error(`decodeBase62: invalid character "${char}"`);
    }
    result = result * BASE + index;
  }

  return result;
}
