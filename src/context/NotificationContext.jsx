// src/context/NotificationContext.jsx
// Drives the bell dropdown + /notifications page from v2.36

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { USER_API as API_BASE } from '@/config/aws'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { token, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [loading, setLoading]             = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.notifications?.filter(n => !n.read).length ?? 0)
    } catch (err) {
      console.error('Failed to fetch notifications', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isAuthenticated) fetchNotifications()
  }, [isAuthenticated, fetchNotifications])

  const markAllRead = useCallback(async () => {
    if (!token) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    await fetch(`${API_BASE}/notifications/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(console.error)
  }, [token])

  const markRead = useCallback(async (notifId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

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
