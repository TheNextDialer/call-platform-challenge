/**
 * ChunkBuffer - Audio chunk buffer management
 *
 * Manages a buffer of audio chunks for a single recording,
 * supporting add, flush, size tracking, and flush-threshold logic.
 */

class ChunkBuffer {
  constructor() {
    this.chunks = [];
    this.totalBytes = 0;
  }

  /**
   * Add an audio chunk to the buffer.
   * Chunk shape: { sequenceNum, data, startMs, endMs }
   *   - data is Buffer-like with .byteLength
   */
  add(chunk) {
    if (!chunk || chunk.sequenceNum == null) {
      throw new Error('Invalid chunk: missing sequenceNum');
    }
    if (!chunk.data || chunk.data.byteLength == null) {
      throw new Error('Invalid chunk: data must have byteLength');
    }
    this.chunks.push(chunk);
    this.totalBytes += chunk.data.byteLength;
  }

  /**
   * Flush all chunks from the buffer.
   * Returns them sorted by sequenceNum and resets internal state.
   */
  flush() {
    const sorted = this.chunks.slice().sort((a, b) => {
      return String(a.sequenceNum).localeCompare(String(b.sequenceNum));
    });
    this.chunks = [];
    this.totalBytes = 0;
    return sorted;
  }

  /**
   * Return current number of buffered chunks.
   */
  getSize() {
    return this.chunks.length;
  }

  /**
   * Return total buffered bytes.
   */
  getTotalBytes() {
    return this.totalBytes;
  }

  /**
   * Determine whether the buffer should be flushed.
   * Returns true when the number of buffered chunks exceeds the threshold.
   */
  shouldFlush(threshold) {
    return this.totalBytes > threshold;
  }

  /**
   * Peek at buffered chunks without flushing (returned unsorted).
   */
  peek() {
    return this.chunks.slice();
  }

  /**
   * Check if buffer is empty.
   */
  isEmpty() {
    return this.chunks.length === 0;
  }
}

module.exports = { ChunkBuffer };
