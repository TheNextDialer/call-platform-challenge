/**
 * Contact deduplication engine.
 * Compares contacts using weighted similarity across name, phone, and email fields.
 */

const {
  stringSimilarity,
  normalizePhone,
  normalizeEmail,
  levenshteinDistance,
} = require('./similarity');

// Similarity weights for each field
const WEIGHTS = {
  name: 0.4,
  phone: 0.3,
  email: 0.3,
};

/**
 * Calculate name similarity between two contacts.
 * Uses Levenshtein-based string similarity on lowercased full names.
 *
 * @param {object} a - First contact
 * @param {object} b - Second contact
 * @returns {number} Similarity score 0..1
 */
function nameSimilarity(a, b) {
  const nameA = (a.name || '').toLowerCase().trim();
  const nameB = (b.name || '').toLowerCase().trim();
  return stringSimilarity(nameA, nameB);
}

/**
 * Calculate phone similarity between two contacts.
 * Uses normalized exact match — returns 1 if phones match, 0 otherwise.
 *
 * @param {object} a - First contact
 * @param {object} b - Second contact
 * @returns {number} 1 if phones match after normalization, 0 otherwise
 */
function phoneSimilarity(a, b) {
  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);

  if (!phoneA || !phoneB) return 0;
  return phoneA === phoneB ? 1 : 0;
}

/**
 * Calculate email similarity between two contacts.
 * Checks domain match first, then applies fuzzy comparison on local part.
 *
 * @param {object} a - First contact
 * @param {object} b - Second contact
 * @returns {number} Similarity score 0..1
 */
function emailSimilarity(a, b) {
  const emailA = normalizeEmail(a.email);
  const emailB = normalizeEmail(b.email);

  if (!emailA || !emailB) return 0;

  const partsA = emailA.split('@');
  const partsB = emailB.split('@');

  if (partsA.length !== 2 || partsB.length !== 2) return 0;

  // Domain must match for any email similarity
  if (partsA[1] !== partsB[1]) return 0;

  // Fuzzy match on local part
  const localSim = stringSimilarity(partsA[0], partsB[0]);

  // Domain match gives a base score, local part similarity adds the rest
  return 0.5 + 0.5 * localSim;
}

/**
 * Compute an overall similarity score between two contacts using weighted fields.
 *
 * @param {object} a - First contact
 * @param {object} b - Second contact
 * @returns {number} Weighted similarity score 0..1
 */
function contactSimilarity(a, b) {
  const nSim = nameSimilarity(a, b);
  const pSim = phoneSimilarity(a, b);
  const eSim = emailSimilarity(a, b);

  return WEIGHTS.name * nSim + WEIGHTS.phone * pSim + WEIGHTS.email * eSim;
}

/**
 * Find duplicate contact pairs from a list of contacts.
 * Compares all pairs and returns those exceeding the similarity threshold.
 *
 * @param {Array<object>} contacts - Array of contact objects
 * @param {number} threshold - Minimum similarity score to consider a duplicate (0..1)
 * @returns {Array<object>} Array of duplicate pair objects with scores
 */
function findDuplicates(contacts, threshold = 0.7) {
  const duplicates = [];

  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const score = contactSimilarity(contacts[i], contacts[j]);

      // BUG: uses > instead of >= so pairs at exact threshold are excluded
      if (score > threshold) {
        duplicates.push({
          contactA: contacts[i],
          contactB: contacts[j],
          score: Math.round(score * 1000) / 1000,
          indexA: i,
          indexB: j,
        });
      }
    }
  }

  // Sort by score descending
  duplicates.sort((a, b) => b.score - a.score);
  return duplicates;
}

/**
 * Merge two contacts, combining their data.
 * When fields conflict, should prefer the newer record (by updatedAt).
 *
 * @param {object} a - First contact
 * @param {object} b - Second contact
 * @returns {object} Merged contact
 */
function mergeContacts(a, b) {
  const dateA = new Date(a.updatedAt || a.createdAt || 0);
  const dateB = new Date(b.updatedAt || b.createdAt || 0);

  // BUG: prefers OLDER record instead of newer
  const primary = dateA < dateB ? a : b;
  const secondary = dateA < dateB ? b : a;

  return {
    id: primary.id || secondary.id,
    name: primary.name || secondary.name,
    email: primary.email || secondary.email,
    phone: primary.phone || secondary.phone,
    company: primary.company || secondary.company,
    updatedAt: primary.updatedAt || secondary.updatedAt,
    createdAt: secondary.createdAt || primary.createdAt,
    mergedFrom: [a.id, b.id].filter(Boolean),
  };
}

/**
 * Deduplicate an array of contacts: find duplicates, merge them,
 * and return a cleaned list.
 *
 * @param {Array<object>} contacts - Raw contact list
 * @param {number} threshold - Similarity threshold
 * @returns {object} { contacts, merges, duplicatesFound }
 */
function deduplicateContacts(contacts, threshold = 0.7) {
  const dupes = findDuplicates(contacts, threshold);
  const merged = new Set();
  const results = [];
  const merges = [];

  for (const dupe of dupes) {
    if (merged.has(dupe.indexA) || merged.has(dupe.indexB)) continue;

    const mergedContact = mergeContacts(dupe.contactA, dupe.contactB);
    results.push(mergedContact);
    merges.push({
      merged: [dupe.indexA, dupe.indexB],
      score: dupe.score,
    });
    merged.add(dupe.indexA);
    merged.add(dupe.indexB);
  }

  // Add contacts that weren't part of any duplicate pair
  for (let i = 0; i < contacts.length; i++) {
    if (!merged.has(i)) {
      results.push(contacts[i]);
    }
  }

  return {
    contacts: results,
    merges,
    duplicatesFound: dupes.length,
  };
}

module.exports = {
  findDuplicates,
  mergeContacts,
  deduplicateContacts,
  contactSimilarity,
  nameSimilarity,
  phoneSimilarity,
  emailSimilarity,
};
