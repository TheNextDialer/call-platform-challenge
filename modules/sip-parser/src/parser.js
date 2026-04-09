/**
 * SIP Message Parser
 *
 * Parses raw SIP message strings into structured objects.
 * Handles request lines, headers, and message bodies per RFC 3261.
 */

const SIP_VERSION = 'SIP/2.0';

const SIP_METHODS = [
  'INVITE', 'ACK', 'BYE', 'CANCEL', 'REGISTER',
  'OPTIONS', 'PRACK', 'SUBSCRIBE', 'NOTIFY', 'PUBLISH',
  'INFO', 'REFER', 'MESSAGE', 'UPDATE'
];

/**
 * Parse a raw SIP message string into a structured object.
 *
 * @param {string} rawMessage - The raw SIP message text
 * @returns {{ method: string|null, statusCode: number|null, uri: string|null, headers: object, body: string }}
 */
function parseSipMessage(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'string') {
    throw new Error('Invalid input: rawMessage must be a non-empty string');
  }

  const normalized = rawMessage.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split head and body on double newline
  const bodyDelimiter = normalized.indexOf('\n\n');
  let headSection, body;

  if (bodyDelimiter !== -1) {
    headSection = normalized.substring(0, bodyDelimiter);
    body = normalized.substring(bodyDelimiter + 2);
  } else {
    headSection = normalized;
    body = '';
  }

  const headLines = headSection.split('\n');

  if (headLines.length === 0) {
    throw new Error('Empty SIP message');
  }

  // Parse start line (request line or status line)
  const startLine = headLines[0].trim();
  const { method, statusCode, uri } = parseStartLine(startLine);

  // Parse headers from remaining lines
  const headerLines = headLines.slice(1);
  const headers = parseHeaders(headerLines);

  return {
    method,
    statusCode,
    uri,
    headers,
    body
  };
}

/**
 * Parse the SIP start line (first line of the message).
 * Can be a request line or a status line.
 *
 * Request: INVITE sip:user@host SIP/2.0
 * Status:  SIP/2.0 200 OK
 *
 * @param {string} line
 * @returns {{ method: string|null, statusCode: number|null, uri: string|null }}
 */
function parseStartLine(line) {
  if (!line) {
    throw new Error('Empty start line');
  }

  // Check if it's a status line (starts with SIP version)
  if (line.startsWith(SIP_VERSION)) {
    const parts = line.split(' ');
    const statusCode = parseInt(parts[1], 10);
    if (isNaN(statusCode)) {
      throw new Error('Invalid status code in status line');
    }
    return { method: null, statusCode, uri: null };
  }

  // Otherwise it's a request line: METHOD URI SIP/2.0
  const parts = line.split(' ');
  if (parts.length < 3) {
    throw new Error('Malformed request line: ' + line);
  }

  const method = parts[0].toUpperCase();
  const uri = parts[1];
  const version = parts[2];

  if (!SIP_METHODS.includes(method)) {
    throw new Error('Unknown SIP method: ' + method);
  }

  if (version !== SIP_VERSION) {
    throw new Error('Unsupported SIP version: ' + version);
  }

  return { method, statusCode: null, uri };
}

/**
 * Parse header lines into a key-value object.
 *
 * BUG: Splits on first ":" which truncates SIP URIs that contain colons
 *      e.g. Contact: <sip:user@host:5060> becomes Contact: <sip
 *
 * BUG: Multi-line header continuation (RFC 3261 Section 7.3.1) lines
 *      starting with whitespace should be appended to the previous header,
 *      but are instead treated as new headers with empty keys.
 *
 * @param {string[]} lines
 * @returns {object}
 */
function parseHeaders(lines) {
  const headers = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line || line.trim() === '') {
      continue;
    }

    // BUG: This split approach breaks SIP URIs containing colons.
    // The split on ":" with limit 2 would be correct, but here we
    // split without a limit and only take the first two pieces.
    const colonIndex = line.indexOf(':');

    if (colonIndex === -1) {
      // No colon found — this could be a continuation line or malformed
      // BUG: Continuation lines (starting with space/tab) should be
      // appended to the previous header value, not stored separately.
      const trimmed = line.trim();
      if (trimmed) {
        headers[''] = (headers[''] || '') + trimmed;
      }
      continue;
    }

    const key = line.substring(0, colonIndex).trim();
    // BUG: We take everything after the FIRST colon, but then we
    // accidentally truncate by splitting on ":" again for "compact" parsing
    const rawValue = line.substring(colonIndex + 1);

    // "Compact form" normalization — this introduces the truncation bug.
    // Attempting to strip angle brackets from URIs, but the split
    // on ':' inside the value destroys port numbers.
    let value = rawValue.trim();

    // BUG: This regex-based trim inadvertently strips content after colons
    // in URI values like <sip:user@host:5060>
    if (value.includes('<') && value.includes(':')) {
      // Faulty "normalization" — splits value on colon trying to
      // separate display name from URI, but breaks port numbers
      const subParts = value.split(':');
      value = subParts[0].trim();
    }

    headers[key] = value;
  }

  return headers;
}

/**
 * Convenience: extract the Call-ID from a parsed message.
 * @param {object} parsed
 * @returns {string|undefined}
 */
function getCallId(parsed) {
  return parsed.headers['Call-ID'] || parsed.headers['call-id'] || parsed.headers['Call-Id'];
}

/**
 * Convenience: extract Content-Length as a string (as-parsed).
 * @param {object} parsed
 * @returns {string|undefined}
 */
function getContentLength(parsed) {
  return parsed.headers['Content-Length'] || parsed.headers['content-length'];
}

module.exports = {
  parseSipMessage,
  parseStartLine,
  parseHeaders,
  getCallId,
  getContentLength,
  SIP_METHODS,
  SIP_VERSION
};
