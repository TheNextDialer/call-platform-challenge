const assert = require("assert");
const {
  toBillableMinutes,
  calculateBill,
  convertCurrency,
  calculateCallCharge,
  MINIMUM_CHARGE_PER_CALL,
} = require("../src/calculator");
const { resolveTierCost, applyFreeMinutes } = require("../src/tier-resolver");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  \u2713 " + name);
  } catch (e) {
    failed++;
    console.log("  \u2717 " + name);
    console.log("    " + e.message);
  }
}

console.log("\nBilling Calculator Tests\n");

// 1. Basic per-minute billing (passes)
test("basic per-minute billing", function () {
  const calls = [
    { id: "c1", durationSeconds: 120 },
    { id: "c2", durationSeconds: 180 },
  ];
  const bill = calculateBill(calls);
  // 2 min + 3 min = 5 min at $0.05/min = $0.25
  assert.strictEqual(bill.totalMinutes, 5);
  assert.strictEqual(bill.totalCharge, 0.25, "Expected 0.25 got " + bill.totalCharge);
});

// 2. Partial minutes rounded UP (fails)
test("partial minutes rounded up", function () {
  // 61 seconds = 1.0167 min -> Math.ceil = 2, Math.round = 1
  const minutes = toBillableMinutes(61);
  assert.strictEqual(minutes, 2, "Expected 2 got " + minutes);
});

// 3. Progressive tier calculation for 3000 minutes (fails)
test("progressive tier pricing for 3000 minutes", function () {
  // Progressive: 1000 * 0.05 + 2000 * 0.03 = 50 + 60 = 110
  // BUG (flat): 3000 * 0.03 = 90
  const cost = resolveTierCost(3000);
  assert.strictEqual(cost, 110, "Expected 110 got " + cost);
});

// 4. Free tier deducted from cheapest tier (fails)
test("free tier minutes deducted from cheapest tier", function () {
  // 1500 min with starter plan (50 free min)
  // Buckets: 1000 at $0.05, 500 at $0.03
  // Correct: deduct 50 from cheapest ($0.05) -> 950*0.05 + 500*0.03 = 47.50 + 15 = 62.50
  // BUG: deducts from most expensive ($0.05) -> same bucket but wrong logic
  // Actually with the flat-rate bug also in play, let's test applyFreeMinutes directly
  const cost = applyFreeMinutes(1500, "starter");
  // Correct: 950*0.05 + 500*0.03 = 47.50 + 15.00 = 62.50
  // BUG: deducts 50 from $0.05 tier (most expensive) -> 950*0.05 + 500*0.03 = 62.50
  // Wait - the sort bug means it deducts from highest rate first which IS the $0.05 tier
  // So we need more minutes to see the difference. Use 2000 min, enterprise (500 free)
  // Buckets: 1000 at $0.05, 1000 at $0.03
  // Correct (deduct from cheapest $0.03): 1000*0.05 + 500*0.03 = 50 + 15 = 65
  // BUG (deduct from expensive $0.05): 500*0.05 + 1000*0.03 = 25 + 30 = 55
  const cost2 = applyFreeMinutes(2000, "enterprise");
  assert.strictEqual(cost2, 65, "Expected 65 got " + cost2);
});

// 5. USD to JPY conversion (passes)
test("USD to JPY conversion", function () {
  const rates = { USD_JPY: 150 };
  const result = convertCurrency(100, "USD", "JPY", rates);
  assert.strictEqual(result, 15000, "Expected 15000 got " + result);
});

// 6. JPY to USD conversion (fails)
test("JPY to USD conversion", function () {
  const rates = { USD_JPY: 150 };
  // 1500 JPY / 150 = 10 USD
  // BUG: 1500 * 150 = 225000
  const result = convertCurrency(1500, "JPY", "USD", rates);
  assert.strictEqual(result, 10, "Expected 10 got " + result);
});

// 7. Minimum charge applied after conversion (fails)
test("minimum charge applied after currency conversion", function () {
  // A very short call: 1 second at a very low rate
  // Rate: $0.001/min -> 1 min * 0.001 = $0.001
  // BUG: min charge $0.01 applied in USD BEFORE conversion
  // Then converted: $0.01 * 150 = 1.5 JPY
  // Correct: $0.001 * 150 = 0.15 JPY, then apply min in JPY
  const charge = calculateCallCharge({ durationSeconds: 60 }, 0.001);
  const rates = { USD_JPY: 150 };
  const jpyCharge = convertCurrency(charge, "USD", "JPY", rates);
  // BUG path: charge = 0.01 (min applied), jpyCharge = 0.01 * 150 = 1.5
  // Correct: charge should be 0.001, jpyCharge = 0.15, then min in JPY
  // We check that the charge before conversion is NOT inflated by min
  assert.strictEqual(charge, 0.001, "Expected 0.001 got " + charge);
});

// 8. Empty calls array returns zero (passes)
test("empty calls array returns zero", function () {
  const bill = calculateBill([]);
  assert.strictEqual(bill.totalCharge, 0, "Expected 0 got " + bill.totalCharge);
  assert.strictEqual(bill.totalMinutes, 0, "Expected 0 got " + bill.totalMinutes);
  assert.strictEqual(bill.callCount, 0, "Expected 0 got " + bill.callCount);
});

console.log("\n  Results: " + passed + " passed, " + failed + " failed\n");
process.exit(failed > 0 ? 1 : 0);
