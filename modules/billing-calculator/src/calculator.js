/**
 * Per-minute Billing Calculator
 * Calculates bills for calls based on tier pricing.
 */

const { resolveTierCost, applyFreeMinutes } = require("./tier-resolver");

const MINIMUM_CHARGE_PER_CALL = 0.01;

/**
 * Round duration to billable minutes.
 *
 * BUG: Uses Math.round instead of Math.ceil.
 * Partial minutes should always round UP since any
 * fraction of a minute is billed as a full minute.
 */
function toBillableMinutes(durationSeconds) {
  if (durationSeconds <= 0) {
    return 0;
  }
  const rawMinutes = durationSeconds / 60;
  // BUG: should be Math.ceil
  return Math.round(rawMinutes);
}

/**
 * Calculate the charge for a single call.
 * Returns the charge amount in the base currency (USD).
 */
function calculateCallCharge(call, ratePerMinute) {
  const billableMinutes = toBillableMinutes(call.durationSeconds);

  if (billableMinutes <= 0) {
    return 0;
  }

  let charge = billableMinutes * ratePerMinute;

  // BUG: Minimum charge applied BEFORE currency conversion.
  // Should be applied AFTER conversion to ensure the minimum
  // is in the target currency.
  if (charge < MINIMUM_CHARGE_PER_CALL) {
    charge = MINIMUM_CHARGE_PER_CALL;
  }

  return charge;
}

/**
 * Calculate the total bill for an array of calls.
 *
 * Each call object: { id, durationSeconds, metadata }
 * Plan is optional: "starter", "professional", "enterprise"
 */
function calculateBill(calls, plan) {
  if (!calls || calls.length === 0) {
    return {
      totalMinutes: 0,
      totalCharge: 0,
      callCount: 0,
      currency: "USD",
      breakdown: [],
    };
  }

  // Sum total minutes across all calls
  let totalMinutes = 0;
  const callDetails = [];

  for (const call of calls) {
    const minutes = toBillableMinutes(call.durationSeconds);
    totalMinutes += minutes;
    callDetails.push({
      id: call.id,
      durationSeconds: call.durationSeconds,
      billableMinutes: minutes,
    });
  }

  // Get the tier cost for the total minutes
  let totalCharge;
  if (plan) {
    totalCharge = applyFreeMinutes(totalMinutes, plan);
  } else {
    totalCharge = resolveTierCost(totalMinutes);
  }

  // Calculate per-call breakdown using effective rate
  const effectiveRate = totalMinutes > 0 ? totalCharge / totalMinutes : 0;
  const breakdown = [];

  let runningTotal = 0;
  for (const detail of callDetails) {
    const callCharge = calculateCallCharge(
      { durationSeconds: detail.durationSeconds },
      effectiveRate
    );
    breakdown.push({
      id: detail.id,
      billableMinutes: detail.billableMinutes,
      charge: callCharge,
    });
    runningTotal += callCharge;
  }

  return {
    totalMinutes,
    totalCharge: runningTotal,
    callCount: calls.length,
    currency: "USD",
    breakdown,
  };
}

/**
 * Convert an amount from one currency to another.
 *
 * Rates object format: { "USD_JPY": 150, "USD_EUR": 0.92 }
 * Meaning 1 USD = 150 JPY, 1 USD = 0.92 EUR, etc.
 *
 * BUG: Always multiplies by the rate. When converting FROM a
 * non-USD currency TO USD, should divide instead.
 * e.g., JPY to USD should divide by 150, not multiply.
 */
function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Try direct key: FROM_TO
  const directKey = fromCurrency + "_" + toCurrency;
  if (rates[directKey] !== undefined) {
    return amount * rates[directKey];
  }

  // Try inverse key: TO_FROM
  const inverseKey = toCurrency + "_" + fromCurrency;
  if (rates[inverseKey] !== undefined) {
    // BUG: should divide when using the inverse key
    // e.g., if key is USD_JPY = 150, converting JPY->USD
    // should be amount / 150, not amount * 150
    return amount * rates[inverseKey];
  }

  throw new Error(
    "No exchange rate found for " + fromCurrency + " to " + toCurrency
  );
}

/**
 * Calculate bill and convert to a target currency.
 */
function calculateBillInCurrency(calls, plan, targetCurrency, rates) {
  const bill = calculateBill(calls, plan);

  if (targetCurrency === "USD") {
    return bill;
  }

  const convertedTotal = convertCurrency(
    bill.totalCharge,
    "USD",
    targetCurrency,
    rates
  );

  const convertedBreakdown = bill.breakdown.map((item) => ({
    ...item,
    charge: convertCurrency(item.charge, "USD", targetCurrency, rates),
  }));

  return {
    ...bill,
    totalCharge: convertedTotal,
    currency: targetCurrency,
    breakdown: convertedBreakdown,
  };
}

module.exports = {
  toBillableMinutes,
  calculateCallCharge,
  calculateBill,
  convertCurrency,
  calculateBillInCurrency,
  MINIMUM_CHARGE_PER_CALL,
};
