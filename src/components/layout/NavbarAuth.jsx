// src/components/layout/NavbarAuth.jsx
// Drop-in replacement for the static Sign In button in your Navbar.
// Import and place this exactly where the current <a href="/signin"> sits.
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function NavbarAuth() {
  const { isAuthenticated, user, signOut } = useAuth()
  const navigate  = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => navigate('/auth/login')}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-xl transition-all group"
      >
        <i className="fa-solid fa-circle-user text-cyan-400 text-base"/>
        <span className="font-black text-xs uppercase tracking-widest text-slate-200 hidden sm:inline">
          Sign In
        </span>
      </button>
    )
  }

  const initials = (user?.name || user?.email || '?')[0].toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-xl transition-all
          ${open
            ? 'bg-slate-800 border-cyan-500/30'
            : 'bg-slate-800/60 border-white/10 hover:border-cyan-500/20 hover:bg-slate-800'}`}
      >
        {/* Avatar */}
        {user?.picture
          ? <img src={user.picture} alt={user.name}
              className="w-7 h-7 rounded-lg object-cover flex-shrink-0"/>
          : (
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-cyan-400">{initials}</span>
            </div>
          )
        }
        <span className="font-bold text-xs text-slate-200 hidden sm:inline max-w-[100px] truncate">
          {user?.name || user?.email?.split('@')[0]}
        </span>
        <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[200]">
          {/* User info */}
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-white text-xs font-bold truncate">{user?.name}</p>
            <p className="text-slate-500 text-[10px] truncate mt-0.5">{user?.email}</p>
            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest
              ${user?.tier === 'premium'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                : 'bg-slate-800 text-slate-500 border border-white/8'}`}>
              {user?.tier === 'premium' ? '★ Premium' : 'Free Plan'}
            </span>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <MenuItem icon="fa-circle-user" label="My Account"     onClick={() => { navigate('/account');       setOpen(false) }}/>
            <MenuItem icon="fa-bell"         label="Notifications"  onClick={() => { navigate('/notifications'); setOpen(false) }}/>
            <MenuItem icon="fa-bookmark"     label="My Watchlist"   onClick={() => { navigate('/watchlist');    setOpen(false) }}/>
          </div>

          {user?.tier !== 'premium' && (
            <div className="border-t border-white/8 py-1">
              <button
                onClick={() => { navigate('/upgrade'); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black text-amber-400 hover:text-amber-300 hover:bg-amber-500/5 transition-colors"
              >
                <i className="fa-solid fa-star w-4 text-center"/>
                Upgrade to Premium
              </button>
            </div>
          )}

          <div className="border-t border-white/8 py-1">
            <button
              onClick={async () => { await signOut(); navigate('/'); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
            >
              <i className="fa-solid fa-right-from-bracket w-4 text-center"/>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
    >
      <i className={`fa-solid ${icon} w-4 text-center text-slate-500`}/>
      {label}
    </button>
  )
}
