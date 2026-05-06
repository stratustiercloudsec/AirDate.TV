// src/pages/UpdateSuccessPage.jsx
// Shown after successful Stripe checkout — upgrade-success.html
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useEffect } from 'react'

export function UpdateSuccessPage() {
  const { loadSession } = useAuth()

  // Re-load the session so the new Pro tier is reflected immediately
  useEffect(() => { loadSession() }, [loadSession])

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-24 h-24 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto mb-8">
          <i className="fa-solid fa-bolt text-cyan-400 text-4xl"></i>
        </div>
        <h1 className="text-4xl font-black text-white mb-4">You're Pro Now</h1>
        <p className="text-slate-200 mb-2">Your account has been upgraded. Unlimited tracking, early alerts, and full Scoop access are now active.</p>
        <p className="text-slate-200 text-sm mb-10">It may take a moment for your tier to refresh — sign out and back in if needed.</p>
        <div className="flex flex-col gap-3">
          <Link to="/" className="h-12 bg-cyan-500 text-slate-950 font-black rounded-xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all">
            <i className="fa-solid fa-house"></i> Back to AirDate
          </Link>
          <Link to="/account" className="h-12 bg-slate-800 border border-white/10 text-white font-bold rounded-xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:border-white/30 transition-all">
            View Account
          </Link>
        </div>
      </div>
    </div>
  )
}
