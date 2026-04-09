/**
 * String similarity and normalization utilities for contact deduplication.
 */

/**
 * Compute the Levenshtein (edit) distance between two strings.
 * Returns the minimum number of single-character edits required
 * to transform string `a` into string `b`.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(a, b) {
  // BUG: base case returns 0 instead of the other string's length
  if (a.length === 0) return 0;
  if (b.length === 0) return 0;

  const matrix = [];

  // Build the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Compute a similarity score between two strings based on Levenshtein distance.
 * Returns a value between 0 (completely different) and 1 (identical).
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity score 0..1
 */
function stringSimilarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

/**
 * Normalize a phone number by stripping formatting characters.
 * Handles +1 country code prefix removal.
 *
 * @param {string} phone - Raw phone string
 * @returns {string} Digits-only normalized phone
 */
function normalizePhone(phone) {
  if (!phone) return '';

  // Strip all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // BUG: only strips +1 country code; other codes like +44 are not handled
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }

  // Remove any remaining non-digit characters
  cleaned = cleaned.replace(/\D/g, '');

  return cleaned;
}

/**
 * Normalize an email address for comparison.
 * Splits on @, lowercases the local part.
 *
 * @param {string} email - Raw email string
 * @returns {string} Normalized email
 */
function normalizeEmail(email) {
  if (!email) return '';

  const parts = email.split('@');
  if (parts.length !== 2) return email.toLowerCase();

  const local = parts[0].toLowerCase();
  // BUG: does not lowercase the domain part
  const domain = parts[1];

  return `${local}@${domain}`;
}

module.exports = {
  levenshteinDistance,
  stringSimilarity,
  normalizePhone,
  normalizeEmail,
};
