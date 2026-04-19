// src/context/AuthContext.jsx

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getSession, logout as authLogout } from '@/services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(null)
  const [loading, setLoading] = useState(true)

  const loadSession = useCallback(async () => {
    setLoading(true)
    const session = await getSession()
    if (session) {
      setUser(session.user)
      setToken(session.token)
    } else {
      setUser(null)
      setToken(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  const logout = useCallback(async () => {
    await authLogout()
    setUser(null)
    setToken(null)
  }, [])

  // Freemium gate: user must be authenticated
  const isAuthenticated = !!user

  // Premium check — extend this when you add plan tiers to Cognito custom attributes
  const isPremium = isAuthenticated && user?.signInDetails?.loginId !== undefined

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, isPremium, loadSession, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
