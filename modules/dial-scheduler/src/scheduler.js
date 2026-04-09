/**
 * Call scheduling engine.
 * Determines the next valid call window for a lead based on business hours,
 * DNC restrictions, and fatigue limits.
 */

const { getLocalHour, getOffset, isBusinessHours } = require('./timezone');

/**
 * Check if a lead has exceeded the fatigue limit.
 * BUG: Counts attempts within the current calendar day (midnight UTC to
 * midnight UTC) instead of a rolling 24-hour window from now. A lead
 * called 3 times at 11:55pm UTC can be called again at 12:00am UTC.
 *
 * @param {Array} callLog - Array of {timestamp, leadId} entries
 * @param {string} leadId - The lead to check
 * @param {number} maxAttempts - Maximum allowed attempts
 * @returns {boolean} Whether the fatigue limit has been reached
 */
function isFatigued(callLog, leadId, maxAttempts) {
  if (maxAttempts === 0) return false;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const attemptsToday = callLog.filter((entry) => {
    return (
      entry.leadId === leadId &&
      new Date(entry.timestamp) >= startOfDay &&
      new Date(entry.timestamp) <= now
    );
  });

  return attemptsToday.length >= maxAttempts;
}

/**
 * Find the next valid minute within a business-hours window.
 * @param {number} currentHour - Current local hour
 * @param {number} startHour - Window start hour
 * @param {number} endHour - Window end hour
 * @returns {boolean} Whether current hour is within the window
 */
function isInWindow(currentHour, startHour, endHour) {
  return isBusinessHours(currentHour, startHour, endHour);
}

/**
 * Calculate the next available call time for next day.
 * BUG: Uses 9am UTC instead of 9am in the lead's local timezone.
 * For a PST lead (UTC-8), 9am UTC = 1am PST.
 *
 * @param {Date} now - Current time
 * @param {number} startHour - Business hours start
 * @param {string} timezone - Lead's timezone
 * @returns {Date} Next available call time
 */
function getNextDayStart(now, startHour, timezone) {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  // BUG: Sets hour in UTC, not in the lead's timezone
  next.setUTCHours(startHour, 0, 0, 0);
  return next;
}

/**
 * Determine if a call is blocked by DNC (Do Not Call) restrictions.
 * @param {number} localHour - Current local hour for the lead
 * @param {Object} dncRules - DNC rules {start, end} in local 24h time
 * @returns {boolean} Whether the call is blocked by DNC
 */
function isDNCBlocked(localHour, dncRules) {
  if (!dncRules) return false;
  return isBusinessHours(localHour, dncRules.start, dncRules.end);
}

/**
 * Schedule a call for a lead.
 *
 * @param {Object} lead - Lead object with id, timezone, etc.
 * @param {Object} options - Scheduling options
 * @param {number} [options.businessStart=9] - Business hours start (24h)
 * @param {number} [options.businessEnd=17] - Business hours end (24h)
 * @param {Object} [options.dncRules] - DNC restricted hours {start, end}
 * @param {number} [options.fatigueLimit=3] - Max calls per period
 * @param {Array}  [options.callLog=[]] - Previous call log entries
 * @param {Date}   [options.now] - Override current time for testing
 * @returns {Object} Schedule result {canCall, scheduledTime, reason}
 */
function scheduleCall(lead, options = {}) {
  const {
    businessStart = 9,
    businessEnd = 17,
    dncRules = null,
    fatigueLimit = 3,
    callLog = [],
    now = new Date(),
  } = options;

  const timezone = lead.timezone || 'US/Eastern';
  const offset = getOffset(now, timezone);
  const utcHour = now.getUTCHours();
  const localHour = getLocalHour(utcHour, offset);

  // Check fatigue limit
  if (isFatigued(callLog, lead.id, fatigueLimit)) {
    return {
      canCall: false,
      scheduledTime: null,
      reason: 'Fatigue limit reached',
    };
  }

  // Check DNC restrictions
  if (isDNCBlocked(localHour, dncRules)) {
    return {
      canCall: false,
      scheduledTime: getNextDayStart(now, businessStart, timezone),
      reason: 'DNC restricted hours',
    };
  }

  // Check business hours
  // BUG: Uses > instead of >= for start hour check.
  // 9:00 exactly is excluded; only 10:00+ passes when businessStart=9.
  if (localHour > businessStart && localHour < businessEnd) {
    return {
      canCall: true,
      scheduledTime: now,
      reason: 'Within business hours',
    };
  }

  // Outside business hours -- find next window
  const nextStart = getNextDayStart(now, businessStart, timezone);
  return {
    canCall: false,
    scheduledTime: nextStart,
    reason: 'Outside business hours',
  };
}

/**
 * Schedule calls for multiple leads.
 * Each lead is evaluated independently.
 *
 * @param {Array} leads - Array of lead objects
 * @param {Object} options - Scheduling options (shared across leads)
 * @returns {Array} Array of schedule results
 */
function scheduleBatch(leads, options = {}) {
  return leads.map((lead) => ({
    leadId: lead.id,
    ...scheduleCall(lead, options),
  }));
}

/**
 * Get a human-readable summary of a schedule result.
 * @param {Object} result - Schedule result from scheduleCall
 * @returns {string} Summary string
 */
function formatResult(result) {
  if (result.canCall) {
    return `Ready to call now (${result.reason})`;
  }
  if (result.scheduledTime) {
    return `Next window: ${result.scheduledTime.toISOString()} (${result.reason})`;
  }
  return `Blocked: ${result.reason}`;
}

module.exports = {
  scheduleCall,
  scheduleBatch,
  formatResult,
  isFatigued,
  getNextDayStart,
  isDNCBlocked,
};
