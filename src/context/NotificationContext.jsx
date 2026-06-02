// src/context/NotificationContext.jsx
//
// Data shape from DynamoDB (airdate-notifications):
//   PK: user_id (string)
//   SK: created_at (ISO string)
//   shows: [{ title, network, premiere_date, days_until, poster, id }]
//   read: boolean
//   alert_date: string
//   type: "premiere_alert"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'

const NotificationContext = createContext(null)

// Resolve the correct user sub regardless of how AuthContext exposes it
function getUserSub(user) {
  return user?.sub ?? user?.userId ?? user?.username ?? ''
}

export function NotificationProvider({ children }) {
  const { token, idToken, user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [loading,       setLoading]       = useState(false)
  const isFetching = useRef(false)

  function getBestToken() {
    if (idToken) return idToken
    try {
      const s = JSON.parse(localStorage.getItem('airdate_session') || '{}')
      return s.IdToken || s.id_token || token || ''
    } catch { return token || '' }
  }

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    const sub = getUserSub(user)
    if (!token || !isAuthenticated || !sub || isFetching.current) return
    isFetching.current = true
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/user/${sub}/notifications`, {
        headers: { Authorization: `Bearer ${getBestToken()}` },
      })
      if (!res.ok) return
      const data = await res.json()

      // Filter out any records with no shows (data integrity guard)
      const notifs = (data.notifications ?? data.items ?? [])
      setNotifications(notifs)
      setUnreadCount(data.unread_count ?? notifs.filter(n => !n.read).length)
    } catch {
      // Silently fail — never surface CORS / network errors to the user
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [token, isAuthenticated, user?.sub, user?.userId, user?.username])

  useEffect(() => {
    if (isAuthenticated && token && getUserSub(user)) {
      fetchNotifications()
    } else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [isAuthenticated, token, user?.sub, user?.userId, user?.username])

  // ── Mark all read ────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const sub = getUserSub(user)
    if (!token || !sub) return
    // Optimistic update immediately
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await fetch(`${API_BASE}/user/${sub}/notifications/read-all`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${getBestToken()}` },
      })
      // Re-fetch to confirm server state — ensures badge stays cleared after re-auth
      await fetchNotifications()
    } catch {}
  }, [token, user?.sub, user?.userId, user?.username, fetchNotifications])

  // ── Mark single read ─────────────────────────────────────────────────────
  // Lambda expects { created_at } in the request body (not notifId)
  // because created_at is the DynamoDB sort key
  const markRead = useCallback(async (createdAt) => {
    const sub = getUserSub(user)
    if (!token || !sub || !createdAt) return

    // Optimistic update keyed on created_at
    setNotifications(prev =>
      prev.map(n => n.created_at === createdAt ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    fetch(`${API_BASE}/user/${sub}/notifications/read`, {
      method:  'PUT',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${getBestToken()}`,
      },
      body: JSON.stringify({ created_at: createdAt }),
    }).catch(() => {})
  }, [token, user?.sub, user?.userId, user?.username])

  // ── Clear all ────────────────────────────────────────────────────────────
  const clearAll = useCallback(async () => {
    const sub = getUserSub(user)
    if (!token || !sub) return
    // Optimistic clear immediately
    setNotifications([])
    setUnreadCount(0)
    // DELETE from DynamoDB — persists across sessions
    fetch(`${API_BASE}/user/${sub}/notifications`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${getBestToken()}` },
    }).catch(() => {})
  }, [token, user?.sub, user?.userId, user?.username])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      markAllRead,
      markRead,
      clearAll,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}