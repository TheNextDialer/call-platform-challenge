/**
 * SIP Parser Module — Test Suite
 *
 * 9 tests covering parser and validator functionality.
 * Several tests expose known bugs in the implementation.
 */

const { parseSipMessage } = require('../src/parser');
const { validateInvite, matchCallId } = require('../src/validator');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log('  PASS: ' + testName);
    passed++;
  } else {
    console.log('  FAIL: ' + testName);
    failed++;
  }
}

// ── Sample Messages ────────────────────────────────────────────────

const SIMPLE_INVITE =
  'INVITE sip:bob@biloxi.com SIP/2.0\r\n' +
  'Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds\r\n' +
  'To: Bob <sip:bob@biloxi.com>\r\n' +
  'From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n' +
  'Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n' +
  'CSeq: 314159 INVITE\r\n' +
  'Contact: <sip:alice@pc33.atlanta.com>\r\n' +
  'Content-Type: application/sdp\r\n' +
  'Content-Length: 4\r\n' +
  '\r\n' +
  'test';

const INVITE_WITH_PORT =
  'INVITE sip:bob@biloxi.com SIP/2.0\r\n' +
  'Via: SIP/2.0/UDP server10.biloxi.com;branch=z9hG4bKnashds8\r\n' +
  'Contact: <sip:alice@atlanta.com:5060>\r\n' +
  'To: Bob <sip:bob@biloxi.com>\r\n' +
  'From: Alice <sip:alice@atlanta.com>;tag=8675309\r\n' +
  'Call-ID: 3848276298220188511@atlanta.com\r\n' +
  'CSeq: 1 INVITE\r\n' +
  'Content-Type: application/sdp\r\n' +
  'Content-Length: 0\r\n' +
  '\r\n';

const MULTILINE_HEADER_MSG =
  'INVITE sip:bob@biloxi.com SIP/2.0\r\n' +
  'Via: SIP/2.0/UDP\r\n' +
  '  pc33.atlanta.com;branch=z9hG4bK776\r\n' +
  'To: Bob <sip:bob@biloxi.com>\r\n' +
  'From: Alice <sip:alice@atlanta.com>\r\n' +
  'Call-ID: multi-line-test@atlanta.com\r\n' +
  'CSeq: 1 INVITE\r\n' +
  '\r\n';

const INVITE_FOR_CALLID =
  'INVITE sip:bob@biloxi.com SIP/2.0\r\n' +
  'Call-ID: AbCdEf123@atlanta.com\r\n' +
  'CSeq: 1 INVITE\r\n' +
  '\r\n';

const BYE_FOR_CALLID =
  'BYE sip:bob@biloxi.com SIP/2.0\r\n' +
  'Call-ID: abcdef123@atlanta.com\r\n' +
  'CSeq: 2 BYE\r\n' +
  '\r\n';

// ── Tests ──────────────────────────────────────────────────────────

console.log('\nSIP Parser Module Tests');
console.log('=' .repeat(50));

// Test 1: Parse simple INVITE request line
console.log('\n[Request Line Parsing]');
try {
  const result = parseSipMessage(SIMPLE_INVITE);
  assert(result.method === 'INVITE' && result.uri === 'sip:bob@biloxi.com',
    'Parses INVITE request line');
} catch (e) {
  assert(false, 'Parses INVITE request line — threw: ' + e.message);
}

// Test 2: Parse headers correctly
console.log('\n[Header Parsing]');
try {
  const result = parseSipMessage(SIMPLE_INVITE);
  assert(result.headers['Via'] !== undefined && result.headers['To'] !== undefined,
    'Parses basic headers');
} catch (e) {
  assert(false, 'Parses basic headers — threw: ' + e.message);
}

// Test 3: SIP URI with port in Contact header (BUG — colon split truncates)
try {
  const result = parseSipMessage(INVITE_WITH_PORT);
  const contact = result.headers['Contact'] || '';
  assert(contact.includes('5060'),
    'Contact header preserves port number');
} catch (e) {
  assert(false, 'Contact header preserves port — threw: ' + e.message);
}

// Test 4: Multi-line header continuation (BUG — treated as separate headers)
console.log('\n[Multi-line Headers]');
try {
  const result = parseSipMessage(MULTILINE_HEADER_MSG);
  const via = result.headers['Via'] || '';
  assert(via.includes('pc33.atlanta.com'),
    'Multi-line Via header includes continuation');
} catch (e) {
  assert(false, 'Multi-line Via header — threw: ' + e.message);
}

// Test 5: Body extraction
console.log('\n[Body Extraction]');
try {
  const result = parseSipMessage(SIMPLE_INVITE);
  assert(result.body === 'test',
    'Extracts body after blank line');
} catch (e) {
  assert(false, 'Body extraction — threw: ' + e.message);
}

// Test 6: Call-ID matching case-insensitive (BUG — case-sensitive comparison)
console.log('\n[Validator — Call-ID Matching]');
try {
  const invite = parseSipMessage(INVITE_FOR_CALLID);
  const bye = parseSipMessage(BYE_FOR_CALLID);
  const result = matchCallId(invite, bye);
  assert(result.match === true,
    'Call-ID match is case-insensitive');
} catch (e) {
  assert(false, 'Call-ID matching — threw: ' + e.message);
}

// Test 7: Content-Length validation (BUG — string vs number comparison)
console.log('\n[Validator — Content-Length]');
try {
  const result = parseSipMessage(SIMPLE_INVITE);
  const validation = require('../src/validator').validateContentLength(result);
  assert(validation.valid === true,
    'Content-Length matches body length');
} catch (e) {
  assert(false, 'Content-Length validation — threw: ' + e.message);
}

// Test 8: Required header validation for INVITE (BUG — case mismatch)
console.log('\n[Validator — Required Headers]');
try {
  const result = parseSipMessage(SIMPLE_INVITE);
  const validation = validateInvite(result);
  assert(validation.valid === true,
    'Valid INVITE has all required headers');
} catch (e) {
  assert(false, 'Required header validation — threw: ' + e.message);
}

// Test 9: Well-formed INVITE passes basic parsing
console.log('\n[Integration]');
try {
  const result = parseSipMessage(SIMPLE_INVITE);
  assert(
    result.method === 'INVITE' &&
    result.uri !== null &&
    Object.keys(result.headers).length > 0 &&
    result.body.length > 0,
    'Well-formed INVITE parses completely');
} catch (e) {
  assert(false, 'Integration test — threw: ' + e.message);
}

// ── Summary ────────────────────────────────────────────────────────

console.log('\n' + '=' .repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('=' .repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
