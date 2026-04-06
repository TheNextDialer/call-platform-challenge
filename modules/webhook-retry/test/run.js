const assert = require("assert");
const { RetryScheduler } = require("../src/retry-scheduler");
const { CircuitBreaker } = require("../src/circuit-breaker");

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

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log("\n  webhook-retry tests\n");

async function runTests() {
  await asyncTest("stops retrying after maxRetries", async () => {
    const scheduler = new RetryScheduler({ maxRetries: 3 });
    let attempts = 0;

    const result = await scheduler.deliver(
      "wh-1", "https://example.com/hook", { event: "call.ended" },
      async () => { attempts++; return { success: false }; }
    );

    assert.strictEqual(result.status, "failed",
      `Expected status 'failed' after max retries but got '${result.status}'`);
    assert.strictEqual(attempts, 4,
      `Expected 4 total attempts (1 initial + 3 retries) but got ${attempts}`);
  });

  await asyncTest("exponential backoff: delays double each attempt", async () => {
    const scheduler = new RetryScheduler({ maxRetries: 4, baseDelay: 1000, maxDelay: 60000 });
    const delays = [];

    // Monkey-patch to capture delays
    const origCalc = scheduler._calculateDelay.bind(scheduler);
    scheduler._calculateDelay = (attempt) => {
      const delay = origCalc(attempt);
      delays.push({ attempt, delay });
      return delay;
    };

    await scheduler.deliver(
      "wh-2", "https://example.com/hook", { event: "call.started" },
      async () => ({ success: false })
    );

    // Verify exponential pattern: each delay should be roughly 2x the previous
    for (const { attempt, delay } of delays) {
      const expectedMin = 1000 * Math.pow(2, attempt);
      const expectedMax = 1000 * Math.pow(2, attempt) + 1000; // +jitter
      assert.ok(delay >= expectedMin && delay <= expectedMax,
        `Attempt ${attempt}: delay ${delay}ms should be between ${expectedMin}ms and ${expectedMax}ms`);
    }
  });

  test("circuit breaker resets failure count on successful HALF_OPEN probe", () => {
    let now = 0;
    const breaker = new CircuitBreaker({ threshold: 3, resetTimeout: 5000, nowFn: () => now });

    // Trip the breaker with 3 failures
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    assert.strictEqual(breaker.getState(), "OPEN", "Should be OPEN after 3 failures");

    // Wait for reset timeout
    now = 6000;
    assert.strictEqual(breaker.getState(), "HALF_OPEN", "Should be HALF_OPEN after timeout");

    // Successful probe
    assert.strictEqual(breaker.canRequest(), true, "Should allow HALF_OPEN probe");
    breaker.recordSuccess();
    assert.strictEqual(breaker.getState(), "CLOSED", "Should be CLOSED after successful probe");

    // After reset, should tolerate threshold-1 failures without re-tripping
    breaker.recordFailure();
    assert.strictEqual(breaker.getState(), "CLOSED",
      "Should stay CLOSED after 1 failure (threshold is 3) — failure count should have been reset");
    breaker.recordFailure();
    assert.strictEqual(breaker.getState(), "CLOSED",
      "Should stay CLOSED after 2 failures (threshold is 3)");
  });

  await asyncTest("successful delivery on first attempt returns 'delivered'", async () => {
    const scheduler = new RetryScheduler({ maxRetries: 5 });

    const result = await scheduler.deliver(
      "wh-3", "https://example.com/hook", { event: "call.ended" },
      async () => ({ success: true })
    );

    assert.strictEqual(result.status, "delivered",
      `Expected 'delivered' but got '${result.status}'`);
    assert.strictEqual(result.attempts, 1,
      `Expected 1 attempt but got ${result.attempts}`);
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests();
