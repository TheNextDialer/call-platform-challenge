/**
 * Geographic utilities for call routing.
 */

// Mean radius of the Earth in kilometers
const EARTH_RADIUS_KM = 6371;


/**
 * Convert degrees to radians.
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the Haversine distance between two points.
 * Returns distance in kilometers.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Find the nearest point from a list of candidates.
 * Returns { index, distance } or null if candidates is empty.
 */
function findNearest(originLat, originLng, candidates) {
  if (candidates.length === 0) return null;

  let bestIdx = 0;
  let bestDist = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const dist = haversineDistance(
      originLat,
      originLng,
      candidates[i].lat,
      candidates[i].lng
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return { index: bestIdx, distance: bestDist };
}

module.exports = { haversineDistance, findNearest, toRadians };
