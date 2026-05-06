// src/components/auth/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute({ children, requirePremium = false }) {
  const { isAuthenticated, isPremium, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="bg-slate-950 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"/>
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Loading…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace/>
  }

  if (requirePremium && !isPremium) {
    return <Navigate to="/upgrade" replace/>
  }

  return children
}
