// src/pages/HomePage.jsx
// API calls match main.js v112.25 exactly

import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate }  from 'react-router-dom'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'
import { API_BASE }     from '@/config/aws'
import { usePoster }    from '@/utils/poster'
import { tmdbFetch, tmdbShow, tmdbContentRatings, tmdbSearchTV, tmdbTrending, tmdbPopular, tmdbDiscover, tmdbOnTheAir, fetchCuratedPremieres } from '../utils/tmdb'
import { useCurated } from '@/context/CuratedContext'
import { Footer }       from '@/components/layout/Footer'
import { SCOOP_MANIFEST_URL } from '@/config/aws'
import RecommendedForYou from '../components/RecommendedForYou'
import PredictionBadge from '../components/PredictionBadge'

const IMAGE_BASE = 'https://image.tmdb.org'


const NEXT_MONTH_NETWORK_IDS = [
  213,   // Netflix
  2552, 350, 3411, // Apple TV+
  4330,  // Paramount+
  3436,  // BET+
  3353, 3076, // Peacock
  3186, 49, 1565, // Max / HBO
  4406, 318, // STARZ
  2503,  // Tubi
  1024, 1025, // Prime Video
  453,   // Hulu
  2739,  // Disney+
  4, 34, // MGM+/Epix
  71,    // The CW
  104,   // TV One
  81,    // BBC America
  6,16,2,19,88,174,67,
].join('|')

// Affiliate partner network IDs — each gets its own fetch to guarantee coverage
const AFFILIATE_NETWORK_IDS = [
  213,        // Netflix
  2552, 350,  // Apple TV+
  4330,       // Paramount+
  3436,       // BET+
  3353,       // Peacock
  3186, 49,   // Max/HBO
  4406, 318,  // STARZ
  2503,       // Tubi
  1024,       // Prime Video
  453,        // Hulu
  2739,       // Disney+
  4,          // MGM+/Epix
  71,         // The CW
  104,        // TV One
  81,         // BBC America
  6, 16, 2, 19, 88, 174, 67,  // Broadcast + Cable
]

// Foreign/non-English network names to exclude
const EXCLUDED_NETWORK_NAMES = new Set([
  'youku','iqiyi','bilibili','mango tv','tencent video','youku tudou',
  'wavve','tving','coupang play','kbs','mbc','sbs','tvn','jtbc','ocn',
  'ena','channel a','mbn','tv chosun','sky showtime',
  'kanal d','show tv','fox turkey','star tv','tv8','atv',
  'viutv','tvb','now tv','mewatch','mediacorp',
  'globoplay','univision','telemundo','televisa',
  'voot','zee5','sonyliv','hotstar','sun nxt','aha',
])
function isEnglishShow(show) {
  // original_language is always present from TMDB discover/trending results
  const lang = show.original_language || ''
  if (lang && lang !== 'en') return false
  // After enrichment, also check network name
  const net = (show.network || '').toLowerCase()
  if (net && EXCLUDED_NETWORK_NAMES.has(net)) return false
  if (net && ['youku','iqiyi','bilibili','wavve','tving','tencent','viutv','hotstar'].some(k => net.includes(k))) return false
  return true
}
// Only include shows that premiered in 2015 or later (blocks legacy catalog bleed)
function isRecentShow(show) {
  const d = show.first_air_date || show.premiereDate || ''
  if (!d) return true
  const year = parseInt(d.slice(0,4), 10)
  return isNaN(year) || year >= 2015
}

const CHIPS = [
  'Premiering Today',
  'Taylor Sheridan',
  'True Crime Documentaries 2026',
  'Award Shows 2026',
  'Reality TV 2026',
  'Comedy 2026',
  'HBO Premieres 2026',
  'Power Universe',
  'Shonda Rhimes Produced Series'
]

const NETWORKS = {
  Streaming: ['Netflix','Hulu','Disney+','Paramount+','Showtime','Max','HBO Max','Apple TV+','Prime Video','Peacock','STARZ','BET+','Tubi','YouTube','Turnstr+','MGM+'],
  Broadcast:  ['CBS','NBC','ABC','FOX','The CW'],
  Cable:      ['HBO','FX','AMC','USA Network','Bravo','Syfy','Freeform','OWN','Comedy Central','BET','Showtime','ESPN'],
}

const CAT_COLORS = {
  premieres:     '#22d3ee',
  renewals:      '#4ade80',
  cancellations: '#f87171',
  casting:       '#c084fc',
  production:    '#fb923c',
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
    Promise.all([
      tmdbShow(s.id)
        .then(r => (r && typeof r.json === 'function') ? r.json() : r).catch(() => null),
      tmdbContentRatings(s.id)
        .then(r => (r && typeof r.json === 'function') ? r.json() : r).catch(() => null),
    ])
  ))
  return shows.map((s, i) => {
    const [detail, ratings] = details[i]
    const usRating = ratings?.results?.find(r => r.iso_3166_1 === 'US')?.rating || ''
    return {
      ...s,
      network:        s.network || detail?.networks?.[0]?.name || '',
      content_rating: usRating,
      poster_path:    (() => {
        // Priority: latest season poster → show-level poster → original
        if (detail?.seasons?.length) {
          const valid = detail.seasons.filter(s => s.season_number > 0 && s.poster_path)
          if (valid.length) return valid[valid.length - 1].poster_path
        }
        return detail?.poster_path || s.poster_path || null
      })(),
      backdrop_path:  s.backdrop_path || detail?.backdrop_path || null,
      _detail:        detail || null,
    }
  })
}

function dedupById(shows) {
  const seen = new Set()
  return shows.filter(s => {
    const key = s.id
      ? `${s.id}-${s.season_number ?? ''}`
      : (s.name || s.title || '')
    if (!key || seen.has(key)) return false
    seen.add(key); return true
  })
}
function mapTMDB(s) {
  return { id:s.id, name:s.name??s.original_name, poster_path:s.poster_path,
    backdrop_path:s.backdrop_path, first_air_date:s.first_air_date,
    vote_average:s.vote_average, overview:s.overview, network:s.network||'' }
}
function normalizeShow(s) {
  return {
    id:             s.id,
    name:           s.seriesTitle || s.title || s.name || '',
    series_title:   s.seriesTitle || s.title || s.name || '',
    poster_path:    s.poster_path || null,
    poster:         s.poster || null,
    first_air_date: s.premiereDate || s.premiere || s.first_air_date || null,
    network:        s.network || '',
    overview:       s.description || s.overview || '',
    vote_average:   s.user_score ? s.user_score / 10 : (s.vote_average || 0),
    backdrop_path:  s.backdrop_path || null,
    season_number:  s.season_number || null,
    content_rating: s.content_rating || '',
  }
}

function detailUrl(show) {
  const base = `/details/${show.id}`
  return show.season_number ? `${base}?season=${show.season_number}` : base
}

function parseGateway(gateway) {
  return gateway.body
    ? (typeof gateway.body==='string' ? JSON.parse(gateway.body) : gateway.body)
    : gateway
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({length:m+1}, (_,i) => Array.from({length:n+1}, (_,j) => i===0?j:j===0?i:0))
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])
  return dp[m][n]
}
function fuzzyScore(query, name) {
  const q = query.toLowerCase().trim()
  const n = name.toLowerCase()
  if (n === q) return 100
  if (n.startsWith(q)) return 90
  if (n.includes(q)) return 75
  const words = n.split(/\s+/)
  if (words.some(w => w.startsWith(q))) return 65
  const dist = levenshtein(q, words[0] || n)
  const maxLen = Math.max(q.length, (words[0]||n).length)
  const similarity = 1 - dist/maxLen
  return similarity > 0.6 ? Math.round(similarity*50) : 0
}

// ─── Scoop Sidebar ────────────────────────────────────────────────────────────
function ScoopSidebar() {
  const navigate = useNavigate()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${SCOOP_MANIFEST_URL}?t=${Date.now()}`)
      .then(r => r.json())
      .then(d => {
        const items = (d.items || [])
          .filter(i => i.story_hash && i.headline)
          .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))
          .slice(0, 5)
        setStories(items)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-3">
      {Array.from({length: 5}).map((_, i) => (
        <div key={i} className="animate-pulse flex gap-3 p-3 rounded-xl">
          <div className="w-6 h-4 bg-slate-700 rounded"/>
          <div className="w-12 h-12 bg-slate-700 rounded-lg flex-shrink-0"/>
          <div className="flex-1">
            <div className="h-3 bg-slate-700 rounded w-full mb-2"/>
            <div className="h-2 bg-slate-700 rounded w-2/3"/>
          </div>
        </div>
      ))}
    </div>
  )

  if (!stories.length) return (
    <div className="text-center py-8 text-slate-200 text-xs">
      <i className="fa-solid fa-satellite-dish text-2xl mb-2 block"/>
      No stories yet — check back soon.
    </div>
  )

  return (
    <div className="space-y-1">
      {stories.map((item, i) => {
        const color  = CAT_COLORS[item.category] || '#22d3ee'
        const poster = item.image_url || item.poster_url || item.poster || null
        return (
          <article
            key={item.story_hash || i}
            onClick={() => navigate(`/scoop/${item.story_hash}`)}
            className="group flex gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/5"
          >
            <span
              className="text-xl font-black text-slate-700 w-6 shrink-0 leading-tight mt-0.5"
              style={{fontVariantNumeric: 'tabular-nums'}}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            {poster && (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={poster}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span
                className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 mb-1"
                style={{background: `${color}20`, color, border: `1px solid ${color}30`}}
              >
                {item.category || 'news'}
              </span>
              <h4 className="text-white text-xs font-bold leading-snug line-clamp-2 group-hover:text-cyan-400 transition-colors">
                {item.headline}
              </h4>
            </div>
          </article>
        )
      })}
      <button
        onClick={() => navigate('/scoop')}
        className="w-full mt-2 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl transition-all"
      >
        View All Stories →
      </button>
    </div>
  )
}

// ─── Search components ────────────────────────────────────────────────────────
function SuggestionItem({ show, query, onClick }) {
  const isExact = (show.name||'').toLowerCase().startsWith(query.toLowerCase().trim())
  const year    = show.first_air_date ? show.first_air_date.split('-')[0] : ''
  const poster  = show.poster_path ? `${IMAGE_BASE}/t/p/w92${show.poster_path}` : null
  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/60 transition-colors text-left group"
      onMouseDown={e => { e.preventDefault(); onClick(show) }}
    >
      <div className="w-8 h-11 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
        {poster
          ? <img src={poster} onError={e => { e.currentTarget.style.display="none" }} alt={show.name} className="w-full h-full object-cover"/>
          : <div className="w-full h-full flex items-center justify-center text-slate-200 text-xs font-black">{(show.name||'?')[0].toUpperCase()}</div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{show.name}</p>
        {year && <p className="text-[10px] text-slate-200 font-bold">{year}</p>}
      </div>
      {isExact && (
        <span className="flex-shrink-0 px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 text-[9px] font-black uppercase tracking-widest">EXACT</span>
      )}
    </button>
  )
}

function SearchBar({ query, setQuery, network, setNetwork, onSearch, onClear, showResults }) {
  const [suggestions, setSuggestions] = useState([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [activeIdx,   setActiveIdx]   = useState(-1)
  const debounceRef = useRef(null)
  const inputRef    = useRef(null)
  const wrapRef     = useRef(null)

  const fetchSuggestions = useCallback(async (q) => {
    if (q.trim().length < 2) { setSuggestions([]); return }
    try {
      const raw  = await tmdbSearchTV(encodeURIComponent(q), 1)
      const data = (raw && typeof raw.json === 'function') ? await raw.json() : raw
      const results = (data.results || []).slice(0, 8)
      results.sort((a,b) => fuzzyScore(q,b.name||'') - fuzzyScore(q,a.name||''))
      setSuggestions(results)
      setShowSuggest(results.length > 0)
    } catch(e) { console.error('Suggestions failed', e); setSuggestions([]) }
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    setActiveIdx(-1)
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setSuggestions([]); setShowSuggest(false); return }
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 180)
  }

  function handleKeyDown(e) {
    if (!showSuggest || !suggestions.length) {
      if (e.key === 'Enter') { setShowSuggest(false); onSearch() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i+1, suggestions.length-1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i-1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && suggestions[activeIdx]) { selectSuggestion(suggestions[activeIdx]) }
      else { setShowSuggest(false); onSearch() }
    }
    else if (e.key === 'Escape') { setShowSuggest(false); setActiveIdx(-1) }
  }

  function selectSuggestion(show) {
    setQuery(show.name); setSuggestions([]); setShowSuggest(false); setActiveIdx(-1)
    window.location.href = `/details/${show.id}`
  }

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setShowSuggest(false); setActiveIdx(-1) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} className="relative">
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-2 border border-white/10 mb-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 p-1">
          <select value={network} onChange={e => setNetwork(e.target.value)}
            className="w-full sm:w-44 p-4 bg-slate-900/60 border-none text-white text-sm font-bold rounded-xl appearance-none cursor-pointer">
            <option value="All">All Networks</option>
            {Object.entries(NETWORKS).map(([group, nets]) => (
              <optgroup key={group} label={group}>
                {nets.map(n => <option key={n} value={n}>{n}</option>)}
              </optgroup>
            ))}
          </select>
          <input ref={inputRef} type="text" value={query} onChange={handleChange} onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
            placeholder="Try 'Netflix Series Premiering in April 2026' or 'Taylor Sheridan'"
            className="flex-1 p-4 bg-transparent border-none text-white text-base focus:ring-0 focus:outline-none min-w-0"
            autoComplete="off"/>
          <button
            onClick={() => showResults ? (onClear(), setSuggestions([]), setShowSuggest(false)) : (setShowSuggest(false), onSearch())}
            className="w-full sm:w-auto bg-cyan-500 text-slate-950 font-black px-8 py-4 rounded-xl shadow-lg hover:bg-cyan-400 transition-colors whitespace-nowrap">
            {showResults ? 'Clear' : 'Get the Date'}
          </button>
        </div>
      </div>
      {showSuggest && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%-12px)] z-50 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
          <div className="py-1.5">
            {suggestions.map((show, idx) => (
              <div key={show.id} className={`${activeIdx === idx ? 'bg-slate-700/60' : ''}`}>
                <SuggestionItem show={show} query={query} onClick={selectSuggestion}/>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-[9px] text-slate-200 font-bold uppercase tracking-widest">{suggestions.length} suggestions · Enter to search all</span>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">↑↓ navigate · ↵ select</span>
          </div>
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return <div className="animate-pulse"><div className="bg-slate-700/50 rounded-2xl aspect-[2/3] mb-3"></div><div className="h-4 bg-slate-700/50 rounded w-3/4 mb-2"></div><div className="h-3 bg-slate-700/50 rounded w-1/2"></div></div>
}

function ratingColor(rating) {
  if (!rating) return 'border-white/20 text-slate-200'
  if (rating === 'TV-MA')  return 'border-red-500/50 text-red-400'
  if (rating === 'TV-14')  return 'border-orange-500/50 text-orange-400'
  if (rating === 'TV-PG')  return 'border-yellow-500/50 text-yellow-400'
  if (['TV-G','TV-Y','TV-Y7'].includes(rating)) return 'border-green-500/50 text-green-400'
  return 'border-white/20 text-slate-200'
}

function ShowCard({ show, isTracked, onTrack, atLimit, isAuthenticated, rank }) {
  const tracked   = isTracked(show.id)
  const posterImg = usePoster(show.poster_path || show.poster, show.name, 342)
  const href      = detailUrl(show)

  return (
    <div className="group relative cursor-pointer" onClick={() => window.location.href = href}>
      {rank != null && (
        <span className="absolute -top-2 -left-2 z-10 w-7 h-7 bg-yellow-400 text-slate-950 text-xs font-black rounded-full flex items-center justify-center shadow-lg">
          {rank}
        </span>
      )}
      <div className="relative overflow-hidden rounded-2xl aspect-[2/3] mb-3 bg-slate-800">
        <img
          {...posterImg}
          alt={show.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"/>
        <button
          onClick={e => {
            e.stopPropagation()
            if (!isAuthenticated) { window.location.href = '/auth/login'; return }
            onTrack(show)
          }}
          disabled={isAuthenticated && !tracked && atLimit}
          aria-label={tracked ? 'Untrack show' : 'Track show'}
          className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg
            ${tracked
              ? 'bg-pink-500 text-white'
              : isAuthenticated && atLimit
                ? 'bg-slate-900/70 text-slate-600 cursor-not-allowed'
                : 'bg-slate-900/70 text-slate-300 hover:bg-pink-500/90 hover:text-white'
            }`}
        >
          <i className={`fa-${tracked ? 'solid' : 'regular'} fa-heart text-xs`}/>
        </button>
        {show.content_rating && (
          <span className={`absolute bottom-2 right-2 z-10 px-1.5 py-0.5 bg-slate-950/85 border rounded text-[9px] font-black tracking-widest backdrop-blur-sm ${ratingColor(show.content_rating)}`}>
            {show.content_rating}
          </span>
        )}
      </div>
      <h3 className="text-xs sm:text-sm font-bold text-white leading-snug mb-1 line-clamp-2">
        {show.name}
      </h3>
      {show.season_number && (
        <span className="inline-block px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 text-[9px] font-black uppercase tracking-widest mb-1">
          Season {show.season_number}
        </span>
      )}
      {show.network && (
        <p className="text-[10px] sm:text-xs font-medium text-slate-200 mb-0.5">{show.network}</p>
      )}
      {(() => {
        const d = show.first_air_date || show.premiereDate
        let label = 'TBA'
        try {
          if (d) {
            const dt = new Date(d.includes('T') ? d : d + 'T12:00:00')
            label = isNaN(dt.getTime()) ? 'TBA' : dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
          }
        } catch {}
        return (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-200">{label}</p>
            {label === 'TBA' && (
              <PredictionBadge showId={show.id} premiereDate={null} compact={true}/>
            )}
          </>
        )
      })()}
    </div>
  )
}

function SectionHeader({ icon, iconColor, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
      <i className={`${icon} ${iconColor} text-lg`}></i>
      <h2 className="text-xl font-black text-white tracking-tighter uppercase">{title}</h2>
      {subtitle && <span className="text-[10px] font-bold uppercase tracking-widest text-slate-200 ml-1">{subtitle}</span>}
    </div>
  )
}

function ShowGrid({ shows, loading, skeletonCount=5, rank=false, ...cardProps }) {
  const grid = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5'
  if (loading) return <div className={grid}>{Array.from({length:skeletonCount}).map((_,i)=><SkeletonCard key={i}/>)}</div>
  return <div className={grid}>{dedupById(shows).map((s,i)=><ShowCard key={`${s.id}-${i}`} show={s} rank={rank?i+1:undefined} {...cardProps}/>)}</div>
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SearchPage() {
  const { token, isAuthenticated, isPremium } = useAuth()
  const { watchlist, toggleWatchlist, isTracked, atLimit } = useWatchlist()

  const [query,             setQuery]         = useState('')
  const [network,           setNetwork]       = useState('All')
  const [searchResults,     setResults]       = useState([])
  const [resultsHeader,     setHeader]        = useState('Search Results')
  const [resultsCount,      setCount]         = useState('')
  const [searching,         setSearching]     = useState(false)
  const [showResults,       setShowResults]   = useState(false)
  const [premieringTonight, setPremieringTonight] = useState([])
  const [loadTonight,       setLoadTonight]   = useState(true)
  const [page,              setPage]          = useState(1)
  const [totalPages,        setTotalPages]    = useState(1)
  const [trending,          setTrending]      = useState([])
  const [top10,             setTop10]         = useState([])
  const [thisWeek,          setThisWeek]      = useState([])
  const [tmdbWeekResults, setTmdbWeekResults] = useState([])
  const curatedShows = useCurated()
  const [nextMonth,         setNextMonth]     = useState([])
  const [leaderboard,       setLeaderboard]   = useState([])
  const [loadTrend,         setLoadTrend]     = useState(true)
  const [loadTop10,         setLoadTop10]     = useState(true)
  const [loadWeek,          setLoadWeek]      = useState(true)
  const [loadMonth,         setLoadMonth]     = useState(true)
  const [modal,             setModal]         = useState(false)
  const [modalTitle,        setModalTitle]    = useState('')
  const [modalContent,      setModalContent]  = useState('')
  const [modalLoading,      setModalLoading]  = useState(false)

  useEffect(() => {
    const now = new Date()
    const nmYear  = new Date(now.getFullYear(), now.getMonth()+1, 1).getFullYear()
    const nmMonth = new Date(now.getFullYear(), now.getMonth()+1, 1).getMonth()+1

    setLoadTrend(true)
    tmdbTrending('week').then(async d => {
      // Trending = what's hot this week — English only, no age restriction
      const shows = (d.results||[]).map(mapTMDB).filter(s => !s.original_language || s.original_language === 'en')
      const enriched = await enrichWithNetwork(shows)
      setTrending(dedupById(enriched.filter(isEnglishShow)).slice(0,10))
    }).catch(()=>{}).finally(()=>setLoadTrend(false))

    setLoadTop10(true)
    Promise.all([tmdbPopular(1), tmdbPopular(2), tmdbPopular(3)]).then(async ([d1, d2, d3]) => {
      const all = [...(d1.results||[]), ...(d2.results||[]), ...(d3.results||[])]
      // Top 10 = most popular shows — English only, no age restriction
      const shows = all.map(mapTMDB).filter(s => !s.original_language || s.original_language === 'en')
      const enriched = await enrichWithNetwork(shows)
      setTop10(dedupById(enriched.filter(isEnglishShow)).slice(0,10))
    }).catch(()=>{}).finally(()=>setLoadTop10(false))
    setLoadWeek(true)
    const weekStart = startOfWeek()
    const weekEnd   = endOfWeek()
    const NETWORK_WEIGHT = {
      'netflix':100,'hbo / max':100,'max':100,'apple tv+':95,'hulu':95,
      'disney+':95,'prime video':90,'peacock':88,'paramount+':85,'starz':85,
      'showtime':85,'mgm+':80,'fx':80,'amc':78,'bet+':75,'cbs':70,
      'nbc':70,'abc':70,'fox':68,'the cw':65,'tubi':60,'bbc america':55,
    }
    Promise.all(
      AFFILIATE_NETWORK_IDS.map(nid =>
        tmdbDiscover({
          sort_by: 'popularity.desc',
          'first_air_date.gte': weekStart,
          'first_air_date.lte': weekEnd,
          with_networks: String(nid),
          page: 1,
        }).catch(() => ({ results: [] }))
      )
    ).then(async responses => {
      const allShows = responses.flatMap(d =>
        (d.results||[])
          .filter(s => s.first_air_date && s.first_air_date >= weekStart && s.first_air_date <= weekEnd)
          .map(mapTMDB)
      )
      const unique = dedupById(allShows)
        .filter(s => !s.original_language || s.original_language === 'en')
        .filter(isRecentShow)
      const enriched = await enrichWithNetwork(unique)
      const tmdbResults = dedupById(enriched.filter(isEnglishShow))
      setTmdbWeekResults(tmdbResults)
    }).catch(()=>{}).finally(()=>setLoadWeek(false))



    setLoadMonth(true)
    const lastDay = new Date(nmYear, nmMonth, 0).getDate()
    const gte = `${nmYear}-${String(nmMonth).padStart(2,'0')}-01`
    const lte = `${nmYear}-${String(nmMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    ;(async () => {
      try {
        // Use the RAG orchestration endpoint — handles returning series (Reacher,
        // Ted Lasso, Lioness) that client-side first_air_date filters miss.
        const monthName = new Date(nmYear, nmMonth - 1, 1).toLocaleString('default', { month: 'long' })
        const res = await fetch(`${API_BASE}/get-premieres`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `Series premiering in ${monthName} ${nmYear}`, page: 1, per_page: 40 }),
        })
        const gw = await res.json()
        const data = parseGateway(gw)
        const mapped = (data.results ?? []).map(normalizeShow)
        setNextMonth(dedupById(mapped).slice(0, 40))
      } catch (e) { console.error('nextMonth fetch failed', e) }
      finally { setLoadMonth(false) }
    })()

    setLoadTonight(true)
    const todayStr = new Date().toLocaleDateString('en-CA')
    tmdbDiscover({ sort_by:'popularity.desc', 'first_air_date.gte':todayStr, 'first_air_date.lte':todayStr, with_original_language:'en', page:1 })
      .then(async d => {
        const shows = (d.results || []).map(mapTMDB).filter(isEnglishShow).filter(isRecentShow)
        setPremieringTonight(dedupById(await enrichWithNetwork(shows)))
      }).catch(() => setPremieringTonight([]))
      .finally(() => setLoadTonight(false))

    fetch(`${API_BASE}/get-premieres`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ page:1, per_page:100 }),
    }).then(r=>r.json()).then(gw=>{
      const d = parseGateway(gw)
      if (d?.leaderboard) setLeaderboard(d.leaderboard)
    }).catch(()=>{})
  }, [])

  // Merge useEffect — runs when TMDB results OR curated data changes
  useEffect(() => {
    if (!tmdbWeekResults.length && !curatedShows.length) return
    const weekStart = startOfWeek()
    const weekEnd   = endOfWeek()
    const NETWORK_WEIGHT = {
      'netflix':100,'hbo / max':100,'max':100,'apple tv+':95,'hulu':95,
      'disney+':95,'prime video':90,'peacock':88,'paramount+':85,'starz':85,
      'showtime':85,'mgm+':80,'fx':80,'amc':78,'bet+':75,'cbs':70,
      'nbc':70,'abc':70,'fox':68,'the cw':65,'tubi':60,'bbc america':55,
    }
    const nw = s => NETWORK_WEIGHT[(s._networkLabel||s.network||'').toLowerCase()] ?? 10
    const weekCurated = curatedShows
      .filter(s => s.first_air_date >= weekStart && s.first_air_date <= weekEnd)
      .map(s => ({ ...s, _networkLabel: s.network, original_language: 'en' }))
    const merged = dedupById([...weekCurated, ...tmdbWeekResults])
      .sort((a,b) => {
        const nwDiff = nw(b) - nw(a)
        const dc = (a.first_air_date||'').localeCompare(b.first_air_date||'')
        return dc !== 0 ? dc : nwDiff
      })
    setThisWeek(merged)
  }, [tmdbWeekResults, curatedShows])

  async function handleSearch(overrideQuery, overridePage=1) {
    const q = overrideQuery ?? query
    if (!q.trim()) return
    setSearching(true); setShowResults(true)
    // Sync header immediately so it reflects the active query, not the previous result
    setHeader(`Results for "${q}"`)
    setCount('')
    try {
      // When network filter is active, use TMDB search + client-side network filter
      // (Lambda /get-premieres with network= returns all network shows, ignoring query)
      if (network && network !== 'All') {
        const tmdbData = await tmdbSearchTV(q, overridePage)
        const tmdbMapped = (tmdbData.results ?? []).map(mapTMDB)
        const tmdbEnriched = await enrichWithNetwork(tmdbMapped)
        // Filter by network — strict match, no fallback to unfiltered
        const NETWORK_ALIASES = {
          'hbo / max': ['hbo','max','hbo max'],
          'prime video': ['prime video','amazon','prime'],
          'apple tv+': ['apple tv','apple tv+'],
          'paramount+': ['paramount+','paramount plus','showtime'],
          'disney+': ['disney+','disney plus'],
        }
        const netFilter = network.toLowerCase()
        const aliases = NETWORK_ALIASES[netFilter] || [netFilter]
        const filtered = tmdbEnriched.filter(s => {
          const net = (s.network || s._networkLabel || '').toLowerCase()
          return aliases.some(a => net === a || net.includes(a) || a.includes(net))
        })
        // If nothing matches the network filter, show 0 results
        if (!filtered.length) {
          setResults([])
          setHeader(`Results for "${q}"`)
          setCount('0 results')
          setTotalPages(1)
          return
        }
        const base = filtered
        const expanded = base.flatMap(s => {
          const detail = s._detail
          const seasons = (detail?.seasons || []).filter(ss => ss.season_number > 0 && ss.air_date)
          if (seasons.length > 1) {
            return seasons.map(ss => ({
              ...s,
              poster_path: ss.poster_path || s.poster_path,
              first_air_date: ss.air_date,
              _seasonNum: ss.season_number,
            }))
          }
          return [s]
        })
        setResults(expanded)
        setHeader(`Results for "${q}"`)
        setCount(`${expanded.length} results`)
        setTotalPages(tmdbData.total_pages ?? 1)
      } else {
      const payload = { query:q, page:overridePage, per_page:20, cache_bust: true }
      const res  = await fetch(`${API_BASE}/get-premieres`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      })
      const gw   = await res.json()
      const data = parseGateway(gw)
      const results = (data.results ?? data.shows ?? []).map(normalizeShow)
      if (results.length === 0) {
        const tmdbData = await tmdbSearchTV(q, overridePage)
        const tmdbMapped = (tmdbData.results ?? []).map(mapTMDB)
        const tmdbEnriched = await enrichWithNetwork(tmdbMapped)
        setResults(tmdbEnriched)
        setHeader(`Results for "${q}"`)
        setCount(tmdbData.total_results ? `${tmdbData.total_results.toLocaleString()} results` : '')
        setTotalPages(tmdbData.total_pages ?? 1)
      } else {
        const enriched = await enrichWithNetwork(results)
        setResults(enriched)
        setHeader(data.header || `Results for "${q}"`)
        setCount(data.pagination?.total ? `${data.pagination.total.toLocaleString()} results` : `${results.length} results`)
        setTotalPages(data.pagination?.pages ?? 1)
      }
      }
      setPage(overridePage)
      if (data?.leaderboard?.length) setLeaderboard(data.leaderboard)
    } catch(e) { console.error('Search failed', e) }
    finally { setSearching(false) }
  }

  function handleClear() { setShowResults(false); setQuery(''); setResults([]) }

  function handleTrack(show) {
    const r = toggleWatchlist(show)
    if (r?.error==='FREEMIUM_LIMIT') window.location.href='/upgrade'
  }

  async function openRecap(show) {
    setModalTitle(`${show.name} — Recap`); setModalContent(''); setModal(true); setModalLoading(true)
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
        <div className="fixed top-[64px] left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-cyan-500/20 px-6 py-2.5">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-bolt text-cyan-400 text-xs flex-shrink-0"></i>
              <p className="text-slate-200 text-xs font-bold">
                <span className="text-white">You're on the Free Plan</span>
                <span className="mx-2 text-slate-200">·</span>
                Track unlimited shows, get early alerts, and unlock The Scoop.
              </p>
            </div>
            <a href="/upgrade" className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap">
              <i className="fa-solid fa-bolt text-xs"></i> Upgrade — $4.99/mo
            </a>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-6">
        <header className="mb-10">
          <SearchBar
            query={query} setQuery={setQuery}
            network={network} setNetwork={setNetwork}
            onSearch={() => handleSearch()}
            onClear={handleClear}
            showResults={showResults}
          />
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-200 mb-2 block">
              Trending Intelligence:
            </span>
            <div className="flex flex-wrap gap-2 mb-5">
              {CHIPS.map(chip => (
                <button key={chip} onClick={() => {
                  if (chip === 'Premiering Today') {
                    setHeader('Premiering Today · ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
                    setResults(premieringTonight)
                    setCount(premieringTonight.length + ' shows')
                    setTotalPages(1); setPage(1); setShowResults(true)
                  } else { setQuery(chip); handleSearch(chip) }
                }}
                  className={chip === 'Premiering Today'
                    ? "flex items-center gap-2 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 hover:border-red-400/60 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    : "px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700 border border-white/10 hover:border-cyan-500/30 text-slate-200 hover:text-cyan-400 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
                  }>
                  {chip === 'Premiering Today' ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                      </span>
                      {chip}
                    </>
                  ) : chip}
                </button>
              ))}
            </div>
          </div>
        </header>

        {isAuthenticated && watchlist.length > 0 && (
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Watchlist banner */}
            <a href="/persona"
              className="flex items-center justify-between gap-4 px-5 py-4
                         bg-slate-800/40 hover:bg-slate-800/70
                         border border-pink-500/20 hover:border-pink-500/40
                         rounded-2xl transition-all group">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {watchlist.slice(0,4).map((show,i) => (
                    <div key={show.id}
                      className="w-9 h-9 rounded-full border-2 border-slate-950 overflow-hidden bg-slate-700 flex-shrink-0"
                      style={{zIndex: 4-i}}>
                      <img {...usePoster(show.poster_path||show.poster, show.name, 92)}
                        alt={show.name} className="w-full h-full object-cover"/>
                    </div>
                  ))}
                  {watchlist.length > 4 && (
                    <div className="w-9 h-9 rounded-full border-2 border-slate-950 bg-slate-700 flex items-center justify-center flex-shrink-0 text-[9px] font-black text-slate-300"
                      style={{zIndex:0}}>
                      +{watchlist.length - 4}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-white text-sm font-black leading-tight">
                    <span className="text-pink-400">{watchlist.length}</span> show{watchlist.length !== 1 ? 's' : ''} in The Pulse
                  </p>
                  <p className="text-slate-200 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                    Your Watchlist
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-200 group-hover:text-pink-400 transition-colors flex-shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">View</span>
                <i className="fa-solid fa-chevron-right text-xs"/>
              </div>
            </a>

            {/* My Persona banner */}
            <a href="/persona?tab=persona"
              className="flex items-center justify-between gap-4 px-5 py-4
                         bg-slate-800/40 hover:bg-slate-800/70
                         border border-violet-500/20 hover:border-violet-500/40
                         rounded-2xl transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30
                                flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-masks-theater text-violet-400 text-sm"/>
                </div>
                <div>
                  <p className="text-white text-sm font-black leading-tight">My Persona</p>
                  <p className="text-slate-200 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                    AI Viewer Profile
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-200 group-hover:text-violet-400 transition-colors flex-shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">View</span>
                <i className="fa-solid fa-chevron-right text-xs"/>
              </div>
            </a>

          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-10">
          <div className="lg:col-span-3 xl:col-span-4">
            {showResults && (
              <div>
                <div className="mb-5">
                  <h2 className="text-2xl font-black text-white mb-1">{resultsHeader}</h2>
                  {resultsCount && <p className="text-slate-200 text-sm">{resultsCount}</p>}
                </div>
                {searching
                  ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">{Array.from({length:6}).map((_,i)=><SkeletonCard key={i}/>)}</div>
                  : <>
                      {searchResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-5">
                            <i className="fa-solid fa-magnifying-glass text-slate-200 text-2xl"/>
                          </div>
                          <h3 className="text-white font-black text-lg uppercase tracking-widest mb-2">
                            No Results Found
                          </h3>
                          <p className="text-slate-200 text-sm max-w-sm leading-relaxed mb-6">
                            We couldn't find any shows matching that search. Try a different title, network, or date range.
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                {['Netflix June 2026','Taylor Sheridan','Apple TV+ 2026','HBO Premieres'].map(s => (
                              <button key={s}
                                onClick={() => { setQuery(s); handleSearch(s) }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-400 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all">
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 mb-8">
                        {searchResults.map((s,i)=><ShowCard key={`${s.id}-${s.season_number||i}`} show={s} {...cardProps}/>)}
                      </div>
                      )}
                      {searchResults.length > 0 && totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6 mb-10">
                          <button onClick={()=>handleSearch(query,page-1)} disabled={page===1}
                            className="px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-xs font-bold text-slate-200 hover:border-cyan-500/30 disabled:opacity-30 transition-all">← Prev</button>
                          <span className="text-xs font-bold text-slate-200 px-3">Page {page} of {totalPages}{resultsCount ? ` (${resultsCount})` : ''}</span>
                          <button onClick={()=>handleSearch(query,page+1)} disabled={page===totalPages}
                            className="px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-xs font-bold text-slate-200 hover:border-cyan-500/30 disabled:opacity-30 transition-all">Next →</button>
                        </div>
                      )}
                    </>
                }
              </div>
            )}

            {!showResults && (
              <div className="flex flex-col gap-14">

                {/* ── v3.7 Personalized Recommendations ("Because you tracked...") ── */}
                {isAuthenticated && (
                  <RecommendedForYou className="" />
                )}

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
                  <SectionHeader icon="fa-solid fa-calendar-plus" iconColor="text-purple-400" title={`Premiering ${nextMonthLabel}`} subtitle="All Major Networks"/>
                  <ShowGrid shows={nextMonth} loading={loadMonth} skeletonCount={10} {...cardProps}/>
                </section>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-8">

            {/* Get The Scoop */}
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                  <i className="fa-solid fa-bolt text-cyan-400 text-lg"></i>
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wide text-cyan-400 mb-0.5">Get The Scoop</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-200">Latest TV Intelligence</p>
                </div>
              </div>
              <ScoopSidebar />
            </div>

            {/* Global Hype Ranking */}
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20">
                  <i className="fa-solid fa-fire text-pink-400 text-lg"></i>
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wide text-pink-400 mb-0.5">Global Hype Ranking</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-200">Top Tracked Series</p>
                </div>
              </div>
              <div className="space-y-3">
                {leaderboard.length === 0
                  ? Array.from({length:5}).map((_,i) => (
                      <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-slate-800/40 rounded-2xl">
                        <div className="w-8 h-8 bg-slate-700 rounded-xl"></div>
                        <div className="flex-1"><div className="h-3 bg-slate-700 rounded w-3/4 mb-1"></div><div className="h-2 bg-slate-700 rounded w-1/2"></div></div>
                      </div>
                    ))
                  : dedupById(leaderboard).slice(0,10).map((s,idx) => (
                      <div key={`${s.id??idx}-${idx}`} className="flex items-center gap-3 p-3 bg-slate-800/40 border border-white/5 rounded-2xl hover:border-pink-500/20 transition-all cursor-pointer" onClick={() => window.location.href=`/details/${s.id}`}>
                        <span className="w-6 text-center text-[10px] font-black text-slate-200">{idx+1}</span>
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

        <Footer />
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
                ? <div className="flex items-center gap-3 py-8 justify-center"><div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div><span className="text-slate-200 text-sm">Generating recap...</span></div>
                : <p>{modalContent}</p>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}