// src/components/layout/Navbar.jsx
// Exact port of the <nav id="airdate-nav"> from index.html

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth }          from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'
import { loginWithHostedUI } from '@/services/authService'

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const { unreadCount, notifications, markAllRead, fetchNotifications } = useNotifications()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Close mobile menu on route change
  useEffect(() => setMobileOpen(false), [location])

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const email = user?.signInDetails?.loginId ?? ''

  return (
    <nav id="airdate-nav" className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-white/5">
      <div className="w-full max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex-shrink-0 transition-opacity hover:opacity-80">
          <img src="/assets/images/official-airdate-logo.png" alt="AirDate" className="h-16 w-auto object-contain mb-1" />
          <p className="text-slate-200 text-xs font-normal leading-tight">Track TV Premieres Before They Trend.</p>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          <Link to="/" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
            <i className="fa-solid fa-house mr-1.5"></i>Home
          </Link>
          <Link to="/premieres" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
            <i className="fa-solid fa-calendar mr-1.5"></i>Premieres
          </Link>
          <Link to="/trending" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
            <i className="fa-solid fa-arrow-trend-up mr-1.5"></i>Trending
          </Link>
          <Link to="/scoop" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
            <i className="fa-solid fa-fire mr-1.5"></i>The Scoop
          </Link>
          {isAuthenticated && (
            <Link to="/account" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
              <i className="fa-solid fa-heart mr-1.5"></i>My Pulse
            </Link>
          )}

          {/* About dropdown */}
          <div className="relative group">
            <button className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 flex items-center gap-1.5 transition-all">
              <i className="fa-solid fa-circle-info"></i>About
              <i className="fa-solid fa-chevron-down text-[8px] opacity-50 group-hover:rotate-180 transition-transform"></i>
            </button>
            <div className="absolute top-full left-0 mt-1 w-40 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <Link to="/vision"  className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors"><i className="fa-solid fa-rocket w-4"></i>Vision</Link>
              <Link to="/privacy" className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors"><i className="fa-solid fa-shield w-4"></i>Privacy</Link>
              <Link to="/terms"   className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors"><i className="fa-solid fa-file-lines w-4"></i>Terms</Link>
            </div>
          </div>
        </div>

        {/* Right side: bell + auth */}
        <div className="flex items-center gap-3">

          {/* Notification bell (authenticated only) */}
          {isAuthenticated && (
            <div className="relative group" id="notif-bell">
              <button
                className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/60 border border-white/10 hover:border-cyan-500/30 hover:bg-slate-800 transition-all duration-150"
                onClick={markAllRead}
              >
                <i className="fa-solid fa-bell text-slate-200 group-hover:text-cyan-400 text-sm transition-colors"></i>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-cyan-500 text-slate-950 text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-white text-xs font-black uppercase tracking-widest">Notifications</span>
                  <button onClick={markAllRead} className="text-cyan-400 text-[10px] font-bold hover:text-cyan-300 transition-colors uppercase tracking-widest">Mark all read</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0
                    ? <div className="px-4 py-6 text-center text-slate-400 text-xs">No new notifications</div>
                    : notifications.slice(0, 5).map(n => (
                        <div key={n.id} className={`px-4 py-3 border-b border-white/5 ${!n.read ? 'bg-cyan-500/5' : ''}`}>
                          <p className="text-xs text-slate-200 font-medium">{n.message}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</p>
                        </div>
                      ))
                  }
                </div>
                <div className="border-t border-white/5 px-4 py-2.5">
                  <Link to="/notifications" className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest hover:text-cyan-300 transition-colors">
                    View all notifications →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Auth button / profile dropdown */}
          {isAuthenticated ? (
            <div className="relative group" id="auth-dropdown-wrapper">
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-xl transition-all group-hover:border-cyan-500/30">
                <i className="fa-solid fa-circle-check text-green-400 text-sm"></i>
                <span className="font-bold text-xs uppercase tracking-widest text-slate-200 hidden sm:inline">Account</span>
                <i className="fa-solid fa-chevron-down text-[8px] text-slate-200 opacity-60 group-hover:rotate-180 transition-transform duration-150"></i>
              </button>
              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-white text-xs font-bold truncate">{email}</p>
                  <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Free Plan</p>
                </div>
                <div className="py-1">
                  <Link to="/account" className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors">
                    <i className="fa-solid fa-circle-user w-4 text-cyan-400"></i> My Account
                  </Link>
                  <Link to="/premieres" className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors">
                    <i className="fa-solid fa-calendar w-4 text-violet-400"></i> Premieres
                  </Link>
                  <Link to="/notifications" className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors">
                    <i className="fa-solid fa-bell w-4 text-amber-400"></i> Notifications
                  </Link>
                </div>
                <div className="border-t border-white/5 py-1">
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors">
                    <i className="fa-solid fa-right-from-bracket w-4"></i> Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => loginWithHostedUI()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-xl transition-all"
            >
              <i className="fa-solid fa-user-circle text-cyan-400 text-sm"></i>
              <span className="font-bold text-xs uppercase tracking-widest text-slate-200 hidden sm:inline">Sign In</span>
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-btn"
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/60 border border-white/10 text-slate-200 hover:text-white transition-colors"
          >
            <i className="fa-solid fa-bars text-sm"></i>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-white/5 bg-slate-950/95">
          <div className="px-6 py-4 flex flex-col gap-1">
            <Link to="/"          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-house w-4"></i>Home</Link>
            <Link to="/premieres" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-calendar w-4"></i>Premieres</Link>
            <Link to="/trending"  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-arrow-trend-up w-4"></i>Trending</Link>
            <Link to="/scoop"     className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-fire w-4"></i>The Scoop</Link>
            {isAuthenticated && (
              <Link to="/account" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-heart w-4"></i>My Pulse</Link>
            )}
            <div className="border-t border-white/5 mt-2 pt-2">
              <Link to="/vision"  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-rocket w-4"></i>Vision</Link>
              <Link to="/privacy" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-shield w-4"></i>Privacy</Link>
              <Link to="/terms"   className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-file-lines w-4"></i>Terms</Link>
            </div>
            <div className="border-t border-white/5 mt-2 pt-2">
              {isAuthenticated
                ? <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/5 w-full"><i className="fa-solid fa-right-from-bracket w-4"></i>Sign Out</button>
                : <button onClick={() => loginWithHostedUI()} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-cyan-400 hover:bg-white/5 w-full text-left"><i className="fa-solid fa-user-circle w-4"></i>Sign In</button>
              }
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
