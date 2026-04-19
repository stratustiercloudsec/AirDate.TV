// src/pages/HomePage.jsx
// API calls match main.js v112.25 exactly

import { useEffect, useState } from 'react'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'
import { API_BASE } from '@/config/aws'
import { usePoster } from '@/utils/poster'

const TMDB_KEY = '9e7202516e78494f2b18ec86d29a4309'
const TMDB     = 'https://api.themoviedb.org/3'

const NEXT_MONTH_NETWORK_IDS = [
  213,1024,453,2739,2552,3353,4330,2503,4406,3186,
  6,16,2,19,3436,71,49,88,174,67,528,
].join('|')

// Hardcoded chips — matches setupFilterChips() in main.js
const CHIPS = [
  'Tyler Perry Produced Shows 2026','Man on Fire','Taylor Sheridan',
  'Netflix April 2026','HBO Max Premieres','Prime Video 2026',
]

const NETWORKS = {
  Streaming: ['Netflix','Hulu','Disney+','Paramount+','HBO Max','Apple TV+','Prime Video','Peacock','STARZ','BET+','Tubi','YouTube'],
  Broadcast: ['CBS','NBC','ABC','FOX','The CW'],
  Cable:     ['FX','AMC','USA Network','Bravo','Syfy','Freeform','OWN','Comedy Central','BET'],
}

function startOfWeek() {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay())
  return d.toISOString().split('T')[0]
}
function endOfWeek() {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()+6)
  return d.toISOString().split('T')[0]
}

async function enrichWithNetwork(shows) {
  const details = await Promise.all(shows.map(s =>
    fetch(`${TMDB}/tv/${s.id}?api_key=${TMDB_KEY}&language=en-US`)
      .then(r => r.ok ? r.json() : null).catch(() => null)
  ))
  return shows.map((s, i) => ({
    ...s,
    network: s.network || details[i]?.networks?.[0]?.name || '',
  }))
}
function mapTMDB(s) {
  return { id:s.id, name:s.name??s.original_name, poster_path:s.poster_path,
    backdrop_path:s.backdrop_path, first_air_date:s.first_air_date,
    vote_average:s.vote_average, overview:s.overview, network:s.network||'' }
}

function parseGateway(gateway) {
  return gateway.body
    ? (typeof gateway.body==='string' ? JSON.parse(gateway.body) : gateway.body)
    : gateway
}

function SkeletonCard() {
  return <div className="animate-pulse"><div className="bg-slate-700/50 rounded-2xl aspect-[2/3] mb-3"></div><div className="h-4 bg-slate-700/50 rounded w-3/4 mb-2"></div><div className="h-3 bg-slate-700/50 rounded w-1/2"></div></div>
}

function ShowCard({ show, isTracked, onTrack, atLimit, isAuthenticated, rank }) {
  const tracked = isTracked(show.id)
  const posterImg = usePoster(show.poster_path, show.name, 342)
  return (
    <div className="group relative cursor-pointer" onClick={()=>window.location.href=`/details/${show.id}`}>
      {rank!=null&&<span className="absolute -top-2 -left-2 z-10 w-7 h-7 bg-yellow-400 text-slate-950 text-xs font-black rounded-full flex items-center justify-center shadow-lg">{rank}</span>}
      <div className="relative overflow-hidden rounded-2xl aspect-[2/3] mb-3 bg-slate-800">
        <img {...posterImg} alt={show.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy"/>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"/>
        {isAuthenticated&&(
          <button onClick={e=>{e.stopPropagation();onTrack(show)}} disabled={!tracked&&atLimit}
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all opacity-0 group-hover:opacity-100 whitespace-nowrap
              ${tracked?'bg-cyan-500 text-slate-950':atLimit?'bg-slate-700 text-slate-400 cursor-not-allowed':'bg-slate-900/90 text-white border border-white/20 hover:bg-cyan-500 hover:text-slate-950'}`}>
            {tracked?'✓ Tracking':'+ Track'}
          </button>
        )}
      </div>
      <h3 className="text-sm font-bold text-white leading-snug mb-1 line-clamp-2">{show.name}</h3>
      {show.network&&<p className="text-xs font-medium text-slate-400 mb-0.5">{show.network}</p>}
      {show.first_air_date&&<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{new Date(show.first_air_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>}
    </div>
  )
}

function SectionHeader({ icon, iconColor, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
      <i className={`${icon} ${iconColor} text-lg`}></i>
      <h2 className="text-xl font-black text-white tracking-tighter uppercase">{title}</h2>
      {subtitle&&<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{subtitle}</span>}
    </div>
  )
}

function ShowGrid({ shows, loading, skeletonCount=5, rank=false, ...cardProps }) {
  const grid='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5'
  if(loading) return <div className={grid}>{Array.from({length:skeletonCount}).map((_,i)=><SkeletonCard key={i}/>)}</div>
  return <div className={grid}>{shows.map((s,i)=><ShowCard key={s.id} show={s} rank={rank?i+1:undefined} {...cardProps}/>)}</div>
}

export function HomePage() {
  const { token, isAuthenticated, isPremium } = useAuth()
  const { watchlist, toggleWatchlist, isTracked, atLimit } = useWatchlist()

  const [query, setQuery]             = useState('')
  const [network, setNetwork]         = useState('All')
  const [searchResults, setResults]   = useState([])
  const [resultsHeader, setHeader]    = useState('Search Results')
  const [resultsCount, setCount]      = useState('')
  const [searching, setSearching]     = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(1)

  const [trending,  setTrending]   = useState([])
  const [top10,     setTop10]      = useState([])
  const [thisWeek,  setThisWeek]   = useState([])
  const [nextMonth, setNextMonth]  = useState([])
  const [featured,  setFeatured]   = useState([])
  const [leaderboard, setLeaderboard] = useState([])

  const [loadTrend, setLoadTrend] = useState(true)
  const [loadTop10, setLoadTop10] = useState(true)
  const [loadWeek,  setLoadWeek]  = useState(true)
  const [loadMonth, setLoadMonth] = useState(true)

  const [modal, setModal]             = useState(false)
  const [modalTitle, setModalTitle]   = useState('')
  const [modalContent, setModalContent] = useState('')
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    const now = new Date()
    const nmYear  = new Date(now.getFullYear(), now.getMonth()+1, 1).getFullYear()
    const nmMonth = new Date(now.getFullYear(), now.getMonth()+1, 1).getMonth()+1

    // TMDB Trending — /trending/tv/week
    setLoadTrend(true)
    fetch(`${TMDB}/trending/tv/week?api_key=${TMDB_KEY}&language=en-US`)
      .then(r=>r.json()).then(async d=>{
        const shows = (d.results||[]).slice(0,10).map(mapTMDB)
        setTrending(await enrichWithNetwork(shows))
      }).catch(()=>{}).finally(()=>setLoadTrend(false))

    // TMDB Popular — /tv/popular (Top 10)
    setLoadTop10(true)
    fetch(`${TMDB}/tv/popular?api_key=${TMDB_KEY}&language=en-US&page=1`)
      .then(r=>r.json()).then(async d=>{
        const shows = (d.results||[]).slice(0,10).map(mapTMDB)
        setTop10(await enrichWithNetwork(shows))
      }).catch(()=>{}).finally(()=>setLoadTop10(false))

    // TMDB This Week — /discover/tv with week date range
    setLoadWeek(true)
    fetch(`${TMDB}/discover/tv?api_key=${TMDB_KEY}&language=en-US&sort_by=popularity.desc`+
      `&first_air_date.gte=${startOfWeek()}&first_air_date.lte=${endOfWeek()}&with_original_language=en&page=1`)
      .then(r=>r.json()).then(async d=>{
        const shows = (d.results||[]).slice(0,20).map(mapTMDB)
        setThisWeek(await enrichWithNetwork(shows))
      }).catch(()=>{}).finally(()=>setLoadWeek(false))

    // TMDB Next Month — /discover/tv with network IDs
    setLoadMonth(true)
    const lastDay = new Date(nmYear, nmMonth, 0).getDate()
    const gte = `${nmYear}-${String(nmMonth).padStart(2,'0')}-01`
    const lte = `${nmYear}-${String(nmMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    fetch(`${TMDB}/discover/tv?api_key=${TMDB_KEY}&language=en-US&sort_by=popularity.desc`+
      `&with_original_language=en&with_networks=${encodeURIComponent(NEXT_MONTH_NETWORK_IDS)}`+
      `&first_air_date.gte=${gte}&first_air_date.lte=${lte}&page=1`)
      .then(r=>r.json()).then(async d=>{
        const shows = (d.results||[]).slice(0,20).map(mapTMDB)
        setNextMonth(await enrichWithNetwork(shows))
      }).catch(()=>{}).finally(()=>setLoadMonth(false))

    // Sidebar — /get-premieres returns featured (Confirmed Premieres) + leaderboard (Hype Ranking)
    fetch(`${API_BASE}/get-premieres`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ page:1, per_page:100 }),
    }).then(r=>r.json()).then(gw=>{
      const d = parseGateway(gw)
      if (d?.featured)    setFeatured(d.featured)
      if (d?.leaderboard) setLeaderboard(d.leaderboard)
    }).catch(()=>{})
  }, [])

  async function handleSearch(overrideQuery, overridePage=1) {
    const q = overrideQuery ?? query
    if(!q.trim()) return
    setSearching(true); setShowResults(true)
    try {
      let url = `${TMDB}/search/tv?api_key=${TMDB_KEY}&language=en-US&query=${encodeURIComponent(q)}&page=${overridePage}`
      const res  = await fetch(url)
      const data = await res.json()
      const mapped = (data.results ?? []).map(mapTMDB)
      setResults(mapped)
      setHeader(`Results for "${q}"`)
      setCount(data.total_results ? `${data.total_results.toLocaleString()} results` : '')
      setTotalPages(data.total_pages ?? 1)
      setPage(overridePage)
    } catch(e){ console.error('Search failed',e) }
    finally { setSearching(false) }
  }

  function handleTrack(show) {
    const r = toggleWatchlist(show)
    if(r?.error==='FREEMIUM_LIMIT') window.location.href='/upgrade'
  }

  async function openRecap(show) {
    setModalTitle(`${show.name} — AI Recap`); setModalContent(''); setModal(true); setModalLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/generate-recap`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ series_title:show.name, tmdb_id:show.id }),
      })
      const data = await res.json()
      setModalContent(data.recap ?? data.body ?? 'No recap available.')
    } catch { setModalContent('Failed to load recap.') }
    finally { setModalLoading(false) }
  }

  const cardProps = { isTracked, onTrack:handleTrack, atLimit, isAuthenticated }
  const nextMonthLabel = new Date(new Date().getFullYear(), new Date().getMonth()+1, 1)
    .toLocaleString('default',{month:'long',year:'numeric'})

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">

      {isAuthenticated && !isPremium && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-cyan-500/20 px-6 py-2.5">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-bolt text-cyan-400 text-xs flex-shrink-0"></i>
              <p className="text-slate-200 text-xs font-bold"><span className="text-white">You're on the Free Plan</span><span className="mx-2 text-slate-400">·</span>Track unlimited shows, get early alerts, and unlock The Scoop.</p>
            </div>
            <a href="/upgrade" className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap">
              <i className="fa-solid fa-bolt text-xs"></i> Upgrade — $4.99/mo
            </a>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto px-6 pt-36 pb-6">

        <header className="mb-10">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-2 border border-white/10 mb-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 p-1">
              <select value={network} onChange={e=>setNetwork(e.target.value)}
                className="w-full sm:w-44 p-4 bg-slate-900/60 border-none text-white text-sm font-bold rounded-xl appearance-none cursor-pointer">
                <option value="All">All Networks</option>
                {Object.entries(NETWORKS).map(([group,nets])=>(
                  <optgroup key={group} label={group}>{nets.map(n=><option key={n} value={n}>{n}</option>)}</optgroup>
                ))}
              </select>
              <input type="text" value={query} onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleSearch()}
                placeholder="Try 'Netflix Series Premiering in April 2026' or 'Taylor Sheridan'"
                className="flex-1 p-4 bg-transparent border-none text-white text-base focus:ring-0 focus:outline-none min-w-0"/>
              <button onClick={()=>showResults?(setShowResults(false),setQuery(''),setResults([])):handleSearch()}
                className="w-full sm:w-auto bg-cyan-500 text-slate-950 font-black px-8 py-4 rounded-xl shadow-lg hover:bg-cyan-400 transition-colors whitespace-nowrap">
                {showResults?'Clear':'Get the Date'}
              </button>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Trending Intelligence:</span>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map(chip=>(
                <button key={chip} onClick={()=>{setQuery(chip);handleSearch(chip)}}
                  className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700 border border-white/10 hover:border-cyan-500/30 text-slate-200 hover:text-cyan-400 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all">
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </header>

        {isAuthenticated && watchlist.length>0 && (
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-pink-500/10 rounded-lg"><i className="fa-solid fa-heart text-pink-500"></i></div>
              <h2 className="text-lg font-bold text-white tracking-tight">The Pulse: Your Watchlist</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchlist.map(show=>(
                <div key={show.id} className="flex items-center gap-4 bg-slate-800/40 border border-white/5 rounded-2xl p-4 hover:border-cyan-500/20 transition-all">
                  <img {...usePoster(show.poster_path, show.name, 92)} alt={show.name} className="w-12 h-16 object-cover rounded-xl flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{show.name}</h3>
                    {show.first_air_date&&<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{new Date(show.first_air_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>}
                  </div>
                  <button onClick={()=>handleTrack(show)} className="text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"><i className="fa-solid fa-xmark"></i></button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-10">
          <div className="lg:col-span-3 xl:col-span-4">

            {showResults && (
              <div>
                <div className="mb-5">
                  <h2 className="text-2xl font-black text-white mb-1">{resultsHeader}</h2>
                  {resultsCount&&<p className="text-slate-400 text-sm">{resultsCount}</p>}
                </div>
                {searching
                  ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">{Array.from({length:6}).map((_,i)=><SkeletonCard key={i}/>)}</div>
                  : <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 mb-8">
                        {searchResults.map(s=><ShowCard key={s.id} show={s} {...cardProps}/>)}
                      </div>
                      {totalPages>1&&(
                        <div className="flex items-center justify-center gap-2 mt-6 mb-10">
                          <button onClick={()=>handleSearch(query,page-1)} disabled={page===1} className="px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-xs font-bold text-slate-200 hover:border-cyan-500/30 disabled:opacity-30 transition-all">← Prev</button>
                          <span className="text-xs font-bold text-slate-400 px-3">Page {page} of {totalPages}</span>
                          <button onClick={()=>handleSearch(query,page+1)} disabled={page===totalPages} className="px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-xs font-bold text-slate-200 hover:border-cyan-500/30 disabled:opacity-30 transition-all">Next →</button>
                        </div>
                      )}
                    </>
                }
              </div>
            )}

            {!showResults && (
              <div className="flex flex-col gap-14">
                <section>
                  <SectionHeader icon="fa-solid fa-fire" iconColor="text-orange-400" title="Trending Shows" subtitle="Most Tracked on AirDate"/>
                  <ShowGrid shows={trending} loading={loadTrend} skeletonCount={5} {...cardProps}/>
                </section>
                <section>
                  <SectionHeader icon="fa-solid fa-ranking-star" iconColor="text-yellow-400" title="Top 10 TV Shows This Week" subtitle="Powered by TMDB"/>
                  <ShowGrid shows={top10} loading={loadTop10} skeletonCount={5} rank={true} {...cardProps}/>
                </section>
                <section>
                  <SectionHeader icon="fa-solid fa-calendar-week" iconColor="text-cyan-400" title="Premiering This Week"/>
                  <ShowGrid shows={thisWeek} loading={loadWeek} skeletonCount={3} {...cardProps}/>
                </section>
                <section>
                  <SectionHeader icon="fa-solid fa-calendar-plus" iconColor="text-purple-400" title={`Premiering ${nextMonthLabel}`}/>
                  <ShowGrid shows={nextMonth} loading={loadMonth} skeletonCount={3} {...cardProps}/>
                </section>
              </div>
            )}
          </div>

          <aside className="space-y-8">
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20"><i className="fa-solid fa-calendar-check text-cyan-400 text-lg"></i></div>
                <div><h2 className="text-sm font-black uppercase tracking-wide text-cyan-400 mb-0.5">Confirmed Premieres</h2><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Upcoming Series 2026</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {featured.length===0
                  ? Array.from({length:4}).map((_,i)=><div key={i} className="animate-pulse bg-slate-700/50 rounded-2xl aspect-[2/3]"></div>)
                  : featured.slice(0,8).map(s=>(
                      <div key={s.id} className="relative overflow-hidden rounded-2xl aspect-[2/3] cursor-pointer group" onClick={()=>window.location.href=`/details/${s.id}`}>
                        <img {...usePoster(s.poster_path||s.poster, s.title||s.name, 185)} alt={s.title||s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"/>
                        <div className="absolute bottom-0 left-0 right-0 p-2"><p className="text-white text-[10px] font-black leading-tight line-clamp-2">{s.title||s.name}</p></div>
                      </div>
                    ))
                }
              </div>
            </div>

            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20"><i className="fa-solid fa-fire text-pink-400 text-lg"></i></div>
                <div><h2 className="text-sm font-black uppercase tracking-wide text-pink-400 mb-0.5">Global Hype Ranking</h2><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Top Tracked Series</p></div>
              </div>
              <div className="space-y-3">
                {leaderboard.length===0
                  ? Array.from({length:5}).map((_,i)=>(
                      <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-slate-800/40 rounded-2xl">
                        <div className="w-8 h-8 bg-slate-700 rounded-xl"></div>
                        <div className="flex-1"><div className="h-3 bg-slate-700 rounded w-3/4 mb-1"></div><div className="h-2 bg-slate-700 rounded w-1/2"></div></div>
                      </div>
                    ))
                  : leaderboard.slice(0,10).map((s,idx)=>(
                      <div key={s.id??idx} className="flex items-center gap-3 p-3 bg-slate-800/40 border border-white/5 rounded-2xl hover:border-pink-500/20 transition-all cursor-pointer" onClick={()=>window.location.href=`/details/${s.id}`}>
                        <span className="w-6 text-center text-[10px] font-black text-slate-400">{idx+1}</span>
                        <img {...usePoster(s.poster_path||s.poster, s.title||s.name, 92)} alt={s.title||s.name} className="w-8 h-10 object-cover rounded-lg flex-shrink-0"/>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{s.title||s.name}</p>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-pink-400 mt-0.5">{s.hype?`${Number(s.hype).toLocaleString()} tracking`:s.tracked_count?`${s.tracked_count.toLocaleString()} tracking`:'Trending'}</p>
                        </div>
                      </div>
                    ))
                }
              </div>
            </div>
          </aside>
        </div>

        <footer className="w-full py-6 mt-16 border-t border-white/10 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 px-2 mb-2">
            <a href="/" className="flex flex-col items-center md:items-start flex-none">
              <img src="/assets/images/official-airdate-logo.png" alt="AirDate" className="h-10 w-auto object-contain mb-1"/>
              <p className="text-slate-400 text-[9px] font-normal tracking-wider lowercase opacity-70">track tv premieres before they trend.</p>
            </a>
            <div className="flex flex-wrap gap-x-8 gap-y-2 justify-center md:justify-end">
              {[['Trending','/trending'],['Premieres','/premieres'],['The Scoop','/scoop'],['My Pulse','/account']].map(([l,h])=>(
                <a key={h} href={h} className="hover:text-cyan-400 transition-colors">{l}</a>
              ))}
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-x-6 gap-y-4 px-2 border-t border-white/5 pt-3">
            <div className="flex flex-wrap items-center gap-x-2 text-center md:text-left text-slate-400/80">
              <span className="font-bold text-slate-400">© 2026 AirDate.</span><span>All Rights Reserved.</span>
              <span className="mx-1 opacity-20">|</span><span>Metadata Orchestration Platform</span>
              <span className="mx-2 opacity-20 text-white">|</span>
              <a href="https://stratustierlabs.com" target="_blank" rel="noreferrer" className="group">
                ENGINEERED BY <span className="text-white font-black group-hover:text-cyan-400 transition-colors">STRATUSTIER</span>{' '}<span className="text-cyan-400">INNOVATION LABS</span>
              </a>
            </div>
            <div className="flex gap-8 justify-center md:justify-end">
              {[['Vision','/vision'],['Terms','/terms'],['Privacy','/privacy'],['Contact','/contact']].map(([l,h])=>(
                <a key={h} href={h} className="hover:text-cyan-400 transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </footer>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="bg-slate-900 border border-white/20 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative flex flex-col max-h-[85vh]">
            <button onClick={()=>setModal(false)} className="absolute top-6 right-8 text-white/50 hover:text-white text-3xl cursor-pointer transition-colors">×</button>
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <div className="p-2 bg-cyan-500/20 rounded-xl"><i className="fa-solid fa-book-open text-cyan-400"></i></div>
              <h3 className="text-xl font-bold text-white tracking-tight">{modalTitle}</h3>
            </div>
            <div className="text-slate-200 leading-relaxed text-base font-medium overflow-y-auto">
              {modalLoading
                ? <div className="flex items-center gap-3 py-8 justify-center"><div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div><span className="text-slate-400 text-sm">Generating recap...</span></div>
                : <p>{modalContent}</p>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}