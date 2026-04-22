// src/context/NotificationContext.jsx
// Fixed: correct API routes from aws apigatewayv2 get-routes output
//
// Actual routes:
//   GET  /user/{sub}/notifications          ← fetch notifications
//   PUT  /user/{sub}/notifications/read-all ← mark all read
//   PUT  /user/{sub}/notifications/read     ← mark one read

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { token, user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [loading,       setLoading]       = useState(false)
  const isFetching = useRef(false)

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!token || !isAuthenticated || !user?.sub || isFetching.current) return
    isFetching.current = true
    setLoading(true)
    try {
      // Correct route: GET /user/{sub}/notifications
      const res = await fetch(`${API_BASE}/user/${user.sub}/notifications`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const notifs = data.notifications ?? data.items ?? []
      setNotifications(notifs)
      setUnreadCount(notifs.filter(n => !n.read).length)
    } catch {
      // Silently fail — never log CORS/network errors
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [token, isAuthenticated, user?.sub])

  // Fetch on sign in, clear on sign out
  useEffect(() => {
    if (isAuthenticated && token && user?.sub) {
      fetchNotifications()
    } else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [isAuthenticated, token, user?.sub])

  // ── Mark all read ──────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!token || !user?.sub) return
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    // Correct route: PUT /user/{sub}/notifications/read-all
    fetch(`${API_BASE}/user/${user.sub}/notifications/read-all`, {
      method: 'PUT',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }).catch(() => {})
  }, [token, user?.sub])

  // ── Mark single notification read ──────────────────────────────────────────
  const markRead = useCallback(async (notifId) => {
    if (!token || !user?.sub) return
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
    // Correct route: PUT /user/{sub}/notifications/read
    fetch(`${API_BASE}/user/${user.sub}/notifications/read`, {
      method: 'PUT',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ notifId }),
    }).catch(() => {})
  }, [token, user?.sub])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      markAllRead,
      markRead,
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