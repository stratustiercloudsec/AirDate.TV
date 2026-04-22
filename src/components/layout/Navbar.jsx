// src/components/layout/Navbar.jsx
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth }          from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'

export function Navbar() {
  // FIX 1: useAuth exports signOut, not logout
  // FIX 2: user shape is { email, name, sub, tier } — not Amplify's signInDetails
  const { isAuthenticated, user, signOut } = useAuth()
  const { unreadCount, notifications, markAllRead } = useNotifications()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Close mobile menu on route change
  useEffect(() => setMobileOpen(false), [location])

  // FIX 1: was `logout()` — now `signOut()`
  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  // FIX 2: was user?.signInDetails?.loginId — now user?.email
  const displayEmail = user?.email ?? ''
  const displayName  = user?.name  ?? displayEmail.split('@')[0] ?? 'Account'

  // Auth pages should render without the navbar chrome interfering —
  // hide the navbar on auth routes so the full-screen auth layout shows cleanly
  const isAuthRoute = location.pathname.startsWith('/auth')
  if (isAuthRoute) return null

  return (
    <nav
      id="airdate-nav"
      className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-white/5"
    >
      <div className="w-full max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex-shrink-0 transition-opacity hover:opacity-80">
          <img
            src="/assets/images/official-airdate-logo.png"
            alt="AirDate"
            className="h-16 w-auto object-contain mb-1"
          />
          <p className="text-slate-200 text-xs font-normal leading-tight">
            Track TV Premieres Before They Trend.
          </p>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          <Link to="/" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
            <i className="fa-solid fa-house mr-1.5"/>Home
          </Link>
          <Link to="/premieres" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
            <i className="fa-solid fa-calendar mr-1.5"/>Premieres
          </Link>
          <Link to="/trending" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
            <i className="fa-solid fa-arrow-trend-up mr-1.5"/>Trending
          </Link>
          <Link to="/scoop" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
            <i className="fa-solid fa-fire mr-1.5"/>The Scoop
          </Link>
          {isAuthenticated && (
            <Link to="/pulse" className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
              <i className="fa-solid fa-heart mr-1.5"/>My Pulse
            </Link>
          )}

          {/* About dropdown */}
          <div className="relative group">
            <button className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 flex items-center gap-1.5 transition-all">
              <i className="fa-solid fa-circle-info"/>About
              <i className="fa-solid fa-chevron-down text-[8px] opacity-50 group-hover:rotate-180 transition-transform"/>
            </button>
            <div className="absolute top-full left-0 mt-1 w-40 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <Link to="/vision"  className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors"><i className="fa-solid fa-rocket w-4"/>Vision</Link>
              <Link to="/privacy" className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors"><i className="fa-solid fa-shield w-4"/>Privacy</Link>
              <Link to="/terms"   className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors"><i className="fa-solid fa-file-lines w-4"/>Terms</Link>
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
                <i className="fa-solid fa-bell text-slate-200 group-hover:text-cyan-400 text-sm transition-colors"/>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-cyan-500 text-slate-950 text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {/* Notification dropdown */}
              <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-white text-xs font-black uppercase tracking-widest">Notifications</span>
                  <button
                    onClick={markAllRead}
                    className="text-cyan-400 text-[10px] font-bold hover:text-cyan-300 transition-colors uppercase tracking-widest"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0
                    ? <div className="px-4 py-6 text-center text-slate-400 text-xs">No new notifications</div>
                    : notifications.slice(0, 5).map(n => (
                        <div key={n.id} className={`px-4 py-3 border-b border-white/5 ${!n.read ? 'bg-cyan-500/5' : ''}`}>
                          <p className="text-xs text-slate-200 font-medium">{n.message}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </p>
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
                {/* Show avatar if Google user has picture, else generic icon */}
                {user?.picture
                  ? <img src={user.picture} alt={displayName} className="w-5 h-5 rounded-full object-cover"/>
                  : <i className="fa-solid fa-circle-check text-green-400 text-sm"/>
                }
                <span className="font-bold text-xs uppercase tracking-widest text-slate-200 hidden sm:inline max-w-[100px] truncate">
                  {displayName}
                </span>
                <i className="fa-solid fa-chevron-down text-[8px] text-slate-200 opacity-60 group-hover:rotate-180 transition-transform duration-150"/>
              </button>

              {/* Account dropdown */}
              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="px-4 py-3 border-b border-white/5">
                  {/* FIX 2: use user.email directly */}
                  <p className="text-white text-xs font-bold truncate">{displayEmail}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5
                    ${user?.tier === 'premium' ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {user?.tier === 'premium' ? '★ Premium' : 'Free Plan'}
                  </p>
                </div>
                <div className="py-1">
                  <Link to="/account" className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors">
                    <i className="fa-solid fa-circle-user w-4 text-cyan-400"/> My Account
                  </Link>
                  <Link to="/pulse" className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors">
                    <i className="fa-solid fa-heart w-4 text-rose-400"/> My Pulse
                  </Link>
                  <Link to="/notifications" className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors">
                    <i className="fa-solid fa-bell w-4 text-amber-400"/> Notifications
                  </Link>
                </div>
                {user?.tier !== 'premium' && (
                  <div className="border-t border-white/5 py-1">
                    <Link to="/upgrade" className="flex items-center gap-3 px-4 py-2.5 text-xs font-black text-amber-400 hover:text-amber-300 hover:bg-amber-500/5 transition-colors">
                      <i className="fa-solid fa-star w-4"/> Upgrade to Premium
                    </Link>
                  </div>
                )}
                <div className="border-t border-white/5 py-1">
                  {/* FIX 1: was handleLogout → signOut (renamed for clarity) */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
                  >
                    <i className="fa-solid fa-right-from-bracket w-4"/> Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // FIX 3: was loginWithHostedUI() — now navigates to custom LoginPage
            <button
              onClick={() => navigate('/auth/login')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-xl transition-all"
            >
              <i className="fa-solid fa-user-circle text-cyan-400 text-sm"/>
              <span className="font-bold text-xs uppercase tracking-widest text-slate-200 hidden sm:inline">
                Sign In
              </span>
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-btn"
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/60 border border-white/10 text-slate-200 hover:text-white transition-colors"
          >
            <i className="fa-solid fa-bars text-sm"/>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-white/5 bg-slate-950/95">
          <div className="px-6 py-4 flex flex-col gap-1">
            <Link to="/"          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-house w-4"/>Home</Link>
            <Link to="/premieres" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-calendar w-4"/>Premieres</Link>
            <Link to="/trending"  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-arrow-trend-up w-4"/>Trending</Link>
            <Link to="/scoop"     className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-fire w-4"/>The Scoop</Link>
            {isAuthenticated && (
              <Link to="/pulse" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-heart w-4"/>My Pulse</Link>
            )}
            <div className="border-t border-white/5 mt-2 pt-2">
              <Link to="/vision"  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-rocket w-4"/>Vision</Link>
              <Link to="/privacy" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-shield w-4"/>Privacy</Link>
              <Link to="/terms"   className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5"><i className="fa-solid fa-file-lines w-4"/>Terms</Link>
            </div>
            <div className="border-t border-white/5 mt-2 pt-2">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/5 w-full"
                >
                  <i className="fa-solid fa-right-from-bracket w-4"/>Sign Out
                </button>
              ) : (
                // FIX 3: navigate to custom login page instead of hosted UI
                <button
                  onClick={() => navigate('/auth/login')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-cyan-400 hover:bg-white/5 w-full text-left"
                >
                  <i className="fa-solid fa-user-circle w-4"/>Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}