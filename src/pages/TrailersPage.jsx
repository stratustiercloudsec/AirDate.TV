// src/pages/TrailersPage.jsx
// Upcoming TV Trailers — embedded YouTube players, grouped by month
// Only shows WITH trailers are displayed; affiliate networks prioritized

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'
import { API_BASE, SCOOP_MANIFEST_URL } from '@/config/aws'
import { tmdbDiscover, tmdbOnTheAir, tmdbShow } from '../utils/tmdb'
import { Footer }       from '@/components/layout/Footer'

const IMAGE_BASE = 'https://image.tmdb.org'

// Affiliate-priority network IDs — ordered by partnership value
// Apple TV+, Max/HBO, Disney+, Hulu, Paramount+, Peacock, STARZ, Netflix, Prime, Tubi
const AFFILIATE_NETWORK_IDS = [
  2552,  // Apple TV+
  3186,  // Max / HBO Max
  2739,  // Disney+
  453,   // Hulu
  4330,  // Paramount+
  3353,  // Peacock
  4406,  // STARZ
  213,   // Netflix
  1024,  // Prime Video
  2503,  // Tubi
]

// Affiliate display names for badge coloring
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

function getMonthRange(offset = 0) {
  const now  = new Date()
  const d    = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()
  return {
    gte:   `${year}-${String(month).padStart(2,'0')}-01`,
    lte:   `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`,
    label: d.toLocaleString('default', { month:'long', year:'numeric' }),
    key:   `${year}-${month}`,
    isCurrentMonth: offset === 0,
  }
}

function dedupById(shows) {
  const seen = new Set()
  return shows.filter(s => { if (!s.id||seen.has(s.id)) return false; seen.add(s.id); return true })
}
function mapTMDB(s) {
  return { id:s.id, name:s.name??s.original_name, poster_path:s.poster_path,
    backdrop_path:s.backdrop_path, first_air_date:s.first_air_date,
    vote_average:s.vote_average??0, overview:s.overview, network:'' }
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

// Sort shows by affiliate priority, then popularity
function sortByAffiliatePriority(shows) {
  const networkOrder = {
    'Apple TV+': 0, 'Max': 1, 'HBO Max': 1, 'HBO': 1,
    'Disney+': 2, 'Hulu': 3, 'Paramount+': 4, 'Showtime': 4,
    'Peacock': 5, 'Starz': 6, 'Netflix': 7, 'Prime Video': 8, 'Tubi TV': 9,
  }
  return [...shows].sort((a, b) => {
    const aOrder = Object.keys(networkOrder).find(k => (a.network||'').includes(k))
    const bOrder = Object.keys(networkOrder).find(k => (b.network||'').includes(k))
    const aRank  = aOrder != null ? networkOrder[aOrder] : 99
    const bRank  = bOrder != null ? networkOrder[bOrder] : 99
    if (aRank !== bRank) return aRank - bRank
    return (b.vote_average||0) - (a.vote_average||0)
  })
}

// Limit per-network to max 2 per section to prevent Netflix flooding
function capNetworkRepresentation(shows, maxPerNetwork = 2) {
  const counts = {}
  return shows.filter(s => {
    const key = s.network || 'unknown'
    counts[key] = (counts[key] || 0) + 1
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

  if (loading) return <div className="space-y-3">{Array.from({length:5}).map((_,i)=>(
    <div key={i} className="animate-pulse flex gap-3 p-3 rounded-xl">
      <div className="w-6 h-4 bg-slate-700 rounded"/><div className="w-12 h-12 bg-slate-700 rounded-lg flex-shrink-0"/>
      <div className="flex-1"><div className="h-3 bg-slate-700 rounded w-full mb-2"/><div className="h-2 bg-slate-700 rounded w-2/3"/></div>
    </div>
  ))}</div>

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
    const d = show.first_air_date
    if (!d) return 'TBA'
    try {
      const dt = new Date(d.includes('T') ? d : d+'T12:00:00')
      return isNaN(dt.getTime()) ? 'TBA' : dt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    } catch { return 'TBA' }
  })()

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
            {show.network && meta && (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30`}}>
                {show.network}
              </span>
            )}
            {show.network && !meta && (
              <span className="text-xs font-medium text-slate-400">{show.network}</span>
            )}
            <span className="text-slate-400 text-xs">Premieres {dateLabel}</span>
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
    const d = show.first_air_date
    if (!d) return 'TBA'
    try {
      const dt = new Date(d.includes('T') ? d : d+'T12:00:00')
      return isNaN(dt.getTime()) ? 'TBA' : dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})
    } catch { return 'TBA' }
  })()

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
                style={{background: meta.bg, color: meta.color}}>
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
  const [readyShows, setReadyShows] = useState([]) // only shows WITH trailers
  const [loading, setLoading]       = useState(true)
  const [fetching, setFetching]     = useState(false)
  const [progress, setProgress]     = useState(0)
  const [total, setTotal]           = useState(0)

  useEffect(() => {
    const { gte, lte } = monthRange
    const dateFilter = { 'air_date.gte':gte, 'air_date.lte':lte, sort_by:'popularity.desc' }

    // Fetch per-network to guarantee affiliate coverage; 3 per network max
    Promise.all(
      AFFILIATE_NETWORK_IDS.map(nid =>
        tmdbDiscover({...dateFilter, with_networks: String(nid), page:1})
          .then(d => (d.results||[]).slice(0,3).map(mapTMDB))
          .catch(()=>[])
      )
    ).then(async perNetwork => {
      // Merge + dedup
      const merged = dedupById(perNetwork.flat())

      // Enrich with real network names
      const enriched = await Promise.all(merged.map(s =>
        tmdbShow(s.id).then(d => {
          const detail = (d && typeof d.json === 'function') ? null : d
          return { ...s, network: detail?.networks?.[0]?.name || s.network || '' }
        }).catch(() => s)
      ))

      // Sort by affiliate priority
      const sorted = sortByAffiliatePriority(enriched)
      // Cap to 2 per network
      const capped = capNetworkRepresentation(sorted, 2)

      setLoading(false)
      setTotal(capped.length)
      setFetching(true)

      // Fetch trailers — only keep shows that have one
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = token

      const withTrailers = []

      for (let i = 0; i < capped.length; i += 3) {
        const batch = capped.slice(i, i + 3)
        await Promise.all(batch.map(async show => {
          try {
            const res  = await fetch(`${API_BASE}/get-trailer`, {
              method: 'POST', headers,
              body: JSON.stringify({ tmdb_id: String(show.id), title: show.name }),
            })
            const data = await res.json()
            const videoId = extractVideoId(data.trailer_url)
            if (videoId) {
              withTrailers.push({ ...show, videoId })
              // Sort by affiliate priority each time we add
              withTrailers.sort((a, b) => {
                const networkOrder = {
                  'Apple TV+':0,'Max':1,'HBO Max':1,'HBO':1,'Disney+':2,'Hulu':3,
                  'Paramount+':4,'Showtime':4,'Peacock':5,'Starz':6,'Netflix':7,'Prime Video':8,'Tubi TV':9
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
  const rest      = readyShows.slice(1)

  return (
    <section className="mb-16">
      {/* Featured hero */}
      {featured && (
        <FeaturedTrailerHero
          show={featured}
          videoId={featured.videoId}
          monthLabel={monthRange.label}
        />
      )}

      {/* Month header */}
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
          {/* Loading placeholders while fetching */}
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
                Official trailers for TV premieres — current &amp; next 3 months
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {Object.entries(NETWORK_META).slice(0,8).map(([name, meta]) => (
              <span key={name} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
                style={{background: meta.bg, color: meta.color, border:`1px solid ${meta.color}30`}}>
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