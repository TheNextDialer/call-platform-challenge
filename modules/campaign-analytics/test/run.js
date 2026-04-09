/**
 * Campaign Analytics Module — Test Suite
 * 10 tests covering funnel ordering, conversion, timing, drop-off, dedup, and date filtering.
 */

const { Funnel } = require('../src/funnel');
const { CampaignAnalytics } = require('../src/analytics');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  FAIL: ${testName}`);
    failed++;
  }
}

function approxEqual(a, b, tolerance = 0.001) {
  return Math.abs(a - b) < tolerance;
}

// ---------------------------------------------------------------------------
// Test 1: Funnel steps return in numeric order
// ---------------------------------------------------------------------------
console.log('\nTest 1: Funnel steps return in numeric order');
{
  const funnel = new Funnel('Outbound');
  funnel.addStep(3, 'Pitched');
  funnel.addStep(1, 'Dialed');
  funnel.addStep(4, 'Closed');
  funnel.addStep(2, 'Connected');
  const steps = funnel.getSteps();
  const numbers = steps.map(s => s.stepNumber);
  assert(
    JSON.stringify(numbers) === JSON.stringify([1, 2, 3, 4]),
    'Steps should be [1,2,3,4] regardless of insertion order'
  );
}

// ---------------------------------------------------------------------------
// Test 2: Basic conversion rate between adjacent steps
// ---------------------------------------------------------------------------
console.log('\nTest 2: Basic conversion rate (step 1 -> step 2)');
{
  const funnel = new Funnel('Sales');
  funnel.addStep(1, 'Dialed');
  funnel.addStep(2, 'Connected');

  const analytics = new CampaignAnalytics(funnel);
  // 5 contacts enter step 1, 4 complete step 1
  // 3 enter step 2, 3 complete step 2
  ['c1','c2','c3','c4','c5'].forEach(id => {
    analytics.addEvent({ contactId: id, step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });
  });
  ['c1','c2','c3','c4'].forEach(id => {
    analytics.addEvent({ contactId: id, step: 1, timestamp: '2026-01-01T10:01:00Z', type: 'completed' });
  });
  ['c1','c2','c3'].forEach(id => {
    analytics.addEvent({ contactId: id, step: 2, timestamp: '2026-01-01T10:02:00Z', type: 'entered' });
    analytics.addEvent({ contactId: id, step: 2, timestamp: '2026-01-01T10:03:00Z', type: 'completed' });
  });

  const rate = analytics.getConversionRate(1, 2);
  // Correct: 3 completed step 2 / 4 completed step 1 = 0.75
  // Bug gives: 3 completed step 2 / 5 unique entered (any step) = 0.60
  assert(approxEqual(rate, 0.75), `Conversion should be 0.75, got ${rate.toFixed(3)}`);
}

// ---------------------------------------------------------------------------
// Test 3: Time to convert from step 1 to step 3
// ---------------------------------------------------------------------------
console.log('\nTest 3: Time to convert (step 1 -> step 3)');
{
  const funnel = new Funnel('Pipeline');
  funnel.addStep(1, 'Dialed');
  funnel.addStep(2, 'Connected');
  funnel.addStep(3, 'Pitched');

  const analytics = new CampaignAnalytics(funnel);

  // Contact c1: enters step 1 at T+0, completes step 1 at T+5m,
  //             enters step 2 at T+6m, completes step 2 at T+10m,
  //             enters step 3 at T+11m, completes step 3 at T+20m
  const base = new Date('2026-01-01T10:00:00Z');
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: new Date(base.getTime()), type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: new Date(base.getTime() + 5*60000), type: 'completed' });
  analytics.addEvent({ contactId: 'c1', step: 2, timestamp: new Date(base.getTime() + 6*60000), type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 2, timestamp: new Date(base.getTime() + 10*60000), type: 'completed' });
  analytics.addEvent({ contactId: 'c1', step: 3, timestamp: new Date(base.getTime() + 11*60000), type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 3, timestamp: new Date(base.getTime() + 20*60000), type: 'completed' });

  const avgTime = analytics.getTimeToConvert(1, 3);
  // Correct: from step 1 completed (T+5m) to step 3 completed (T+20m) = 15 minutes = 900000ms
  // Bug gives: from first entered (T+0) to step 3 completed (T+20m) = 20 minutes = 1200000ms
  assert(
    avgTime === 15 * 60 * 1000,
    `Should be 900000ms (15min), got ${avgTime}ms`
  );
}

// ---------------------------------------------------------------------------
// Test 4: Drop-off excludes in-progress contacts
// ---------------------------------------------------------------------------
console.log('\nTest 4: Drop-off excludes in-progress contacts');
{
  const funnel = new Funnel('Outbound');
  funnel.addStep(1, 'Dialed');

  const analytics = new CampaignAnalytics(funnel);
  // c1: entered + completed
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:01:00Z', type: 'completed' });
  // c2: entered + dropped
  analytics.addEvent({ contactId: 'c2', step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });
  analytics.addEvent({ contactId: 'c2', step: 1, timestamp: '2026-01-01T10:01:00Z', type: 'dropped' });
  // c3: entered only (in progress — NOT dropped)
  analytics.addEvent({ contactId: 'c3', step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });

  const dropRate = analytics.getDropOffRate(1);
  // Correct: 1 dropped / 3 entered = 0.333
  // Bug gives: 2 "not completed" / 3 entered = 0.667
  assert(
    approxEqual(dropRate, 1/3),
    `Drop-off should be 0.333, got ${dropRate.toFixed(3)}`
  );
}

// ---------------------------------------------------------------------------
// Test 5: Duplicate events not double-counted
// ---------------------------------------------------------------------------
console.log('\nTest 5: Duplicate events not double-counted');
{
  const funnel = new Funnel('Dedup Test');
  funnel.addStep(1, 'Dialed');
  funnel.addStep(2, 'Connected');

  const analytics = new CampaignAnalytics(funnel);
  // Add same event twice
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:01:00Z', type: 'completed' });
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:01:00Z', type: 'completed' });

  analytics.addEvent({ contactId: 'c1', step: 2, timestamp: '2026-01-01T10:02:00Z', type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 2, timestamp: '2026-01-01T10:03:00Z', type: 'completed' });

  // With dedup, c1 entered step 1 once, completed once -> conversion 1→2 should be 1.0
  const rate = analytics.getConversionRate(1, 2);
  const journey = analytics.getContactJourney('c1');
  // Should have 4 unique events, not 6
  assert(
    journey.length === 4,
    `Should have 4 unique events, got ${journey.length}`
  );
}

// ---------------------------------------------------------------------------
// Test 6: Date range includes last day
// ---------------------------------------------------------------------------
console.log('\nTest 6: Date range includes last day');
{
  const funnel = new Funnel('Date Test');
  funnel.addStep(1, 'Dialed');

  const analytics = new CampaignAnalytics(funnel);
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:01:00Z', type: 'completed' });
  analytics.addEvent({ contactId: 'c2', step: 1, timestamp: '2026-01-03T10:00:00Z', type: 'entered' });
  analytics.addEvent({ contactId: 'c2', step: 1, timestamp: '2026-01-03T10:00:00Z', type: 'completed' });

  const report = analytics.getReport({
    start: '2026-01-01T00:00:00Z',
    end: '2026-01-03T10:00:00Z',
  });

  // Both contacts should be included
  assert(
    report.totalContacts === 2,
    `Should include 2 contacts in range, got ${report.totalContacts}`
  );
}

// ---------------------------------------------------------------------------
// Test 7: 100% conversion when all contacts complete both steps
// ---------------------------------------------------------------------------
console.log('\nTest 7: 100% conversion when all complete');
{
  const funnel = new Funnel('Perfect');
  funnel.addStep(1, 'Dialed');
  funnel.addStep(2, 'Connected');

  const analytics = new CampaignAnalytics(funnel);
  ['c1','c2'].forEach(id => {
    analytics.addEvent({ contactId: id, step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });
    analytics.addEvent({ contactId: id, step: 1, timestamp: '2026-01-01T10:01:00Z', type: 'completed' });
    analytics.addEvent({ contactId: id, step: 2, timestamp: '2026-01-01T10:02:00Z', type: 'entered' });
    analytics.addEvent({ contactId: id, step: 2, timestamp: '2026-01-01T10:03:00Z', type: 'completed' });
  });

  const rate = analytics.getConversionRate(1, 2);
  assert(approxEqual(rate, 1.0), `Should be 1.0, got ${rate.toFixed(3)}`);
}

// ---------------------------------------------------------------------------
// Test 8: Zero events returns empty report
// ---------------------------------------------------------------------------
console.log('\nTest 8: Zero events returns empty report');
{
  const funnel = new Funnel('Empty');
  funnel.addStep(1, 'Dialed');
  funnel.addStep(2, 'Connected');

  const analytics = new CampaignAnalytics(funnel);
  const report = analytics.getReport();

  assert(report.totalContacts === 0, `Should have 0 contacts, got ${report.totalContacts}`);
  assert(report.steps.length === 2, `Should have 2 step entries, got ${report.steps.length}`);
}

// ---------------------------------------------------------------------------
// Test 9: Multi-step funnel report
// ---------------------------------------------------------------------------
console.log('\nTest 9: Multi-step funnel report');
{
  const funnel = new Funnel('Full Pipeline');
  funnel.addStep(3, 'Pitched');
  funnel.addStep(1, 'Dialed');
  funnel.addStep(2, 'Connected');

  const analytics = new CampaignAnalytics(funnel);
  ['c1','c2','c3'].forEach(id => {
    analytics.addEvent({ contactId: id, step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });
    analytics.addEvent({ contactId: id, step: 1, timestamp: '2026-01-01T10:01:00Z', type: 'completed' });
  });
  ['c1','c2'].forEach(id => {
    analytics.addEvent({ contactId: id, step: 2, timestamp: '2026-01-01T10:02:00Z', type: 'entered' });
    analytics.addEvent({ contactId: id, step: 2, timestamp: '2026-01-01T10:03:00Z', type: 'completed' });
  });
  analytics.addEvent({ contactId: 'c1', step: 3, timestamp: '2026-01-01T10:04:00Z', type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 3, timestamp: '2026-01-01T10:05:00Z', type: 'completed' });

  const report = analytics.getReport();

  // Steps in report should be ordered: 1, 2, 3
  const stepNums = report.steps.map(s => s.stepNumber);
  assert(
    JSON.stringify(stepNums) === JSON.stringify([1, 2, 3]),
    `Report steps should be [1,2,3], got [${stepNums}]`
  );
  assert(
    report.totalContacts === 3,
    `Should have 3 total contacts, got ${report.totalContacts}`
  );
}

// ---------------------------------------------------------------------------
// Test 10: Contacts can only be in one state per step
// ---------------------------------------------------------------------------
console.log('\nTest 10: Contacts can only be in one final state per step');
{
  const funnel = new Funnel('State Test');
  funnel.addStep(1, 'Dialed');

  const analytics = new CampaignAnalytics(funnel);
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:00:00Z', type: 'entered' });
  analytics.addEvent({ contactId: 'c1', step: 1, timestamp: '2026-01-01T10:01:00Z', type: 'completed' });

  const journey = analytics.getContactJourney('c1');
  const step1Events = journey.filter(e => e.step === 1);
  assert(step1Events.length === 2, `Should have entered + completed for step 1`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
