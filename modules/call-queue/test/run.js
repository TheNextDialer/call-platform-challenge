const assert = require("assert");
const { PriorityQueue } = require("../src/priority-queue");

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

console.log("\n  call-queue tests\n");

// Fixed clock: 2025-01-15 17:00:00 UTC (5pm)
const FIVE_PM_UTC = new Date("2025-01-15T17:00:00Z").getTime();
const nowFn = () => FIVE_PM_UTC;

test("dequeue returns items in priority order (all items)", () => {
  const pq = new PriorityQueue(nowFn);

  // All same enqueue time, offset 0 → local 17:00 = not business hours (< 17 fails)
  pq.enqueue({ id: "low", leadScore: 20, enqueuedAt: FIVE_PM_UTC, utcOffsetHours: 0 });
  pq.enqueue({ id: "high", leadScore: 90, enqueuedAt: FIVE_PM_UTC, utcOffsetHours: 0 });
  pq.enqueue({ id: "mid", leadScore: 50, enqueuedAt: FIVE_PM_UTC, utcOffsetHours: 0 });
  pq.enqueue({ id: "med", leadScore: 60, enqueuedAt: FIVE_PM_UTC, utcOffsetHours: 0 });

  const first = pq.dequeue();
  assert.strictEqual(first.id, "high", `1st dequeue: expected 'high' (90) but got '${first.id}'`);
  const second = pq.dequeue();
  assert.strictEqual(second.id, "med", `2nd dequeue: expected 'med' (60) but got '${second.id}'`);
  const third = pq.dequeue();
  assert.strictEqual(third.id, "mid", `3rd dequeue: expected 'mid' (50) but got '${third.id}'`);
  const fourth = pq.dequeue();
  assert.strictEqual(fourth.id, "low", `4th dequeue: expected 'low' (20) but got '${fourth.id}'`);
});

test("wait time contributes to priority score", () => {
  const pq = new PriorityQueue(nowFn);

  // Both offset 0 → local 17:00 → not business hours → no timezone bonus
  // Lead A: score 50, waiting 60 min → 50*0.6 + 60*0.4 = 30+24 = 54
  // Lead B: score 80, waiting 0 min  → 80*0.6 + 0*0.4  = 48+0  = 48
  const sixtyMinAgo = FIVE_PM_UTC - (60 * 60 * 1000);

  pq.enqueue({ id: "patient", leadScore: 50, enqueuedAt: sixtyMinAgo, utcOffsetHours: 0 });
  pq.enqueue({ id: "fresh-hot", leadScore: 80, enqueuedAt: FIVE_PM_UTC, utcOffsetHours: 0 });

  const first = pq.dequeue();
  assert.strictEqual(first.id, "patient",
    `Expected 'patient' (score 50 + 60min wait = 54) to beat 'fresh-hot' (score 80 + 0min wait = 48) but got '${first.id}'`);
});

test("timezone bonus applies correctly based on local business hours", () => {
  const pq = new PriorityQueue(nowFn);

  // Clock: 17:00 UTC (5pm)
  // Lead A: offset -8 (PST) → correct local = 17+(-8) = 9am (business hours, +10 bonus)
  //                           bug formula: 17-(-8) = 25 → 1am (NOT business hours)
  // Lead B: offset +8 (SGT) → correct local = 17+8 = 25 → 1am (NOT business hours)
  //                           bug formula: 17-8 = 9am (business hours, +10 bonus)
  // Same score/enqueue → with correct formula PST wins, with bug SGT wins

  pq.enqueue({ id: "singapore", leadScore: 50, enqueuedAt: FIVE_PM_UTC, utcOffsetHours: 8 });
  pq.enqueue({ id: "pacific", leadScore: 50, enqueuedAt: FIVE_PM_UTC, utcOffsetHours: -8 });

  const first = pq.dequeue();
  assert.strictEqual(first.id, "pacific",
    `Expected 'pacific' (9am local, business hours) to beat 'singapore' (1am local) but got '${first.id}'`);
});

test("peek returns highest priority without removing it", () => {
  const pq = new PriorityQueue(nowFn);

  pq.enqueue({ id: "a", leadScore: 40, enqueuedAt: FIVE_PM_UTC, utcOffsetHours: 0 });
  pq.enqueue({ id: "b", leadScore: 70, enqueuedAt: FIVE_PM_UTC, utcOffsetHours: 0 });

  const peeked = pq.peek();
  assert.strictEqual(peeked.id, "b", `Peek should return 'b' but got '${peeked.id}'`);
  assert.strictEqual(pq.size, 2, `Size should still be 2 after peek but got ${pq.size}`);

  const dequeued = pq.dequeue();
  assert.strictEqual(dequeued.id, "b", `Dequeue should return 'b' but got '${dequeued.id}'`);
  assert.strictEqual(pq.size, 1, `Size should be 1 after dequeue but got ${pq.size}`);
});

console.log(`\n  ${passed} passing, ${failed} failing\n`);
if (failed > 0) process.exit(1);
