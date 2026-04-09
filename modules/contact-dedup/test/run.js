/**
 * Test suite for contact deduplication module.
 * 9 tests covering similarity functions, normalization, and dedup logic.
 */

const {
  levenshteinDistance,
  normalizePhone,
  normalizeEmail,
} = require('../src/similarity');

const {
  findDuplicates,
  mergeContacts,
} = require('../src/deduplicator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

console.log('Running contact-dedup tests...\n');

// --- Levenshtein tests ---

test('Levenshtein: "kitten" vs "sitting" = 3', () => {
  const dist = levenshteinDistance('kitten', 'sitting');
  assert(dist === 3, `expected 3, got ${dist}`);
});

test('Levenshtein: empty string vs "hello" = 5', () => {
  const dist = levenshteinDistance('', 'hello');
  assert(dist === 5, `expected 5, got ${dist}`);
});

// --- Normalization tests ---

test('Phone normalization: +1 and +44 numbers', () => {
  const us = normalizePhone('+1-555-867-5309');
  assert(us === '5558675309', `US: expected 5558675309, got ${us}`);
  const uk = normalizePhone('+44-20-7123-4567');
  assert(uk === '2071234567', `UK: expected 2071234567, got ${uk}`);
});

test('Email normalization: case-insensitive domain', () => {
  const result = normalizeEmail('User@GMAIL.COM');
  assert(result === 'user@gmail.com', `expected user@gmail.com, got ${result}`);
});

// --- Duplicate finding tests ---

test('Finds exact duplicates', () => {
  const contacts = [
    { name: 'John Smith', email: 'john@test.com', phone: '555-1234' },
    { name: 'John Smith', email: 'john@test.com', phone: '555-1234' },
  ];
  const dupes = findDuplicates(contacts, 0.5);
  assert(dupes.length === 1, `expected 1 duplicate, got ${dupes.length}`);
});

test('Finds fuzzy name duplicates above threshold', () => {
  const contacts = [
    { name: 'Jonathan Smith', email: 'jon@test.com', phone: '555-0001' },
    { name: 'Jon Smith', email: 'jon@test.com', phone: '555-0001' },
  ];
  const dupes = findDuplicates(contacts, 0.5);
  assert(dupes.length >= 1, `expected at least 1 duplicate, got ${dupes.length}`);
});

test('Threshold boundary: pair at exactly threshold included', () => {
  const contacts = [
    { name: 'Alice Johnson', email: 'alice@example.com', phone: '555-1111' },
    { name: 'Alice Johnson', email: 'alice@example.com', phone: '555-1111' },
  ];
  // These are identical so score = 1.0; use threshold of exactly 1.0
  const dupes = findDuplicates(contacts, 1.0);
  assert(dupes.length === 1, `expected 1 at exact threshold, got ${dupes.length}`);
});

test('Merge prefers newer record', () => {
  const older = {
    id: '1', name: 'Old Name', email: 'old@test.com',
    phone: '555-0000', updatedAt: '2024-01-01',
  };
  const newer = {
    id: '2', name: 'New Name', email: 'new@test.com',
    phone: '555-9999', updatedAt: '2025-06-15',
  };
  const merged = mergeContacts(older, newer);
  assert(merged.name === 'New Name', `expected "New Name", got "${merged.name}"`);
});

test('No false positives for dissimilar contacts', () => {
  const contacts = [
    { name: 'Alice Johnson', email: 'alice@foo.com', phone: '555-1111' },
    { name: 'Bob Williams', email: 'bob@bar.com', phone: '555-9999' },
  ];
  const dupes = findDuplicates(contacts, 0.7);
  assert(dupes.length === 0, `expected 0 duplicates, got ${dupes.length}`);
});

// --- Summary ---

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
