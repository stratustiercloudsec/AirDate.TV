// src/context/WatchlistContext.jsx
// Fixed: correct API routes from aws apigatewayv2 get-routes output
//
// Actual routes:
//   GET    /user/{sub}                    ← get full user profile + watchlist
//   POST   /user/{sub}/pulse              ← add show to watchlist
//   DELETE /user/{sub}/pulse/{show_id}    ← remove show from watchlist
//   POST   /user/{sub}/history            ← log view history

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'

const WatchlistContext = createContext(null)

const FREEMIUM_LIMIT = 5

export function WatchlistProvider({ children }) {
  const { token, user, isAuthenticated } = useAuth()
  const [watchlist, setWatchlist] = useState([])
  const [loading,   setLoading]   = useState(false)

  // ── Load watchlist on sign in ────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && token && user?.sub) {
      loadWatchlist()
    } else {
      setWatchlist([])
    }
  }, [isAuthenticated, token, user?.sub])

  async function loadWatchlist() {
    if (!token || !user?.sub) return
    setLoading(true)
    try {
      // Correct route: GET /user/{sub}
      const res = await fetch(`${API_BASE}/user/${user.sub}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      // Lambda returns watchlist inside user profile object
      const list = data.watchlist ?? data.pulse ?? data.shows ?? data.items ?? []
      setWatchlist(list)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  // ── Toggle track / untrack ────────────────────────────────────────────────
  const toggleWatchlist = useCallback((show) => {
    if (!isAuthenticated || !user?.sub) return { error: 'NOT_AUTHENTICATED' }

    const alreadyTracked = watchlist.some(s => String(s.id) === String(show.id))

    // Freemium gate
    if (!alreadyTracked && watchlist.length >= FREEMIUM_LIMIT && user?.tier !== 'premium') {
      return { error: 'FREEMIUM_LIMIT' }
    }

    // Optimistic update
    if (alreadyTracked) {
      setWatchlist(prev => prev.filter(s => String(s.id) !== String(show.id)))
    } else {
      setWatchlist(prev => [...prev, show])
    }

    // Persist — fire and forget
    if (token && user?.sub) {
      if (alreadyTracked) {
        // Correct route: DELETE /user/{sub}/pulse/{show_id}
        fetch(`${API_BASE}/user/${user.sub}/pulse/${show.id}`, {
          method:  'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
      } else {
        // Correct route: POST /user/{sub}/pulse
        fetch(`${API_BASE}/user/${user.sub}/pulse`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            show: {
              id:             show.id,
              name:           show.name         ?? show.title ?? '',
              poster_path:    show.poster_path  ?? null,
              poster:         show.poster       ?? null,
              first_air_date: show.first_air_date ?? null,
              network:        show.network      ?? show.networks?.[0]?.name ?? '',
            },
          }),
        }).catch(() => {})
      }
    }

    return { success: true, tracked: !alreadyTracked }
  }, [watchlist, isAuthenticated, token, user])

  // ── Log history (call when a show detail page is viewed) ─────────────────
  const logHistory = useCallback((show) => {
    if (!token || !user?.sub || !show?.id) return
    // Correct route: POST /user/{sub}/history
    fetch(`${API_BASE}/user/${user.sub}/history`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        showId:   show.id,
        showData: show,
      }),
    }).catch(() => {})
  }, [token, user?.sub])

  const isTracked = useCallback(
    (showId) => watchlist.some(s => String(s.id) === String(showId)),
    [watchlist]
  )

  const atLimit = user?.tier !== 'premium' && watchlist.length >= FREEMIUM_LIMIT

  return (
    <WatchlistContext.Provider value={{
      watchlist,
      loading,
      toggleWatchlist,
      isTracked,
      atLimit,
      logHistory,
      reload: loadWatchlist,
    }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext)
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider')
  return ctx
}