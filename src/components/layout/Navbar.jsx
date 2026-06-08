// src/components/layout/Navbar.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth }             from '@/context/AuthContext'
import { useNotifications }    from '@/context/NotificationContext'
import { usePushSubscription } from '@/hooks/usePushSubscription'

export function Navbar() {
  const { isAuthenticated, user, signOut } = useAuth()
  const { unreadCount, notifications, markAllRead, markRead, clearAll } = useNotifications()
  const { isSupported, isSubscribed, permissionState, subscribeToPush, unsubscribeFromPush } = usePushSubscription()
  const [pushLoading, setPushLoading] = useState(false)

  const [mobileOpen, setMobileOpen] = useState(false)
  const [bellOpen,   setBellOpen]   = useState(false)

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

  // ── Flatten notifications into individual per-show rows ─────────────────
  // DynamoDB batches multiple shows into a single notification document.
  // We unwrap them so each show gets its own tappable row with its own
  // deep-link to /details/:id instead of a dead-end group link.
  const previewRows = notifications
  .flatMap(n => {
    const showList = n.shows ?? n.premiering ?? null

    // Batch notification — unwrap each show into its own tappable row
    if (showList?.length) {
      return showList.map(show => ({
        notifCreatedAt: n.created_at,
        read:           n.read,
        type:           n.type,
        _show:          show,
      }))
    }

    // Single-show notification — treat the notification root as the show
    // (prevents notifications from silently disappearing when shows[] is absent)
    return [{
      notifCreatedAt: n.created_at,
      read:           n.read,
      type:           n.type,
      _show: {
        title:     n.title     ?? n.show_title ?? n.name ?? '',
        tmdb_id:   n.tmdb_id   ?? n.show_id    ?? null,
        poster:    n.poster    ?? n.poster_path ?? null,
        network:   n.network   ?? '',
        days_until: n.days_until ?? null,
      },
    }]
  })
  .slice(0, 5)

  function handleBellClick() {
    setBellOpen(v => !v)
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
            src="/assets/images/adtv-logo_tagline.png"
            alt="AirDate"
            className="h-20 w-auto object-contain"
          />
          <p className="text-slate-200 text-[10px] font-medium leading-tight hidden sm:block">
           {/* Track TV Premieres Before They Trend. */}
          </p>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink to="/search"          icon="fa-binoculars"  label="Search"/>
          <NavLink to="/premieres" icon="fa-calendar"       label="Premieres"/>
          <NavLink to="/trailers"  icon="fa-brands fa-youtube" label="Trailers"/>
          <NavLink to="/trending"  icon="fa-arrow-trend-up" label="Trending"/>
          <NavLink to="/scoop"     icon="fa-fire"           label="The Scoop"/>
          <NavLink to="/subscribe" icon="fa-envelope"       label="Subscribe"/>
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
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-cyan-400 text-[10px] font-bold hover:text-cyan-300 transition-colors uppercase tracking-widest"
                        >
                          Mark read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); clearAll(); setBellOpen(false) }}
                          className="text-slate-500 hover:text-red-400 text-[10px] font-bold transition-colors uppercase tracking-widest"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notification rows — one per show */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                    {previewRows.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <div className="text-2xl mb-2">🔔</div>
                        <p className="text-slate-200 text-xs font-bold uppercase tracking-widest">No notifications yet</p>
                      </div>
                    ) : (
                      previewRows.map((row, idx) => {
                        const { notifCreatedAt, read, _show: show, type: notifType } = row
                        const isUnread = !read

                        const dateStr = notifCreatedAt
                          ? new Date(notifCreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : ''

                        const dayLabel = (() => {
                          if (show?.days_until === 0) return 'Today'
                          if (show?.days_until === 1) return 'Tomorrow'
                          return dateStr
                        })()

                        const showId = show?.tmdb_id ?? show?.show_id ?? show?.id

                        // Per-type config
                        const TYPE_CFG = {
                          premiere_alert: { label: 'Premiere Alert',   icon: 'fa-tv',            color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   dot: 'bg-cyan-400',   unreadBg: 'bg-cyan-500/5'   },
                          comment_reply:  { label: 'Reply',             icon: 'fa-reply',         color: 'text-purple-400', bg: 'bg-purple-500/10', dot: 'bg-purple-400', unreadBg: 'bg-purple-500/5' },
                          reply:          { label: 'Reply',             icon: 'fa-reply',         color: 'text-purple-400', bg: 'bg-purple-500/10', dot: 'bg-purple-400', unreadBg: 'bg-purple-500/5' },
                          persona_update: { label: 'Persona Updated',  icon: 'fa-masks-theater', color: 'text-violet-400', bg: 'bg-violet-500/10', dot: 'bg-violet-400', unreadBg: 'bg-violet-500/5' },
                          show_expiry:    { label: 'Watchlist Update', icon: 'fa-calendar-xmark', color: 'text-amber-400',  bg: 'bg-amber-500/10',  dot: 'bg-amber-400',  unreadBg: 'bg-amber-500/5'  },
                        }
                        const cfg = TYPE_CFG[notifType] || TYPE_CFG.premiere_alert
                        const isPremiere = !notifType || notifType === 'premiere_alert'
                        const isReply    = notifType === 'comment_reply' || notifType === 'reply'
                        const isPersona  = notifType === 'persona_update'
                        const isExpiry   = notifType === 'show_expiry'

                        return (
                          <div
                            key={`${notifCreatedAt}-${show?.title ?? ''}-${idx}`}
                            onClick={() => {
                              if (isUnread) markRead(notifCreatedAt)
                              setBellOpen(false)
                              if (isPersona)       navigate('/persona')
                              else if (showId)     navigate(`/details/${showId}`)
                              else                 navigate('/notifications')
                            }}
                            className={`px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 ${isUnread ? cfg.unreadBg : ''}`}
                          >
                            <div className="flex items-start gap-3">

                              {/* Icon / poster */}
                              {isPremiere && show?.poster ? (
                                <img src={show.poster} alt=""
                                  className="w-8 h-11 rounded-lg object-cover flex-shrink-0 mt-0.5"/>
                              ) : (
                                <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                  <i className={`fa-solid ${cfg.icon} ${cfg.color} text-[10px]`}/>
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                {/* Row meta */}
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.color}`}>
                                    {cfg.label}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-200 text-[9px]">{dateStr}</span>
                                    {isUnread && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}/>}
                                  </div>
                                </div>

                                {/* Premiere Alert — show title + day */}
                                {isPremiere && (
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-white text-xs font-bold truncate">{show?.title}</span>
                                    <span className={`text-[9px] font-black uppercase tracking-widest flex-shrink-0
                                      ${show?.days_until === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                      {dayLabel}
                                    </span>
                                  </div>
                                )}
                                {isPremiere && show?.network && (
                                  <p className="text-slate-200 text-[9px] mt-0.5 truncate">{show.network}</p>
                                )}

                                {/* Comment Reply */}
                                {isReply && (
                                  <p className="text-white text-xs font-bold truncate">
                                    <span className="text-purple-300">{show?.replier || 'Someone'}</span> replied to your comment
                                    {show?.show_title && <span className="text-slate-400 font-normal"> on {show.show_title}</span>}
                                  </p>
                                )}

                                {/* Persona Updated */}
                                {isPersona && (
                                  <p className="text-white text-xs font-bold truncate">
                                    {show?.persona_label || 'Your persona has been refreshed'}
                                  </p>
                                )}

                                {/* Show Expiry */}
                                {isExpiry && (
                                  <p className="text-white text-xs font-bold truncate">
                                    {show?.show_title || show?.title || 'A show'} removed from watchlist
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
                        className="text-slate-200 hover:text-red-400 text-[9px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                      >
                        Turn off
                      </button>
                    </div>
                  )}

                  {/* Blocked state */}
                  {isSupported && permissionState === 'denied' && (
                    <div className="border-t border-white/5 px-4 py-2.5">
                      <p className="text-[9px] text-slate-200 uppercase tracking-widest">
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
                      <span className="text-[9px] font-black text-slate-200 uppercase tracking-widest">
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
                  <DropdownLink to="/persona"          icon="fa-heart"        iconColor="text-rose-400"  label="My Persona"/>
                  <DropdownLink to="/notifications"  icon="fa-bell"         iconColor="text-amber-400" label="Notifications"/>
                  <DropdownLink to="/subscribe"      icon="fa-envelope"     iconColor="text-cyan-400"  label="Subscribe"/>
                </div>
                {(user?.tier !== 'pro' && user?.tier !== 'premium') && (
                  <div className="border-t border-white/5 py-1">
                    <Link to="/upgrade" className="flex items-center gap-3 px-4 py-2.5 text-xs font-black text-amber-400 hover:text-amber-300 hover:bg-amber-500/5 transition-colors">
                      <i className="fa-solid fa-star w-4"/> Upgrade to Pro
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
            <MobileLink to="/"          icon="fa-binoculars"          label="Search"/>
            <MobileLink to="/premieres" icon="fa-calendar"       label="Premieres"/>
            <MobileLink to="/trailers"  icon="fa-brands fa-youtube" label="Trailers"/>
            <MobileLink to="/trending"  icon="fa-arrow-trend-up" label="Trending"/>
            <MobileLink to="/scoop"     icon="fa-fire"           label="The Scoop"/>
            <MobileLink to="/subscribe" icon="fa-envelope"       label="Subscribe"/>
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
  const iconClass = icon.startsWith('fa-brands') || icon.startsWith('fa-regular') || icon.startsWith('fa-solid')
    ? icon : `fa-solid ${icon}`
  return (
    <Link to={to} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white hover:bg-white/5 transition-all">
      <i className={`${iconClass} mr-1.5`}/>{label}
    </Link>
  )
}

function MobileLink({ to, icon, label }) {
  const iconClass = icon.startsWith('fa-brands') || icon.startsWith('fa-regular') || icon.startsWith('fa-solid')
    ? icon : `fa-solid ${icon}`
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-200 hover:text-white hover:bg-white/5">
      <i className={`${iconClass} w-4`}/>{label}
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