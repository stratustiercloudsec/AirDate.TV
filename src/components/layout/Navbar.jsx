// src/components/layout/Navbar.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth }             from '@/context/AuthContext'
import { useNotifications }    from '@/context/NotificationContext'
import { usePushSubscription } from '@/hooks/usePushSubscription'

export function Navbar() {
  const { isAuthenticated, user, signOut } = useAuth()
  const { unreadCount, notifications, markAllRead, markRead } = useNotifications()
  const { isSupported, isSubscribed, permissionState, subscribeToPush, unsubscribeFromPush } = usePushSubscription()
  const [pushLoading, setPushLoading] = useState(false)

  const [mobileOpen, setMobileOpen] = useState(false)
  const [bellOpen,   setBellOpen]   = useState(false)  // ← click-controlled, not hover

  const bellRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  // Close mobile menu on route change
  useEffect(() => setMobileOpen(false), [location])

  // Close bell dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false)
      }
    }
    if (bellOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen])

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  const displayEmail = user?.email ?? ''
  const displayName  = user?.name  ?? displayEmail.split('@')[0] ?? 'Account'

  const isAuthRoute = location.pathname.startsWith('/auth')
  if (isAuthRoute) return null

  // Notification items shaped for the dropdown
  // DynamoDB shape: { created_at, shows[], read, type }
  const previewNotifs = notifications.slice(0, 5)

  function handleBellClick() {
    setBellOpen(v => !v)
    // Do NOT auto-mark-all-read on open — user should explicitly dismiss
  }

  function handleMarkAllRead(e) {
    e.stopPropagation()
    markAllRead()
  }

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
          <NavLink to="/"         icon="fa-house"          label="Home"/>
          <NavLink to="/premieres" icon="fa-calendar"       label="Premieres"/>
          <NavLink to="/trending"  icon="fa-arrow-trend-up" label="Trending"/>
          <NavLink to="/scoop"     icon="fa-fire"           label="The Scoop"/>
          {isAuthenticated && (
            <NavLink to="/pulse"   icon="fa-heart"          label="My Pulse"/>
          )}
          <NavLink to="/about"     icon="fa-circle-info"    label="About"/>
        </div>

        {/* Right side: bell + auth */}
        <div className="flex items-center gap-3">

          {/* ── Notification bell ────────────────────────────────────────── */}
          {isAuthenticated && (
            <div className="relative" ref={bellRef}>
              <button
                onClick={handleBellClick}
                aria-label="Notifications"
                className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-150
                  ${bellOpen
                    ? 'bg-slate-800 border-cyan-500/30'
                    : 'bg-slate-800/60 border-white/10 hover:border-cyan-500/30 hover:bg-slate-800'}`}
              >
                <i className={`fa-solid fa-bell text-sm transition-colors ${bellOpen ? 'text-cyan-400' : 'text-slate-200'}`}/>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-cyan-500 text-slate-950 text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Bell dropdown */}
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[200]">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-white text-xs font-black uppercase tracking-widest">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-cyan-400 text-[10px] font-bold hover:text-cyan-300 transition-colors uppercase tracking-widest"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notification list */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                    {previewNotifs.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <div className="text-2xl mb-2">🔔</div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No notifications yet</p>
                      </div>
                    ) : (
                      previewNotifs.map(n => {
                        const isUnread = !n.read
                        const show     = n.shows?.[0]
                        const dateStr  = n.created_at
                          ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : ''
                        const label = show?.days_until === 0 ? 'TODAY' : show?.days_until === 1 ? 'TOMORROW' : dateStr

                        return (
                          <div
                            key={n.created_at}
                            onClick={() => {
                              if (isUnread) markRead(n.created_at)
                              setBellOpen(false)
                              navigate('/notifications')
                            }}
                            className={`px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 ${isUnread ? 'bg-cyan-500/5' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Poster thumbnail */}
                              {show?.poster ? (
                                <img
                                  src={show.poster}
                                  alt=""
                                  className="w-8 h-11 rounded-lg object-cover flex-shrink-0 mt-0.5"
                                />
                              ) : (
                                <div className="w-8 h-11 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <i className="fa-solid fa-tv text-cyan-400 text-[10px]"/>
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-cyan-400 text-[9px] font-black uppercase tracking-widest">
                                    Premiere Alert
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-500 text-[9px]">{dateStr}</span>
                                    {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0"/>}
                                  </div>
                                </div>
                                {(n.shows ?? []).slice(0, 2).map(s => (
                                  <div key={s.title} className="flex items-center justify-between gap-1">
                                    <span className="text-white text-xs font-bold truncate">{s.title}</span>
                                    <span className={`text-[9px] font-black uppercase tracking-widest flex-shrink-0
                                      ${s.days_until === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                      {s.days_until === 0 ? 'Today' : s.days_until === 1 ? 'Tomorrow' : label}
                                    </span>
                                  </div>
                                ))}
                                {(n.shows?.length ?? 0) > 2 && (
                                  <p className="text-slate-500 text-[9px] mt-0.5">
                                    +{n.shows.length - 2} more
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Push opt-in strip */}
                  {isSupported && !isSubscribed && permissionState !== 'denied' && (
                    <div className="border-t border-white/5 px-4 py-3 bg-cyan-500/5">
                      <button
                        onClick={async () => {
                          setPushLoading(true)
                          await subscribeToPush()
                          setPushLoading(false)
                        }}
                        disabled={pushLoading}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 hover:border-cyan-500/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pushLoading
                          ? <><i className="fa-solid fa-circle-notch fa-spin"/>Enabling…</>
                          : <><i className="fa-solid fa-bell-ring"/>Enable Push Alerts</>
                        }
                      </button>
                    </div>
                  )}

                  {/* Subscribed indicator + disable option */}
                  {isSupported && isSubscribed && (
                    <div className="border-t border-white/5 px-4 py-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-green-400">
                        <i className="fa-solid fa-circle-check text-[8px]"/>Push alerts on
                      </span>
                      <button
                        onClick={async () => {
                          setPushLoading(true)
                          await unsubscribeFromPush()
                          setPushLoading(false)
                        }}
                        disabled={pushLoading}
                        className="text-slate-500 hover:text-red-400 text-[9px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                      >
                        Turn off
                      </button>
                    </div>
                  )}

                  {/* Blocked state */}
                  {isSupported && permissionState === 'denied' && (
                    <div className="border-t border-white/5 px-4 py-2.5">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                        <i className="fa-solid fa-ban mr-1 text-red-400/60"/>
                        Push blocked — enable in browser settings
                      </p>
                    </div>
                  )}

                  {/* Footer link */}
                  <div className="border-t border-white/5 px-4 py-2.5 flex items-center justify-between">
                    <Link
                      to="/notifications"
                      onClick={() => setBellOpen(false)}
                      className="text-cyan-400 text-[10px] font-black uppercase tracking-widest hover:text-cyan-300 transition-colors"
                    >
                      View all notifications →
                    </Link>
                    {unreadCount > 0 && (
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Auth button / profile dropdown ───────────────────────────── */}
          {isAuthenticated ? (
            <div className="relative group" id="auth-dropdown-wrapper">
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-xl transition-all group-hover:border-cyan-500/30">
                {user?.picture
                  ? <img src={user.picture} alt={displayName} className="w-5 h-5 rounded-full object-cover"/>
                  : <i className="fa-solid fa-circle-check text-green-400 text-sm"/>
                }
                <span className="font-bold text-xs uppercase tracking-widest text-slate-200 hidden sm:inline max-w-[100px] truncate">
                  {displayName}
                </span>
                <i className="fa-solid fa-chevron-down text-[8px] text-slate-200 opacity-60 group-hover:rotate-180 transition-transform duration-150"/>
              </button>

              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-white text-xs font-bold truncate">{displayEmail}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5
                    ${(user?.tier === 'pro' || user?.tier === 'premium') ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {(user?.tier === 'pro' || user?.tier === 'premium') ? '★ Pro' : 'Free Plan'}
                  </p>
                </div>
                <div className="py-1">
                  <DropdownLink to="/account"       icon="fa-circle-user"  iconColor="text-cyan-400"  label="My Account"/>
                  <DropdownLink to="/pulse"          icon="fa-heart"        iconColor="text-rose-400"  label="My Pulse"/>
                  <DropdownLink to="/notifications"  icon="fa-bell"         iconColor="text-amber-400" label="Notifications"/>
                </div>
                {(user?.tier !== 'pro' && user?.tier !== 'premium') && (
                  <div className="border-t border-white/5 py-1">
                    <Link to="/upgrade" className="flex items-center gap-3 px-4 py-2.5 text-xs font-black text-amber-400 hover:text-amber-300 hover:bg-amber-500/5 transition-colors">
                      <i className="fa-solid fa-star w-4"/> Upgrade to Premium
                    </Link>
                  </div>
                )}
                <div className="border-t border-white/5 py-1">
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
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/60 border border-white/10 text-slate-200 hover:text-white transition-colors"
          >
            <i className="fa-solid fa-bars text-sm"/>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-slate-950/95">
          <div className="px-6 py-4 flex flex-col gap-1">
            <MobileLink to="/"          icon="fa-house"          label="Home"/>
            <MobileLink to="/premieres" icon="fa-calendar"       label="Premieres"/>
            <MobileLink to="/trending"  icon="fa-arrow-trend-up" label="Trending"/>
            <MobileLink to="/scoop"     icon="fa-fire"           label="The Scoop"/>
            {isAuthenticated && (
              <MobileLink to="/pulse"   icon="fa-heart"          label="My Pulse"/>
            )}
            <MobileLink to="/about"     icon="fa-circle-info"    label="About"/>

            <div className="border-t border-white/5 mt-2 pt-2">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/5 w-full"
                >
                  <i className="fa-solid fa-right-from-bracket w-4"/>Sign Out
                </button>
              ) : (
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

// ── Sub-components ────────────────────────────────────────────────────────────

function NavLink({ to, icon, label }) {
  return (
    <Link to={to} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
      <i className={`fa-solid ${icon} mr-1.5`}/>{label}
    </Link>
  )
}

function MobileLink({ to, icon, label }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5">
      <i className={`fa-solid ${icon} w-4`}/>{label}
    </Link>
  )
}

function DropdownLink({ to, icon, iconColor, label }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/5 transition-colors">
      <i className={`fa-solid ${icon} w-4 ${iconColor}`}/>{label}
    </Link>
  )
}