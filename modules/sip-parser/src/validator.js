/**
 * SIP Message Validator
 *
 * Validates parsed SIP messages against RFC 3261 requirements.
 */

const REQUIRED_INVITE_HEADERS = [
  'via',
  'to',
  'from',
  'call-id',
  'cseq',
  'contact',
  'content-type'
];

/**
 * Validate that a parsed INVITE message contains all required headers.
 *
 * BUG: The required header list uses lowercase names, but parsed headers
 *      preserve original case (e.g. "Via", "To", "Call-ID"). The check
 *      iterates parsed.headers keys and compares directly, so
 *      "Via" !== "via" and the header is reported as missing.
 *
 * @param {object} parsed - Parsed SIP message from parseSipMessage()
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateInvite(parsed) {
  const errors = [];

  if (!parsed) {
    return { valid: false, errors: ['No parsed message provided'] };
  }

  if (parsed.method !== 'INVITE') {
    errors.push('Message is not an INVITE request');
  }

  // Check required headers
  // BUG: Direct key lookup is case-sensitive. parsed.headers has keys like
  // "Via", "To", "From", "Call-ID" but REQUIRED_INVITE_HEADERS has lowercase.
  for (const required of REQUIRED_INVITE_HEADERS) {
    if (!parsed.headers[required]) {
      errors.push('Missing required header: ' + required);
    }
  }

  // Validate Content-Length if present
  const contentLengthResult = validateContentLength(parsed);
  if (!contentLengthResult.valid) {
    errors.push(...contentLengthResult.errors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate the Content-Length header matches the actual body length.
 *
 * BUG: The Content-Length header value is a string (e.g. "150") but
 *      body.length is a number (e.g. 150). The comparison uses strict
 *      equality (===) so "150" !== 150, and validation always fails
 *      when Content-Length is present.
 *
 * @param {object} parsed
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateContentLength(parsed) {
  const errors = [];
  const contentLength = parsed.headers['Content-Length'] || parsed.headers['content-length'];

  if (contentLength === undefined) {
    return { valid: true, errors: [] };
  }

  const bodyLength = parsed.body ? parsed.body.length : 0;

  // BUG: contentLength is a string from header parsing, bodyLength is a number.
  // Strict equality comparison means "150" === 150 is false.
  if (contentLength === bodyLength) {
    return { valid: true, errors: [] };
  }

  errors.push('Content-Length mismatch: header=' + contentLength + ', body=' + bodyLength);

  return { valid: false, errors };
}

/**
 * Match Call-ID between two SIP messages (e.g., INVITE and BYE).
 *
 * BUG: Comparison is case-sensitive, but RFC 3261 Section 8.1.1.4
 *      specifies that Call-ID comparison should be case-insensitive.
 *      Messages with Call-IDs like "abc123@host" and "ABC123@host"
 *      should match but won't with this implementation.
 *
 * @param {object} invite - Parsed INVITE message
 * @param {object} bye - Parsed BYE message
 * @returns {{ match: boolean, inviteCallId: string, byeCallId: string }}
 */
function matchCallId(invite, bye) {
  const inviteCallId = findCallId(invite);
  const byeCallId = findCallId(bye);

  if (!inviteCallId || !byeCallId) {
    return {
      match: false,
      inviteCallId: inviteCallId || '',
      byeCallId: byeCallId || ''
    };
  }

  // BUG: Case-sensitive comparison — RFC 3261 says Call-ID should
  // be compared case-insensitively.
  return {
    match: inviteCallId === byeCallId,
    inviteCallId,
    byeCallId
  };
}

/**
 * Find Call-ID in parsed headers. Tries common casings.
 */
function findCallId(parsed) {
  if (!parsed || !parsed.headers) return null;
  return parsed.headers['Call-ID'] || parsed.headers['Call-Id'] || parsed.headers['call-id'] || null;
}

module.exports = {
  validateInvite,
  validateContentLength,
  matchCallId,
  REQUIRED_INVITE_HEADERS
};
