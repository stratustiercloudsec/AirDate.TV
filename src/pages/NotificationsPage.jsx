// src/pages/NotificationsPage.jsx
import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'
import { Footer } from '@/components/layout/Footer'

function SkeletonCard() {
  return (
    <div className="bg-slate-900 rounded-2xl p-5 border border-white/5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-14 rounded-lg bg-slate-800 animate-pulse flex-shrink-0"></div>
        <div className="flex-1 space-y-2 pt-1">
          <div className="flex items-center gap-3">
            <div className="h-3 w-24 bg-slate-800 rounded-full animate-pulse"></div>
            <div className="h-3 w-16 bg-slate-800 rounded-full animate-pulse"></div>
          </div>
          <div className="h-4 w-48 bg-slate-800 rounded-full animate-pulse"></div>
          <div className="h-3 w-20 bg-slate-800 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const { token, user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [filter, setFilter]               = useState('all')
  const [loading, setLoading]             = useState(true)

  const navigate = useNavigate()
  const sub = user?.sub || user?.userId || user?.username || ''

  const fetchNotifs = useCallback(async () => {
    if (!token || !sub) return
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/user/${sub}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const valid = (data.notifications ?? [])
      // Explode premiere_alert multi-show notifications — one card per show
      const exploded = valid.flatMap(n => {
        if (n.type !== 'premiere_alert' || (n.shows ?? []).length <= 1) return [n]
        return (n.shows ?? []).map((show, i) => ({
          ...n,
          shows: [show],
          _explodeKey: `${n.created_at}_${i}`,
        }))
      })
      setNotifications(exploded)
      setUnreadCount(data.unread_count ?? valid.filter(n => !n.read).length)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [token, sub])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  async function markOneRead(createdAt) {
    setNotifications(prev => prev.map(n => n.created_at === createdAt ? { ...n, read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
    try {
      await fetch(`${API_BASE}/user/${sub}/notifications/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_at: createdAt }),
      })
    } catch {}
  }

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await fetch(`${API_BASE}/user/${sub}/notifications/read-all`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` },
      })
    } catch {}
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'read')   return n.read
    return true
  })

  const filterBtn = (key, label) => (
    <button onClick={() => setFilter(key)}
      className={`filter-btn px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all
        ${filter === key ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-transparent text-slate-200 border-white/5 hover:text-slate-200 hover:border-white/10'}`}>
      {label}
    </button>
  )

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <div className="pt-24 pb-16 px-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-white">
              <i className="fa-solid fa-bell text-cyan-400 mr-3"></i>Notifications
            </h1>
            <p className="text-slate-200 text-xs mt-1 uppercase tracking-widest">Alerts · Replies · Persona · Watchlist</p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <>
                <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                  {unreadCount} unread
                </span>
                <button onClick={markAllRead}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-cyan-500/30 text-xs font-bold uppercase tracking-widest text-slate-200 hover:text-cyan-400 rounded-xl transition-all">
                  <i className="fa-solid fa-check-double mr-1.5"></i>Mark all read
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {filterBtn('all', 'All')}
          {filterBtn('unread', 'Unread')}
          {filterBtn('read', 'Read')}
        </div>

        <div className="space-y-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.length === 0
              ? (
                <div className="text-center py-20">
                  <div className="text-5xl mb-4">🔔</div>
                  <p className="text-slate-200 font-bold text-sm uppercase tracking-widest mb-2">No notifications yet</p>
                  <p className="text-slate-200 text-xs">When shows in your watchlist are about to premiere, you'll see them here.</p>
                  <Link to="/account"
                    className="inline-block mt-6 px-6 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-cyan-500/20 transition-all">
                    <i className="fa-solid fa-sliders mr-1.5"></i>Manage Preferences
                  </Link>
                </div>
              )
              : filtered.map(n => {
                const isUnread        = !n.read
                const type            = n.type || 'premiere_alert'
                const isPremiere      = type === 'premiere_alert'
                const isReply         = type === 'reply' || type === 'comment_reply'
                const isPersona       = type === 'persona_update'
                const isExpiry        = type === 'show_expiry'
                const poster          = n.shows?.[0]?.poster
                const dateStr         = n.created_at
                  ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : ''

                // Per-type styling
                const typeConfig = {
                  premiere_alert: { icon: 'fa-tv',               color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   dot: 'bg-cyan-400',   label: 'Premiere Alert'    },
                  comment_reply:  { icon: 'fa-reply',             color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400', label: 'Reply'             },
                  reply:          { icon: 'fa-reply',             color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400', label: 'Reply'             },
                  persona_update: { icon: 'fa-masks-theater',     color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', dot: 'bg-violet-400', label: 'Persona Updated'   },
                  show_expiry:    { icon: 'fa-calendar-xmark',    color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  dot: 'bg-amber-400',  label: 'Watchlist Update'  },
                }
                const cfg = typeConfig[type] || typeConfig.premiere_alert

                return (
                  <div key={n._explodeKey ?? n.created_at}
                    className={`bg-slate-900 rounded-2xl p-5 border cursor-pointer transition-all hover:border-white/10
                      ${isUnread ? cfg.border : 'border-white/5'}`}
                    onClick={() => {
                      if (isUnread) markOneRead(n.created_at)
                      const showId = (isReply || isExpiry) ? n.show_id : n.shows?.[0]?.id
                      if (isPersona)       navigate('/persona')
                      else if (showId)     navigate(`/details/${showId}`)
                    }}>
                    <div className="flex items-start gap-4">
                      {/* Icon / poster */}
                      {isPremiere && poster ? (
                        <img src={poster} className="w-10 h-14 rounded-lg object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-1`}>
                          <i className={`fa-solid ${cfg.icon} ${cfg.color} text-sm`}/>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <span className="text-slate-200 text-[10px]">{dateStr}</span>
                          </div>
                          {isUnread && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`}/>}
                        </div>

                        {/* ── Premiere Alert ── */}
                        {isPremiere && (n.shows ?? []).map(s => {
                          const label = s.premiere_date
                            ? new Date(s.premiere_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : s.days_until === 0 ? 'TODAY' : 'TOMORROW'
                          const dateColor = s.days_until === 0 ? 'text-red-400' : 'text-cyan-400'
                          return (
                            <div key={s.title} className="flex items-center justify-between mt-2">
                              <div>
                                <span className="text-white text-sm font-bold">{s.title}</span>
                                {s.network && <span className="text-slate-200 text-xs ml-2">{s.network}</span>}
                              </div>
                              <span className={`${dateColor} text-[10px] font-black uppercase tracking-widest`}>{label}</span>
                            </div>
                          )
                        })}

                        {/* ── Comment Reply ── */}
                        {isReply && (
                          <div>
                            <p className="text-white text-sm font-bold mb-1">
                              <span className="text-purple-300">{n.replier || 'Someone'}</span> replied to your comment
                              {n.show_title && <span className="text-slate-400 font-normal"> on <span className="text-white font-bold">{n.show_title}</span></span>}
                            </p>
                            {n.preview && (
                              <p className="text-slate-300 text-xs leading-relaxed line-clamp-2 bg-slate-800/50 rounded-lg px-3 py-2 border border-white/5">
                                "{n.preview}"
                              </p>
                            )}
                          </div>
                        )}

                        {/* ── Persona Updated ── */}
                        {isPersona && (
                          <div>
                            <p className="text-white text-sm font-bold mb-1">Your Viewer Persona has been updated</p>
                            {n.persona_label && (
                              <p className="text-violet-300 text-xs font-bold">"{n.persona_label}"</p>
                            )}
                            <p className="text-slate-400 text-[10px] mt-1">Tap to view your new affinities and recommendations →</p>
                          </div>
                        )}

                        {/* ── Show Expiry ── */}
                        {isExpiry && (
                          <div>
                            <p className="text-white text-sm font-bold mb-1">
                              {n.show_title || 'A show'} was removed from your watchlist
                            </p>
                            <p className="text-slate-400 text-[10px]">30-day tracking period ended · Tap to re-add</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
          }
        </div>
      </div>
      <Footer />
    </div>
  )
}
