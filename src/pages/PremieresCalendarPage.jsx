// src/pages/PremieresCalendarPage.jsx
import { useEffect, useState, useCallback } from 'react'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'
import { usePoster }    from '@/utils/poster'
import { Footer }       from '@/components/layout/Footer'
import { API_BASE }     from '@/config/aws'

const TMDB_KEY = '9e7202516e78494f2b18ec86d29a4309'
const TMDB     = 'https://api.themoviedb.org/3'

const NETWORK_MAP = {
  'Netflix':      [213],
  'HBO / Max':    [49, 3186, 1565],
  'Disney+':      [2739],
  'Prime Video':  [1024, 1025, 2777],
  'Hulu':         [453],
  'Apple TV+':    [2552, 350, 3411, 2007],
  'Peacock':      [3353, 3076],
  'Paramount+':   [4330, 67, 4711],
  'CBS':          [16],
  'NBC':          [6],
  'ABC':          [2],
  'FOX':          [19],
  'FX':           [88],
  'AMC':          [174],
  'STARZ':        [318, 304, 1709],
}

// Streaming platforms store episode air_date as UTC midnight → needs +1 day shift for US local.
// Broadcast networks (NBC/CBS/ABC/FOX/FX/AMC) store the correct US air date already.
const STREAMING_NETWORK_IDS = new Set([
  213,                    // Netflix
  49, 3186, 1565,         // HBO / Max
  2739,                   // Disney+
  1024, 1025, 2777,       // Prime Video
  453,                    // Hulu
  2552, 350, 3411, 2007,  // Apple TV+
  3353, 3076,             // Peacock
  4330, 67, 4711,         // Paramount+
  2503,                   // Tubi
  4406, 318, 304, 1709,   // STARZ
])

const STREAMING_NAME_KEYWORDS = ['netflix','apple tv','prime','hulu','disney','peacock','paramount','max','starz','tubi']

function isStreaming(detail) {
  // ID-based check (primary)
  if ((detail?.networks || []).some(n => STREAMING_NETWORK_IDS.has(n.id))) return true
  // Name-based fallback — catches alternate Apple TV+ IDs and unlisted streaming networks
  return (detail?.networks || []).some(n =>
    STREAMING_NAME_KEYWORDS.some(kw => (n.name || '').toLowerCase().includes(kw))
  )
}
const NETWORKS  = ['All', ...Object.keys(NETWORK_MAP)]
const DOW       = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DOW_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT']

const GENRE_LABEL = {
  18:'DRAMA', 35:'COMEDY', 10765:'SCI-FI', 80:'CRIME', 10759:'ACTION',
  53:'THRILLER', 16:'ANIMATION', 10764:'REALITY', 99:'DOCUMENTARY',
  10751:'FAMILY', 9648:'MYSTERY', 10762:'KIDS', 10768:'WAR', 37:'WESTERN',
}

function getNetworkColor(n='') {
  const map = {
    'Netflix':'#E50914','HBO':'#5822CF','Max':'#5822CF','Disney+':'#113CCF',
    'Hulu':'#1CE783','Apple':'#888','Prime Video':'#00A8E0',
    'Peacock':'#818cf8','Paramount+':'#0064FF','CBS':'#4a90d9','NBC':'#CF0A2C',
    'ABC':'#f59e0b','FOX':'#6366f1','FX':'#a78bfa','AMC':'#D4AF37','STARZ':'#94a3b8',
    'USA Network':'#22d3ee','Bravo':'#e879f9','Syfy':'#818cf8',
  }
  for (const [k,v] of Object.entries(map)) { if (n.includes(k)) return v }
  return '#22d3ee'
}

function pad(n) { return String(n).padStart(2,'0') }

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

function shiftDate(str) {
  if (!str) return str
  const d = new Date(str + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

function formatShortDate(str) {
  if (!str) return ''
  try {
    return new Date(str + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return str }
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────
async function fetchAllPages(base, maxPages=8) {
  const p1    = await fetch(`${base}&page=1`).then(r=>r.json()).catch(()=>({results:[],total_pages:0}))
  const total = Math.min(p1.total_pages||1, maxPages)
  const items = [...(p1.results||[])]
  if (total > 1) {
    const rest = await Promise.all(
      Array.from({length:total-1}, (_,i) =>
        fetch(`${base}&page=${i+2}`)
          .then(r=>r.json()).then(d=>d.results||[]).catch(()=>[])
      )
    )
    items.push(...rest.flat())
  }
  return items
}

async function batchFetchDetails(ids) {
  const results = {}
  const chunks = []
  for (let i=0; i<ids.length; i+=20) chunks.push(ids.slice(i,i+20))
  // Fetch ALL chunks in parallel (not sequentially) for speed
  await Promise.all(
    chunks.map(chunk =>
      Promise.all(
        chunk.map(id =>
          fetch(`${TMDB}/tv/${id}?api_key=${TMDB_KEY}&language=en-US`)
            .then(r=>r.json())
            .then(d=>{ results[id]=d })
            .catch(()=>{})
        )
      )
    )
  )
  return results
}

async function fetchLambdaPremieres(year, month, networkLabel=null) {
  try {
    const params = new URLSearchParams({
      year, month,
      ...(networkLabel && networkLabel !== 'All' ? { network: networkLabel } : {}),
    })
    const res = await fetch(`${API_BASE}/premieres/calendar?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    const shows = data.premieres ?? data.shows ?? []
    return shows
      .filter(s => s.id)
      .map(s => ({
        id:             s.id,
        name:           s.title || s.name || s.seriesTitle || '',
        poster_path:    s.poster_path || null,
        poster:         s.poster || null,
        first_air_date: s.premiereDate || s.premiere || s.first_air_date || null,
        _networkLabel:  s.network || networkLabel || '',
        genre_ids:      s.genre_ids || [],
        overview:       s.description || s.overview || '',
        _fromLambda:    true,
      }))
  } catch { return [] }
}

function findSeasonPremiereInRange(detail, first, last) {
  const seasons = (detail.seasons || [])
    .filter(s => s.season_number > 0 && s.air_date)
    .map(s => ({ ...s, air_date: shiftDate(s.air_date) }))
    .filter(s => s.air_date >= first && s.air_date <= last)
  if (!seasons.length) return null
  seasons.sort((a,b) => a.air_date.localeCompare(b.air_date))
  return seasons[0]
}

// ─── Main fetcher ─────────────────────────────────────────────────────────────
// Four source types, all parallel / additive:
//   Pass A  — first_air_date in month  (brand-new series, S1E1)
//   Pass B  — air_date in month + seasons[] (returning season premieres, E1 of new season)
//   Pass C  — continuing shows: next_episode_to_air OR last_episode_to_air lands this month
//             catches both upcoming weekly shows AND full-season drops already aired (e.g. Apple TV+)
//   Lambda  — curated data for networks TMDB misses (STARZ, etc.)
async function fetchMonthPremieres(year, month, networkIds=null) {
  const first = `${year}-${pad(month)}-01`
  const last  = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`

  const qStart = (() => {
    const d = new Date(first + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  })()

  const langFilter    = networkIds ? '' : '&with_original_language=en'
  const networkIdList = networkIds || [null]

  const activeNetworkLabel = networkIds
    ? Object.entries(NETWORK_MAP).find(([,ids]) =>
        ids.some(id => networkIds.includes(id))
      )?.[0] || null
    : null

  const [lambdaShows, ...tmdbPerNetwork] = await Promise.all([
    Promise.resolve([]),   // GET /premieres/calendar not yet deployed — TMDB passes cover all data
    ...networkIdList.map(async (networkId) => {
      const netParam = networkId ? `&with_networks=${networkId}` : ''
      const netLabel = networkId
        ? (Object.entries(NETWORK_MAP).find(([,ids])=>ids.includes(networkId))?.[0] || '')
        : ''

      // Pass A: brand-new series (first_air_date in month)
      const baseA = `${TMDB}/discover/tv?api_key=${TMDB_KEY}&language=en-US`
        + `&first_air_date.gte=${qStart}&first_air_date.lte=${last}`
        + `&sort_by=popularity.desc` + langFilter + netParam
      const newShowsRaw = await fetchAllPages(baseA, 3)
      const newShows = newShowsRaw
        .map(s => ({
          ...s,
          first_air_date: shiftDate(s.first_air_date),
          ...(netLabel ? { _networkLabel: netLabel } : {}),
          _seasonNum:  1,
          _episodeNum: 1,
          _isSeason:   false,
        }))
        .filter(s => s.first_air_date >= first && s.first_air_date <= last)

      // Pass B: returning shows — air_date query + seasons[] batch
      const baseB = `${TMDB}/discover/tv?api_key=${TMDB_KEY}&language=en-US`
        + `&air_date.gte=${qStart}&air_date.lte=${last}`
        + `&sort_by=popularity.desc` + langFilter + netParam
      const airingShows = await fetchAllPages(baseB, 2)

      const newIds     = new Set(newShows.map(s=>s.id))
      const candidates = airingShows.filter(s=>!newIds.has(s.id))

      // Fetch details in two separate batches so newShows are GUARANTEED inclusion.
      // If we merged into one slice(0,60), candidates (often 60+) crowd out newShows entirely.
      //   newShowsDetails → Pass C continuing episode check (e.g. YF&N premieres Apr 3, Ep4 Apr 24)
      //   candidateDetails → Pass B season premieres + Pass C continuing check
      const [newShowsDetails, candidateDetails] = await Promise.all([
        newShows.length > 0
          ? batchFetchDetails(newShows.slice(0, 40).map(s=>s.id))
          : Promise.resolve({}),
        candidates.length > 0
          ? batchFetchDetails(candidates.slice(0, 40).map(s=>s.id))
          : Promise.resolve({}),
      ])
      const detailsMap = { ...candidateDetails, ...newShowsDetails }

      // Pass B: season premieres (E1 of a new season landing this month)
      const seasonPremierIds = new Map()  // id → premiere air_date
      const seasonPremieres  = []
      for (const show of candidates) {
        const detail = detailsMap[show.id]
        if (!detail) continue
        const season = findSeasonPremiereInRange(detail, first, last)
        if (!season) continue
        seasonPremierIds.set(show.id, season.air_date)
        seasonPremieres.push({
          ...show,
          first_air_date: season.air_date,
          _networkLabel:  netLabel || (detail.networks?.[0]?.name || ''),
          _seasonNum:     season.season_number,
          _episodeNum:    1,
          _isSeason:      season.season_number > 1,
        })
      }

      // Pass C: continuing shows — premiered in a prior month, episodes still airing now
      // Also processes newShows: a show that premiered this month (Pass A) may have
      // additional episodes airing later the same month (e.g. Your Friends & Neighbors
      // premieres Apr 3, Ep4 airs Apr 25 — both should appear on the calendar).
      // Two-check fallback so we catch both:
      //   • Weekly shows where next_episode_to_air is upcoming this month
      //   • Full-season drops (e.g. Apple TV+) where all eps already aired and
      //     next_episode_to_air is null — use last_episode_to_air instead
      const continuingShows = []
      for (const show of [...candidates, ...newShows]) {
        const detail = detailsMap[show.id]
        if (!detail) continue

        let episodeDate = null
        let episodeNum  = null
        let seasonNum   = null

        // Check 1: next_episode_to_air — upcoming weekly episodes
        // Streaming platforms (Netflix, Apple TV+, etc.) store UTC midnight dates → shift +1 for US.
        // Broadcast networks (NBC, CBS, ABC, FOX) already store the correct US air date.
        const streaming = isStreaming(detail)
        const nextEp = detail.next_episode_to_air
        if (nextEp?.air_date) {
          const epDate = streaming ? shiftDate(nextEp.air_date) : nextEp.air_date
          if (epDate >= first && epDate <= last) {
            episodeDate = epDate
            episodeNum  = nextEp.episode_number
            seasonNum   = nextEp.season_number
          }
        }

        // Check 2: last_episode_to_air — catches shows mid-run or full-season drops
        // where next_episode_to_air is null because episodes already aired this month
        if (!episodeDate) {
          const lastEp = detail.last_episode_to_air
          if (lastEp?.air_date) {
            const epDate = streaming ? shiftDate(lastEp.air_date) : lastEp.air_date
            if (epDate >= first && epDate <= last) {
              episodeDate = epDate
              episodeNum  = lastEp.episode_number
              seasonNum   = lastEp.season_number
            }
          }
        }

        if (!episodeDate) continue  // genuinely no episodes this month

        // NOW safe to check: skip only if episodeDate == the season premiere date
        // (Pass B already placed it). Don't skip entirely — later episodes still needed.
        if (seasonPremierIds.has(show.id) && episodeDate === seasonPremierIds.get(show.id)) continue

        // For shows that premiered this month (in newShows), skip continuing entry
        // if episodeDate == their premiere date — Pass A already placed them there
        if (newIds.has(show.id) && episodeDate === show.first_air_date) continue

        // Primary entry — next_episode_to_air (upcoming) or last_episode_to_air (recently aired)
        continuingShows.push({
          ...show,
          first_air_date: episodeDate,
          _networkLabel:  netLabel || (detail.networks?.[0]?.name || ''),
          _seasonNum:     seasonNum,
          _episodeNum:    episodeNum,
          _isSeason:      false,
          _isContinuing:  true,
        })

        // Secondary entry — if we used next_episode_to_air, ALSO show last_episode_to_air
        // if it aired earlier this month (different date). This lets weekly shows like
        // Law & Order appear on BOTH the date they aired AND the upcoming date.
        const usedNext = episodeDate === nextEp?.air_date
        if (usedNext && detail.last_episode_to_air?.air_date) {
          const lastDate = streaming ? shiftDate(detail.last_episode_to_air.air_date) : detail.last_episode_to_air.air_date
          const lastNum  = detail.last_episode_to_air.episode_number
          const lastSsn  = detail.last_episode_to_air.season_number
          if (lastDate >= first && lastDate <= last && lastDate !== episodeDate) {
            continuingShows.push({
              ...show,
              first_air_date: lastDate,
              _networkLabel:  netLabel || (detail.networks?.[0]?.name || ''),
              _seasonNum:     lastSsn,
              _episodeNum:    lastNum,
              _isSeason:      false,
              _isContinuing:  true,
            })
          }
        }
      }

      return [...newShows, ...seasonPremieres, ...continuingShows]
    }),
  ])

  // Merge all sources, sort by premiere date, dedupe (TMDB wins over Lambda on dupes)
  const seen = new Set()
  return [...tmdbPerNetwork.flat(), ...lambdaShows]
    .sort((a,b) => (a.first_air_date||'').localeCompare(b.first_air_date||''))
    .filter(s => {
      if (!s.id || seen.has(`${s.id}_${s.first_air_date||''}`)) return false
      seen.add(`${s.id}_${s.first_air_date||''}`)
      return true
    })
}

// ─── Skeletons ────────────────────────────────────────────────────────────────
function SkeletonListDay() {
  return (
    <div className="animate-pulse mb-10">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex-shrink-0"/>
        <div className="space-y-2">
          <div className="h-5 bg-slate-800 rounded w-40"/>
          <div className="h-3 bg-slate-800 rounded w-20"/>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({length:4}).map((_,i)=>(
          <div key={i} className="bg-slate-800/40 rounded-2xl p-3 flex gap-3">
            <div className="w-12 h-16 bg-slate-700 rounded-xl flex-shrink-0"/>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 bg-slate-700 rounded w-3/4"/>
              <div className="h-2 bg-slate-700 rounded w-1/2"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-1.5 animate-pulse">
      {Array.from({length:35}).map((_,i)=>(
        <div key={i} className="min-h-[90px] rounded-xl bg-slate-800/40"/>
      ))}
    </div>
  )
}

// ─── Episode schedule drawer (lazy loaded on demand) ─────────────────────────
function EpisodeDrawer({ show, monthFirst, monthLast }) {
  const [episodes, setEpisodes] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const seasonNum = show._seasonNum || 1
        const res  = await fetch(`${TMDB}/tv/${show.id}/season/${seasonNum}?api_key=${TMDB_KEY}&language=en-US`)
        const data = await res.json()
        const eps  = (data.episodes || [])
          .map(ep => ({ ...ep, air_date: shiftDate(ep.air_date) }))
          .filter(ep => ep.air_date && ep.air_date >= monthFirst && ep.air_date <= monthLast)
          .sort((a,b) => a.air_date.localeCompare(b.air_date))
        setEpisodes(eps)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [show.id, show._seasonNum, monthFirst, monthLast])

  if (loading) return (
    <div className="mt-3 pt-3 border-t border-white/8">
      <div className="flex items-center gap-2.5 py-2">
        <div className="w-4 h-4 border-2 border-cyan-500/40 border-t-cyan-400 rounded-full animate-spin flex-shrink-0"/>
        <span className="text-xs text-slate-400 font-bold">Loading episode schedule…</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="mt-3 pt-3 border-t border-white/8">
      <p className="text-xs text-slate-400 font-bold">Could not load episode schedule.</p>
    </div>
  )

  if (!episodes || !episodes.length) return (
    <div className="mt-3 pt-3 border-t border-white/8">
      <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">No episodes found for this month.</p>
    </div>
  )

  const today = todayStr()

  return (
    <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-black uppercase tracking-widest text-slate-300">
          {episodes.length} Episode{episodes.length!==1?'s':''} This Month
        </p>
        <p className="text-[10px] text-slate-500 font-bold">S{show._seasonNum||1}</p>
      </div>

      {episodes.map(ep => {
        const isToday = ep.air_date === today
        const isPast  = ep.air_date < today

        return (
          <div
            key={ep.id || ep.episode_number}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
              ${isToday
                ? 'bg-red-500/10 border-red-500/30'
                : isPast
                  ? 'bg-slate-900/40 border-white/5'
                  : 'bg-slate-900/60 border-cyan-500/10 hover:border-cyan-500/20'
              }`}
          >
            {/* Episode badge */}
            <span className={`flex-shrink-0 min-w-[38px] text-center text-xs font-black px-2 py-1 rounded-lg
              ${isToday
                ? 'bg-red-500/25 text-red-300 border border-red-500/40'
                : isPast
                  ? 'bg-slate-800 text-slate-400 border border-white/8'
                  : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
              }`}>
              E{String(ep.episode_number).padStart(2,'0')}
            </span>

            {/* Title */}
            <span className={`flex-1 text-sm font-semibold truncate
              ${isToday ? 'text-white' : isPast ? 'text-slate-400' : 'text-slate-100'}`}>
              {ep.name || `Episode ${ep.episode_number}`}
            </span>

            {/* Air date */}
            {isToday ? (
              <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-black text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"/>
                </span>
                Live
              </span>
            ) : (
              <span className={`flex-shrink-0 text-xs font-bold
                ${isPast ? 'text-slate-500' : 'text-slate-300'}`}>
                {formatShortDate(ep.air_date)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Show card (list view) ────────────────────────────────────────────────────
function ShowListCard({ show, onTrack, isTracked, atLimit, isAuthenticated, monthFirst, monthLast }) {
  const [expanded, setExpanded] = useState(false)
  const netName = show._networkLabel || show.networks?.[0]?.name || show.network || ''
  const genre   = show.genre_ids?.[0] ? GENRE_LABEL[show.genre_ids[0]] : ''
  const tracked = isTracked(show.id)
  const poster  = usePoster(show.poster_path || show.poster, show.name, 92)
  const canExpand = !!show._seasonNum

  function getEpisodeLabel() {
    if (!show._seasonNum) return null
    if (show._isContinuing) return `S${show._seasonNum} · E${show._episodeNum ?? '?'} Airing`
    if (show._isSeason)     return `S${show._seasonNum} · E1 Season Premiere`
    return `S1 · E1 Series Premiere`
  }

  const epLabel = getEpisodeLabel()

  return (
    <div className={`bg-slate-800/40 border rounded-2xl transition-all
      ${expanded ? 'border-cyan-500/20 bg-slate-800/60' : 'border-white/5 hover:border-cyan-500/20 hover:bg-slate-800/60'}`}>

      <div
        className="flex items-center gap-3 p-3 cursor-pointer group"
        onClick={()=>window.location.href=`/details/${show.id}`}
      >
        <img {...poster} alt={show.name}
          className="w-12 h-16 object-cover rounded-xl flex-shrink-0 group-hover:scale-105 transition-transform duration-200"/>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white leading-snug line-clamp-2 mb-1">{show.name}</h4>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:getNetworkColor(netName)}}/>
            <p className="text-[10px] font-bold text-slate-400 truncate">{netName||'Unknown'}</p>
          </div>
          {epLabel && (
            <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5
              ${show._isContinuing ? 'text-amber-400/80' : 'text-cyan-500/70'}`}>
              {epLabel}
            </p>
          )}
          {genre && <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{genre}</p>}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {isAuthenticated && (
            <button
              onClick={e=>{e.stopPropagation();onTrack(show)}}
              disabled={!tracked&&atLimit}
              className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all flex items-center justify-center opacity-0 group-hover:opacity-100
                ${tracked?'bg-cyan-500 text-slate-950':'bg-slate-700 text-slate-400 hover:bg-cyan-500/20 hover:text-cyan-400'}`}>
              {tracked?'✓':'+'}
            </button>
          )}
          {canExpand && (
            <button
              onClick={e=>{e.stopPropagation();setExpanded(v=>!v)}}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all
                ${expanded
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : 'bg-slate-700/60 border-white/10 text-slate-400 hover:border-cyan-500/20 hover:text-cyan-400'}`}>
              <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-list'} text-[9px]`}/>
              {expanded ? 'Hide' : 'Episodes'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          <EpisodeDrawer show={show} monthFirst={monthFirst} monthLast={monthLast}/>
        </div>
      )}
    </div>
  )
}

// ─── Day panel card (calendar view) ──────────────────────────────────────────
function DayPanelCard({ show, onTrack, isTracked, atLimit, isAuthenticated, monthFirst, monthLast }) {
  const [expanded, setExpanded] = useState(false)
  const netName = show._networkLabel || show.networks?.[0]?.name || show.network || ''
  const tracked = isTracked(show.id)
  const poster  = usePoster(show.poster_path || show.poster, show.name, 92)
  const canExpand = !!show._seasonNum

  function getEpisodeLabel() {
    if (!show._seasonNum) return null
    if (show._isContinuing) return `S${show._seasonNum} · E${show._episodeNum ?? '?'} Airing`
    if (show._isSeason)     return `S${show._seasonNum} · E1 Premiere`
    return `S1 · E1`
  }

  return (
    <div className={`border rounded-2xl transition-all
      ${expanded ? 'border-cyan-500/20 bg-slate-800/40' : 'border-white/5 bg-slate-800/40 hover:border-cyan-500/20'}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={()=>window.location.href=`/details/${show.id}`}
      >
        <img {...poster} alt={show.name} className="w-10 h-14 object-cover rounded-lg flex-shrink-0"/>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white truncate">{show.name}</h4>
          {getEpisodeLabel() && (
            <p className={`text-[10px] font-black uppercase tracking-widest
              ${show._isContinuing ? 'text-amber-400/80' : 'text-cyan-500/70'}`}>
              {getEpisodeLabel()}
            </p>
          )}
          {netName && (
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
              style={{color:getNetworkColor(netName)}}>{netName}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {isAuthenticated && (
            <button
              onClick={e=>{e.stopPropagation();onTrack(show)}}
              disabled={!tracked&&atLimit}
              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                ${tracked?'bg-cyan-500 text-slate-950':'bg-slate-700 text-slate-400 hover:bg-cyan-500/20 hover:text-cyan-400'}`}>
              {tracked?'✓':'+'}
            </button>
          )}
          {canExpand && (
            <button
              onClick={e=>{e.stopPropagation();setExpanded(v=>!v)}}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all
                ${expanded
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : 'bg-slate-700/60 border-white/10 text-slate-400 hover:border-cyan-500/20 hover:text-cyan-400'}`}>
              <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-list'} text-[8px]`}/>
              {expanded ? 'Hide' : 'Eps'}
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <EpisodeDrawer show={show} monthFirst={monthFirst} monthLast={monthLast}/>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function PremieresCalendarPage() {
  const { isAuthenticated } = useAuth()
  const { toggleWatchlist, isTracked, atLimit } = useWatchlist()

  const [view,        setView]        = useState('list')
  const [network,     setNetwork]     = useState('All')
  const [premieres,   setPremieres]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const monthFirst = `${year}-${pad(month)}-01`
  const monthLast  = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`

  const load = useCallback(async () => {
    setLoading(true)
    setSelectedDay(null)
    try {
      const networkIds = network==='All' ? null : NETWORK_MAP[network]
      const shows = await fetchMonthPremieres(year, month, networkIds)
      setPremieres(shows)
    } catch(e) {
      console.warn('[AirDate] Premieres fetch failed', e)
      setPremieres([])
    } finally {
      setLoading(false)
    }
  }, [year, month, network])

  useEffect(()=>{ load() }, [load])

  function handleTrack(show) {
    const r = toggleWatchlist(show)
    if (r?.error==='FREEMIUM_LIMIT') window.location.href='/upgrade'
  }

  const cardProps = { onTrack:handleTrack, isTracked, atLimit, isAuthenticated, monthFirst, monthLast }

  const firstDow    = new Date(year, month-1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today       = todayStr()
  const monthLabel  = new Date(year, month-1, 1).toLocaleString('default',{month:'long',year:'numeric'})

  function dateStr(day) { return `${year}-${pad(month)}-${pad(day)}` }
  function showsForDay(day) { return premieres.filter(s=>s.first_air_date===dateStr(day)) }

  const byDate = {}
  premieres.forEach(s=>{
    const d=s.first_air_date||''
    if (d){ if (!byDate[d]) byDate[d]=[]; byDate[d].push(s) }
  })
  const sortedDates   = Object.keys(byDate).sort()
  const selDateStr    = selectedDay ? dateStr(selectedDay) : null
  const selectedShows = selectedDay ? showsForDay(selectedDay) : []

  const goBack = ()=>setCurrentDate(new Date(year, month-2, 1))
  const goNext = ()=>setCurrentDate(new Date(year, month, 1))

  const MonthNav = ()=>(
    <div className="flex items-center justify-between mb-6">
      <button onClick={goBack}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 rounded-xl text-sm font-bold text-slate-200 hover:text-white transition-all">
        <i className="fa-solid fa-chevron-left text-xs"></i> Prev
      </button>
      <div className="text-center">
        <h2 className="text-2xl font-black text-white tracking-tight">{monthLabel}</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
          {loading?'Loading…':`${premieres.length} Premiere${premieres.length!==1?'s':''}`}
        </p>
      </div>
      <button onClick={goNext}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 rounded-xl text-sm font-bold text-slate-200 hover:text-white transition-all">
        Next <i className="fa-solid fa-chevron-right text-xs"></i>
      </button>
    </div>
  )

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-3">
              <i className="fa-solid fa-calendar-star"></i> Premiere Dates
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2">Premiere Calendar</h1>
            <p className="text-slate-400 text-sm max-w-xl">New series, season premieres, and continuing episodes across all major networks.</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <div className="w-3 h-3 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin"></div>
                Loading…
              </div>
            )}
            <div className="flex items-center gap-1 bg-slate-800/60 border border-white/10 rounded-xl p-1">
              {[['list','fa-th-large','List'],['calendar','fa-calendar-days','Calendar']].map(([v,icon,label])=>(
                <button key={v} onClick={()=>setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all
                    ${view===v?'bg-white/8 text-white':'text-slate-400 hover:text-slate-200'}`}>
                  <i className={`fa-solid ${icon} mr-1`}></i>{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mb-6 text-[10px] font-bold uppercase tracking-widest">
          <span className="text-slate-500">Key:</span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"/>
            Season / Series Premiere
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>
            Continuing Episodes
          </span>
        </div>

        {/* Network filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2" style={{scrollbarWidth:'none'}}>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex-shrink-0">Filter:</span>
          {NETWORKS.map(n=>(
            <button key={n} onClick={()=>setNetwork(n)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all
                ${network===n?'bg-cyan-500/10 border-cyan-500/35 text-cyan-400':'text-slate-400 border-white/10 hover:text-white'}`}>
              {n}
            </button>
          ))}
        </div>

        {/* ── LIST VIEW ── */}
        {view==='list' && (
          <>
            <MonthNav/>
            {loading ? (
              <div>{Array.from({length:4}).map((_,i)=><SkeletonListDay key={i}/>)}</div>
            ) : sortedDates.length===0 ? (
              <div className="text-center py-20">
                <i className="fa-solid fa-calendar-xmark text-slate-700 text-5xl mb-4"/>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                  No premieres found for {monthLabel}
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {sortedDates.map(date=>{
                  const d       = new Date(date+'T12:00:00')
                  const isToday = date===today
                  const shows   = byDate[date]
                  return (
                    <div key={date}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center border
                          ${isToday?'bg-cyan-500 border-cyan-400':'bg-slate-800/60 border-white/10'}`}>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${isToday?'text-slate-950':'text-slate-400'}`}>
                            {DOW_SHORT[d.getDay()]}
                          </span>
                          <span className={`text-xl font-black leading-tight ${isToday?'text-slate-950':'text-white'}`}>
                            {d.getDate()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white">
                            {d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
                          </h3>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                            {shows.length} premiere{shows.length!==1?'s':''}
                          </p>
                        </div>
                        {isToday && (
                          <span className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-[9px] font-black uppercase tracking-widest">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {shows.map(show=><ShowListCard key={show.id} show={show} {...cardProps}/>)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── CALENDAR VIEW ── */}
        {view==='calendar' && (
          <>
            <MonthNav/>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2">
                <div className="grid grid-cols-7 mb-2">
                  {DOW.map(d=>(
                    <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-2">{d}</div>
                  ))}
                </div>
                {loading ? <CalendarSkeleton/> : (
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({length:firstDow}).map((_,i)=>(
                      <div key={`e${i}`} className="min-h-[90px] rounded-xl bg-slate-900/20 opacity-20"/>
                    ))}
                    {Array.from({length:daysInMonth}).map((_,i)=>{
                      const day        = i+1
                      const ds         = dateStr(day)
                      const shows      = showsForDay(day)
                      const isToday    = ds===today
                      const isSelected = selectedDay===day
                      return (
                        <div key={day} onClick={()=>setSelectedDay(isSelected?null:day)}
                          className={`min-h-[90px] rounded-xl border p-1.5 cursor-pointer transition-all
                            ${isSelected?'border-cyan-500/40 bg-cyan-500/5'
                              :shows.length>0?'border-white/10 bg-slate-900/40 hover:border-white/20'
                              :'border-white/5 bg-slate-900/20 hover:border-white/10'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black mb-1
                            ${isToday?'bg-cyan-400 text-slate-950':'text-slate-400'}`}>
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {shows.slice(0,3).map((s,idx)=>{
                              const net=s._networkLabel||s.networks?.[0]?.name||''
                              return (
                                <div key={idx} className="flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{background: s._isContinuing ? '#f59e0b' : getNetworkColor(net)}}/>
                                  <span className="text-[8px] text-slate-300 truncate leading-tight">{s.name}</span>
                                </div>
                              )
                            })}
                            {shows.length>3&&(
                              <span className="text-[8px] text-slate-500">+{shows.length-3} more</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Day detail panel */}
              <div className="xl:col-span-1">
                <div className="bg-slate-900/50 border border-white/8 rounded-3xl p-5 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
                  {!selectedDay ? (
                    <div className="text-center py-12">
                      <i className="fa-solid fa-calendar-day text-slate-700 text-4xl mb-3"></i>
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Select a date</p>
                      <p className="text-slate-600 text-xs mt-1">to see what's premiering</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-black text-white">
                            {new Date(year,month-1,selectedDay).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
                          </h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                            {selectedShows.length} premiere{selectedShows.length!==1?'s':''}
                          </p>
                        </div>
                        {selDateStr===today&&(
                          <span className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-[10px] font-black uppercase tracking-widest">
                            Today
                          </span>
                        )}
                      </div>
                      {selectedShows.length===0 ? (
                        <p className="text-slate-500 text-sm text-center py-8">No premieres on this date.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedShows.map(show=>(
                            <DayPanelCard key={show.id} show={show} {...cardProps}/>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

      </div>
      <Footer/>
    </div>
  )
}