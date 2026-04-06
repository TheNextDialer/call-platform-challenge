/**
 * TF-IDF Search Index for call transcripts.
 *
 * Supports:
 * - Indexing documents with addDocument(id, text)
 * - Searching with search(query, options)
 * - Phrase search with search(query, { phrase: true })
 *
 * TF = termCount / totalTokensInDoc  (normalized)
 * IDF = log(1 + totalDocs / (1 + docsContainingTerm))
 * Score = sum of TF * IDF for each query term
 */

const { tokenize } = require("./tokenizer");

class SearchIndex {
  constructor() {
    this.documents = new Map();  // id → { tokens: string[], text: string }
    this.invertedIndex = new Map();  // term → Set of doc ids
  }

  addDocument(id, text) {
    const tokens = tokenize(text);
    this.documents.set(id, { tokens, text });

    for (const token of tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token).add(id);
    }
  }

  search(query, options = {}) {
    const queryTokens = tokenize(query);

    if (queryTokens.length === 0) return [];

    const scores = new Map();

    for (const term of queryTokens) {
      const docsWithTerm = this.invertedIndex.get(term);
      if (!docsWithTerm) continue;

      const idf = Math.log(this.documents.size / docsWithTerm.size);

      for (const docId of docsWithTerm) {
        const doc = this.documents.get(docId);
        const termCount = doc.tokens.filter(t => t === term).length;
        const tf = termCount;  // raw count

        const score = tf * idf;
        scores.set(docId, (scores.get(docId) || 0) + score);
      }
    }

    // TODO: implement phrase matching
    // For now, phrase search falls through to regular token search

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({ id, score }));
  }
}

module.exports = { SearchIndex };
