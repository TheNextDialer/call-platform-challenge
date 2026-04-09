/**
 * Dial-scheduler test suite.
 * 9 tests covering business hours, DST, DNC, fatigue, and edge cases.
 */

const { scheduleCall } = require('../src/scheduler');
const { isDST } = require('../src/timezone');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}`);
    failed++;
  }
}

console.log('Dial-Scheduler Tests\n');

// ── Test 1: Schedules call during business hours ──────────────────────
console.log('1. Schedules call during business hours');
{
  const lead = { id: 'lead-1', timezone: 'US/Eastern' };
  // 2pm UTC = 9am EST... but with the >= bug, let's use 3pm UTC = 10am EST
  const now = new Date('2026-01-15T15:00:00Z');
  const result = scheduleCall(lead, { now });
  assert(result.canCall === true, 'Lead callable during business hours');
}

// ── Test 2: Rejects call outside business hours ───────────────────────
console.log('2. Rejects call outside business hours');
{
  const lead = { id: 'lead-2', timezone: 'US/Eastern' };
  // 2am UTC = 9pm EST, outside 9-17
  const now = new Date('2026-01-15T02:00:00Z');
  const result = scheduleCall(lead, { now });
  assert(result.canCall === false, 'Lead not callable outside business hours');
}

// ── Test 3: DST — US-Eastern summer should use UTC-4 ─────────────────
console.log('3. DST: US-Eastern summer should use UTC-4 not UTC-5');
{
  // July = DST active. 1pm UTC should be 9am EDT (UTC-4), not 8am EST (UTC-5).
  // At 8am local, call should be rejected (before 9am business hours).
  // At 9am local (correct DST), call should be allowed.
  const lead = { id: 'lead-3', timezone: 'US/Eastern' };
  const summerDate = new Date('2026-07-15T13:00:00Z');
  const dstActive = isDST(summerDate, 'US/Eastern');
  // With DST: 13 UTC - 4 = 9am local (business hours start)
  // Without DST (bug): 13 UTC - 5 = 8am local (too early)
  const result = scheduleCall(lead, { now: summerDate });
  // If DST is correct, local hour is 9 and should be callable
  // But isDST always returns false, so local hour is 8 -> not callable
  assert(dstActive === true, 'DST detected for US/Eastern in July');
}

// ── Test 4: DNC hours block evening calls ─────────────────────────────
console.log('4. DNC hours block calls during wide DNC window (9:00-21:00)');
{
  // DNC window 9:00-21:00 should block a call at 3pm local time.
  // BUG: isBusinessHours does 12h conversion: (15->3, 9->9, 21->9).
  // Range 9-9 is empty, so 3pm is NOT detected as blocked.
  const lead = { id: 'lead-4', timezone: 'US/Eastern' };
  // 8pm UTC = 3pm EST. DNC 9:00-21:00 should block 3pm.
  const now = new Date('2026-01-15T20:00:00Z');
  const dncRules = { start: 9, end: 21 };
  const result = scheduleCall(lead, { now, dncRules });
  assert(result.canCall === false && result.reason === 'DNC restricted hours',
    'Afternoon call blocked by wide DNC window (9:00-21:00)');
}

// ── Test 5: Fatigue — blocks after max attempts in rolling 24h ────────
console.log('5. Fatigue: blocks after max attempts in rolling 24h window');
{
  const lead = { id: 'lead-5', timezone: 'US/Eastern' };
  const now = new Date('2026-01-16T15:00:00Z'); // 10am EST, business hours
  // Calls from late yesterday (23:50 UTC) -- within rolling 24h but different calendar day
  const callLog = [
    { leadId: 'lead-5', timestamp: '2026-01-15T23:50:00Z' },
    { leadId: 'lead-5', timestamp: '2026-01-15T23:52:00Z' },
    { leadId: 'lead-5', timestamp: '2026-01-15T23:55:00Z' },
  ];
  const result = scheduleCall(lead, { now, callLog, fatigueLimit: 3 });
  // BUG: Calendar-day check sees 0 calls today (Jan 16), so fatigue not triggered.
  // Rolling 24h window would see 3 calls within last 24h and block.
  assert(result.canCall === false && result.reason === 'Fatigue limit reached',
    'Fatigue blocks calls within rolling 24h window');
}

// ── Test 6: Next-day scheduling uses lead timezone ────────────────────
console.log('6. Next-day scheduling uses lead timezone');
{
  const lead = { id: 'lead-6', timezone: 'US/Pacific' };
  // 2am UTC Jan 16 = 6pm PST Jan 15. Outside business hours.
  const now = new Date('2026-01-16T02:00:00Z');
  const result = scheduleCall(lead, { now });
  // Next day 9am PST = 9am + 8h = 17:00 UTC
  // BUG: getNextDayStart sets 9am UTC directly, giving 1am PST
  const scheduledHour = result.scheduledTime.getUTCHours();
  assert(scheduledHour === 17,
    'Next-day start is 9am in lead timezone (17:00 UTC for PST)');
}

// ── Test 7: Business hours include 9:00 exactly ──────────────────────
console.log('7. Business hours include 9:00 exactly');
{
  const lead = { id: 'lead-7', timezone: 'US/Eastern' };
  // 2pm UTC = 9am EST exactly
  const now = new Date('2026-01-15T14:00:00Z');
  const result = scheduleCall(lead, { now });
  // BUG: scheduler uses > instead of >= for start hour, so 9 is excluded
  assert(result.canCall === true, '9:00 exactly is within business hours');
}

// ── Test 8: Multiple leads scheduled independently ────────────────────
console.log('8. Multiple leads scheduled independently');
{
  const leads = [
    { id: 'lead-8a', timezone: 'US/Eastern' },
    { id: 'lead-8b', timezone: 'US/Pacific' },
  ];
  // 3pm UTC = 10am EST (business hours) and 7am PST (not business hours)
  const now = new Date('2026-01-15T15:00:00Z');
  const results = leads.map((lead) => scheduleCall(lead, { now }));
  assert(
    results[0].canCall === true && results[1].canCall === false,
    'Eastern lead callable, Pacific lead not callable'
  );
}

// ── Test 9: Zero fatigue limit means unlimited ────────────────────────
console.log('9. Zero fatigue limit means unlimited calls');
{
  const lead = { id: 'lead-9', timezone: 'US/Eastern' };
  const now = new Date('2026-01-15T15:00:00Z');
  const callLog = [
    { leadId: 'lead-9', timestamp: '2026-01-15T14:00:00Z' },
    { leadId: 'lead-9', timestamp: '2026-01-15T14:10:00Z' },
    { leadId: 'lead-9', timestamp: '2026-01-15T14:20:00Z' },
    { leadId: 'lead-9', timestamp: '2026-01-15T14:30:00Z' },
    { leadId: 'lead-9', timestamp: '2026-01-15T14:40:00Z' },
  ];
  const result = scheduleCall(lead, { now, callLog, fatigueLimit: 0 });
  assert(result.canCall === true, 'Zero fatigue limit allows unlimited calls');
}

// ── Summary ───────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
