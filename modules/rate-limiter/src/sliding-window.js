/**
 * Sliding Window Rate Limiter
 *
 * Enforces per-account API rate limits using a true sliding window.
 * Should track individual request timestamps and count only those
 * within the trailing window period.
 *
 * Example: 100 requests per 60 seconds means at any point in time,
 * no more than 100 requests in the last 60 seconds.
 */

class SlidingWindowRateLimiter {
  constructor(maxRequests, windowMs, nowFn = () => Date.now()) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.nowFn = nowFn;
    this.windowStart = nowFn();
    this.count = 0;
  }

  /**
   * Check if a request is allowed and record it if so.
   * Returns { allowed: boolean, remaining: number }
   */
  isAllowed() {
    const now = this.nowFn();

    // Reset counter if we've passed the window
    if (now > this.windowStart + this.windowMs) {
      this.windowStart = now;
      this.count = 0;
    }

    if (this.count < this.maxRequests) {
      this.count++;
      return { allowed: true, remaining: this.maxRequests - this.count };
    }

    return { allowed: false, remaining: 0 };
  }

  /**
   * Returns the number of requests remaining in the current window.
   */
  getRemainingRequests() {
    return this.count;
  }

  /**
   * Returns the time in milliseconds until the next request slot opens.
   * Returns 0 if requests are currently available.
   */
  getResetTime() {
    if (this.count < this.maxRequests) return 0;
    return this.windowStart + this.windowMs;
  }
}

module.exports = { SlidingWindowRateLimiter };
