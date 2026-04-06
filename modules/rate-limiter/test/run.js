const assert = require("assert");
const { SlidingWindowRateLimiter } = require("../src/sliding-window");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log("\n  rate-limiter tests\n");

test("allows requests up to limit then rejects", () => {
  let now = 1000;
  const limiter = new SlidingWindowRateLimiter(5, 60000, () => now);

  for (let i = 0; i < 5; i++) {
    const result = limiter.isAllowed();
    assert.strictEqual(result.allowed, true, `Request ${i + 1} should be allowed`);
  }

  const rejected = limiter.isAllowed();
  assert.strictEqual(rejected.allowed, false, "6th request should be rejected");
});

test("sliding window: old requests expire individually, not all at once", () => {
  let now = 0;
  const limiter = new SlidingWindowRateLimiter(5, 60000, () => now);

  // Make 5 requests at times 0, 10s, 20s, 30s, 40s
  for (let i = 0; i < 5; i++) {
    now = i * 10000;
    limiter.isAllowed();
  }

  // At T=50s, all 5 are still in window. Should be rejected.
  now = 50000;
  const r1 = limiter.isAllowed();
  assert.strictEqual(r1.allowed, false, "At T=50s, all 5 in window, should reject");

  // At T=61s, the request from T=0 has expired (older than 60s).
  // Only 4 requests remain in window (from 10s, 20s, 30s, 40s).
  // So one new request should be allowed.
  now = 61000;
  const r2 = limiter.isAllowed();
  assert.strictEqual(r2.allowed, true,
    "At T=61s, request from T=0 expired, should allow one new request");

  // But only one slot opened, so the next should be rejected
  const r3 = limiter.isAllowed();
  assert.strictEqual(r3.allowed, false,
    "Only one slot opened at T=61s, second request should be rejected");
});

test("getRemainingRequests returns remaining capacity, not count", () => {
  let now = 1000;
  const limiter = new SlidingWindowRateLimiter(10, 60000, () => now);

  limiter.isAllowed();
  limiter.isAllowed();
  limiter.isAllowed();

  const remaining = limiter.getRemainingRequests();
  assert.strictEqual(remaining, 7,
    `After 3 requests with limit 10, remaining should be 7 but got ${remaining}`);
});

test("getResetTime returns ms until next slot, not an epoch timestamp", () => {
  let now = 5000;
  const limiter = new SlidingWindowRateLimiter(2, 60000, () => now);

  // Request at T=5s
  limiter.isAllowed();
  // Request at T=15s
  now = 15000;
  limiter.isAllowed();

  // At T=20s, both slots full. Next slot opens when T=5s request expires at T=65s.
  // So reset time should be 65000 - 20000 = 45000ms
  now = 20000;
  limiter.isAllowed(); // rejected

  const resetTime = limiter.getResetTime();
  assert.ok(resetTime > 0 && resetTime <= 60000,
    `Reset time should be ms until next slot (expected ~45000) but got ${resetTime}`);
  assert.ok(resetTime >= 44000 && resetTime <= 46000,
    `Reset time should be ~45000ms but got ${resetTime}`);
});

console.log(`\n  ${passed} passing, ${failed} failing\n`);
if (failed > 0) process.exit(1);
