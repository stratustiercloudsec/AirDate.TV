// src/pages/ScoopArchivePage.jsx — v1.0
// Pro-only: 30-day archive of all Scoop stories from DynamoDB
// Features: category filter, pagination, saved stories tab
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'
import { Footer } from '@/components/layout/Footer'

const CATS = {
  all:           { label:'All Stories',        icon:'newspaper',     color:'#94a3b8' },
  premieres:     { label:'Premiere Dates',     icon:'calendar-star', color:'#22d3ee' },
  renewals:      { label:'Renewals',           icon:'rotate',        color:'#4ade80' },
  cancellations: { label:'Cancellations',      icon:'ban',           color:'#f87171' },
  casting:       { label:'Casting News',       icon:'user-plus',     color:'#c084fc' },
  production:    { label:'Production Updates', icon:'clapperboard',  color:'#fb923c' },
}

function timeAgo(iso) {
  if (!iso) return ''
  try {
    const diff  = Date.now() - new Date(iso).getTime()
    const h     = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)
    if (h < 1)    return 'Just now'
    if (h < 24)   return `${h}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' })
  } catch { return '' }
}

// ── Story Card ────────────────────────────────────────────────────────────────
function ArchiveCard({ story, onSave, onUnsave, isSaved }) {
  const navigate = useNavigate()
  const cat  = story.category || 'production'
  const conf = CATS[cat] || CATS.production

  return (
    <div className="group bg-slate-900/50 border border-white/5 hover:border-cyan-500/20
      rounded-2xl overflow-hidden transition-all duration-200 hover:bg-slate-900/80 hover:-translate-y-0.5 flex flex-col">

      {/* Image — always shown, fallback gradient if no URL */}
      <div className="relative h-40 overflow-hidden flex-shrink-0 cursor-pointer"
        onClick={() => navigate(`/scoop/${story.story_hash}`)}>
        {story.image_url ? (
          <>
            <img src={story.image_url} alt={story.headline}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}/>
            <div className="hidden w-full h-full items-center justify-center"
              style={{ background:'linear-gradient(135deg,#0f172a,#1e293b)' }}>
              <i className={`fa-solid fa-${conf.icon} text-3xl`} style={{ color:`${conf.color}60` }}/>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background:`linear-gradient(135deg,#0f172a,${conf.color}15)` }}>
            <i className={`fa-solid fa-${conf.icon} text-3xl`} style={{ color:`${conf.color}40` }}/>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"/>
        {/* Category label overlay on image */}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full backdrop-blur-sm"
          style={{ background:`${conf.color}25`, color:conf.color, border:`1px solid ${conf.color}35` }}>
          <i className={`fa-solid fa-${conf.icon}`} style={{ fontSize:'7px' }}/>{conf.label}
        </span>
      </div>

      <div className="p-4 flex flex-col flex-1">


        {/* Headline */}
        <h3 onClick={() => navigate(`/scoop/${story.story_hash}`)}
          className="text-white font-black text-sm leading-snug line-clamp-3 mb-3
            group-hover:text-cyan-400 transition-colors cursor-pointer flex-1">
          {story.headline}
        </h3>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[10px] font-bold">{timeAgo(story.published_at)}</span>
            {story.source_domain && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-slate-600 text-[10px]">{story.source_domain.replace('www.','').split('.')[0]}</span>
              </>
            )}
          </div>
          <button onClick={() => isSaved ? onUnsave(story) : onSave(story)}
            className={`p-1.5 rounded-lg transition-all ${
              isSaved
                ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                : 'text-slate-600 hover:text-cyan-400 hover:bg-slate-800'
            }`}>
            <i className={`fa-${isSaved ? 'solid' : 'regular'} fa-bookmark text-xs`}/>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function ScoopArchivePage() {
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuth()
  const isPro = user?.tier === 'pro' || user?.tier === 'premium'

  const [activeTab,    setActiveTab]    = useState('archive')   // 'archive' | 'saved'
  const [activeFilter, setActiveFilter] = useState('all')
  const [stories,      setStories]      = useState([])
  const [savedStories, setSavedStories] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [lastKey,      setLastKey]      = useState(null)
  const [hasMore,      setHasMore]      = useState(false)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')

  // ── Redirect non-Pro users ──────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return }
    if (isAuthenticated && !isPro) { navigate('/upgrade'); return }
  }, [isAuthenticated, isPro])

  // ── Load archive stories ────────────────────────────────────────────────
  const loadStories = useCallback(async (category = 'all', startKey = null, append = false) => {
    if (!token) return
    append ? setLoadingMore(true) : setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '24' })
      if (category && category !== 'all') params.set('category', category)
      if (startKey) params.set('last_key', startKey)

      const res = await fetch(`${API_BASE}/scoop/archive?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to load archive')
      const data = await res.json()
      const items = data.stories || data.items || []

      setStories(prev => append ? [...prev, ...items] : items)
      setLastKey(data.last_key || null)
      setHasMore(!!data.last_key)
    } catch (e) {
      console.error('Archive load error:', e)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [token])

  // ── Load saved stories ──────────────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    if (!token || !user?.sub) return
    setLoadingSaved(true)
    try {
      const res = await fetch(`${API_BASE}/user/${user.sub}/saved-stories`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setSavedStories(data.saved_stories || [])
    } catch (e) {
      console.error('Saved stories error:', e)
    } finally {
      setLoadingSaved(false)
    }
  }, [token, user?.sub])

  useEffect(() => { if (isPro) { loadStories('all'); loadSaved() } }, [isPro])

  // ── Category filter change ──────────────────────────────────────────────
  function handleFilter(cat) {
    setActiveFilter(cat)
    setStories([])
    setLastKey(null)
    loadStories(cat)
  }

  // ── Save / Unsave story ─────────────────────────────────────────────────
  async function handleSave(story) {
    if (!token || !user?.sub) return
    try {
      await fetch(`${API_BASE}/user/${user.sub}/saved-stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          story_hash:    story.story_hash,
          headline:      story.headline,
          category:      story.category,
          published_at:  story.published_at,
          image_url:     story.image_url || null,
          show_title:    story.show_title || null,
          source_domain: story.source_domain || null,
        })
      })
      setSavedStories(prev => [story, ...prev.filter(s => s.story_hash !== story.story_hash)])
    } catch (e) { console.error('Save error:', e) }
  }

  async function handleUnsave(story) {
    if (!token || !user?.sub) return
    try {
      await fetch(`${API_BASE}/user/${user.sub}/saved-stories/${story.story_hash}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      setSavedStories(prev => prev.filter(s => s.story_hash !== story.story_hash))
    } catch (e) { console.error('Unsave error:', e) }
  }

  const savedSet = new Set(savedStories.map(s => s.story_hash))
  const filteredStories = (activeTab === 'saved' ? savedStories : stories)
    .filter(s => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (s.headline || '').toLowerCase().includes(q) ||
             (s.show_title || '').toLowerCase().includes(q) ||
             (s.category || '').toLowerCase().includes(q) ||
             (s.source_domain || '').toLowerCase().includes(q)
    })
  const displayStories = filteredStories

  if (!isPro) return null // Redirecting

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-24 pb-20">

        {/* Header */}
        <div className="mb-10">
          <button onClick={() => navigate('/scoop')}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors group">
            <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"/>
            Back to The Scoop
          </button>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <i className="fa-solid fa-box-archive text-amber-400 text-lg"/>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Story Archive
                </h1>
              </div>
              <p className="text-slate-400 text-sm ml-12">
                30 days of AirDate TV Originals — every story, always accessible
              </p>
            </div>
            {/* Pro badge */}
            <span className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5
              bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px]
              font-black uppercase tracking-widest rounded-xl">
              <i className="fa-solid fa-bolt text-[9px]"/> Pro Feature
            </span>
          </div>
        </div>

        {/* Archive / Saved tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key:'archive', label:'All Stories', icon:'newspaper' },
            { key:'saved',   label:`Saved (${savedStories.length})`, icon:'bookmark' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                activeTab === tab.key
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                  : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
              }`}>
              <i className={`fa-solid fa-${tab.icon} text-[10px]`}/>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category filter — only on archive tab */}
        {activeTab === 'archive' && (
          <div className="flex gap-2 mb-8 pb-6 border-b border-white/5 overflow-x-auto">
            {Object.entries(CATS).map(([key, conf]) => (
              <button key={key}
                onClick={() => handleFilter(key)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs
                  font-black uppercase tracking-widest transition-all border ${
                  activeFilter === key
                    ? 'border-current'
                    : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                }`}
                style={activeFilter === key
                  ? { background:`${conf.color}20`, color:conf.color, borderColor:`${conf.color}40` }
                  : {}
                }>
                <i className={`fa-solid fa-${conf.icon} text-[10px]`}/>
                {conf.label}
              </button>
            ))}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-6">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"/>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search stories by title, show, or source…"
            className="w-full pl-10 pr-10 py-3 bg-slate-800/60 border border-white/8
              hover:border-white/15 focus:border-cyan-500/40 focus:outline-none
              rounded-xl text-sm text-white placeholder-slate-500 transition-all"/>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500
                hover:text-white transition-colors p-1">
              <i className="fa-solid fa-xmark text-xs"/>
            </button>
          )}
        </div>

        {/* Stories Grid */}
        {loading || (activeTab === 'saved' && loadingSaved) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-slate-800/40 rounded-2xl h-64 border border-white/5"/>
            ))}
          </div>
        ) : displayStories.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-slate-700/50 rounded-3xl">
            <i className={`fa-solid fa-${activeTab === 'saved' ? 'bookmark' : 'newspaper'} text-slate-700 text-4xl mb-4 block`}/>
            <h3 className="text-xl font-black text-white mb-2">
              {activeTab === 'saved' ? 'No saved stories yet' : 'No stories found'}
            </h3>
            <p className="text-slate-500 text-sm">
              {activeTab === 'saved'
                ? 'Bookmark stories from The Scoop to find them here anytime.'
                : 'Try a different category filter.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayStories.map(story => (
                <ArchiveCard
                  key={story.story_hash}
                  story={story}
                  onSave={handleSave}
                  onUnsave={handleUnsave}
                  isSaved={savedSet.has(story.story_hash)}
                />
              ))}
            </div>

            {/* Load More — archive tab only */}
            {activeTab === 'archive' && hasMore && (
              <div className="text-center mt-10">
                <button
                  onClick={() => loadStories(activeFilter, lastKey, true)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 mx-auto px-8 py-3 bg-slate-800/60
                    hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30
                    text-white font-black text-xs uppercase tracking-widest rounded-xl
                    transition-all disabled:opacity-50">
                  {loadingMore
                    ? <><div className="w-3.5 h-3.5 border-2 border-current/20 border-t-current rounded-full animate-spin"/>Loading…</>
                    : <><i className="fa-solid fa-chevron-down text-[10px]"/>Load More Stories</>
                  }
                </button>
              </div>
            )}

            {/* Story count */}
            <p className="text-center text-slate-600 text-xs mt-6 font-bold uppercase tracking-widest">
              {searchQuery.trim()
                ? `${filteredStories.length} result${filteredStories.length !== 1 ? 's' : ''} for "${searchQuery}"`
                : activeTab === 'saved'
                  ? `${savedStories.length} saved ${savedStories.length === 1 ? 'story' : 'stories'}`
                  : `${stories.length} stories loaded${hasMore ? ' — more available' : ''}`
              }
            </p>
          </>
        )}
      </div>
      <Footer/>
    </div>
  )
}
