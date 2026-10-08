// src/utils/providers.js — Where to Watch links: network/streamer only, never TMDB.
// Order: show's official page (TMDB homepage on the provider's domain) → provider search
// (only where it works signed-out) → provider homepage. Unknown providers: show homepage or no link.

// Affiliate params: fill in when agreements are signed, e.g. { tag: 'airdatetv-20' } for Amazon Associates.
const AFFILIATE = {
  amazon: {},
  apple:  {},
}

const P = {}
const add = (ids, cfg) => ids.forEach(id => { P[id] = cfg })
add([8, 1796],        { home: 'https://www.netflix.com',        domains: ['netflix.com'] })
add([9, 10, 119, 2100],{ home: 'https://www.amazon.com/primevideo', domains: ['amazon.com', 'primevideo.com'],
                         search: 'https://www.amazon.com/s?k={title}&i=instant-video', aff: 'amazon' })
add([337],            { home: 'https://www.disneyplus.com',     domains: ['disneyplus.com'] })
add([1899, 384, 1825],{ home: 'https://www.hbomax.com',         domains: ['hbomax.com', 'max.com', 'hbo.com'] })
add([15],             { home: 'https://www.hulu.com',           domains: ['hulu.com'] })
add([531, 582, 633],  { home: 'https://www.paramountplus.com',  domains: ['paramountplus.com', 'cbs.com'] })
add([350, 2],         { home: 'https://tv.apple.com',           domains: ['tv.apple.com', 'apple.com'],
                         search: 'https://tv.apple.com/search?term={title}', aff: 'apple' })
add([386, 387],       { home: 'https://www.peacocktv.com',      domains: ['peacocktv.com', 'nbc.com'] })
add([43],             { home: 'https://www.starz.com',          domains: ['starz.com'] })
add([34, 521, 583, 636],{ home: 'https://www.mgmplus.com',      domains: ['mgmplus.com', 'epix.com'] })
add([207, 257],       { home: 'https://www.fubo.tv',            domains: ['fubo.tv'] })
add([73, 509, 67, 2383],{ home: 'https://www.philo.com',        domains: ['philo.com'] })
add([58, 613],        { home: 'https://tubitv.com',             domains: ['tubitv.com'] })
add([237, 422],       { home: 'https://www.betplus.com',        domains: ['betplus.com', 'bet.com'] })
add([444, 538],       { home: 'https://watch.plex.tv',          domains: ['plex.tv'] })
add([191, 526],       { home: 'https://www.amcplus.com',        domains: ['amcplus.com', 'amc.com'] })
add([11],             { home: 'https://mubi.com',               domains: ['mubi.com'] })
add([486, 551],       { home: 'https://watch.spectrum.net',     domains: ['spectrum.net'] })
add([99],             { home: 'https://www.shudder.com',        domains: ['shudder.com'] })
add([123],            { home: 'https://www.sundancenow.com',    domains: ['sundancenow.com'] })
add([584, 520],       { home: 'https://www.discoveryplus.com',  domains: ['discoveryplus.com'] })
add([149],            { home: 'https://plus.espn.com',          domains: ['espn.com'] })
add([192],            { home: 'https://www.youtube.com',        domains: ['youtube.com'],
                         search: 'https://www.youtube.com/results?search_query={title}' })

// "Reasonable Doubt Season 4" → "Reasonable Doubt"
export const cleanTitle = (t) => String(t || '').replace(/\s+season\s+\d+\s*$/i, '').trim()

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const withAff = (url, key) => {
  const params = AFFILIATE[key] || {}
  if (!Object.keys(params).length) return url
  const u = new URL(url); Object.entries(params).forEach(([k, v]) => v && u.searchParams.set(k, v)); return u.toString()
}

// Returns a URL, or '' when there's no non-TMDB destination (render the logo without a link)
export function getProviderUrl(provider, showTitle, showHomepage) {
  const cfg = P[provider?.provider_id]
  const hp = showHomepage && !host(showHomepage).includes('themoviedb') ? showHomepage : ''
  if (!cfg) return hp
  if (hp && cfg.domains.some(d => host(hp).endsWith(d))) return withAff(hp, cfg.aff)
  if (cfg.search) return withAff(cfg.search.replace('{title}', encodeURIComponent(cleanTitle(showTitle))), cfg.aff)
  return cfg.home
}

export const justWatchUrl = (showTitle) =>
  `https://www.justwatch.com/us/search?q=${encodeURIComponent(cleanTitle(showTitle))}`
