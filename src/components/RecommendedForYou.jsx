// RecommendedForYou.jsx
// "Because you tracked..." personalized recommendation row
// Renders on HomePage for authenticated Pro users only.
// Falls back to genre-affinity recs for free users / cold-start.

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = 'https://qg0x31ranc.execute-api.us-east-1.amazonaws.com/prod'

function ShowPill({ show }) {
  const poster = show.poster || show.posterPath
  const date   = show.premiereDate || show.first_air_date || ''
  const dateLabel = date && date !== 'TBA'
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : date || ''

  return (
    <Link
      to={`/details/${show.tmdb_id || show.id}`}
      className="group flex-none w-[140px] sm:w-[160px] snap-start"
    >
      {/* Poster */}
      <div className="relative rounded-xl overflow-hidden bg-slate-800 aspect-[2/3] mb-2
                      ring-1 ring-white/5 group-hover:ring-cyan-400/40 transition-all duration-200
                      group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-black/40">
        {poster ? (
          <img
            src={poster}
            alt={show.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <i className="fa-solid fa-tv text-slate-600 text-3xl"/>
          </div>
        )}

        {/* Score badge (FM only) */}
        {show.score && show.score > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm
                          text-cyan-400 text-[9px] font-black px-1.5 py-0.5 rounded-lg
                          uppercase tracking-wider">
            {Math.round(show.score * 100)}%
          </div>
        )}
      </div>

      {/* Labels */}
      <p className="text-white text-[11px] font-bold leading-tight truncate group-hover:text-cyan-400 transition-colors">
        {show.title}
      </p>
      {show.network && (
        <p className="text-slate-400 text-[10px] truncate mt-0.5">{show.network}</p>
      )}
      {dateLabel && (
        <p className="text-slate-500 text-[10px] mt-0.5">{dateLabel}</p>
      )}
    </Link>
  )
}

export default function RecommendedForYou({ className = '' }) {
  const { user, token, isAuthenticated } = useAuth()
  // Fallback: read token directly from Amplify/Cognito session if useAuth token is null
  function getToken() {
    if (token) return token
    try {
      const session = JSON.parse(localStorage.getItem('airdate_session') || '{}')
      return session?.tokens?.idToken?.toString() ||
             session?.idToken?.jwtToken ||
             session?.accessToken?.jwtToken || ''
    } catch { return '' }
  }

  const [shows,     setShows]     = useState([])
  const [label,     setLabel]     = useState('Recommended for You')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [strategy,  setStrategy]  = useState('')
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !user?.sub || fetchedRef.current) return
    fetchedRef.current = true
    fetchRecs()
  }, [isAuthenticated, user])

  async function fetchRecs() {
    setLoading(true)
    setError('')
    try {
      const t = getToken()
      const res = await fetch(`${API}/user/${user.sub}/recs`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setShows(data.results  || [])
      setLabel(data.label    || 'Recommended for You')
      setStrategy(data.strategy || '')
    } catch (err) {
      console.error('Recs fetch error:', err)
      setError('Could not load recommendations.')
    } finally {
      setLoading(false)
    }
  }

  // Don't render for logged-out users
  if (!isAuthenticated) return null

  // Don't render if empty and not loading
  if (!loading && shows.length === 0 && !error) return null

  return (
    <section className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {/* Icon */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600
                          flex items-center justify-center">
            <i className="fa-solid fa-wand-magic-sparkles text-white text-[11px]"/>
          </div>
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-widest leading-tight">
              {label}
            </h2>
            {strategy === 'fm' && (
              <p className="text-slate-500 text-[10px] font-medium mt-0.5">
                AI-powered · Factorization Machine
              </p>
            )}
            {strategy === 'genre_affinity' && (
              <p className="text-slate-500 text-[10px] font-medium mt-0.5">
                Based on your network + genre preferences
              </p>
            )}
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={() => { fetchedRef.current = false; fetchRecs() }}
          disabled={loading}
          className="text-slate-500 hover:text-cyan-400 transition-colors text-xs"
          title="Refresh recommendations"
        >
          <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''}`}/>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-none w-[140px] sm:w-[160px]">
              <div className="aspect-[2/3] rounded-xl bg-slate-800 animate-pulse mb-2"/>
              <div className="h-2.5 bg-slate-800 rounded animate-pulse w-3/4 mb-1"/>
              <div className="h-2 bg-slate-800 rounded animate-pulse w-1/2"/>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-slate-500 text-sm">{error}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory
                        scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent
                        [-webkit-overflow-scrolling:touch]">
          {shows.map((show, i) => (
            <ShowPill key={`${show.id}-${i}`} show={show}/>
          ))}
        </div>
      )}
    </section>
  )
}
