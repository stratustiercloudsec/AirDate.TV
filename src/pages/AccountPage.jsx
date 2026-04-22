// src/pages/AccountPage.jsx
// Fixed:
// 1. Auth shape: user.email + user.sub + signOut (not Amplify loginId/userId/logout)
// 2. WatchlistContext: toggleWatchlist instead of removeFromWatchlist; no preferences prop
// 3. usePoster called inside map → extracted to ShowCard sub-component (hooks rules)
// 4. Navigation: /details/:id (not /show/:id)
// 5. Preferences: loaded from GET /user/{sub}, saved via PUT /user/{sub}/preferences
// 6. isPremium: matches AuthContext (tier === 'premium'), API may return 'pro' — both handled

import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate }   from 'react-router-dom'
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

// ── ShowCard — must be a component so usePoster is a valid hook call ──────────
function ShowCard({ show, onRemove }) {
  const navigate = useNavigate()
  const poster   = usePoster(show?.poster_path ?? show?.poster, show?.name, 185)
  if (!show) return null
  return (
    <div
      className="relative group cursor-pointer"
      onClick={() => navigate(`/details/${show.id}`)}
    >
      <div className="relative overflow-hidden rounded-2xl aspect-[2/3] mb-2 bg-slate-800">
        <img {...poster} alt={show.name ?? ''} className="w-full h-full object-cover"/>
        <button
          onClick={e => { e.stopPropagation(); onRemove(show) }}
          className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <i className="fa-solid fa-xmark text-white text-[9px]"/>
        </button>
      </div>
      <h3 className="text-xs font-bold text-white truncate">{show.name ?? ''}</h3>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AccountPage() {
  // FIX 1: correct AuthContext shape — email/sub/signOut (not Amplify loginId/userId/logout)
  const { user, token, signOut, isAuthenticated, isPremium } = useAuth()
  // FIX 2: correct WatchlistContext shape — toggleWatchlist (not removeFromWatchlist)
  const { watchlist, toggleWatchlist } = useWatchlist()
  const navigate = useNavigate()

  const [userData,        setUserData]        = useState(null)
  const [preferences,     setPreferences]     = useState({ networks: [], genres: [], notifications: false, alert_days: 1 })
  const [networkInput,    setNetworkInput]     = useState('')
  const [toast,           setToast]           = useState(null)
  const [cancelModal,     setCancelModal]     = useState(false)
  const [reactivateModal, setReactivate]      = useState(false)
  const [actionLoading,   setActionLoading]   = useState(false)
  const [prefSaving,      setPrefSaving]      = useState(false)

  // FIX 3: correct user field names from AuthContext
  const email = user?.email ?? ''
  const sub   = user?.sub   ?? ''

  function showToast(msg, color = 'cyan') {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 5000)
  }

  // ── Fetch user record (tier, sub dates, preferences) ───────────────────────
  useEffect(() => {
    if (!token || !sub) return
    fetch(`${API_BASE}/user/${sub}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const record = d.Item ?? d
        setUserData(record)
        // Merge preferences from user record
        if (record.preferences) {
          setPreferences(prev => ({ ...prev, ...record.preferences }))
        }
      })
      .catch(() => {})
  }, [token, sub])

  // Normalize tier — API may return 'pro', JWT may return 'premium'
  const tier          = userData?.tier ?? (isPremium ? 'pro' : 'free')
  const isProTier     = tier === 'pro' || tier === 'premium'
  const cancelPending = userData?.cancel_at_period_end === true
  const periodEnd     = userData?.subscription_period_end
    ? new Date(Number(userData.subscription_period_end) * 1000)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  // FIX 4: signOut not logout
  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  // ── Preferences helpers ────────────────────────────────────────────────────
  const networks  = preferences.networks      ?? []
  const genrePrefs = preferences.genres       ?? []
  const notifsOn  = preferences.notifications ?? false
  const alertDays = preferences.alert_days    ?? 1

  function addNetwork() {
    if (!networkInput || networks.includes(networkInput)) return
    setPreferences(prev => ({ ...prev, networks: [...prev.networks, networkInput] }))
    setNetworkInput('')
  }
  function removeNetwork(n) {
    setPreferences(prev => ({ ...prev, networks: prev.networks.filter(x => x !== n) }))
  }
  function toggleGenre(g) {
    setPreferences(prev => ({
      ...prev,
      genres: prev.genres.includes(g) ? prev.genres.filter(x => x !== g) : [...prev.genres, g],
    }))
  }
  function toggleNotifs() {
    setPreferences(prev => ({ ...prev, notifications: !prev.notifications }))
  }
  function setAlertDays(d) {
    setPreferences(prev => ({ ...prev, alert_days: d }))
  }

  // Save preferences via PUT /user/{sub}/preferences
  async function savePreferences() {
    if (!token || !sub) return
    setPrefSaving(true)
    try {
      const res = await fetch(`${API_BASE}/user/${sub}/preferences`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(preferences),
      })
      if (!res.ok) throw new Error('Save failed')
      showToast('Preferences saved!', 'cyan')
    } catch {
      showToast('Could not save preferences.', 'red')
    } finally {
      setPrefSaving(false)
    }
  }

  // ── Subscription actions ───────────────────────────────────────────────────
  async function confirmCancel() {
    setActionLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/user/${sub}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUserData(prev => ({ ...prev, cancel_at_period_end: true }))
      setCancelModal(false)
      showToast(`Pro access ends ${periodEnd}. No further charges.`, 'amber')
    } catch (e) {
      showToast(`Could not cancel: ${e.message}`, 'red')
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmReactivate() {
    setActionLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/user/${sub}/reactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUserData(prev => ({ ...prev, cancel_at_period_end: false }))
      setReactivate(false)
      showToast("Pro plan reactivated! You're all set.", 'cyan')
    } catch (e) {
      showToast(`Could not reactivate: ${e.message}`, 'red')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">

      {/* Free plan upgrade banner */}
      {isAuthenticated && !isProTier && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-cyan-500/20 px-6 py-2.5">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
            <p className="text-slate-200 text-xs font-bold">
              <span className="text-white">You're on the Free Plan</span>
              <span className="mx-2 text-slate-400">·</span>
              Track unlimited shows, get early alerts, and unlock The Scoop.
            </p>
            <Link to="/upgrade"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap">
              <i className="fa-solid fa-bolt text-xs"/> Upgrade — $4.99/mo
            </Link>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto px-6 pt-36 pb-6">
        <main className="grid grid-cols-1 lg:grid-cols-4 gap-10">

          {/* ── Sidebar ── */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 text-center sticky top-24">
              {/* Avatar */}
              {user?.picture
                ? <img src={user.picture} alt={user.name}
                    className="w-20 h-20 rounded-full mx-auto mb-5 object-cover shadow-2xl border border-white/10"/>
                : (
                  <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto mb-5 flex items-center justify-center shadow-2xl">
                    <span className="text-3xl font-black text-white">
                      {(user?.name || email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                )
              }
              <h2 className="text-base font-black text-white truncate mb-1">
                {user?.name || email || 'Loading…'}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{email}</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6
                ${isProTier ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-white/8'}`}>
                {isProTier ? '★ Pro' : 'Free Plan'}
              </span>

              <div className="space-y-2">
                <Link to="/"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 border border-white/10 rounded-xl text-slate-200 hover:text-white font-bold transition-all text-xs uppercase tracking-widest">
                  <i className="fa-solid fa-magnifying-glass"/> Search Shows
                </Link>
                <Link to="/account"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 border border-white/10 rounded-xl text-slate-200 hover:text-white font-bold transition-all text-xs uppercase tracking-widest">
                  <i className="fa-solid fa-circle-user"/> Edit Profile
                </Link>
                <button onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 font-bold transition-all text-xs uppercase tracking-widest">
                  <i className="fa-solid fa-right-from-bracket"/> Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* ── Main ── */}
          <section className="lg:col-span-3 space-y-10">

            {/* Hero */}
            <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-8 md:p-10 relative overflow-hidden">
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                  <i className="fa-solid fa-heart"/> Your Watchlist
                </div>
                <h1 className="text-4xl font-black text-white mb-3 tracking-tight">The Pulse</h1>
                <p className="text-slate-200 max-w-xl leading-relaxed">
                  Track upcoming premieres you're anticipating. Your watchlist is synced to your account and accessible from any device.
                </p>
              </div>
              <i className="fa-solid fa-bolt absolute -right-4 -bottom-4 text-white/5 text-[10rem] rotate-12"/>
            </div>

            {/* Subscription Card */}
            {userData && (
              <div>
                {isProTier && !cancelPending && (
                  <div className="bg-slate-900/60 border border-cyan-500/20 rounded-3xl p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <i className="fa-solid fa-bolt text-cyan-400 text-lg"/>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-black text-sm uppercase tracking-widest">Pro Plan</p>
                            <span className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Active</span>
                          </div>
                          <p className="text-slate-400 text-xs">$4.99 / month · Renews <span className="text-slate-200 font-bold">{periodEnd}</span></p>
                        </div>
                      </div>
                      <button onClick={() => setCancelModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 border border-white/10 hover:border-red-500/40 hover:text-red-400 rounded-xl text-slate-200 text-xs font-bold uppercase tracking-widest transition-all">
                        <i className="fa-solid fa-xmark"/> Cancel Plan
                      </button>
                    </div>
                  </div>
                )}
                {isProTier && cancelPending && (
                  <div className="bg-slate-900/60 border border-amber-500/20 rounded-3xl p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <i className="fa-solid fa-hourglass-half text-amber-400 text-lg"/>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-black text-sm uppercase tracking-widest">Pro Plan</p>
                            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Canceling</span>
                          </div>
                          <p className="text-slate-400 text-xs">Pro access ends <span className="text-amber-400 font-bold">{periodEnd}</span> — all features active until then.</p>
                        </div>
                      </div>
                      <button onClick={() => setReactivate(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                        <i className="fa-solid fa-rotate-left"/> Keep Pro
                      </button>
                    </div>
                  </div>
                )}
                {!isProTier && (
                  <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-800 border border-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <i className="fa-solid fa-user text-slate-400 text-lg"/>
                        </div>
                        <div>
                          <p className="text-white font-black text-sm uppercase tracking-widest mb-1">Free Plan</p>
                          <p className="text-slate-400 text-xs">Track up to 5 shows · No early premiere alerts</p>
                        </div>
                      </div>
                      <Link to="/upgrade"
                        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                        <i className="fa-solid fa-bolt"/> Upgrade to Pro
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tracked Productions */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-pink-500/20 rounded-xl flex items-center justify-center">
                    <i className="fa-solid fa-heart text-pink-500 text-sm"/>
                  </div>
                  <h2 className="text-white font-black text-lg uppercase tracking-widest">
                    Tracked Productions
                    <span className="ml-2 text-slate-500 text-sm font-bold">({watchlist.length})</span>
                  </h2>
                </div>
              </div>

              {watchlist.length === 0 ? (
                <div className="text-center p-10 text-slate-500 text-sm uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">
                  <i className="fa-solid fa-heart text-3xl text-slate-700 mb-3 block"/>
                  No shows tracked yet
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {/* FIX: ShowCard component — usePoster can't be called inside .map() */}
                  {watchlist.filter(Boolean).map(show => (
                    <ShowCard
                      key={show.id}
                      show={show}
                      onRemove={toggleWatchlist}   // FIX: was removeFromWatchlist
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Preferences */}
            <div id="preferences">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 bg-violet-500/20 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-sliders text-violet-400 text-sm"/>
                </div>
                <h2 className="text-white font-black text-lg uppercase tracking-widest">Preferences</h2>
              </div>
              <div className="space-y-6">

                {/* Networks */}
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6">
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Preferred Networks</h3>
                  <p className="text-slate-400 text-xs mb-4">We'll prioritize these in your recommendations.</p>
                  {networks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {networks.map(n => (
                        <span key={n} className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold rounded-full">
                          {n}
                          <button onClick={() => removeNetwork(n)} className="hover:text-red-400 transition-colors">
                            <i className="fa-solid fa-xmark text-[9px]"/>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <select value={networkInput} onChange={e => setNetworkInput(e.target.value)}
                      className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-slate-200 text-xs font-bold focus:outline-none focus:border-cyan-500/50">
                      <option value="">Add a network…</option>
                      {NETWORK_OPTIONS.filter(n => !networks.includes(n)).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <button onClick={addNetwork}
                      className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/30 transition-all">
                      Add
                    </button>
                  </div>
                </div>

                {/* Genres */}
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6">
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Preferred Genres</h3>
                  <p className="text-slate-400 text-xs mb-4">Tailor your discovery feed to what you love.</p>
                  {genrePrefs.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {genrePrefs.map(g => (
                        <span key={g} className="flex items-center gap-1.5 px-3 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold rounded-full">
                          {g}
                          <button onClick={() => toggleGenre(g)} className="hover:text-red-400">
                            <i className="fa-solid fa-xmark text-[9px]"/>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {GENRES.filter(g => !genrePrefs.includes(g)).map(g => (
                      <button key={g} onClick={() => toggleGenre(g)}
                        className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-full text-slate-200 text-xs font-bold hover:border-violet-500/50 hover:text-violet-400 transition-all">
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Premiere Alerts</h3>
                      <p className="text-slate-400 text-xs">Get notified when tracked shows are about to premiere.</p>
                    </div>
                    <button onClick={toggleNotifs}
                      className={`relative w-12 h-6 rounded-full border transition-all ${notifsOn ? 'bg-cyan-500 border-cyan-400' : 'border-white/10 bg-slate-700'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 ${notifsOn ? 'left-6 bg-white' : 'left-0.5 bg-slate-400'}`}/>
                    </button>
                  </div>
                  {notifsOn && (
                    <div className="border-t border-white/5 pt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-white text-xs font-black uppercase tracking-widest">Alert Timing</span>
                        <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[9px] font-black uppercase tracking-widest rounded-full">Pro</span>
                      </div>
                      <p className="text-slate-400 text-xs mb-4">How far in advance do you want to be notified?</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {ALERT_DAYS.map(d => (
                          <button key={d} onClick={() => setAlertDays(d)}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all
                              ${alertDays === d ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-transparent border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>
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
                    className="flex items-center gap-2 px-6 py-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-black uppercase tracking-widest hover:bg-cyan-500/30 transition-all disabled:opacity-50">
                    {prefSaving
                      ? <><i className="fa-solid fa-spinner fa-spin"/> Saving…</>
                      : <><i className="fa-solid fa-floppy-disk"/> Save Preferences</>
                    }
                  </button>
                </div>
              </div>
            </div>

          </section>
        </main>
      </div>
      <Footer/>

      {/* ── Cancel Modal ── */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setCancelModal(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full mx-auto mb-5 flex items-center justify-center">
              <i className="fa-solid fa-triangle-exclamation text-red-400 text-2xl"/>
            </div>
            <h3 className="text-white font-black text-xl text-center mb-2">Cancel Pro Plan?</h3>
            <p className="text-slate-400 text-sm text-center mb-1 leading-relaxed">You'll keep all Pro features until your billing period ends on</p>
            <p className="text-cyan-400 font-black text-center text-base mb-6">{periodEnd}</p>
            <ul className="space-y-2 mb-8 bg-slate-800/40 border border-white/5 rounded-2xl p-4">
              <li className="flex items-center gap-3 text-sm text-slate-200"><i className="fa-solid fa-check text-slate-400 w-4"/> Pro features stay active until the end date</li>
              <li className="flex items-center gap-3 text-sm text-slate-200"><i className="fa-solid fa-check text-slate-400 w-4"/> No further charges after cancellation</li>
              <li className="flex items-center gap-3 text-sm text-slate-200"><i className="fa-solid fa-xmark text-red-500/70 w-4"/> Watchlist over 5 shows becomes read-only</li>
              <li className="flex items-center gap-3 text-sm text-slate-200"><i className="fa-solid fa-xmark text-red-500/70 w-4"/> Early premiere alerts will stop</li>
            </ul>
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(false)}
                className="flex-1 h-12 bg-slate-800 border border-white/10 rounded-xl text-slate-200 text-xs font-bold uppercase tracking-widest hover:border-white/30 hover:text-white transition-all">
                Keep Pro
              </button>
              <button onClick={confirmCancel} disabled={actionLoading}
                className="flex-1 h-12 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {actionLoading ? <i className="fa-solid fa-spinner fa-spin"/> : <><i className="fa-solid fa-xmark"/> Yes, Cancel Plan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reactivate Modal ── */}
      {reactivateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setReactivate(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl text-center">
            <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-full mx-auto mb-5 flex items-center justify-center">
              <i className="fa-solid fa-bolt text-cyan-400 text-2xl"/>
            </div>
            <h3 className="text-white font-black text-xl mb-2">Keep your Pro plan?</h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Your subscription will stay active and you'll continue to be billed $4.99/month.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReactivate(false)}
                className="flex-1 h-12 bg-slate-800 border border-white/10 rounded-xl text-slate-200 text-xs font-bold uppercase tracking-widest hover:border-white/30 hover:text-white transition-all">
                Go Back
              </button>
              <button onClick={confirmReactivate} disabled={actionLoading}
                className="flex-1 h-12 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {actionLoading ? <i className="fa-solid fa-spinner fa-spin"/> : <><i className="fa-solid fa-check"/> Yes, Keep Pro</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl border backdrop-blur-sm shadow-2xl text-sm font-bold transition-all
          ${toast.color === 'amber' ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
          : toast.color === 'red'   ? 'bg-red-500/20 border-red-500/30 text-red-300'
          : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// MyPulsePage alias — same component, two routes (/account and /pulse)
export function MyPulsePage() { return <AccountPage /> }