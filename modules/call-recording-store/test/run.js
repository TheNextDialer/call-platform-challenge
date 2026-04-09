/**
 * Test suite for call-recording-store
 * 9 tests — run with: node test/run.js
 */

const { ChunkBuffer } = require('../src/chunk-buffer');
const { RecordingStore } = require('../src/store');

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

function makeChunk(seq, startMs, endMs, bytes = 128) {
  return {
    sequenceNum: seq,
    data: Buffer.alloc(bytes),
    startMs,
    endMs,
  };
}

// -----------------------------------------------------------------------
console.log('\n--- ChunkBuffer tests ---');

// 1. Adds and retrieves chunks in order
(function test1() {
  const buf = new ChunkBuffer();
  buf.add(makeChunk(1, 0, 100));
  buf.add(makeChunk(2, 100, 200));
  buf.add(makeChunk(3, 200, 300));
  const flushed = buf.flush();
  assert(
    flushed.length === 3 && flushed[0].sequenceNum === 1 && flushed[2].sequenceNum === 3,
    '1. Adds and retrieves chunks in order'
  );
})();

// 2. Sorts chunks numerically (not lexicographically)
(function test2() {
  const buf = new ChunkBuffer();
  buf.add(makeChunk(2, 100, 200));
  buf.add(makeChunk(10, 900, 1000));
  buf.add(makeChunk(1, 0, 100));
  const flushed = buf.flush();
  assert(
    flushed[0].sequenceNum === 1 && flushed[1].sequenceNum === 2 && flushed[2].sequenceNum === 10,
    '2. Sorts chunks numerically not lexicographically'
  );
})();

// 6. Flush threshold based on chunk count
(function test6() {
  const buf = new ChunkBuffer();
  buf.add(makeChunk(1, 0, 100, 8));
  buf.add(makeChunk(2, 100, 200, 8));
  buf.add(makeChunk(3, 200, 300, 8));
  assert(buf.shouldFlush(2) === true, '6. shouldFlush returns true when chunk count exceeds threshold');
  assert(buf.shouldFlush(5) === false, '6b. shouldFlush returns false when under threshold');
})();

// -----------------------------------------------------------------------
console.log('\n--- RecordingStore tests ---');

// 3. Detects gaps between consecutive chunks
(function test3() {
  const store = new RecordingStore();
  store.addChunk('r1', makeChunk(1, 0, 100));
  store.addChunk('r1', makeChunk(2, 200, 300)); // gap 100-200
  const rec = store.getRecording('r1');
  assert(
    rec.gaps.length === 1 && rec.gaps[0].from === 100 && rec.gaps[0].to === 200,
    '3. Detects gap between consecutive chunks'
  );
})();

// 4. Detects gap at end of recording (trailing gap)
(function test4() {
  const store = new RecordingStore();
  store.createRecording('r2', { expectedDurationMs: 500 });
  store.addChunk('r2', makeChunk(1, 0, 100));
  store.addChunk('r2', makeChunk(2, 100, 300));
  const rec = store.getRecording('r2');
  const trailing = rec.gaps.find((g) => g.to === 500);
  assert(
    trailing != null && trailing.from === 300,
    '4. Detects trailing gap (last chunk end vs expected duration)'
  );
})();

// 5. Duration handles overlapping chunks
(function test5() {
  const store = new RecordingStore();
  store.addChunk('r3', makeChunk(1, 0, 200));
  store.addChunk('r3', makeChunk(2, 100, 300)); // overlaps 100-200
  const dur = store.getDuration('r3');
  assert(dur === 300, '5. Duration uses span (max-min) not sum, handles overlap');
})();

// 7. Lock prevents concurrent writes
(function test7() {
  const store = new RecordingStore();
  const first = store.acquireLock('r4');
  const second = store.acquireLock('r4');
  store.releaseLock('r4');
  const third = store.acquireLock('r4');
  assert(
    first === true && second === false && third === true,
    '7. Lock prevents concurrent access'
  );
})();

// 8. Multiple recordings are independent
(function test8() {
  const store = new RecordingStore();
  store.addChunk('a', makeChunk(1, 0, 100));
  store.addChunk('b', makeChunk(1, 0, 200));
  const durA = store.getDuration('a');
  const durB = store.getDuration('b');
  assert(durA === 100 && durB === 200, '8. Multiple recordings are independent');
})();

// 9. Empty recording returns null
(function test9() {
  const store = new RecordingStore();
  const rec = store.getRecording('nonexistent');
  assert(rec === null, '9. Empty/unknown recording returns null');
})();

// -----------------------------------------------------------------------
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed}\n`);
process.exit(failed > 0 ? 1 : 0);
