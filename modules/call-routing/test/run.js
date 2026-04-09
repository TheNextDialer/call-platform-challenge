const assert = require("assert");
const { haversineDistance, toRadians } = require("../src/geo-utils");
const { CallRouter } = require("../src/router");

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

console.log("\n  call-routing tests\n");

test("haversine: NYC to LA should be ~3944km", () => {
  // NYC: 40.7128, -74.0060  LA: 34.0522, -118.2437
  const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
  assert.ok(
    dist > 3930 && dist < 3960,
    `NYC to LA should be ~3944km but got ${Math.round(dist)}km`
  );
});

test("haversine: London to Tokyo should be ~9560km", () => {
  const dist = haversineDistance(51.5074, -0.1278, 35.6762, 139.6503);
  assert.ok(
    dist > 9550 && dist < 9575,
    `London to Tokyo should be ~9560km but got ${Math.round(dist)}km`
  );
});

test("haversine: Sydney to Santiago should be ~11340km", () => {
  // Equator-spanning route exposes radius/conversion errors
  const dist = haversineDistance(-33.8688, 151.2093, -33.4489, -70.6693);
  assert.ok(
    dist > 11300 && dist < 11380,
    `Sydney to Santiago should be ~11340km but got ${Math.round(dist)}km`
  );
});

test("haversine: same point should be 0km", () => {
  const dist = haversineDistance(40.0, -74.0, 40.0, -74.0);
  assert.ok(dist < 0.01, `Same point distance should be ~0 but got ${dist}`);
});

test("routes to nearest agent", () => {
  const router = new CallRouter();
  router.setAgentPool([
    { id: "nyc", lat: 40.7128, lng: -74.006, capacity: 10 },
    { id: "la", lat: 34.0522, lng: -118.2437, capacity: 10 },
  ]);
  // Call from Chicago (closer to NYC)
  const result = router.routeCall(41.8781, -87.6298);
  assert.strictEqual(
    result.id,
    "nyc",
    `Chicago call should route to NYC but got ${result.id}`
  );
});

test("respects agent capacity limits", () => {
  const router = new CallRouter();
  router.setAgentPool([
    { id: "a1", lat: 40.0, lng: -74.0, capacity: 2 },
    { id: "a2", lat: 41.0, lng: -75.0, capacity: 2 },
  ]);
  // Route 2 calls to a1 (nearest)
  router.routeCall(40.0, -74.0);
  router.routeCall(40.0, -74.0);
  // Third call should go to a2 since a1 is at capacity
  const third = router.routeCall(40.0, -74.0);
  assert.strictEqual(
    third.id,
    "a2",
    `Third call should route to a2 (a1 at capacity) but got ${third.id}`
  );
});

test("round-robin breaks distance ties fairly", () => {
  const router = new CallRouter();
  // Two agents at equal distance from origin
  router.setAgentPool([
    { id: "east", lat: 40.0, lng: -73.0, capacity: 10 },
    { id: "west", lat: 40.0, lng: -75.0, capacity: 10 },
  ]);
  // Route from midpoint
  router.routeCall(40.0, -74.0);
  router.routeCall(40.0, -74.0);
  const counts = router.getCallCounts();
  // Both should have 1 call each (fair distribution)
  assert.strictEqual(
    counts.east,
    1,
    `East should have 1 call but got ${counts.east}`
  );
  assert.strictEqual(
    counts.west,
    1,
    `West should have 1 call but got ${counts.west}`
  );
});

test("returns null for empty agent pool", () => {
  const router = new CallRouter();
  router.setAgentPool([]);
  const result = router.routeCall(40.0, -74.0);
  assert.strictEqual(result, null, "Empty pool should return null, not throw");
});

test("removeAgent cleans up call counts", () => {
  const router = new CallRouter();
  router.setAgentPool([
    { id: "a1", lat: 40.0, lng: -74.0, capacity: 10 },
    { id: "a2", lat: 41.0, lng: -75.0, capacity: 10 },
  ]);
  router.routeCall(40.0, -74.0); // routes to a1
  router.routeCall(41.0, -75.0); // routes to a2
  router.removeAgent("a1");
  // After removing a1, getTotalRouted should only count active agents
  const total = router.getTotalRouted();
  assert.strictEqual(
    total,
    1,
    `After removing a1, total should be 1 (only a2) but got ${total}`
  );
});

test("pool change resets round-robin state", () => {
  const router = new CallRouter();
  router.setAgentPool([
    { id: "a1", lat: 40.0, lng: -74.0, capacity: 10 },
  ]);
  router.routeCall(40.0, -74.0);
  router.routeCall(40.0, -74.0);

  // Change pool
  router.setAgentPool([
    { id: "b1", lat: 41.0, lng: -75.0, capacity: 10 },
    { id: "b2", lat: 42.0, lng: -76.0, capacity: 10 },
  ]);

  // Old call counts should not affect new pool
  const counts = router.getCallCounts();
  assert.strictEqual(
    counts.b1,
    0,
    `New agent b1 should have 0 calls but got ${counts.b1}`
  );
});

console.log(`\n  ${passed} passing, ${failed} failing\n`);
if (failed > 0) process.exit(1);
