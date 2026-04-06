const assert = require("assert");
const { SearchIndex } = require("../src/search-index");

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

console.log("\n  transcript-search tests\n");

test("punctuation stripping: 'pricing.' matches query 'pricing'", () => {
  const idx = new SearchIndex();
  idx.addDocument("call-1", "Let me tell you about our pricing.");
  idx.addDocument("call-2", "The weather looks great today.");
  idx.addDocument("call-3", "Our pricing model is competitive pricing!");

  const results = idx.search("pricing");
  assert.ok(results.length >= 2,
    `Should match at least 2 docs with 'pricing' (with punctuation) but got ${results.length}`);

  const ids = results.map(r => r.id);
  assert.ok(ids.includes("call-1"), "Should match 'call-1' which has 'pricing.'");
  assert.ok(ids.includes("call-3"), "Should match 'call-3' which has 'pricing!'");
});

test("stopwords removed regardless of capitalization", () => {
  const idx = new SearchIndex();
  // "The" and "And" start with capitals — stopword filter must work on lowercased tokens
  idx.addDocument("d1", "The best approach And strategy for sales");
  idx.addDocument("d2", "approach strategy sales methodology");

  const r1 = idx.search("approach");
  // Both docs should match, and the shorter one (d2, fewer tokens) should score
  // equal or higher with normalized TF since both have 1 occurrence of "approach"
  assert.ok(r1.length === 2, `Expected 2 results but got ${r1.length}`);

  // If stopwords aren't removed, d1 has more tokens → lower normalized TF → lower score
  // But if "The" and "And" are NOT removed (bug), d1 has 7 tokens vs d2's 4 tokens
  // With proper stopword removal, d1 has 4 tokens (best, approach, strategy, sales) same as d2

  // The key test: d1 should NOT have "The" or "And" indexed
  const theResults = idx.search("the");
  assert.strictEqual(theResults.length, 0,
    `Searching for 'the' should return 0 results (stopword) but got ${theResults.length}. ` +
    `Capital 'The' might not be filtered if stopwords are checked before lowercasing.`);
});

test("normalized TF: short doc scores higher than long doc with same term count", () => {
  const idx = new SearchIndex();
  // Long doc added FIRST — if scores tie (raw TF bug), stable sort puts this first → test fails
  // Long doc: ~12 tokens, "pricing" 2x → normalized TF = 2/12 ≈ 0.17
  idx.addDocument("long",
    "quarterly revenue report shows strong growth across all regions pricing model updated pricing");
  // Short doc: ~4 tokens after stopwords, "pricing" 2x → normalized TF = 2/4 = 0.5
  idx.addDocument("short", "pricing competitive pricing strategy");
  // Third doc without pricing to ensure IDF > 0
  idx.addDocument("other", "customer satisfaction survey completed successfully");

  const results = idx.search("pricing");
  assert.ok(results.length === 2, `Expected 2 results but got ${results.length}`);
  assert.strictEqual(results[0].id, "short",
    `Short doc should score higher (higher normalized TF) but got '${results[0].id}' first. ` +
    `If tied, TF is probably raw count instead of normalized (count / total tokens).`);
});

test("phrase search: 'next steps' matches consecutive words only", () => {
  const idx = new SearchIndex();
  idx.addDocument("match", "What would the next steps look like for your team?");
  idx.addDocument("no-match", "The next quarter will involve steps to improve retention.");

  const results = idx.search("next steps", { phrase: true });
  const ids = results.map(r => r.id);

  assert.ok(ids.includes("match"),
    "Should match doc where 'next steps' appears as a phrase");
  assert.ok(!ids.includes("no-match"),
    "Should NOT match doc where 'next' and 'steps' are separated");
});

console.log(`\n  ${passed} passing, ${failed} failing\n`);
if (failed > 0) process.exit(1);
