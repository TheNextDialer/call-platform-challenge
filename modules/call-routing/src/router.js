/**
 * Geographic round-robin call router.
 *
 * Routes incoming calls to the nearest available agent,
 * using round-robin to break distance ties and distribute load.
 */

const { haversineDistance } = require("./geo-utils");

class CallRouter {
  constructor() {
    this.agents = [];
    this.roundRobinCounter = 0;
    this.callCounts = new Map(); // agentId → number of recent calls
  }

  /**
   * Register available agents with their locations and capacity.
   */
  setAgentPool(agents) {
    // agents: [{ id, lat, lng, capacity }]
    this.agents = agents.map((a) => ({ ...a }));
    // BUG: roundRobinCounter not reset when pool changes
    // this.roundRobinCounter = 0;
  }

  /**
   * Route a call from the given origin to the best available agent.
   * Returns the agent object or null if no agents available.
   */
  routeCall(callLat, callLng) {
    // BUG: throws on empty pool instead of returning null
    if (this.agents.length === 0) {
      throw new Error("No agents available");
    }

    // Find agents with remaining capacity
    const available = this.agents.filter((agent) => {
      const count = this.callCounts.get(agent.id) || 0;
      // BUG: > instead of >= (allows one over capacity)
      return count > agent.capacity ? false : true;
    });

    if (available.length === 0) return null;

    // Score each agent: distance + round-robin tiebreaker
    const scored = available.map((agent, idx) => {
      const distance = haversineDistance(
        callLat,
        callLng,
        agent.lat,
        agent.lng
      );
      const callCount = this.callCounts.get(agent.id) || 0;
      return { agent, distance, callCount, poolIdx: idx };
    });

    // Sort by distance (ascending), then by call count for tiebreaking
    // BUG: tiebreaker sorts descending (more calls = preferred) instead of ascending
    scored.sort((a, b) => {
      const distDiff = a.distance - b.distance;
      if (Math.abs(distDiff) > 1) return distDiff;
      return b.callCount - a.callCount; // Should be a - b (prefer fewer calls)
    });

    const winner = scored[0].agent;
    this.callCounts.set(winner.id, (this.callCounts.get(winner.id) || 0) + 1);
    this.roundRobinCounter++;

    return { ...winner, distance: scored[0].distance };
  }

  /**
   * Remove an agent from the pool (e.g., agent went offline).
   * Returns true if agent was found and removed.
   */
  removeAgent(agentId) {
    const idx = this.agents.findIndex((a) => a.id === agentId);
    if (idx === -1) return false;
    this.agents.splice(idx, 1);
    // BUG: doesn't clean up call counts for removed agent
    // this.callCounts.delete(agentId);
    return true;
  }

  /**
   * Get current call counts per agent.
   */
  getCallCounts() {
    const counts = {};
    for (const agent of this.agents) {
      counts[agent.id] = this.callCounts.get(agent.id) || 0;
    }
    return counts;
  }

  /**
   * Get total routed calls across all agents.
   */
  getTotalRouted() {
    let total = 0;
    // BUG: iterates this.agents but callCounts may have entries for removed agents
    for (const [, count] of this.callCounts) {
      total += count;
    }
    return total;
  }

  /**
   * Reset call counts (e.g., at start of new period).
   */
  resetCounts() {
    this.callCounts.clear();
    this.roundRobinCounter = 0;
  }
}

module.exports = { CallRouter };
