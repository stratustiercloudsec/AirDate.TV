// Network-aware air date correction
// TMDB consistently logs Apple TV+/Showtime/Paramount+ release dates ONE DAY EARLY,
// regardless of weekday. Verified cases:
//   Lucky S1        TMDB 2026-07-14 (Tue) -> actual 2026-07-15 (Wed), per tv.apple.com
//   Ted Lasso S4E1   TMDB 2026-08-04 (Tue) -> actual 2026-08-05 (Wed), per tv.apple.com
// A prior "Thursday UTC -> Friday" heuristic only fired on Thursday dates and silently
// let Tuesday-logged dates like these through. Root cause is upstream at TMDB (likely a
// PT-midnight timestamp getting attributed to the wrong UTC calendar day), and the fix
// must NOT be conditioned on weekday — apply flat +1 day to any date from these networks.

const OFFSET_NETWORKS = new Set([
  'apple tv+', 'apple tv', 'appletv+',
  ])

/**
 * Corrects TMDB air dates for networks known to log dates one calendar day early.
 * @param {string} airDate - YYYY-MM-DD from TMDB
 * @param {string} networkName - network label
 * @returns {string} corrected YYYY-MM-DD
 */
export function correctAirDate(airDate, networkName) {
  if (!airDate || !networkName) return airDate
  const net = networkName.toLowerCase()
  if (!OFFSET_NETWORKS.has(net)) return airDate
  const d = new Date(airDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}
