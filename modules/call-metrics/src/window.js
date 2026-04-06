/**
 * Time Window Manager
 *
 * Manages a sliding time window of events.
 * Events older than windowMs are evicted on each access.
 */

class TimeWindow {
  constructor(windowMs, nowFn = () => Date.now()) {
    this.windowMs = windowMs;
    this.nowFn = nowFn;
    this.events = [];
  }

  add(event) {
    this.events.push({ ...event, _ingestedAt: this.nowFn() });
  }

  getEvents() {
    const cutoff = this.nowFn() - this.windowMs;
    this.events = this.events.filter(e => e._ingestedAt >= cutoff);
    return this.events;
  }

  clear() {
    this.events = [];
  }
}

module.exports = { TimeWindow };
