// src/pages/MyPersonaPage.jsx
import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate }   from 'react-router-dom'
import PredictionBadge from '../components/PredictionBadge'
import { useAuth }             from '@/context/AuthContext'
import { useWatchlist }        from '@/context/WatchlistContext'
import { API_BASE }            from '@/config/aws'
import { usePoster }           from '@/utils/poster'
import { Footer }              from '@/components/layout/Footer'

const ALERT_DAYS    = [0, 1, 3, 7]
const ALERT_LABELS  = {
  0: { emoji: '📺', label: 'Day of' },
  1: { emoji: '🔔', label: '1 day before' },
  3: { emoji: '📅', label: '3 days before' },
  7: { emoji: '🗓️', label: '1 week before' },
}
const GENRES          = ['Drama','Comedy','Thriller','Sci-Fi','Crime','Horror','Fantasy','Documentary','Reality','Animation']
const NETWORK_OPTIONS = ['Netflix','HBO / Max','Prime Video','Apple TV+','Hulu','Disney+','Peacock','Paramount+','AMC','FX','Showtime','BritBox','Starz']
const TMDB_KEY  = 'd80b629f69e7c5393047c32a865ed697'
const TMDB_BASE = 'https://api.themoviedb.org/3'

const PERSONA_COLORS = {
  0: { bg: 'from-violet-600/20 to-purple-600/10', border: 'border-violet-500/30', accent: 'text-violet-400', badge: 'bg-violet-500/20 border-violet-500/30 text-violet-300' },
  1: { bg: 'from-cyan-600/20 to-blue-600/10',     border: 'border-cyan-500/30',   accent: 'text-cyan-400',   badge: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' },
  2: { bg: 'from-rose-600/20 to-pink-600/10',     border: 'border-rose-500/30',   accent: 'text-rose-400',   badge: 'bg-rose-500/20 border-rose-500/30 text-rose-300' },
  3: { bg: 'from-amber-600/20 to-orange-600/10',  border: 'border-amber-500/30',  accent: 'text-amber-400',  badge: 'bg-amber-500/20 border-amber-500/30 text-amber-300' },
}

function hashLabel(label) {
  if (!label) return 0
  return label.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 4
}

function ratingColor(rating) {
  if (!rating) return 'border-white/20 text-slate-200'
  if (rating === 'TV-MA')  return 'border-red-500/50 text-red-400'
  if (rating === 'TV-14')  return 'border-orange-500/50 text-orange-400'
  if (rating === 'TV-PG')  return 'border-yellow-500/50 text-yellow-400'
  if (['TV-G','TV-Y','TV-Y7'].includes(rating)) return 'border-green-500/50 text-green-400'
  return 'border-white/20 text-slate-200'
}

function ShowCard({ show, liveData, onRemove }) {
  const navigate = useNavigate()
  const poster   = usePoster(show?.poster_path ?? show?.poster, show?.name, 185)
  if (!show) return null
  const rating = show.content_rating || liveData?.content_ratings?.results?.[0]?.rating || ''
  const rawDate = liveData?.next_episode_to_air?.air_date
    ?? liveData?.first_air_date
    ?? show.next_episode_to_air?.air_date
    ?? show.premiere_date ?? show.premiereDate ?? show.first_air_date ?? ''
  const isValidDate = rawDate && rawDate !== 'TBA' && rawDate !== 'TBD' && rawDate !== 'Intel Pending'
  const displayDate = isValidDate
    ? new Date(rawDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const network = show.network ?? liveData?.networks?.[0]?.name ?? show.networks?.[0]?.name ?? null
  return (
    <div className="relative cursor-pointer group" onClick={() => navigate(`/details/${show.id}`)}>
      <div className="relative overflow-hidden rounded-2xl aspect-[2/3] mb-2 bg-slate-800">
        <img {...poster} alt={show.name ?? ''} className="w-full h-full object-cover"/>
        <button onClick={e => { e.stopPropagation(); onRemove(show) }}
          className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={`Remove ${show.name}`}>
          <i className="fa-solid fa-xmark text-white text-[10px]"/>
        </button>
        {rating && (
          <span className={`absolute bottom-1.5 right-1.5 z-10 px-1.5 py-0.5 bg-slate-950/85 border rounded text-[9px] font-black tracking-widest backdrop-blur-sm ${ratingColor(rating)}`}>
            {rating}
          </span>
        )}
      </div>
      <h3 className="text-[10px] sm:text-xs font-bold text-white truncate leading-tight mb-1">{show.name ?? ''}</h3>
      {network && <p className="text-[9px] sm:text-[10px] text-slate-200 font-semibold truncate leading-tight mb-0.5">{network}</p>}
      {displayDate ? (
        <p className="text-[9px] sm:text-[10px] font-black text-cyan-400 truncate leading-tight uppercase tracking-wide">
          <i className="fa-solid fa-calendar-day mr-1 text-[8px]"/>{displayDate}
        </p>
      ) : (
        <>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-600 truncate leading-tight uppercase tracking-wide">Premiere TBA</p>
          <PredictionBadge showId={show.id || show.tmdb_id} premiereDate={null} compact={true}/>
        </>
      )}
    </div>
  )
}

function PersonaCard({ persona, onRefresh, loading }) {
  if (!persona && !loading) return null
  // Empty digest is valid — show friendly message
  const colorIdx = hashLabel(persona?.persona_label)
  const colors   = PERSONA_COLORS[colorIdx]
  return (
    <div className={`bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-3xl p-6 sm:p-8 relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-4 right-4 text-8xl">🎭</div>
      </div>
      {loading ? (
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-700 animate-pulse flex-shrink-0"/>
          <div className="space-y-3 flex-1">
            <div className="h-5 w-48 bg-slate-700 rounded-full animate-pulse"/>
            <div className="h-3 w-64 bg-slate-700 rounded-full animate-pulse"/>
            <div className="flex gap-2">
              {[1,2,3].map(i => <div key={i} className="h-5 w-20 bg-slate-700 rounded-full animate-pulse"/>)}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-slate-900/60 border ${colors.border} flex items-center justify-center flex-shrink-0`}>
                <i className="fa-solid fa-masks-theater text-2xl text-white"/>
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${colors.accent} mb-1`}>Your Viewer Persona</p>
                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">{persona?.persona_label}</h2>
              </div>
            </div>
            <button onClick={onRefresh} disabled={loading}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 border ${colors.border} rounded-xl text-[10px] font-bold uppercase tracking-widest ${colors.accent} hover:bg-slate-900/80 transition-all disabled:opacity-50`}>
              <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''} text-[9px]`}/>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <p className="text-slate-200 text-sm leading-relaxed mb-5 max-w-xl">{persona?.welcome_message}</p>
          {persona?.affinities?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {persona.affinities.map(a => (
                <span key={a} className={`px-3 py-1 rounded-full text-xs font-bold border ${colors.badge}`}>
                  {a}
                </span>
              ))}
            </div>
          )}
          {persona?.generated_at && (
            <p className="text-slate-200 text-[10px] mt-4">
              Last updated {new Date(persona.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {persona.watchlist_size ? ` · Based on ${persona.watchlist_size} tracked shows` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function WeeklyDigest({ digest, loading }) {
  const navigate = useNavigate()
  if (loading || digest === null) return (
    <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6">
      <div className="h-4 w-40 bg-slate-800 rounded animate-pulse mb-4"/>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse"/>)}
      </div>
    </div>
  )
  const items = [...(digest?.this_week || []), ...(digest?.persona_picks || [])]
  const hasDigestData = items.length > 0
  if (!items.length) return null
  return (
    <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center">
          <i className="fa-solid fa-calendar-week text-green-400 text-sm"/>
        </div>
        <div>
          <h2 className="text-white font-black text-sm uppercase tracking-widest">Coming Up</h2>
          <p className="text-slate-200 text-[10px]">
            {digest?.week_start && new Date(digest.week_start + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
            {' — '}
            {digest?.week_end && new Date(digest.week_end + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {items.slice(0,5).map((item, i) => (
          <div key={item.id || i}
            onClick={() => item.id && navigate(`/details/${item.id}`)}
            className="flex items-center gap-3 p-3 bg-slate-800/60 hover:bg-slate-800 border border-white/5 hover:border-white/10 rounded-xl cursor-pointer transition-all">
            {item.poster
              ? <img src={item.poster} alt="" className="w-10 h-14 rounded-lg object-cover flex-shrink-0"/>
              : <div className="w-10 h-14 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0"><i className="fa-solid fa-tv text-slate-500 text-xs"/></div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate">{item.title}</p>
              {item.network && <p className="text-slate-200 text-xs truncate">{item.network}</p>}
              {item.reason && <p className="text-violet-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">{item.reason}</p>}
            </div>
            {item.air_date && (
              <div className="text-right flex-shrink-0">
                <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest">
                  {new Date(item.air_date + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PersonaRecs({ recs, loading }) {
  const navigate = useNavigate()
  if (loading) return (
    <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6">
      <div className="h-4 w-48 bg-slate-800 rounded animate-pulse mb-4"/>
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="aspect-[2/3] bg-slate-800 rounded-2xl animate-pulse"/>)}
      </div>
    </div>
  )
  if (!recs?.length) return null
  return (
    <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-violet-500/20 rounded-xl flex items-center justify-center">
          <i className="fa-solid fa-wand-magic-sparkles text-violet-400 text-sm"/>
        </div>
        <div>
          <h2 className="text-white font-black text-sm uppercase tracking-widest">You Might Be Missing</h2>
          <p className="text-slate-200 text-[10px]">AI picks matched to your persona</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {recs.slice(0,6).map((rec, i) => (
          <div key={rec.id || i}
            onClick={() => rec.id && navigate(`/details/${rec.id}`)}
            className="cursor-pointer group">
            <div className="relative overflow-hidden rounded-xl aspect-[2/3] bg-slate-800 mb-2">
              {rec.poster
                ? <img src={rec.poster} alt={rec.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-tv text-slate-600 text-2xl"/></div>
              }
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
            </div>
            <p className="text-white text-xs font-bold truncate leading-tight">{rec.title}</p>
            {rec.reason && <p className="text-violet-400 text-[9px] font-bold uppercase tracking-widest truncate mt-0.5">{rec.reason}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MyPersonaPage() {
  const { user, token, signOut, isAuthenticated, isPremium } = useAuth()
  const { watchlist, toggleWatchlist } = useWatchlist()
  const navigate = useNavigate()

  const [userData,        setUserData]      = useState(null)
  const [liveShowData,    setLiveShowData]  = useState({})
  const [preferences,     setPreferences]   = useState({ networks: [], genres: [], notifications: false, alertDays: 1, customInterests: [] })
  const [networkInput,    setNetworkInput]  = useState('')
  const [customInput,     setCustomInput]   = useState('')
  const [toast,           setToast]         = useState(null)
  const [prefSaving,      setPrefSaving]    = useState(false)
  const [actionLoading,   setActionLoading] = useState(false)
  const [cancelModal,     setCancelModal]   = useState(false)
  const [reactivateModal, setReactivate]    = useState(false)
  const [deleteModal,     setDeleteModal]   = useState(false)
  const [deleteConfirm,   setDeleteConfirm] = useState('')
  const [deleteLoading,   setDeleteLoading] = useState(false)

  // Persona state
  const [persona,        setPersona]       = useState(null)
  const [personaLoading, setPersonaLoading]= useState(false)
  const [digest,         setDigest]        = useState(null)
  const [digestLoading,  setDigestLoading] = useState(false)
  const [activeTab,      setActiveTab]     = useState('persona') // 'persona' | 'watchlist' | 'preferences'

  const email = user?.email ?? ''
  const sub   = user?.sub   ?? ''

  function showToast(msg, color = 'cyan') {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    if (!token || !sub) return
    fetch(`${API_BASE}/user/${sub}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setUserData(d)
        if (d.preferences) setPreferences(prev => ({ ...prev, ...d.preferences }))
        if (d.persona) {
          setPersona(d.persona)
          setDigestLoading(true)
          fetch(`${API_BASE}/user/${sub}/persona/digest`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null)
            .then(d2 => { if (d2) setDigest(d2?.weekly_digest || d2) })
            .catch(() => {})
            .finally(() => setDigestLoading(false))
        }
      })
      .catch(() => {})
  }, [token, sub])

  useEffect(() => {
    if (!watchlist.length) return
    watchlist.filter(Boolean).slice(0, 20).forEach(show => {
      const id = show.id
      if (!id) return
      fetch(`${TMDB_BASE}/tv/${id}?api_key=${TMDB_KEY}&language=en-US`)
        .then(r => r.json())
        .then(data => setLiveShowData(prev => ({ ...prev, [id]: data })))
        .catch(() => {})
    })
  }, [watchlist.length])

  // digest loaded inline with user data below

  async function generatePersona() {
    if (!token || !sub) return
    setPersonaLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/user/${sub}/persona/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlist, preferences }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPersona(data)
      if (data.weekly_digest) setDigest(data.weekly_digest)
      showToast('Persona updated!', 'cyan')
    } catch (e) {
      showToast(`Could not generate persona: ${e.message}`, 'red')
    } finally {
      setPersonaLoading(false)
    }
  }

  const tier          = isPremium ? 'pro' : (userData?.tier === 'pro' ? 'pro' : 'free')
  const isProTier     = tier === 'pro' || tier === 'premium'
  const cancelPending = userData?.cancel_at_period_end === true
  const periodEnd     = userData?.subscription_period_end
    ? new Date(Number(userData.subscription_period_end) * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const networks   = preferences.networks      ?? []
  const genrePrefs = preferences.genres        ?? []
  const notifsOn   = preferences.notifications ?? false
  const alertDays  = preferences.alertDays     ?? 1

  async function handleLogout() { await signOut(); navigate('/') }

  function addNetwork() {
    if (!networkInput || networks.includes(networkInput)) return
    setPreferences(prev => ({ ...prev, networks: [...prev.networks, networkInput] }))
    setNetworkInput('')
  }
  function removeNetwork(n) { setPreferences(prev => ({ ...prev, networks: prev.networks.filter(x => x !== n) })) }
  function addCustomInterest() {
    const val = customInput.trim()
    if (!val) return
    const existing = preferences.customInterests ?? []
    if (existing.map(x => x.toLowerCase()).includes(val.toLowerCase())) return
    setPreferences(prev => ({ ...prev, customInterests: [...(prev.customInterests ?? []), val] }))
    setCustomInput('')
  }
  function removeCustomInterest(val) {
    setPreferences(prev => ({ ...prev, customInterests: (prev.customInterests ?? []).filter(x => x !== val) }))
  }
  function toggleGenre(g) {
    setPreferences(prev => ({ ...prev, genres: prev.genres.includes(g) ? prev.genres.filter(x => x !== g) : [...prev.genres, g] }))
  }
  function toggleNotifs() { setPreferences(prev => ({ ...prev, notifications: !prev.notifications })) }
  function handleSetAlertDays(d) { setPreferences(prev => ({ ...prev, alertDays: d })) }

  async function savePreferences() {
    if (!token || !sub) return
    setPrefSaving(true)
    try {
      const res = await fetch(`${API_BASE}/user/${sub}/preferences`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })
      if (!res.ok) throw new Error('Save failed')
      showToast('Preferences saved!', 'cyan')
    } catch { showToast('Could not save preferences.', 'red') }
    finally { setPrefSaving(false) }
  }

  async function confirmCancel() {
    setActionLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/user/${sub}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUserData(prev => ({ ...prev, cancel_at_period_end: true }))
      setCancelModal(false)
      showToast(`Pro access ends ${periodEnd}. No further charges.`, 'amber')
    } catch (e) { showToast(`Could not cancel: ${e.message}`, 'red') }
    finally { setActionLoading(false) }
  }

  async function confirmReactivate() {
    setActionLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/user/${sub}/reactivate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUserData(prev => ({ ...prev, cancel_at_period_end: false }))
      setReactivate(false)
      showToast("Pro plan reactivated! You're all set.", 'cyan')
    } catch (e) { showToast(`Could not reactivate: ${e.message}`, 'red') }
    finally { setActionLoading(false) }
  }

  async function confirmDelete() {
    if (deleteConfirm !== 'DELETE') return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/user/${sub}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Delete failed')
      await signOut(); navigate('/')
    } catch {
      showToast('Could not delete account. Contact operations@airdate.tv.', 'red')
      setDeleteLoading(false); setDeleteModal(false)
    }
  }

  const tabs = [
    { key: 'persona',     label: 'My Persona',  icon: 'fa-masks-theater', count: null },
    { key: 'watchlist',   label: 'Tracked',    icon: 'fa-heart',         count: watchlist.length },
    { key: 'preferences', label: 'Preferences', icon: 'fa-sliders',       count: null },
  ]

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">

      {isAuthenticated && !isProTier && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-cyan-500/20 px-4 sm:px-6 py-2">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <i className="fa-solid fa-bolt text-cyan-400 text-xs flex-shrink-0"/>
              <p className="text-slate-200 text-xs font-bold truncate">
                <span className="text-white">You're on the Free Plan</span>
                <span className="mx-2 text-slate-200">·</span>
                Track unlimited shows, get early alerts, and unlock The Scoop.
              </p>
            </div>
            <Link to="/upgrade"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap">
              <i className="fa-solid fa-bolt text-[10px]"/>Upgrade — $4.99/mo
            </Link>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-6">
        <main className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-10">

          {/* Mobile profile strip */}
          <div className="lg:hidden bg-slate-900/60 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
            {user?.picture
              ? <img src={user.picture} alt={user.name} className="w-14 h-14 rounded-full flex-shrink-0 object-cover border border-white/10"/>
              : <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex-shrink-0 flex items-center justify-center">
                  <span className="text-xl font-black text-white">{(user?.name || email || '?')[0].toUpperCase()}</span>
                </div>
            }
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-black text-white truncate">{user?.name || email || 'Loading…'}</h2>
              <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest truncate">{email}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isProTier ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-200 border border-white/8'}`}>
                {isProTier ? '★ Pro' : 'Free Plan'}
              </span>
            </div>
            <button onClick={handleLogout}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-bold uppercase tracking-widest transition-all">
              <i className="fa-solid fa-right-from-bracket"/>
            </button>
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 text-center sticky top-24">
              {user?.picture
                ? <img src={user.picture} alt={user.name} className="w-20 h-20 rounded-full mx-auto mb-5 object-cover shadow-2xl border border-white/10"/>
                : <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto mb-5 flex items-center justify-center shadow-2xl">
                    <span className="text-3xl font-black text-white">{(user?.name || email || '?')[0].toUpperCase()}</span>
                  </div>
              }
              <h2 className="text-base font-black text-white truncate mb-1">{user?.name || email || 'Loading…'}</h2>
              <p className="text-xs font-bold text-slate-200 uppercase tracking-widest mb-1">{email}</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 ${isProTier ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-200 border border-white/8'}`}>
                {isProTier ? '★ Pro' : 'Free Plan'}
              </span>
              {persona?.persona_label && (
                <div className={`mb-6 px-3 py-2 rounded-xl border ${PERSONA_COLORS[hashLabel(persona.persona_label)].border} bg-slate-900/40`}>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${PERSONA_COLORS[hashLabel(persona.persona_label)].accent} mb-0.5`}>Your Persona</p>
                  <p className="text-white text-xs font-bold leading-tight">{persona.persona_label}</p>
                </div>
              )}
              <div className="space-y-2">
                <Link to="/" className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 border border-white/10 rounded-xl text-slate-200 hover:text-white font-bold transition-all text-xs uppercase tracking-widest">
                  <i className="fa-solid fa-magnifying-glass"/> Search Shows
                </Link>
                <Link to="/account" className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 border border-white/10 rounded-xl text-slate-200 hover:text-white font-bold transition-all text-xs uppercase tracking-widest">
                  <i className="fa-solid fa-circle-user"/> Edit Profile
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 font-bold transition-all text-xs uppercase tracking-widest">
                  <i className="fa-solid fa-right-from-bracket"/> Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <section className="lg:col-span-3 space-y-6">

            {/* Tab nav */}
            <div className="flex items-center gap-1 p-1 bg-slate-900/60 border border-white/10 rounded-2xl">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                    ${activeTab === tab.key
                      ? 'bg-slate-800 text-white border border-white/10'
                      : 'text-slate-200 hover:text-white hover:bg-slate-800/50'}`}>
                  <i className={`fa-solid ${tab.icon} text-[11px]`}/>
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === tab.key ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-200'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── WATCHLIST TAB ── */}
            {activeTab === 'watchlist' && (
              <div className="space-y-6">
                <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                      <i className="fa-solid fa-heart"/> Your Watchlist
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight">My Persona</h1>
                    <p className="text-slate-200 text-sm max-w-xl leading-relaxed">
                      Track upcoming premieres you're anticipating. Your watchlist is synced to your account and accessible from any device.
                    </p>
                  </div>
                  <i className="fa-solid fa-bolt absolute -right-4 -bottom-4 text-white/5 text-[10rem] rotate-12"/>
                </div>

                {isProTier && (
                  <div onClick={() => navigate('/scoop/archive')}
                    className="cursor-pointer group bg-slate-900/60 border border-amber-500/20 hover:border-amber-500/40 rounded-3xl p-5 sm:p-6 transition-all hover:bg-slate-900/80">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <i className="fa-solid fa-box-archive text-amber-400 text-lg"/>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-black text-sm uppercase tracking-widest">Story Archive</p>
                            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Pro</span>
                          </div>
                          <p className="text-slate-200 text-xs">30 days of AirDate TV Originals — every story, always accessible.</p>
                        </div>
                      </div>
                      <i className="fa-solid fa-arrow-right text-amber-400/50 group-hover:text-amber-400 group-hover:translate-x-1 transition-all flex-shrink-0"/>
                    </div>
                  </div>
                )}

                {userData && (
                  <div>
                    {isProTier && !cancelPending && (
                      <div className="bg-slate-900/60 border border-cyan-500/20 rounded-3xl p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                              <i className="fa-solid fa-bolt text-cyan-400 text-lg"/>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-white font-black text-sm uppercase tracking-widest">Pro Plan</p>
                                <span className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Active</span>
                              </div>
                              <p className="text-slate-200 text-xs">$4.99 / month · Renews <span className="font-bold">{periodEnd}</span></p>
                            </div>
                          </div>
                          <button onClick={() => setCancelModal(true)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 border border-white/10 hover:border-red-500/40 hover:text-red-400 rounded-xl text-slate-200 text-xs font-bold uppercase tracking-widest transition-all">
                            <i className="fa-solid fa-xmark"/> Cancel Plan
                          </button>
                        </div>
                      </div>
                    )}
                    {!isProTier && (
                      <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-800 border border-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                              <i className="fa-solid fa-user text-slate-200 text-lg"/>
                            </div>
                            <div>
                              <p className="text-white font-black text-sm uppercase tracking-widest mb-1">Free Plan</p>
                              <p className="text-slate-200 text-xs">Track up to 5 shows · No early premiere alerts</p>
                            </div>
                          </div>
                          <Link to="/upgrade"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                            <i className="fa-solid fa-bolt"/> Upgrade to Pro
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 bg-pink-500/20 rounded-xl flex items-center justify-center">
                      <i className="fa-solid fa-heart text-pink-500 text-sm"/>
                    </div>
                    <h2 className="text-white font-black text-base sm:text-lg uppercase tracking-widest">
                      Tracked <span className="ml-1.5 text-slate-200 text-sm font-bold">({watchlist.length})</span>
                    </h2>
                  </div>
                  {watchlist.length === 0 ? (
                    <div className="text-center p-10 text-slate-200 text-sm uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">
                      <i className="fa-solid fa-heart text-3xl text-slate-700 mb-3 block"/>No shows tracked yet
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                      {watchlist.filter(Boolean).map(show => (
                        <ShowCard key={show.id} show={show} liveData={liveShowData[show.id] ?? null} onRemove={toggleWatchlist}/>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PERSONA TAB ── */}
            {activeTab === 'persona' && (
              <div className="space-y-6">
                <PersonaCard persona={persona} onRefresh={generatePersona} loading={personaLoading}/>

                {!persona && !personaLoading && (
                  <div className="text-center py-12 bg-slate-900/40 border border-white/10 rounded-3xl">
                    <div className="text-5xl mb-4">🎭</div>
                    <p className="text-white font-black text-sm uppercase tracking-widest mb-2">No Persona Yet</p>
                    <p className="text-slate-200 text-xs mb-6 max-w-xs mx-auto leading-relaxed">
                      Add shows to your watchlist and set genre preferences, then generate your AI viewer persona.
                    </p>
                    <button onClick={generatePersona} disabled={personaLoading || watchlist.length === 0}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-violet-500/30 transition-all disabled:opacity-50">
                      <i className="fa-solid fa-wand-magic-sparkles"/>
                      {watchlist.length === 0 ? 'Add shows to get started' : 'Generate My Persona'}
                    </button>
                  </div>
                )}

                <WeeklyDigest digest={digest} loading={digestLoading}/>
                {persona?.recommendations?.length > 0 && (
                  <PersonaRecs recs={persona.recommendations} loading={personaLoading}/>
                )}
              </div>
            )}

            {/* ── PREFERENCES TAB ── */}
            {activeTab === 'preferences' && (
              <div id="preferences" className="space-y-5 sm:space-y-6">
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6">
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Preferred Networks</h3>
                  <p className="text-slate-200 text-[10px] mb-4 leading-relaxed">Shows from these networks will appear first in your premiere calendar and discovery results.</p>
                  {networks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {networks.map(n => (
                        <span key={n} className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold rounded-full">
                          {n}
                          <button onClick={() => removeNetwork(n)} className="hover:text-red-400 transition-colors"><i className="fa-solid fa-xmark text-[9px]"/></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select value={networkInput} onChange={e => setNetworkInput(e.target.value)}
                      className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 text-xs font-bold focus:outline-none focus:border-cyan-500/50">
                      <option value="">Add a network…</option>
                      {NETWORK_OPTIONS.filter(n => !networks.includes(n)).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button onClick={addNetwork}
                      className="w-full sm:w-auto px-4 py-2.5 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/30 transition-all">Add</button>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6">
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Preferred Genres</h3>
                  <p className="text-slate-200 text-[10px] mb-4 leading-relaxed">Selected genres filter your premiere feed and power your AI Persona. Genres you don't pick won't disappear — they'll just rank lower.</p>
                  {genrePrefs.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {genrePrefs.map(g => (
                        <span key={g} className="flex items-center gap-1.5 px-3 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold rounded-full">
                          {g}<button onClick={() => toggleGenre(g)} className="hover:text-red-400"><i className="fa-solid fa-xmark text-[9px]"/></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {GENRES.filter(g => !genrePrefs.includes(g)).map(g => (
                      <button key={g} onClick={() => toggleGenre(g)}
                        className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-full text-slate-200 text-xs font-bold hover:border-violet-500/50 hover:text-violet-400 transition-all">{g}</button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Premiere Alerts</h3>
                      <p className="text-slate-200 text-[10px] leading-relaxed max-w-sm">When enabled, AirDate sends email alerts for every show on your watchlist. Pro members choose how far in advance.</p>
                    </div>
                    <button onClick={toggleNotifs}
                      className={`relative flex-shrink-0 w-12 h-6 rounded-full border transition-all ml-4 ${notifsOn ? 'bg-cyan-500 border-cyan-400' : 'border-white/10 bg-slate-700'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 ${notifsOn ? 'left-6 bg-white' : 'left-0.5 bg-slate-400'}`}/>
                    </button>
                  </div>
                  {notifsOn && (
                    <div className="border-t border-white/5 pt-5 mt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-white text-xs font-black uppercase tracking-widest">Alert Timing</span>
                        <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[9px] font-black uppercase tracking-widest rounded-full">Pro</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {ALERT_DAYS.map(d => (
                          <button key={d} onClick={() => handleSetAlertDays(d)}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${alertDays === d ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-transparent border-white/10 text-slate-200 hover:border-white/20'}`}>
                            <div className="text-sm font-black mb-0.5">{ALERT_LABELS[d].emoji}</div>
                            {ALERT_LABELS[d].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button onClick={savePreferences} disabled={prefSaving}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-black uppercase tracking-widest hover:bg-cyan-500/30 transition-all disabled:opacity-50">
                    {prefSaving ? <><i className="fa-solid fa-spinner fa-spin"/> Saving…</> : <><i className="fa-solid fa-floppy-disk"/> Save Preferences</>}
                  </button>
                </div>
              </div>
            )}

          </section>
        </main>
      </div>
      <Footer/>

      {/* Modals unchanged */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setCancelModal(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full mx-auto mb-5 flex items-center justify-center">
              <i className="fa-solid fa-triangle-exclamation text-red-400 text-2xl"/>
            </div>
            <h3 className="text-white font-black text-xl text-center mb-2">Cancel Pro Plan?</h3>
            <p className="text-slate-200 text-sm text-center mb-1 leading-relaxed">You'll keep all Pro features until your billing period ends on</p>
            <p className="text-cyan-400 font-black text-center text-base mb-6">{periodEnd}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setCancelModal(false)} className="flex-1 h-12 bg-slate-800 border border-white/10 rounded-xl text-slate-200 text-xs font-bold uppercase tracking-widest hover:border-white/30 hover:text-white transition-all">Keep Pro</button>
              <button onClick={confirmCancel} disabled={actionLoading} className="flex-1 h-12 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {actionLoading ? <i className="fa-solid fa-spinner fa-spin"/> : <><i className="fa-solid fa-xmark"/> Yes, Cancel Plan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setDeleteModal(false)}>
          <div className="bg-slate-900 border border-red-500/20 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full mx-auto mb-5 flex items-center justify-center">
              <i className="fa-solid fa-trash text-red-400 text-2xl"/>
            </div>
            <h3 className="text-white font-black text-xl text-center mb-2">Delete Your Account?</h3>
            <p className="text-slate-200 text-sm text-center mb-6 leading-relaxed">This cannot be undone.</p>
            <div className="mb-6">
              <label className="block text-slate-200 text-xs font-bold uppercase tracking-widest mb-2">Type <span className="text-red-400">DELETE</span> to confirm</label>
              <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE"
                className="w-full bg-slate-800 border border-white/10 focus:border-red-500/50 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-slate-600 focus:outline-none transition-colors"/>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setDeleteModal(false)} className="flex-1 h-12 bg-slate-800 border border-white/10 rounded-xl text-slate-200 text-xs font-bold uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteConfirm !== 'DELETE' || deleteLoading}
                className="flex-1 h-12 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40">
                {deleteLoading ? <i className="fa-solid fa-spinner fa-spin"/> : <><i className="fa-solid fa-trash"/> Delete Forever</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl border backdrop-blur-sm shadow-2xl text-sm font-bold max-w-[90vw] text-center
          ${toast.color === 'amber' ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : toast.color === 'red' ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
