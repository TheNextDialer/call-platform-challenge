/**
 * Call Metrics Aggregator
 *
 * Computes real-time call center metrics from a stream of call events:
 *
 * - Average Handle Time (AHT): mean of (ended_at - answered_at) for answered calls only
 * - Abandonment Rate: abandoned / (abandoned + answered) as a percentage
 * - Service Level: % of answered calls where (answered_at - started_at) <= targetMs
 *
 * Call event shape:
 * {
 *   id: string,
 *   started_at: number,    // ms timestamp — call starts ringing
 *   answered_at: number|null, // ms timestamp — call answered (null if abandoned/ringing)
 *   ended_at: number|null,    // ms timestamp — call ended (null if still active)
 *   status: "ringing" | "answered" | "abandoned" | "ended"
 * }
 */

const { TimeWindow } = require("./window");

class CallMetricsAggregator {
  constructor({ windowMs = 300000, targetSeconds = 20, nowFn = () => Date.now() } = {}) {
    this.window = new TimeWindow(windowMs, nowFn);
    this.targetSeconds = targetSeconds;
  }

  addEvent(event) {
    this.window.add(event);
  }

  getMetrics() {
    const events = this.window.getEvents();

    // Group by call ID, take the latest event for each call
    const calls = new Map();
    for (const event of events) {
      const existing = calls.get(event.id);
      if (!existing || event._ingestedAt >= existing._ingestedAt) {
        calls.set(event.id, event);
      }
    }

    const allCalls = Array.from(calls.values());
    const answered = allCalls.filter(c => c.status === "ended" && c.answered_at);
    const abandoned = allCalls.filter(c => c.status === "abandoned");
    const ringing = allCalls.filter(c => c.status === "ringing");

    // Average Handle Time: mean of (ended_at - started_at) for answered calls
    let aht = 0;
    if (answered.length > 0) {
      const totalHandle = answered.reduce((sum, c) => sum + (c.ended_at - c.started_at), 0);
      aht = totalHandle / answered.length;
    }

    // Abandonment Rate: abandoned / answered
    const totalOffered = answered.length + ringing.length;
    const abandonmentRate = totalOffered > 0
      ? (abandoned.length / totalOffered) * 100
      : 0;

    // Service Level: % of answered calls answered within target
    let serviceLevel = 0;
    if (answered.length > 0) {
      const metTarget = answered.filter(c =>
        (c.answered_at - c.started_at) <= this.targetSeconds
      ).length;
      serviceLevel = (metTarget / answered.length) * 100;
    }

    return {
      averageHandleTime: Math.round(aht),
      abandonmentRate: Math.round(abandonmentRate * 10) / 10,
      serviceLevel: Math.round(serviceLevel * 10) / 10,
      totalCalls: allCalls.length,
      answeredCalls: answered.length,
      abandonedCalls: abandoned.length,
    };
  }
}

module.exports = { CallMetricsAggregator };
