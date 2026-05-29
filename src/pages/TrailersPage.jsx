// src/pages/TrailersPage.jsx
// Upcoming TV Trailers — embedded YouTube players, grouped by month
// Only SEASON PREMIERES are shown — not mid-run episodes
//
// FILTERING STRATEGY (in priority order per show):
//   1. next_episode_to_air.episode_number === 1 AND air_date in this month → season premiere starting this month
//   2. last_episode_to_air.episode_number === 1 AND air_date in this month → just started this month
//   3. first_air_date in this month AND status is upcoming/in-production → brand new unaired show
//   4. first_air_date in this month (fallback for any new show) → include
//   5. Anything else (mid-run weekly episode) → EXCLUDE
//
// TRAILER STRATEGY:
//   Pass season_number to get-trailer so it fetches current season trailer, not S1
//
// COVERAGE STRATEGY:
//   - Fetch pages 1+2 for high-value Apple TV+, Max, Disney+, Hulu networks
//   - Fetch page 1 only for others
//   - Cap 3 per network (up from 2) to allow more high-value shows through

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'
import { API_BASE, SCOOP_MANIFEST_URL } from '@/config/aws'
import { tmdbDiscover, tmdbOnTheAir, tmdbShow } from '../utils/tmdb'
import { Footer }       from '@/components/layout/Footer'

const IMAGE_BASE = 'https://image.tmdb.org'

const AFFILIATE_NETWORK_IDS = [
  2552,  // Apple TV+
  3186,  // Max / HBO Max
  2739,  // Disney+
  453,   // Hulu
  4330,  // Paramount+
  3353,  // Peacock
  318,   // STARZ
  213,   // Netflix
  1024,  // Prime Video
  2503,  // Tubi
]

// Networks where we fetch page 1 AND page 2 to get deeper coverage
const DEEP_FETCH_NETWORK_IDS = new Set([2552, 3186, 2739, 453, 213, 1024])

const NETWORK_META = {
  'Apple TV+':    { color: '#a3a3a3', bg: '#a3a3a320' },
  'Max':          { color: '#00b4d8', bg: '#00b4d820' },
  'HBO Max':      { color: '#00b4d8', bg: '#00b4d820' },
  'Disney+':      { color: '#113ccf', bg: '#113ccf20' },
  'Hulu':         { color: '#1ce783', bg: '#1ce78320' },
  'Paramount+':   { color: '#0064ff', bg: '#0064ff20' },
  'Peacock':      { color: '#f5a623', bg: '#f5a62320' },
  'Starz':        { color: '#000000', bg: '#ffffff15' },
  'Netflix':      { color: '#e50914', bg: '#e5091420' },
  'Prime Video':  { color: '#00a8e1', bg: '#00a8e120' },
  'Tubi TV':      { color: '#fa4f00', bg: '#fa4f0020' },
}

const CAT_COLORS = {
  premieres: '#22d3ee', renewals: '#4ade80',
  cancellations: '#f87171', casting: '#c084fc', production: '#fb923c',
}

// Statuses that indicate a show hasn't started airing yet
const UPCOMING_STATUSES = new Set([
  'Planned', 'In Production', 'Post Production', 'Pilot', 'In Development'
])

// ─── Month helpers ────────────────────────────────────────────────────────────
function getMonthRange(offset = 0) {
  const now   = new Date()
  const d     = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const year  = d.getFullYear()
  const month = d.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()
  return {
    year,
    month,
    gte:   `${year}-${String(month).padStart(2,'0')}-01`,
    lte:   `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`,
    label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
    key:   `${year}-${month}`,
    isCurrentMonth: offset === 0,
  }
}

// Returns true if YYYY-MM-DD falls in the given year+month (1-indexed)
function dateInMonth(dateStr, year, month) {
  if (!dateStr) return false
  try {
    const [y, m] = dateStr.split('-').map(Number)
    return y === year && m === month
  } catch { return false }
}

// ─── Season premiere resolver ─────────────────────────────────────────────────
// Returns { passes: bool, air_date_for_month: string|null, season_number: int }
// Only passes if a SEASON PREMIERE (ep 1) is dated in the target month,
// OR it's a brand-new unaired show with first_air_date in this month.
function resolveSeasonPremiere(detail, s, year, month) {
  const NO = { passes: false, air_date_for_month: null, season_number: 1 }

  if (!detail) {
    // No detail: only include brand-new shows by first_air_date
    if (dateInMonth(s.first_air_date, year, month)) {
      return { passes: true, air_date_for_month: s.first_air_date, season_number: 1 }
    }
    return NO
  }

  const next   = detail.next_episode_to_air
  const last   = detail.last_episode_to_air
  const status = detail.status || ''

  // Check 1: next upcoming episode is E1 of a season, airing this month
  if (next && next.episode_number === 1 && dateInMonth(next.air_date, year, month)) {
    return { passes: true, air_date_for_month: next.air_date, season_number: next.season_number || 1 }
  }

  // Check 2: last aired episode is E1, aired this month (show just started)
  if (last && last.episode_number === 1 && dateInMonth(last.air_date, year, month)) {
    return { passes: true, air_date_for_month: last.air_date, season_number: last.season_number || 1 }
  }

  // Check 3: brand-new show not yet airing — first_air_date in this month
  // Works for shows like Cape Fear / Sugar S2 where TMDB hasn't populated next_episode_to_air yet
  const firstAirDate = detail.first_air_date || s.first_air_date
  if (dateInMonth(firstAirDate, year, month)) {
    // Determine season number: if number_of_seasons > 0 it's a returning show
    const seasonNum = (detail.number_of_seasons && detail.number_of_seasons > 0)
      ? detail.number_of_seasons
      : 1
    return { passes: true, air_date_for_month: firstAirDate, season_number: seasonNum }
  }

  // Not a premiere this month
  return NO
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function dedupById(shows) {
  const seen = new Set()
  return shows.filter(s => {
    if (!s.id || seen.has(s.id)) return false
    seen.add(s.id); return true
  })
}
function mapTMDB(s) {
  return {
    id: s.id,
    name: s.name ?? s.original_name,
    poster_path: s.poster_path,
    backdrop_path: s.backdrop_path,
    first_air_date: s.first_air_date,
    vote_average: s.vote_average ?? 0,
    overview: s.overview,
    network: '',
    air_date_for_month: s.first_air_date,
    season_number: 1,
  }
}
// ─── Trailer overrides — TWO lookup strategies ───────────────────────────────
// Strategy A: by TMDB numeric ID (exact, fast) — add ID once confirmed from console logs
// Strategy B: by normalized show name (fallback when ID unknown) — always works
//
// CONSOLE LOG: open DevTools → Console, filter "[AirDate]" to see each show's TMDB ID.
// Once you see the real ID, move the entry from TRAILER_OVERRIDES_BY_NAME to TRAILER_OVERRIDES_BY_ID.

// By TMDB ID — confirmed IDs (fastest lookup, no ambiguity)
const TRAILER_OVERRIDES_BY_ID = {
  124394: 'U7RT9LZ_6M0',   // Power Book III: Raising Kanan — S5 trailer
  203744: 'WJMbHySi5eQ',   // Sugar (Colin Farrell, Apple TV+) — S2 trailer
  219971: 'cYpslA2ytis',   // The Agency (Fassbender, Paramount+) — S2 trailer
}

// By normalized name — fallback for any show where TMDB ID is not yet confirmed
const TRAILER_OVERRIDES_BY_NAME = {
  'ted lasso':  'PxZg4SfIURg',   // Ted Lasso S4 Apple TV+ (TMDB ID TBD)
}

// Shows to skip entirely — no trailer exists yet for the current season
const NO_TRAILER_IDS = new Set([
  136315, // The Bear S5 — no official trailer yet; remove when trailer drops
])

// Resolve override: check ID first, then name
function getTrailerOverride(show) {
  if (TRAILER_OVERRIDES_BY_ID[show.id]) return TRAILER_OVERRIDES_BY_ID[show.id]
  const normalized = (show.name || '').toLowerCase().trim()
  return TRAILER_OVERRIDES_BY_NAME[normalized] || null
}

function extractVideoId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.searchParams.get('v') || u.pathname.split('/').pop()
  } catch { return null }
}
function getNetworkMeta(name) {
  if (!name) return null
  const key = Object.keys(NETWORK_META).find(k => name.toLowerCase().includes(k.toLowerCase()))
  return key ? NETWORK_META[key] : null
}
function sortByAffiliatePriority(shows) {
  const networkOrder = {
    'Apple TV+':0,'Max':1,'HBO Max':1,'HBO':1,'Disney+':2,'Hulu':3,
    'Paramount+':4,'Showtime':4,'Peacock':5,'Starz':6,'Netflix':7,'Prime Video':8,'Tubi TV':9,
  }
  return [...shows].sort((a, b) => {
    const aO = Object.keys(networkOrder).find(k => (a.network||'').includes(k))
    const bO = Object.keys(networkOrder).find(k => (b.network||'').includes(k))
    const aR = aO != null ? networkOrder[aO] : 99
    const bR = bO != null ? networkOrder[bO] : 99
    if (aR !== bR) return aR - bR
    return (b.vote_average||0) - (a.vote_average||0)
  })
}
function capNetworkRepresentation(shows, maxPerNetwork = 3) {
  const counts = {}
  return shows.filter(s => {
    const key = s.network || 'unknown'
    counts[key] = (counts[key]||0) + 1
    return counts[key] <= maxPerNetwork
  })
}

// ─── Scoop Sidebar ────────────────────────────────────────────────────────────
function ScoopSidebar() {
  const navigate = useNavigate()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${SCOOP_MANIFEST_URL}?t=${Date.now()}`)
      .then(r => r.json())
      .then(d => setStories(
        (d.items||[]).filter(i=>i.story_hash&&i.headline&&i.image_url)
          .sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0)).slice(0,5)
      )).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-3">
      {Array.from({length:5}).map((_,i)=>(
        <div key={i} className="animate-pulse flex gap-3 p-3 rounded-xl">
          <div className="w-6 h-4 bg-slate-700 rounded"/>
          <div className="w-12 h-12 bg-slate-700 rounded-lg flex-shrink-0"/>
          <div className="flex-1"><div className="h-3 bg-slate-700 rounded w-full mb-2"/><div className="h-2 bg-slate-700 rounded w-2/3"/></div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-1">
      {stories.map((item,i) => {
        const color = CAT_COLORS[item.category]||'#22d3ee'
        return (
          <article key={item.story_hash||i} onClick={()=>navigate(`/scoop/${item.story_hash}`)}
            className="group flex gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/5">
            <span className="text-xl font-black text-slate-700 w-6 shrink-0 leading-tight mt-0.5">
              {String(i+1).padStart(2,'0')}
            </span>
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
              <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"/>
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 mb-1"
                style={{background:`${color}20`,color,border:`1px solid ${color}30`}}>
                {item.category||'news'}
              </span>
              <h4 className="text-white text-xs font-bold leading-snug line-clamp-2 group-hover:text-cyan-400 transition-colors">
                {item.headline}
              </h4>
            </div>
          </article>
        )
      })}
      <button onClick={()=>navigate('/scoop')}
        className="w-full mt-2 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl transition-all">
        View All Stories →
      </button>
    </div>
  )
}

// ─── Featured Trailer Hero ────────────────────────────────────────────────────
function FeaturedTrailerHero({ show, videoId, monthLabel }) {
  const navigate = useNavigate()
  if (!show || !videoId) return null
  const meta = getNetworkMeta(show.network)
  const dateLabel = (() => {
    const d = show.air_date_for_month || show.first_air_date
    if (!d) return 'TBA'
    try {
      const dt = new Date(d + 'T12:00:00')
      return isNaN(dt.getTime()) ? 'TBA' : dt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    } catch { return 'TBA' }
  })()
  const seasonLabel = show.season_number > 1 ? `Season ${show.season_number} Premiere` : 'Series Premiere'

  return (
    <div className="mb-6 rounded-3xl overflow-hidden border border-white/10 bg-slate-900 relative">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-red-600/90 backdrop-blur-sm rounded-xl border border-red-400/30">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse"/>
        <span className="text-white text-[9px] font-black uppercase tracking-widest">Most Anticipated · {monthLabel}</span>
      </div>
      <div className="relative w-full" style={{paddingTop:'56.25%'}}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={`${show.name} — Official Trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="px-5 py-4 flex items-center justify-between border-t border-white/5">
        <div>
          <h3 className="text-white font-black text-lg leading-tight">{show.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {show.network && meta ? (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{background:meta.bg,color:meta.color,border:`1px solid ${meta.color}30`}}>
                {show.network}
              </span>
            ) : show.network ? (
              <span className="text-xs font-medium text-slate-400">{show.network}</span>
            ) : null}
            <span className="text-slate-400 text-xs">{seasonLabel} · {dateLabel}</span>
          </div>
        </div>
        <button onClick={()=>navigate(`/details/${show.id}`)}
          className="flex-shrink-0 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-cyan-500/30 rounded-xl text-xs font-black uppercase tracking-widest text-slate-300 hover:text-cyan-400 transition-all">
          Show Details →
        </button>
      </div>
    </div>
  )
}

// ─── Trailer Embed Card ───────────────────────────────────────────────────────
function TrailerEmbedCard({ show, videoId }) {
  const navigate = useNavigate()
  const meta = getNetworkMeta(show.network)
  const dateLabel = (() => {
    const d = show.air_date_for_month || show.first_air_date
    if (!d) return 'TBA'
    try {
      const dt = new Date(d + 'T12:00:00')
      return isNaN(dt.getTime()) ? 'TBA' : dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})
    } catch { return 'TBA' }
  })()
  const seasonBadge = show.season_number > 1 ? `S${show.season_number}` : null

  return (
    <div className="flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 transition-all">
      <div className="relative w-full bg-slate-800" style={{paddingTop:'56.25%'}}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={`${show.name} Trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {seasonBadge && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded-lg">
            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">{seasonBadge}</span>
          </div>
        )}
      </div>
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 onClick={()=>navigate(`/details/${show.id}`)}
            className="text-white text-xs font-bold leading-snug line-clamp-1 cursor-pointer hover:text-cyan-400 transition-colors mb-1">
            {show.name}
          </h4>
          <div className="flex items-center gap-2">
            {show.network && meta ? (
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{background:meta.bg,color:meta.color}}>
                {show.network}
              </span>
            ) : show.network ? (
              <span className="text-[10px] text-slate-400">{show.network}</span>
            ) : null}
            <span className="text-[10px] font-bold text-cyan-500/80 uppercase tracking-widest">{dateLabel}</span>
          </div>
        </div>
        <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 transition-all text-slate-400 hover:text-red-400"
          title="Open on YouTube">
          <i className="fa-brands fa-youtube text-sm"/>
        </a>
      </div>
    </div>
  )
}

// ─── Month Section ────────────────────────────────────────────────────────────
function MonthSection({ monthRange, token }) {
  const [readyShows, setReadyShows] = useState([])
  const [loading, setLoading]       = useState(true)
  const [fetching, setFetching]     = useState(false)
  const [progress, setProgress]     = useState(0)
  const [total, setTotal]           = useState(0)

  const { year, month } = monthRange

  useEffect(() => {
    const { gte, lte } = monthRange

    // Build per-network fetch promises — deep networks get pages 1+2
    const fetchPromises = AFFILIATE_NETWORK_IDS.flatMap(nid => {
      const base = {
        'air_date.gte': gte,
        'air_date.lte': lte,
        sort_by: 'popularity.desc',
        with_networks: String(nid),
      }
      const pages = DEEP_FETCH_NETWORK_IDS.has(nid) ? [1, 2] : [1]
      return pages.map(page =>
        tmdbDiscover({ ...base, page })
          .then(d => (d.results||[]).slice(0, 8).map(mapTMDB))
          .catch(() => [])
      )
    })

    Promise.all(fetchPromises).then(async allPages => {
      const merged = dedupById(allPages.flat())

      // Enrich: fetch detail for season premiere detection + season number
      const enriched = await Promise.all(merged.map(async s => {
        try {
          const detail = await tmdbShow(s.id)
          const { passes, air_date_for_month, season_number } = resolveSeasonPremiere(detail, s, year, month)
          if (!passes) return null
          return {
            ...s,
            network: detail?.networks?.[0]?.name || s.network || '',
            air_date_for_month,
            season_number,
          }
        } catch {
          if (!dateInMonth(s.first_air_date, year, month)) return null
          return { ...s, air_date_for_month: s.first_air_date, season_number: 1 }
        }
      }))

      const filtered = enriched.filter(Boolean)
      const sorted   = sortByAffiliatePriority(filtered)
      const capped   = capNetworkRepresentation(sorted, 3)

      setLoading(false)
      setTotal(capped.length)
      setFetching(true)

      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = token

      const withTrailers = []

      for (let i = 0; i < capped.length; i += 3) {
        const batch = capped.slice(i, i + 3)
        await Promise.all(batch.map(async show => {
          try {
            // Log show IDs to console so TMDB IDs can be confirmed for TRAILER_OVERRIDES
            console.log(`[AirDate Trailers] id=${show.id} name="${show.name}" season=${show.season_number}`)

            // Skip shows with no trailer available yet
            if (NO_TRAILER_IDS.has(show.id)) {
              setProgress(p => p + 1)
              return
            }

            // Check hardcoded override first — bypasses Lambda for known wrong-season results
            let videoId = getTrailerOverride(show)

            if (!videoId) {
              const res = await fetch(`${API_BASE}/get-trailer`, {
                method: 'POST', headers,
                body: JSON.stringify({
                  tmdb_id: String(show.id),
                  title: show.name,
                  season_number: show.season_number || 1,
                }),
              })
              const data = await res.json()
              videoId = extractVideoId(data.trailer_url)
            }

            if (videoId) {
              withTrailers.push({ ...show, videoId })
              withTrailers.sort((a, b) => {
                const networkOrder = {
                  'Apple TV+':0,'Max':1,'HBO Max':1,'HBO':1,'Disney+':2,'Hulu':3,
                  'Paramount+':4,'Showtime':4,'Peacock':5,'Starz':6,'Netflix':7,'Prime Video':8,'Tubi TV':9,
                }
                const aO = Object.keys(networkOrder).find(k=>(a.network||'').includes(k))
                const bO = Object.keys(networkOrder).find(k=>(b.network||'').includes(k))
                return (aO!=null?networkOrder[aO]:99) - (bO!=null?networkOrder[bO]:99)
              })
              setReadyShows([...withTrailers])
            }
          } catch {}
          setProgress(p => p + 1)
        }))
        if (i + 3 < capped.length) await new Promise(r => setTimeout(r, 150))
      }
      setFetching(false)
    })
  }, [monthRange.key])

  const featured = readyShows[0] || null
  const rest     = readyShows.slice(1)

  return (
    <section className="mb-16">

      {/* Month header — always first */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/5">
        <div className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border
          ${monthRange.isCurrentMonth
            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            : 'bg-slate-800/60 border-white/10 text-slate-300'}`}>
          {monthRange.isCurrentMonth ? '● NOW' : 'UPCOMING'}
        </div>
        <h2 className="text-2xl font-black text-white tracking-tighter uppercase">
          {monthRange.label}
        </h2>
        <div className="ml-auto flex items-center gap-3">
          {fetching && (
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block"/>
              Loading {progress}/{total}
            </span>
          )}
          {!fetching && readyShows.length > 0 && (
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {readyShows.length} trailers
            </span>
          )}
        </div>
      </div>

      {/* Featured hero */}
      {featured && (
        <FeaturedTrailerHero
          show={featured}
          videoId={featured.videoId}
          monthLabel={monthRange.label}
        />
      )}

      {/* Trailer grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({length:8}).map((_,i)=>(
            <div key={i} className="animate-pulse bg-slate-800/50 rounded-2xl overflow-hidden">
              <div className="w-full bg-slate-700" style={{paddingTop:'56.25%'}}/>
              <div className="p-3"><div className="h-3 bg-slate-700 rounded w-3/4 mb-2"/><div className="h-2 bg-slate-700 rounded w-1/2"/></div>
            </div>
          ))}
        </div>
      ) : rest.length === 0 && !featured ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          <i className="fa-solid fa-film text-3xl mb-3 block opacity-30"/>
          {fetching ? 'Searching for trailers…' : 'No trailers found for this period.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {rest.map(show => (
            <TrailerEmbedCard key={show.id} show={show} videoId={show.videoId} />
          ))}
          {fetching && rest.length < 8 && Array.from({length: Math.min(4, total - readyShows.length)}).map((_,i)=>(
            <div key={`ph-${i}`} className="animate-pulse bg-slate-800/50 rounded-2xl overflow-hidden">
              <div className="w-full bg-slate-700" style={{paddingTop:'56.25%'}}/>
              <div className="p-3"><div className="h-3 bg-slate-700 rounded w-3/4 mb-2"/><div className="h-2 bg-slate-700 rounded w-1/2"/></div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function TrailersPage() {
  const { token } = useAuth()
  const [leaderboard, setLeaderboard] = useState([])
  const months = [getMonthRange(0), getMonthRange(1), getMonthRange(2), getMonthRange(3)]

  useEffect(() => {
    fetch(`${API_BASE}/get-premieres`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({page:1, per_page:10}),
    }).then(r=>r.json()).then(gw=>{
      const d = gw.body?(typeof gw.body==='string'?JSON.parse(gw.body):gw.body):gw
      if (d?.leaderboard) setLeaderboard(d.leaderboard)
    }).catch(()=>{})
  }, [])

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-28 pb-6">

        <header className="mb-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-red-600/10 rounded-2xl border border-red-500/20">
              <i className="fa-brands fa-youtube text-red-500 text-2xl"/>
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
                Upcoming Trailers
              </h1>
              <p className="text-slate-400 text-sm font-medium mt-1">
                Official trailers for TV season premieres — current &amp; next 3 months
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {Object.entries(NETWORK_META).slice(0,8).map(([name, meta]) => (
              <span key={name} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
                style={{background:meta.bg,color:meta.color,border:`1px solid ${meta.color}30`}}>
                {name}
              </span>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-10">
          <div className="lg:col-span-3 xl:col-span-4">
            {months.map(month => (
              <MonthSection key={month.key} monthRange={month} token={token} />
            ))}
          </div>

          <aside className="space-y-8">
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                  <i className="fa-solid fa-bolt text-cyan-400 text-lg"/>
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wide text-cyan-400 mb-0.5">Get The Scoop</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Latest TV Intelligence</p>
                </div>
              </div>
              <ScoopSidebar/>
            </div>

            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20">
                  <i className="fa-solid fa-fire text-pink-400 text-lg"/>
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wide text-pink-400 mb-0.5">Global Hype Ranking</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Top Tracked Series</p>
                </div>
              </div>
              <div className="space-y-3">
                {leaderboard.length === 0
                  ? Array.from({length:5}).map((_,i)=>(
                      <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-slate-800/40 rounded-2xl">
                        <div className="w-8 h-8 bg-slate-700 rounded-xl"/>
                        <div className="flex-1"><div className="h-3 bg-slate-700 rounded w-3/4 mb-1"/><div className="h-2 bg-slate-700 rounded w-1/2"/></div>
                      </div>
                    ))
                  : leaderboard.slice(0,10).map((s,idx)=>(
                      <div key={`${s.id??idx}-${idx}`}
                        className="flex items-center gap-3 p-3 bg-slate-800/40 border border-white/5 rounded-2xl hover:border-pink-500/20 transition-all cursor-pointer"
                        onClick={()=>window.location.href=`/details/${s.id}`}>
                        <span className="w-6 text-center text-[10px] font-black text-slate-500">{idx+1}</span>
                        <img src={s.poster_path?`${IMAGE_BASE}/t/p/w92${s.poster_path}`:(s.poster||'')}
                          alt={s.title||s.name}
                          className="w-8 h-10 object-cover rounded-lg flex-shrink-0 bg-slate-700"
                          onError={e=>{e.currentTarget.style.display='none'}}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{s.title||s.name}</p>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-pink-400 mt-0.5">
                            {s.hype?`${Number(s.hype).toLocaleString()} tracking`:s.tracked_count?`${s.tracked_count.toLocaleString()} tracking`:'Trending'}
                          </p>
                        </div>
                      </div>
                    ))
                }
              </div>
            </div>
          </aside>
        </div>
        <Footer/>
      </div>
    </div>
  )
}