/**
 * Circuit Breaker for webhook endpoints.
 *
 * States:
 * - CLOSED: normal operation, requests pass through
 * - OPEN: endpoint is down, reject immediately
 * - HALF_OPEN: testing if endpoint recovered, allow one probe request
 *
 * Transitions:
 * - CLOSED → OPEN: after `threshold` consecutive failures
 * - OPEN → HALF_OPEN: after `resetTimeout` ms
 * - HALF_OPEN → CLOSED: on success (must reset failure count)
 * - HALF_OPEN → OPEN: on failure
 */

class CircuitBreaker {
  constructor({ threshold = 5, resetTimeout = 30000, nowFn = () => Date.now() } = {}) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.nowFn = nowFn;
    this.state = "CLOSED";
    this.failures = 0;
    this.lastFailureTime = null;
  }

  canRequest() {
    if (this.state === "CLOSED") return true;

    if (this.state === "OPEN") {
      // Check if enough time has passed to try again
      const elapsed = this.nowFn() - this.lastFailureTime;
      if (elapsed >= this.resetTimeout) {
        this.state = "HALF_OPEN";
        return true;
      }
      return false;
    }

    if (this.state === "HALF_OPEN") return true;

    return false;
  }

  recordSuccess() {
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      // Note: failure count carries over for faster re-trip
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = this.nowFn();

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      return;
    }

    if (this.failures >= this.threshold) {
      this.state = "OPEN";
    }
  }

  getState() {
    // Re-check OPEN → HALF_OPEN transition
    if (this.state === "OPEN" && this.lastFailureTime) {
      const elapsed = this.nowFn() - this.lastFailureTime;
      if (elapsed >= this.resetTimeout) {
        this.state = "HALF_OPEN";
      }
    }
    return this.state;
  }
}

module.exports = { CircuitBreaker };
