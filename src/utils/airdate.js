// Network-aware air date correction
// Apple TV+ releases episodes at midnight PT (Friday), but TMDB often logs Thursday UTC
// Paramount+/Showtime (The Chi) also has Friday releases logged as wrong day

const FRIDAY_NETWORKS = new Set([
  'apple tv+', 'apple tv', 'appletv+',
  'showtime', 'paramount+', 'paramount plus',
])

/**
 * Corrects TMDB air dates for networks known to release on Friday midnight PT
 * but get logged as Thursday in TMDB due to UTC offset.
 * @param {string} airDate - YYYY-MM-DD from TMDB
 * @param {string} networkName - network label
 * @returns {string} corrected YYYY-MM-DD
 */
export function correctAirDate(airDate, networkName) {
  if (!airDate || !networkName) return airDate
  const net = networkName.toLowerCase()
  if (!FRIDAY_NETWORKS.has(net)) return airDate
  // Check if the date falls on a Thursday (day 4)
  const d = new Date(airDate + 'T12:00:00Z')
  if (d.getUTCDay() === 4) { // Thursday UTC → should be Friday
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().split('T')[0]
  }
  return airDate
}
