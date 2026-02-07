/**
 * k6 Load Test — URL Shortener Redirect Performance
 * ──────────────────────────────────────────────────
 *
 * Prerequisites:
 *   1. Install k6: https://k6.io/docs/get-started/installation/
 *      brew install k6
 *
 *   2. Have the app running locally (or against a staging URL):
 *      bun dev
 *
 *   3. Create at least one short link via the UI or API:
 *      curl -X POST http://localhost:3000/api/shorten \
 *        -H 'Content-Type: application/json' \
 *        -d '{"url": "https://example.com"}'
 *
 *   4. Replace SHORT_CODE below with the returned short code.
 *
 * Usage:
 *   k6 run tests/k6-script.js
 *
 * Interpreting Results:
 * ─────────────────────
 *   • http_req_duration (P95) — 95th percentile latency.
 *       Goal: < 200ms local, < 100ms on Vercel Edge.
 *
 *   • http_reqs — Total requests completed.
 *       Divide by test duration to get Requests Per Second (RPS).
 *       Goal: > 500 RPS locally, much higher on Vercel.
 *
 *   • http_req_failed — Should be 0% (no 5xx errors).
 *
 *   • iterations — Each VU completes one full iteration per loop.
 *       Higher = the redirect is fast and the system is not saturated.
 */

import http from "k6/http";
import { check, sleep } from "k6";

// ─── Configuration ─────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SHORT_CODE = __ENV.SHORT_CODE || "2Bi"; // Replace with a real code

export const options = {
  // Ramp up to 50 VUs over 30s, hold for 1m, ramp down over 10s
  stages: [
    { duration: "30s", target: 50 }, // Ramp up
    { duration: "1m", target: 50 },  // Sustained load
    { duration: "10s", target: 0 },  // Ramp down
  ],
  thresholds: {
    // P95 latency must be under 200ms
    http_req_duration: ["p(95)<200"],
    // Less than 1% of requests should fail
    http_req_failed: ["rate<0.01"],
  },
};

// ─── Test Scenario ─────────────────────────────────────────

export default function () {
  // Test the redirect endpoint — this is the hot path
  const res = http.get(`${BASE_URL}/${SHORT_CODE}`, {
    // Don't follow redirects — we want to measure the shortener's
    // response time, not the downstream site's load time.
    redirects: 0,
  });

  check(res, {
    // The shortener should return a 302 redirect
    "status is 302": (r) => r.status === 302,
    // The Location header should contain the original URL
    "has Location header": (r) => r.headers["Location"] !== undefined,
    // Response time under 200ms (individual request check)
    "latency < 200ms": (r) => r.timings.duration < 200,
  });

  // Small pause between iterations to simulate realistic traffic
  sleep(0.5);
}

/**
 * Optional: Test the shorten endpoint under load.
 * Uncomment below to stress-test URL creation.
 *
 * NOTE: This will be rate-limited to 10 req/min per IP,
 * so most requests will return 429. That's expected — it
 * proves the rate limiter works!
 *
 * export function shortenEndpoint() {
 *   const payload = JSON.stringify({
 *     url: `https://example.com/${Date.now()}/${Math.random()}`,
 *   });
 *
 *   const res = http.post(`${BASE_URL}/api/shorten`, payload, {
 *     headers: { "Content-Type": "application/json" },
 *   });
 *
 *   check(res, {
 *     "status is 201 or 429": (r) => r.status === 201 || r.status === 429,
 *   });
 *
 *   sleep(1);
 * }
 */
