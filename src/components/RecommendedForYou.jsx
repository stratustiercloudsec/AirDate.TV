import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API     = 'https://qg0x31ranc.execute-api.us-east-1.amazonaws.com/prod'
const PER_PAGE = 6

function ShowPill({ show }) {
  const poster    = show.poster || show.posterPath
  const date      = show.premiereDate || show.first_air_date || ''
  const dateLabel = date && date !== 'TBA'
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US',
        { month: 'short', day: 'numeric', year: 'numeric' })
    : date || ''

  return (
    <Link to={`/details/${show.tmdb_id || show.id}`} className="group">
      <div className="relative rounded-xl overflow-hidden bg-slate-800 aspect-[2/3] mb-2
                      ring-1 ring-white/5 group-hover:ring-cyan-400/40
                      group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-black/40
                      transition-all duration-200">
        {poster
          ? <img src={poster} alt={show.title} className="w-full h-full object-cover" loading="lazy"/>
          : <div className="w-full h-full flex items-center justify-center">
              <i className="fa-solid fa-tv text-slate-600 text-3xl"/>
            </div>
        }
        {show.score > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm
                          text-cyan-400 text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-wider">
            {Math.round(show.score * 100)}%
          </div>
        )}
      </div>
      <p className="text-white text-[11px] font-bold leading-tight truncate group-hover:text-cyan-400 transition-colors">
        {show.title}
      </p>
      {show.network && <p className="text-slate-400 text-[10px] truncate mt-0.5">{show.network}</p>}
      {dateLabel    && <p className="text-slate-500 text-[10px] mt-0.5">{dateLabel}</p>}
    </Link>
  )
}

export default function RecommendedForYou({ className = '' }) {
  const { user, token, isAuthenticated } = useAuth()
  const [shows,    setShows]    = useState([])
  const [label,    setLabel]    = useState('Recommended for You')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [strategy, setStrategy] = useState('')
  const [page,     setPage]     = useState(0)
  const fetchedRef = useRef(false)

  const totalPages = Math.ceil(shows.length / PER_PAGE)
  const pageShows  = shows.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)

  useEffect(() => {
    if (!isAuthenticated || !user?.sub || fetchedRef.current) return
    fetchedRef.current = true
    fetchRecs()
  }, [isAuthenticated, user])

  async function fetchRecs() {
    setLoading(true); setError('')
    try {
      const t = token || (() => {
        try {
          const s = JSON.parse(localStorage.getItem('airdate_session') || '{}')
          return s?.tokens?.idToken?.toString() || s?.idToken?.jwtToken || ''
        } catch { return '' }
      })()
      const res  = await fetch(`${API}/user/${user.sub}/recs`,
        t ? { headers: { Authorization: `Bearer ${t}` } } : {})
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setShows(data.results || []); setLabel(data.label || 'Recommended for You')
      setStrategy(data.strategy || ''); setPage(0)
    } catch (err) {
      console.error('Recs fetch error:', err); setError('Could not load recommendations.')
    } finally { setLoading(false) }
  }

  if (!isAuthenticated) return null
  if (!loading && shows.length === 0 && !error) return null

  return (
    <section className={`w-full ${className}`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-wand-magic-sparkles text-white text-[11px]"/>
          </div>
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-widest leading-tight">{label}</h2>
            <p className="text-slate-500 text-[10px] font-medium mt-0.5">
              {strategy === 'fm' ? 'AI-powered · Factorization Machine' : 'Based on your preferences'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Page dots */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1 mr-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  className={`rounded-full transition-all duration-200 ${
                    i === page ? 'w-4 h-1.5 bg-cyan-400' : 'w-1.5 h-1.5 bg-slate-600 hover:bg-slate-400'
                  }`}/>
              ))}
            </div>
          )}
          {/* Prev */}
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0 || loading}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center text-xs transition-all
              ${page > 0 ? 'border-white/10 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400 hover:bg-slate-800'
                         : 'border-white/5 text-slate-700 cursor-not-allowed'}`}>
            <i className="fa-solid fa-chevron-left"/>
          </button>
          {/* Next */}
          <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1 || loading}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center text-xs transition-all
              ${page < totalPages - 1 ? 'border-white/10 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400 hover:bg-slate-800'
                                      : 'border-white/5 text-slate-700 cursor-not-allowed'}`}>
            <i className="fa-solid fa-chevron-right"/>
          </button>
          {/* Refresh */}
          <button onClick={() => { fetchedRef.current = false; fetchRecs() }} disabled={loading}
            className="w-8 h-8 rounded-xl border border-white/5 flex items-center justify-center
                       text-slate-600 hover:text-cyan-400 hover:border-cyan-500/20 transition-all text-xs ml-1"
            title="Refresh">
            <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''}`}/>
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {[...Array(PER_PAGE)].map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] rounded-xl bg-slate-800/60 animate-pulse mb-2"/>
              <div className="h-2.5 bg-slate-800/60 rounded animate-pulse w-3/4 mb-1"/>
              <div className="h-2   bg-slate-800/60 rounded animate-pulse w-1/2"/>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-slate-500 text-sm">{error}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {pageShows.map((show, i) => <ShowPill key={`${show.id}-${page}-${i}`} show={show}/>)}
          {[...Array(Math.max(0, PER_PAGE - pageShows.length))].map((_, i) => <div key={`g${i}`}/>)}
        </div>
      )}

    </section>
  )
}
