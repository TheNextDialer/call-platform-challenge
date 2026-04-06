/**
 * Tokenizer for call transcript text.
 *
 * Should:
 * 1. Split on whitespace
 * 2. Lowercase all tokens
 * 3. Strip leading/trailing punctuation from each token
 * 4. Remove stopwords
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "this", "that", "was", "are",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "can", "shall",
  "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them",
]);

function tokenize(text) {
  const tokens = text.split(/\s+/).filter(t => t.length > 0);

  // Remove stopwords — check against original token
  const filtered = tokens.filter(t => !STOPWORDS.has(t));

  // Lowercase after filtering
  return filtered.map(t => t.toLowerCase());
}

module.exports = { tokenize, STOPWORDS };
