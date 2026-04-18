// test/run.js — Voicemail drop module tests

const { detectBeep, buildPlaybackBuffer, BYTES_PER_MS } = require("../src/audio-timing");
const { VoicemailDropper } = require("../src/dropper");

let passed = 0;
let failed = 0;

function assert(condition, testName, expected, actual) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  FAIL: ${testName}`);
    console.log(`    Expected ${expected} got ${actual}`);
    failed++;
  }
}

async function runTests() {
  console.log("Voicemail Drop Module Tests\n");

  // -------------------------------------------------------
  // Test 1: Detects standard VM beep tone
  // Signal: 1000 Hz, -15 dB — both values exceed -30,
  // so the buggy comparison still returns true.
  // -------------------------------------------------------
  const beepSignal = { frequency: 1000, amplitude: -15 };
  const isBeep = detectBeep(beepSignal);
  assert(isBeep === true, "Detects standard VM beep tone", true, isBeep);

  // -------------------------------------------------------
  // Test 2: Rejects non-beep signal with wrong frequency
  // Signal: 400 Hz, -15 dB — frequency is 400, which is
  // still > -30 in the buggy code, so it incorrectly passes.
  // -------------------------------------------------------
  const nonBeepSignal = { frequency: 400, amplitude: -15 };
  const isNotBeep = detectBeep(nonBeepSignal);
  assert(isNotBeep === false, "Rejects non-beep signal with wrong frequency", false, isNotBeep);

  // -------------------------------------------------------
  // Test 3: Playback buffer has correct order
  // Expected: [leadSilence][message][trailSilence]
  // Bug produces: [leadSilence][trailSilence][message]
  // -------------------------------------------------------
  const message = Buffer.from("HELLO");
  const buffer = buildPlaybackBuffer(message, { leadSilenceMs: 100, trailSilenceMs: 50 });
  const leadBytes = 100 * BYTES_PER_MS;
  const trailBytes = 50 * BYTES_PER_MS;

  // The message should start right after lead silence
  const messageStart = buffer.indexOf("HELLO");
  const expectedMessageStart = leadBytes;
  assert(
    messageStart === expectedMessageStart,
    "Playback buffer has correct order: silence, message, silence",
    expectedMessageStart,
    messageStart
  );

  // -------------------------------------------------------
  // Test 4: Message fits within VM system max recording time
  // A 30-second message (30 * 8000 bytes) on a system with
  // 60-second max should be accepted. Bug checks byte length
  // against a small threshold instead of vmSystemMaxSeconds.
  // -------------------------------------------------------
  const thirtySecMsg = Buffer.alloc(30 * BYTES_PER_MS * 1000, 0xAA); // 30 seconds of audio
  const dropperForLimit = new VoicemailDropper({ maxRetries: 0 });
  const limitResult = await dropperForLimit.drop("call-limit-test", thirtySecMsg, {
    vmSystemMaxSeconds: 60,
  });
  assert(
    limitResult.status !== "rejected",
    "Message fits within VM system max recording time",
    "not rejected",
    limitResult.status
  );

  // -------------------------------------------------------
  // Test 5: Status is pending until confirmation
  // Bug sets status to "delivered" before confirmation.
  // -------------------------------------------------------
  const dropperStatus = new VoicemailDropper({ maxRetries: 0 });
  let statusDuringSend = null;

  // Monkey-patch to capture status mid-flight
  const origDrop = dropperStatus.drop.bind(dropperStatus);
  const origSet = dropperStatus.drops.set.bind(dropperStatus.drops);
  let firstSet = true;
  dropperStatus.drops.set = function (key, value) {
    if (firstSet) {
      statusDuringSend = value.status;
      firstSet = false;
    }
    return origSet(key, value);
  };

  const smallMsg = Buffer.alloc(10, 0xBB);
  await dropperStatus.drop("call-status-test", smallMsg, {});
  assert(
    statusDuringSend === "pending",
    "Status is pending until confirmation",
    "pending",
    statusDuringSend
  );

  // -------------------------------------------------------
  // Test 6: Successful drop returns delivered after confirmation
  // -------------------------------------------------------
  const dropperSuccess = new VoicemailDropper({ maxRetries: 0 });
  const successMsg = Buffer.alloc(10, 0xCC);
  const successResult = await dropperSuccess.drop("call-success", successMsg, {});
  assert(
    successResult.status === "delivered",
    "Successful drop returns delivered after confirmation",
    "delivered",
    successResult.status
  );

  // -------------------------------------------------------
  // Summary
  // -------------------------------------------------------
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
