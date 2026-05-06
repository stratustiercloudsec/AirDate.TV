// src/components/guards/index.jsx

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'

// ── ProtectedRoute ────────────────────────────────────────────────────────────
// Redirects unauthenticated users to the Cognito hosted UI login
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="auth-loading bg-slate-950 min-h-screen"></div>
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

// ── FreemiumGate ──────────────────────────────────────────────────────────────
// Wraps any premium feature — shows upgrade prompt when at the free-plan limit
export function FreemiumGate({ children, fallback }) {
  const { isPremium } = useAuth()
  const { atLimit }   = useWatchlist()

  if (!isPremium && atLimit) {
    return fallback ?? (
      <div className="freemium-gate p-6 bg-slate-900/60 border border-cyan-500/20 rounded-2xl text-center">
        <i className="fa-solid fa-bolt text-cyan-400 text-2xl mb-3 block"></i>
        <p className="text-white font-black text-sm uppercase tracking-widest mb-1">Free Plan Limit Reached</p>
        <p className="text-slate-400 text-xs mb-4">Upgrade to track unlimited shows.</p>
        <a href="/upgrade" className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all">
          <i className="fa-solid fa-bolt text-xs"></i> Upgrade to Pro
        </a>
      </div>
    )
  }
  return children
}
