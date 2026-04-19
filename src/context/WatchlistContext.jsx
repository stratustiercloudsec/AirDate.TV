// src/context/WatchlistContext.jsx
// Replaces pulse.js — watchlist, history, and preferences via airdate-user-data Lambda

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { USER_API as API_BASE } from '@/config/aws'

const WatchlistContext = createContext(null)

const FREEMIUM_LIMIT = 5  // 402 gate threshold

async function fetchUserData(token) {
  const res = await fetch(`${API_BASE}/user-data`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch user data')
  return res.json()
}

async function saveUserData(token, payload) {
  const res = await fetch(`${API_BASE}/user-data`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to save user data')
  return res.json()
}

export function WatchlistProvider({ children }) {
  const { token, isAuthenticated, isPremium } = useAuth()
  const [watchlist, setWatchlist]   = useState([])   // [{ id, name, poster, ... }]
  const [history, setHistory]       = useState([])   // [{ id, name, watchedAt }]
  const [preferences, setPreferences] = useState({}) // genre prefs, notification settings, etc.
  const [loading, setLoading]       = useState(false)
  const syncTimer = useRef(null)

  // Load from DynamoDB on auth
  useEffect(() => {
    if (!token) {
      setWatchlist([])
      setHistory([])
      setPreferences({})
      return
    }
    setLoading(true)
    fetchUserData(token)
      .then(data => {
        setWatchlist(data.watchlist ?? [])
        setHistory(data.history ?? [])
        setPreferences(data.preferences ?? {})
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  // Debounced sync to Lambda — batches rapid changes into one write
  const scheduleSave = useCallback((newWatchlist, newHistory, newPrefs) => {
    if (!token) return
    clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      saveUserData(token, {
        watchlist: newWatchlist,
        history: newHistory,
        preferences: newPrefs,
      }).catch(console.error)
    }, 800)
  }, [token])

  // ── Watchlist actions ─────────────────────────────────────────────────────

  const isTracked = useCallback(
    (showId) => watchlist.some(s => s.id === showId),
    [watchlist]
  )

  const addToWatchlist = useCallback((show) => {
    // Freemium gate — 402 equivalent
    if (!isPremium && watchlist.length >= FREEMIUM_LIMIT) {
      return { error: 'FREEMIUM_LIMIT', message: `Free accounts can track up to ${FREEMIUM_LIMIT} shows.` }
    }
    if (isTracked(show.id)) return { error: 'ALREADY_TRACKED' }

    const updated = [...watchlist, { ...show, trackedAt: Date.now() }]
    setWatchlist(updated)
    scheduleSave(updated, history, preferences)
    return { success: true }
  }, [watchlist, history, preferences, isTracked, isPremium, scheduleSave])

  const removeFromWatchlist = useCallback((showId) => {
    const updated = watchlist.filter(s => s.id !== showId)
    setWatchlist(updated)
    scheduleSave(updated, history, preferences)
  }, [watchlist, history, preferences, scheduleSave])

  const toggleWatchlist = useCallback((show) => {
    return isTracked(show.id) ? removeFromWatchlist(show.id) : addToWatchlist(show)
  }, [isTracked, addToWatchlist, removeFromWatchlist])

  // ── History actions ───────────────────────────────────────────────────────

  const addToHistory = useCallback((show) => {
    const alreadySeen = history.some(h => h.id === show.id)
    if (alreadySeen) return
    const updated = [{ ...show, watchedAt: Date.now() }, ...history].slice(0, 100)
    setHistory(updated)
    scheduleSave(watchlist, updated, preferences)
  }, [history, watchlist, preferences, scheduleSave])

  // ── Preferences ───────────────────────────────────────────────────────────

  const updatePreferences = useCallback((patch) => {
    const updated = { ...preferences, ...patch }
    setPreferences(updated)
    scheduleSave(watchlist, history, updated)
  }, [preferences, watchlist, history, scheduleSave])

  return (
    <WatchlistContext.Provider value={{
      watchlist,
      history,
      preferences,
      loading,
      isTracked,
      addToWatchlist,
      removeFromWatchlist,
      toggleWatchlist,
      addToHistory,
      updatePreferences,
      freemiumLimit: FREEMIUM_LIMIT,
      atLimit: !isPremium && watchlist.length >= FREEMIUM_LIMIT,
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
