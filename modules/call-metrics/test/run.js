const assert = require("assert");
const { CallMetricsAggregator } = require("../src/aggregator");

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

console.log("\n  call-metrics tests\n");

test("AHT uses answered_at to ended_at, not started_at", () => {
  let now = 100000;
  const agg = new CallMetricsAggregator({ windowMs: 600000, targetSeconds: 20, nowFn: () => now });

  // Call 1: rang for 10s, handled for 60s → AHT should be 60000ms
  agg.addEvent({
    id: "c1", started_at: 0, answered_at: 10000, ended_at: 70000, status: "ended"
  });
  // Call 2: rang for 5s, handled for 45s → AHT should be 45000ms
  agg.addEvent({
    id: "c2", started_at: 1000, answered_at: 6000, ended_at: 51000, status: "ended"
  });

  const metrics = agg.getMetrics();
  // Average of 60000 and 45000 = 52500
  assert.ok(metrics.averageHandleTime >= 52000 && metrics.averageHandleTime <= 53000,
    `AHT should be ~52500ms (answered→ended) but got ${metrics.averageHandleTime}ms. ` +
    `If you got ~67500, you're using started_at instead of answered_at.`);
});

test("abandonment rate: abandoned / (abandoned + answered), excluding ringing", () => {
  let now = 100000;
  const agg = new CallMetricsAggregator({ windowMs: 600000, targetSeconds: 20, nowFn: () => now });

  // 7 answered calls
  for (let i = 0; i < 7; i++) {
    agg.addEvent({
      id: `ans-${i}`, started_at: i * 1000, answered_at: i * 1000 + 5000,
      ended_at: i * 1000 + 65000, status: "ended"
    });
  }
  // 3 abandoned calls
  for (let i = 0; i < 3; i++) {
    agg.addEvent({
      id: `abn-${i}`, started_at: i * 1000 + 500, answered_at: null,
      ended_at: i * 1000 + 30000, status: "abandoned"
    });
  }
  // 2 still ringing (should NOT count in denominator)
  for (let i = 0; i < 2; i++) {
    agg.addEvent({
      id: `ring-${i}`, started_at: 90000 + i * 1000, answered_at: null,
      ended_at: null, status: "ringing"
    });
  }

  const metrics = agg.getMetrics();
  // Abandonment = 3 / (3 + 7) = 30%
  assert.ok(metrics.abandonmentRate >= 29.5 && metrics.abandonmentRate <= 30.5,
    `Abandonment rate should be 30% (3 abandoned / 10 offered) but got ${metrics.abandonmentRate}%. ` +
    `If you got ~43%, denominator is wrong. If ringing calls affect the rate, they shouldn't.`);
});

test("service level: compare ms timestamps correctly against target seconds", () => {
  let now = 200000;
  const agg = new CallMetricsAggregator({ windowMs: 600000, targetSeconds: 20, nowFn: () => now });

  // 4 calls answered within 20 seconds
  for (let i = 0; i < 4; i++) {
    agg.addEvent({
      id: `fast-${i}`, started_at: i * 10000, answered_at: i * 10000 + 15000,
      ended_at: i * 10000 + 60000, status: "ended"
    });
  }
  // 1 call answered at 25 seconds (exceeds 20s target)
  agg.addEvent({
    id: "slow-1", started_at: 50000, answered_at: 75000,
    ended_at: 120000, status: "ended"
  });

  const metrics = agg.getMetrics();
  // 4 out of 5 answered within target = 80%
  assert.ok(metrics.serviceLevel >= 79.5 && metrics.serviceLevel <= 80.5,
    `Service level should be 80% (4/5 within 20s) but got ${metrics.serviceLevel}%. ` +
    `If you got 0%, there's likely a ms vs seconds unit mismatch.`);
});

test("window eviction: old events are excluded from metrics", () => {
  let now = 0;
  const agg = new CallMetricsAggregator({ windowMs: 60000, targetSeconds: 20, nowFn: () => now });

  // Add a call at T=0
  agg.addEvent({
    id: "old-1", started_at: 0, answered_at: 5000, ended_at: 30000, status: "ended"
  });

  now = 30000;
  let metrics = agg.getMetrics();
  assert.strictEqual(metrics.answeredCalls, 1, "Should see 1 answered call at T=30s");

  // Advance past window
  now = 70000;
  metrics = agg.getMetrics();
  assert.strictEqual(metrics.answeredCalls, 0,
    `After window expires, answered calls should be 0 but got ${metrics.answeredCalls}`);
  assert.strictEqual(metrics.totalCalls, 0,
    `After window expires, total calls should be 0 but got ${metrics.totalCalls}`);
});

console.log(`\n  ${passed} passing, ${failed} failing\n`);
if (failed > 0) process.exit(1);
