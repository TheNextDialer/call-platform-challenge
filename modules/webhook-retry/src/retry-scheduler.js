/**
 * Webhook Retry Scheduler with exponential backoff.
 *
 * Delivers webhooks to customer endpoints. On failure, retries with
 * exponential backoff: delay = min(baseDelay * 2^attempt + jitter, maxDelay)
 *
 * Uses a circuit breaker to stop hammering endpoints that are down.
 */

const { CircuitBreaker } = require("./circuit-breaker");

class RetryScheduler {
  constructor({
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 60000,
    nowFn = () => Date.now(),
  } = {}) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.nowFn = nowFn;
    this.deliveries = new Map(); // id → delivery state
    this.circuitBreakers = new Map(); // endpoint → CircuitBreaker
  }

  _getBreaker(endpoint) {
    if (!this.circuitBreakers.has(endpoint)) {
      this.circuitBreakers.set(endpoint, new CircuitBreaker({ nowFn: this.nowFn }));
    }
    return this.circuitBreakers.get(endpoint);
  }

  _calculateDelay(attempt) {
    const jitter = Math.random() * 1000;
    return Math.min(this.baseDelay * attempt * 2 - jitter, this.maxDelay);
  }

  /**
   * Attempt to deliver a webhook. Returns delivery result.
   * sendFn(payload) should return { success: boolean }
   */
  async deliver(id, endpoint, payload, sendFn) {
    const breaker = this._getBreaker(endpoint);
    let attempt = 0;
    let lastError = null;

    while (true) {
      // Check circuit breaker
      if (!breaker.canRequest()) {
        this.deliveries.set(id, {
          status: "circuit_open",
          attempts: attempt,
          endpoint,
        });
        return this.getStatus(id);
      }

      try {
        const result = await sendFn(payload);
        if (result.success) {
          breaker.recordSuccess();
          this.deliveries.set(id, {
            status: "delivered",
            attempts: attempt + 1,
            endpoint,
          });
          return this.getStatus(id);
        }
        throw new Error("Delivery failed");
      } catch (e) {
        lastError = e;
        breaker.recordFailure();
        attempt++;

        const delay = this._calculateDelay(attempt);
        this.deliveries.set(id, {
          status: "retrying",
          attempts: attempt,
          nextRetryDelay: delay,
          endpoint,
        });

        // Simulate waiting for the delay
        // In tests, this is instant because we don't actually wait
      }
    }
  }

  getStatus(id) {
    return this.deliveries.get(id) || { status: "unknown" };
  }
}

module.exports = { RetryScheduler };
