// src/pages/TrendingPage.jsx
import { useEffect, useState } from 'react'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'
import { usePoster }    from '@/utils/poster'
import { Footer }       from '@/components/layout/Footer'
import { tmdbFetch, tmdbShow, tmdbContentRatings, tmdbCredits, tmdbSeason } from '../utils/tmdb'

const IMAGE_BASE = 'https://image.tmdb.org'

// TMDB network IDs
const NETWORKS = [
  { label: 'Netflix',      id: 213  },
  { label: 'HBO / Max',    id: 49   },
  { label: 'Disney+',      id: 2739 },
  { label: 'Prime Video',  id: 1024 },
  { label: 'Hulu',         id: 453  },
  { label: 'Peacock',      id: 3353 },
  { label: 'Paramount+',   id: 4330 },
  { label: 'Apple TV+',    id: 2552 },
  { label: 'FX',           id: 88   },
  { label: 'AMC',          id: 174  },
  { label: 'Starz',        id: 318  },
]

const GENRES = [
  { label: 'Drama',     id: '18'    },
  { label: 'Crime',     id: '80'    },
  { label: 'Sci-Fi',    id: '10765' },
  { label: 'Comedy',    id: '35'    },
  { label: 'Action',    id: '10759' },
  { label: 'Thriller',  id: '53'    },
  { label: 'Animation', id: '16'    },
  { label: 'Reality',   id: '10764' },
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── Rating helpers (mirror of HomePage) ─────────────────────────────────────
function ratingColor(rating) {
  if (!rating) return 'border-white/20 text-slate-400'
  if (rating === 'TV-MA')  return 'border-red-500/50 text-red-400'
  if (rating === 'TV-14')  return 'border-orange-500/50 text-orange-400'
  if (rating === 'TV-PG')  return 'border-yellow-500/50 text-yellow-400'
  if (['TV-G','TV-Y','TV-Y7'].includes(rating)) return 'border-green-500/50 text-green-400'
  return 'border-white/20 text-slate-400'
}

// ─── Non-blocking ratings enrichment ─────────────────────────────────────────
// Fires AFTER cards render — never blocks card display
async function fetchRatingsMap(shows) {
  if (!shows?.length) return {}
  const results = await Promise.allSettled(
    shows.map(s =>
      tmdbContentRatings(s.id)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    )
  )
  const map = {}
  shows.forEach((s, i) => {
    const data = results[i].status === 'fulfilled' ? results[i].value : null
    map[s.id] = data?.results?.find(r => r.iso_3166_1 === 'US')?.rating || ''
  })
  return map
}

async function fetchNetworksMap(shows) {
  if (!shows?.length) return {}
  const results = await Promise.allSettled(
    shows.map(s =>
      tmdbShow(s.id)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    )
  )
  const map = {}
  shows.forEach((s, i) => {
    const data = results[i].status === 'fulfilled' ? results[i].value : null
    map[s.id] = data?.networks?.[0]?.name || ''
  })
  return map
}

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="bg-slate-700/50 rounded-2xl aspect-[2/3] mb-3"/>
      <div className="h-4 bg-slate-700/50 rounded w-3/4 mb-1"/>
      <div className="h-3 bg-slate-700/50 rounded w-1/2"/>
    </div>
  )
}

// ─── ShowCard — heart icon + rating badge (mirrors HomePage pattern) ──────────
function ShowCard({ show, isTracked, onTrack, atLimit, isAuthenticated, size = 'normal', ratingsMap = {}, networksMap = {} }) {
  const tracked    = isTracked(show.id)
  const posterImg  = usePoster(show.poster_path, show.name, 342)
  const rating     = show.content_rating || ratingsMap[show.id] || ''
  const network    = show.network || networksMap[show.id] || ''

  return (
    <div className="group relative cursor-pointer"
      onClick={() => window.location.href = `/details/${show.id}`}>

      <div className="relative overflow-hidden rounded-2xl aspect-[2/3] mb-3 bg-slate-800">
        <img {...posterImg} alt={show.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"/>

        {/* Hover gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"/>

        {/* ── Heart button — always visible, top-right ── */}
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

        {/* ── Content rating badge — bottom-right ── */}
        {rating && (
          <span className={`absolute bottom-2 right-2 z-10 px-1.5 py-0.5 bg-slate-950/85 border rounded text-[9px] font-black tracking-widest backdrop-blur-sm ${ratingColor(rating)}`}>
            {rating}
          </span>
        )}
      </div>

      <h3 className={`font-bold text-white leading-snug mb-1 line-clamp-2 ${size === 'small' ? 'text-xs' : 'text-sm'}`}>
        {show.name}
      </h3>
      {network && (
        <p className="text-[10px] sm:text-xs font-medium text-slate-400 mb-0.5">{network}</p>
      )}
      {show.first_air_date && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {new Date(show.first_air_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}

function AnticipatedCard({ show, rank, isTracked, onTrack, atLimit, isAuthenticated }) {
  const tracked   = isTracked(show.id)
  const posterImg = usePoster(show.poster_path, show.name, 185)
  const voteStr   = show.vote_count > 0 ? `${show.vote_count.toLocaleString()} votes` : 'Upcoming'
  return (
    <div className="flex items-center gap-4 bg-slate-800/40 border border-white/5 rounded-2xl p-4 hover:border-cyan-500/20 transition-all cursor-pointer"
      onClick={() => window.location.href = `/details/${show.id}`}>
      <span className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-base font-black flex-shrink-0">{rank}</span>
      <img {...posterImg} alt={show.name} className="w-16 h-24 object-cover rounded-xl flex-shrink-0"/>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-white truncate mb-1">{show.name}</h3>
        {show.first_air_date && (
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            {new Date(show.first_air_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        <p className="text-[9px] text-purple-400 font-black uppercase tracking-widest mt-1">{voteStr}</p>
      </div>
      {isAuthenticated && (
        <button
          onClick={e => { e.stopPropagation(); onTrack(show) }}
          disabled={!tracked && atLimit}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg
            ${tracked
              ? 'bg-pink-500 text-white'
              : atLimit
                ? 'bg-slate-900/70 text-slate-600 cursor-not-allowed'
                : 'bg-slate-900/70 text-slate-300 hover:bg-pink-500/90 hover:text-white'
            }`}
        >
          <i className={`fa-${tracked ? 'solid' : 'regular'} fa-heart text-xs`}/>
        </button>
      )}
    </div>
  )
}

const GRID_CLASS = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5'

async function tmdb(path) {
  const sep = path.includes('?') ? '&' : '?'
  const r = await tmdbFetch(path, { language: 'en-US' })
  const d = await r.json()
  return d.results || []
}

export function TrendingPage() {
  const { isAuthenticated } = useAuth()
  const { toggleWatchlist, isTracked, atLimit } = useWatchlist()

  const [trendingWeek, setTrendingWeek] = useState([])
  const [anticipated,  setAnticipated]  = useState([])
  const [rising,       setRising]       = useState([])
  const [networkShows, setNetworkShows] = useState([])
  const [genreShows,   setGenreShows]   = useState([])

  // Ratings maps — keyed by show id, populated after cards load
  const [weekRatings,    setWeekRatings]    = useState({})
  const [risingRatings,  setRisingRatings]  = useState({})
  const [networkRatings, setNetworkRatings] = useState({})
  const [genreRatings,   setGenreRatings]   = useState({})
  const [weekNetworks,    setWeekNetworks]    = useState({})
  const [risingNetworks,  setRisingNetworks]  = useState({})
  const [networkNetworks, setNetworkNetworks] = useState({})
  const [genreNetworks,   setGenreNetworks]   = useState({})

  const [activeNetwork, setActiveNetwork] = useState(NETWORKS[0])
  const [activeGenre,   setActiveGenre]   = useState(GENRES[0])
  const [activeSection, setSection]       = useState('trending-week')

  const [loading, setLoading] = useState({
    week: true, anticipated: true, rising: true, network: true, genre: true,
  })
  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }))

  function handleTrack(show) {
    const r = toggleWatchlist(show)
    if (r?.error === 'FREEMIUM_LIMIT') window.location.href = '/upgrade'
  }

  const cardProps = { isTracked, onTrack: handleTrack, atLimit, isAuthenticated }

  // ── Trending This Week + Rising ───────────────────────────────────────────
  useEffect(() => {
    setLoad('week', true)
    setLoad('rising', true)
    Promise.all([
      tmdb('/trending/tv/week'),
      tmdb('/trending/tv/day'),
    ]).then(([week, day]) => {
      setTrendingWeek(week)
      const weekIds    = new Set(week.slice(0, 5).map(s => s.id))
      const risingShows = day.filter(s => !weekIds.has(s.id)).slice(0, 12)
      const finalRising = risingShows.length >= 4 ? risingShows : day.slice(0, 12)
      setRising(finalRising)

      // Non-blocking ratings enrichment — fires after cards render
      fetchRatingsMap(week).then(setWeekRatings).catch(() => {})
      fetchRatingsMap(finalRising).then(setRisingRatings).catch(() => {})
      fetchNetworksMap(week).then(setWeekNetworks).catch(() => {})
      fetchNetworksMap(finalRising).then(setRisingNetworks).catch(() => {})
    }).catch(() => {}).finally(() => { setLoad('week', false); setLoad('rising', false) })

    // Most Anticipated
    setLoad('anticipated', true)
    tmdb(`/discover/tv?sort_by=popularity.desc&first_air_date.gte=${todayISO()}&with_original_language=en`)
      .then(r => setAnticipated(r.slice(0, 12)))
      .catch(() => {})
      .finally(() => setLoad('anticipated', false))
  }, [])

  // ── By Network ────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoad('network', true)
    tmdb(`/discover/tv?sort_by=popularity.desc&with_networks=${activeNetwork.id}`)
      .then(r => {
        setNetworkShows(r)
        fetchRatingsMap(r).then(setNetworkRatings).catch(() => {})
        fetchNetworksMap(r).then(setNetworkNetworks).catch(() => {})
      })
      .catch(() => {})
      .finally(() => setLoad('network', false))
  }, [activeNetwork])

  // ── By Genre ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoad('genre', true)
    tmdb(`/discover/tv?sort_by=popularity.desc&with_genres=${activeGenre.id}`)
      .then(r => {
        setGenreShows(r)
        fetchRatingsMap(r).then(setGenreRatings).catch(() => {})
        fetchNetworksMap(r).then(setGenreNetworks).catch(() => {})
      })
      .catch(() => {})
      .finally(() => setLoad('genre', false))
  }, [activeGenre])

  const TABS = [
    { id: 'trending-week',    icon: 'fa-bolt',           color: 'text-yellow-400', label: 'This Week' },
    { id: 'most-anticipated', icon: 'fa-calendar-star',  color: 'text-purple-400', label: 'Most Anticipated' },
    { id: 'rising',           icon: 'fa-arrow-trend-up', color: 'text-green-400',  label: 'Rising' },
    { id: 'by-network',       icon: 'fa-tv',             color: 'text-cyan-400',   label: 'By Network' },
    { id: 'by-genre',         icon: 'fa-tags',           color: 'text-pink-400',   label: 'By Genre' },
  ]

  const SectionHeader = ({ icon, color, title, subtitle }) => (
    <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
      <i className={`fa-solid ${icon} ${color} text-lg`}/>
      <h2 className="text-xl font-black text-white tracking-tighter uppercase">{title}</h2>
      {subtitle && <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{subtitle}</span>}
    </div>
  )

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">

        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest mb-4">
            <i className="fa-solid fa-fire animate-pulse"/> Live Trending Intelligence
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-3">What's Trending</h1>
          <p className="text-slate-400 text-base max-w-2xl">Real-time signals across TMDB popularity, weekly spikes, and upcoming premiere anticipation.</p>
        </div>

        {/* Sticky tabs */}
        <div className="sticky top-16 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-white/5 -mx-6 px-6 mb-10">
          <div className="flex items-center gap-1 overflow-x-auto py-3" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => {
                setSection(t.id)
                document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' })
              }}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                  ${activeSection === t.id ? 'bg-white/8 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                <i className={`fa-solid ${t.icon} ${t.color}`}/>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. Trending This Week */}
        <section id="trending-week" className="mb-16">
          <SectionHeader icon="fa-bolt" color="text-yellow-400" title="Trending This Week" subtitle="Powered by TMDB"/>
          {loading.week ? (
            <div className={GRID_CLASS}>{Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i}/>)}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
                {trendingWeek.slice(0, 3).map(s => (
                  <ShowCard key={s.id} show={s} size="normal" ratingsMap={weekRatings} networksMap={weekNetworks} {...cardProps}/>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                {trendingWeek.slice(3, 10).map(s => (
                  <ShowCard key={s.id} show={s} size="small" ratingsMap={weekRatings} networksMap={weekNetworks} {...cardProps}/>
                ))}
              </div>
            </>
          )}
        </section>

        {/* 2. Most Anticipated */}
        <section id="most-anticipated" className="mb-16">
          <SectionHeader icon="fa-calendar-star" color="text-purple-400" title="Most Anticipated Premieres" subtitle="Upcoming · Sorted by Popularity"/>
          <p className="text-slate-400 text-xs mb-6">English-language shows with future premiere dates, ranked by TMDB popularity score.</p>
          {loading.anticipated ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-slate-800/40 rounded-2xl p-4 flex gap-4">
                  <div className="bg-slate-700/50 rounded-xl w-16 h-24 flex-shrink-0"/>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-slate-700/50 rounded w-3/4"/>
                    <div className="h-3 bg-slate-700/50 rounded w-1/2"/>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {anticipated.map((s, i) => (
                <AnticipatedCard key={s.id} show={s} rank={i + 1} {...cardProps}/>
              ))}
            </div>
          )}
        </section>

        {/* 3. Rising */}
        <section id="rising" className="mb-16">
          <SectionHeader icon="fa-arrow-trend-up" color="text-green-400" title="Rising Right Now" subtitle="Today's Signals"/>
          <p className="text-slate-400 text-xs mb-6">Trending today but not yet in this week's top 5 — early signals before they go mainstream.</p>
          {loading.rising ? (
            <div className={GRID_CLASS}>{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i}/>)}</div>
          ) : (
            <div className={GRID_CLASS}>
              {rising.map(s => (
                <ShowCard key={s.id} show={s} ratingsMap={risingRatings} networksMap={risingNetworks} {...cardProps}/>
              ))}
            </div>
          )}
        </section>

        {/* 4. By Network */}
        <section id="by-network" className="mb-16">
          <SectionHeader icon="fa-tv" color="text-cyan-400" title="Trending by Network"/>
          <div className="flex flex-wrap gap-2 mb-8">
            {NETWORKS.map(n => (
              <button key={n.id} onClick={() => setActiveNetwork(n)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all
                  ${activeNetwork.id === n.id
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    : 'bg-transparent border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'}`}>
                {n.label}
              </button>
            ))}
          </div>
          {loading.network ? (
            <div className={GRID_CLASS}>{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i}/>)}</div>
          ) : (
            <div className={GRID_CLASS}>
              {networkShows.map(s => (
                <ShowCard key={s.id} show={s} ratingsMap={networkRatings} networksMap={networkNetworks} {...cardProps}/>
              ))}
            </div>
          )}
        </section>

        {/* 5. By Genre */}
        <section id="by-genre" className="mb-16">
          <SectionHeader icon="fa-tags" color="text-pink-400" title="Trending by Genre"/>
          <div className="flex flex-wrap gap-2 mb-8">
            {GENRES.map(g => (
              <button key={g.id} onClick={() => setActiveGenre(g)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all
                  ${activeGenre.id === g.id
                    ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                    : 'bg-transparent border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'}`}>
                {g.label}
              </button>
            ))}
          </div>
          {loading.genre ? (
            <div className={GRID_CLASS}>{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i}/>)}</div>
          ) : (
            <div className={GRID_CLASS}>
              {genreShows.map(s => (
                <ShowCard key={s.id} show={s} ratingsMap={genreRatings} networksMap={genreNetworks} {...cardProps}/>
              ))}
            </div>
          )}
        </section>

      </div>
      <Footer/>
    </div>
  )
}