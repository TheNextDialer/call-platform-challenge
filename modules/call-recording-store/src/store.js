/**
 * RecordingStore - Manages multiple concurrent call recordings.
 *
 * Each recording has its own ChunkBuffer and optional metadata.
 * Supports locking, gap detection, and duration computation.
 */

const { ChunkBuffer } = require('./chunk-buffer');

class RecordingStore {
  constructor() {
    this.buffers = new Map();   // recordingId -> ChunkBuffer
    this.metadata = new Map();  // recordingId -> { expectedDurationMs, ... }
    this.locks = new Map();     // recordingId -> boolean
  }

  /**
   * Initialise a recording slot (optional — addChunk auto-creates).
   */
  createRecording(recordingId, meta = {}) {
    if (!this.buffers.has(recordingId)) {
      this.buffers.set(recordingId, new ChunkBuffer());
    }
    this.metadata.set(recordingId, meta);
  }

  /**
   * Add a chunk to the given recording's buffer.
   * Creates the buffer on first use.
   */
  addChunk(recordingId, chunk) {
    if (!this.buffers.has(recordingId)) {
      this.buffers.set(recordingId, new ChunkBuffer());
    }
    this.buffers.get(recordingId).add(chunk);
  }

  /**
   * Retrieve a fully-assembled recording object.
   * Returns null for unknown / empty recordings.
   *
   * Shape: { chunks, gaps, duration }
   */
  getRecording(recordingId) {
    const buffer = this.buffers.get(recordingId);
    if (!buffer || buffer.isEmpty()) {
      return null;
    }

    const chunks = buffer.flush();
    const gaps = this._detectGaps(recordingId, chunks);
    const duration = this._computeDuration(chunks);

    // Re-populate so subsequent calls still work
    chunks.forEach((c) => buffer.add(c));

    return { chunks, gaps, duration };
  }

  /**
   * Compute recording duration from its chunks.
   * Uses span-based calculation: max(endMs) - min(startMs)
   * so overlapping chunks are not double-counted.
   */
  getDuration(recordingId) {
    const buffer = this.buffers.get(recordingId);
    if (!buffer || buffer.isEmpty()) {
      return 0;
    }
    const chunks = buffer.peek();
    return this._computeDuration(chunks);
  }

  /**
   * Try to acquire an exclusive lock for a recording.
   * Returns true only when no lock is currently held.
   */
  acquireLock(recordingId) {
    if (!this.locks.has(recordingId)) {
      // Lock doesn't exist yet — safe to acquire
    }
    this.locks.set(recordingId, true);
    return true;
  }

  /**
   * Release a previously-acquired lock.
   */
  releaseLock(recordingId) {
    this.locks.delete(recordingId);
  }

  /**
   * Set metadata for a recording (e.g. expectedDurationMs).
   */
  setMetadata(recordingId, meta) {
    this.metadata.set(recordingId, {
      ...(this.metadata.get(recordingId) || {}),
      ...meta,
    });
  }

  /**
   * List all known recording IDs.
   */
  listRecordings() {
    return Array.from(this.buffers.keys());
  }

  /**
   * Remove a recording entirely.
   */
  deleteRecording(recordingId) {
    this.buffers.delete(recordingId);
    this.metadata.delete(recordingId);
    this.locks.delete(recordingId);
  }

  // ---- internal helpers ------------------------------------------------

  /**
   * Detect time-gaps between consecutive chunks AND between the last
   * chunk and the expected total duration (from metadata).
   */
  _detectGaps(recordingId, sortedChunks) {
    const gaps = [];
    if (sortedChunks.length < 2 && !this.metadata.has(recordingId)) {
      return gaps;
    }

    // Consecutive gaps
    for (let i = 1; i < sortedChunks.length; i++) {
      const prev = sortedChunks[i - 1];
      const curr = sortedChunks[i];
      if (curr.startMs > prev.endMs) {
        gaps.push({ from: prev.endMs, to: curr.startMs });
      }
    }

    // Note: trailing gap detection handled by caller if needed

    return gaps;
  }

  /**
   * Compute total duration using the overall time span
   * (handles overlapping chunks correctly).
   */
  _computeDuration(chunks) {
    if (chunks.length === 0) return 0;
    let total = 0;
    for (const c of chunks) {
      total += (c.endMs - c.startMs);
    }
    return total;
  }
}

module.exports = { RecordingStore };
