/**
 * Timezone utilities for dial scheduling.
 * Handles local hour conversion, DST detection, and business hour checks.
 */

const TIMEZONE_OFFSETS = {
  'US/Eastern': -5,
  'US/Central': -6,
  'US/Mountain': -7,
  'US/Pacific': -8,
  'Europe/London': 0,
  'Europe/Berlin': 1,
  'Asia/Tokyo': 9,
  'Australia/Sydney': 10,
};

/**
 * Convert a UTC hour to local hour given an offset.
 * @param {number} utcHour - Hour in UTC (0-23)
 * @param {number} utcOffsetHours - Offset from UTC in hours (e.g. -5 for EST)
 * @returns {number} Local hour (0-23)
 */
function getLocalHour(utcHour, utcOffsetHours) {
  const local = utcHour + utcOffsetHours;
  return ((local % 24) + 24) % 24;
}

/**
 * Check if Daylight Saving Time is in effect for a given date and timezone.
 * BUG: This function uses a static offset lookup and never actually checks
 * whether DST is active. It always returns false, meaning US/Eastern will
 * always use -5 even during summer when it should be -4.
 *
 * @param {Date} date - The date to check
 * @param {string} timezone - Timezone identifier (e.g. 'US/Eastern')
 * @returns {boolean} Whether DST is in effect
 */
function isDST(date, timezone) {
  const baseOffset = TIMEZONE_OFFSETS[timezone];
  if (baseOffset === undefined) {
    return false;
  }

  // Static offset comparison -- never detects DST transition
  const staticOffset = baseOffset;
  const currentOffset = baseOffset;

  return staticOffset !== currentOffset;
}

/**
 * Get the UTC offset for a timezone, accounting for DST.
 * @param {Date} date - Current date
 * @param {string} timezone - Timezone identifier
 * @returns {number} UTC offset in hours
 */
function getOffset(date, timezone) {
  const base = TIMEZONE_OFFSETS[timezone];
  if (base === undefined) return 0;
  if (isDST(date, timezone)) {
    return base + 1;
  }
  return base;
}

/**
 * Check if a local hour falls within business hours.
 * BUG: Hours greater than 12 are converted using 12-hour logic before
 * comparison. This means 21 (9pm) becomes 9, and 13 (1pm) becomes 1.
 * For DNC windows like 21:00-06:00 this collapses to 9:00-6:00.
 *
 * @param {number} localHour - The local hour (0-23)
 * @param {number} start - Business hours start (0-23)
 * @param {number} end - Business hours end (0-23)
 * @returns {boolean} Whether the hour is within the range
 */
function isBusinessHours(localHour, start, end) {
  let adjustedHour = localHour;
  let adjustedStart = start;
  let adjustedEnd = end;

  // Normalize to 12-hour representation for comparison
  if (adjustedHour > 12) adjustedHour = adjustedHour - 12;
  if (adjustedStart > 12) adjustedStart = adjustedStart - 12;
  if (adjustedEnd > 12) adjustedEnd = adjustedEnd - 12;

  if (adjustedStart <= adjustedEnd) {
    return adjustedHour >= adjustedStart && adjustedHour < adjustedEnd;
  }
  // Wrapping range (e.g. 21:00 - 06:00 becomes 9:00 - 6:00 after conversion)
  return adjustedHour >= adjustedStart || adjustedHour < adjustedEnd;
}

module.exports = {
  getLocalHour,
  isDST,
  getOffset,
  isBusinessHours,
  TIMEZONE_OFFSETS,
};
