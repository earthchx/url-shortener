import { describe, it, expect } from "vitest";
import { encodeBase62, decodeBase62 } from "@/lib/base62";

describe("Base62 Encoder / Decoder", () => {
  // ─── encodeBase62 ──────────────────────────────────────────

  describe("encodeBase62", () => {
    it("encodes 1 → '1'", () => {
      expect(encodeBase62(1)).toBe("1");
    });

    it("encodes 10 → 'a' (first lowercase letter)", () => {
      expect(encodeBase62(10)).toBe("a");
    });

    it("encodes 36 → 'A' (first uppercase letter)", () => {
      expect(encodeBase62(36)).toBe("A");
    });

    it("encodes 61 → 'Z' (last char in charset)", () => {
      expect(encodeBase62(61)).toBe("Z");
    });

    it("encodes 62 → '10' (first two-char code)", () => {
      expect(encodeBase62(62)).toBe("10");
    });

    it("encodes 10000 → '2Bi' (our COUNTER_START)", () => {
      // 10000 = 2*62² + 37*62 + 18
      // CHARSET[2]='2', CHARSET[37]='B', CHARSET[18]='i'
      expect(encodeBase62(10000)).toBe("2Bi");
    });

    it("encodes 100000 correctly", () => {
      expect(encodeBase62(100000)).toBe("q0U");
    });

    it("encodes Number.MAX_SAFE_INTEGER without crashing", () => {
      // 2^53 - 1 = 9007199254740991
      const result = encodeBase62(Number.MAX_SAFE_INTEGER);
      expect(result).toBeTypeOf("string");
      expect(result.length).toBeGreaterThan(0);
      // Verify every character is in the Base62 charset
      const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (const ch of result) {
        expect(charset).toContain(ch);
      }
    });

    it("throws for 0 (not a positive integer)", () => {
      expect(() => encodeBase62(0)).toThrow("expected positive integer");
    });

    it("throws for negative numbers", () => {
      expect(() => encodeBase62(-5)).toThrow("expected positive integer");
    });

    it("throws for non-integers", () => {
      expect(() => encodeBase62(3.14)).toThrow("expected positive integer");
    });
  });

  // ─── decodeBase62 ──────────────────────────────────────────

  describe("decodeBase62", () => {
    it("decodes '1' → 1", () => {
      expect(decodeBase62("1")).toBe(1);
    });

    it("decodes '2Bi' → 10000", () => {
      expect(decodeBase62("2Bi")).toBe(10000);
    });

    it("throws for invalid characters", () => {
      expect(() => decodeBase62("abc!")).toThrow('invalid character "!"');
      expect(() => decodeBase62("hello world")).toThrow('invalid character " "');
    });
  });

  // ─── Round-trip consistency ────────────────────────────────

  describe("round-trip: decode(encode(n)) === n", () => {
    const testValues = [1, 2, 10, 61, 62, 100, 999, 10000, 100000, 999999, 56800235583];

    it.each(testValues)("round-trips %i correctly", (n) => {
      expect(decodeBase62(encodeBase62(n))).toBe(n);
    });

    it("round-trips 1000 sequential values", () => {
      for (let i = 1; i <= 1000; i++) {
        expect(decodeBase62(encodeBase62(i))).toBe(i);
      }
    });
  });

  // ─── Monotonicity (important for short codes) ─────────────

  describe("monotonicity", () => {
    it("produces unique codes for sequential inputs", () => {
      const codes = Array.from({ length: 100 }, (_, i) => encodeBase62(10000 + i));
      const unique = new Set(codes);
      expect(unique.size).toBe(100);
    });

    it("higher input → higher decoded value (numerical monotonicity)", () => {
      for (let n = 10000; n < 10100; n++) {
        const code = encodeBase62(n);
        expect(decodeBase62(code)).toBe(n);
        if (n > 10000) {
          expect(decodeBase62(encodeBase62(n))).toBeGreaterThan(
            decodeBase62(encodeBase62(n - 1))
          );
        }
      }
    });
  });
});
