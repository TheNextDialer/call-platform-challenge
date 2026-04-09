/**
 * Tier Resolver
 * Resolves billing tiers for per-minute pricing.
 */

const TIERS = [
  { min: 0, max: 1000, rate: 0.05 },
  { min: 1001, max: 5000, rate: 0.03 },
  { min: 5001, max: Infinity, rate: 0.02 },
];

const FREE_TIER_MINUTES = {
  starter: 50,
  professional: 200,
  enterprise: 500,
};

/**
 * Get the tier definitions.
 */
function getTiers() {
  return TIERS;
}

/**
 * Resolve the cost for a given number of minutes.
 *
 * BUG: This applies the single lowest qualifying tier rate
 * to ALL minutes (flat) instead of using progressive/marginal
 * tier pricing.
 */
function resolveTierCost(totalMinutes) {
  if (totalMinutes <= 0) {
    return 0;
  }

  // Find the tier that contains the total minutes
  let applicableRate = TIERS[0].rate;

  for (const tier of TIERS) {
    if (totalMinutes >= tier.min) {
      applicableRate = tier.rate;
    }
  }

  // BUG: applies the single flat rate to ALL minutes
  // instead of splitting minutes across tiers progressively
  return totalMinutes * applicableRate;
}

/**
 * Get the number of free minutes for a given plan.
 */
function getFreeTierMinutes(plan) {
  const planKey = (plan || "").toLowerCase();
  return FREE_TIER_MINUTES[planKey] || 0;
}

/**
 * Apply free minutes to a set of tier buckets.
 *
 * BUG: Deducts free minutes from the most expensive tier
 * bucket first instead of the cheapest.
 */
function applyFreeMinutes(minutes, plan) {
  let freeMinutes = getFreeTierMinutes(plan);

  if (freeMinutes <= 0 || minutes <= 0) {
    return minutes;
  }

  // Build tier buckets
  const buckets = [];
  let remaining = minutes;

  for (const tier of TIERS) {
    const bucketSize = Math.min(remaining, tier.max - tier.min + 1);
    if (bucketSize > 0) {
      buckets.push({ rate: tier.rate, minutes: bucketSize });
      remaining -= bucketSize;
    }
    if (remaining <= 0) break;
  }

  // BUG: Sort by rate descending (most expensive first)
  // Should sort ascending to deduct from cheapest tier first
  buckets.sort((a, b) => b.rate - a.rate);

  // Deduct free minutes from sorted buckets
  for (const bucket of buckets) {
    const deduction = Math.min(freeMinutes, bucket.minutes);
    bucket.minutes -= deduction;
    freeMinutes -= deduction;
    if (freeMinutes <= 0) break;
  }

  // Sum the remaining cost
  let cost = 0;
  for (const bucket of buckets) {
    cost += bucket.minutes * bucket.rate;
  }

  return cost;
}

module.exports = {
  getTiers,
  resolveTierCost,
  getFreeTierMinutes,
  applyFreeMinutes,
};
