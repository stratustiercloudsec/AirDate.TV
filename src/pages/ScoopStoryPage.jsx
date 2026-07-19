// src/pages/ScoopStoryPage.jsx — v2.0
// Pro paywall: free users see hero + lede + key facts, then gate
// Pro users: full story + bookmark button
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'
import { Footer } from '@/components/layout/Footer'

const STORY_BASE = import.meta.env.VITE_STORY_BASE || 'https://airdate.tv/scoop/stories/'
const MANIFEST_URL = import.meta.env.VITE_SCOOP_MANIFEST_URL || 'https://airdate.tv/scoop/stories.json'

const CATS = {
  premieres:     { label:'Premiere Dates',     icon:'calendar-star', color:'#22d3ee' },
  renewals:      { label:'Renewals',           icon:'rotate',        color:'#4ade80' },
  cancellations: { label:'Cancellations',      icon:'ban',           color:'#f87171' },
  casting:       { label:'Casting News',       icon:'user-plus',     color:'#c084fc' },
  production:    { label:'Production Updates', icon:'clapperboard',  color:'#fb923c' },
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso), diff = Date.now() - d.getTime()
    const h = Math.floor(diff/3600000), days = Math.floor(diff/86400000)
    if (h < 1) return 'Just now'
    if (h < 24) return `${h}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  } catch { return '' }
}

function CatBadge({ cat, small }) {
  const conf = CATS[cat] || CATS.premieres
  return (
    <span
      className={`inline-flex items-center gap-1 font-black uppercase tracking-widest rounded-full
        ${small ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'}`}
      style={{background:`${conf.color}20`, color:conf.color, border:`1px solid ${conf.color}30`}}>
      <i className={`fa-solid fa-${conf.icon}`} style={{fontSize:'8px'}}/>
      {conf.label}
    </span>
  )
}

// ── Related Stories sidebar (same-category list, matches /scoop's sidebar pattern) ──
function RelatedListRow({ item, index }) {
  const navigate = useNavigate()
  const cat    = item.category || 'premieres'
  const poster = item.image_url || item.poster_url || item.poster
  return (
    <article
      onClick={() => item.story_hash && navigate(`/scoop/${item.story_hash}`)}
      className="group flex gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/5"
    >
      <span className="text-2xl font-black text-slate-700 w-6 shrink-0 leading-tight mt-0.5"
        style={{fontVariantNumeric:'tabular-nums'}}>
        {String(index+1).padStart(2,'0')}
      </span>
      {poster && (
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
          <img src={poster} onError={e => { e.currentTarget.style.display="none"; e.currentTarget.parentElement.classList.add("no-image") }} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"/>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="mb-1"><CatBadge cat={cat} small/></div>
        <h4 className="text-white text-xs font-bold leading-snug line-clamp-2 group-hover:text-cyan-400 transition-colors">
          {item.headline}
        </h4>
        <p className="text-slate-200 text-[10px] mt-1">{formatTime(item.published_at)}</p>
      </div>
    </article>
  )
}

function RelatedStories({ category, currentHash }) {
  const [related, setRelated] = useState([])
  const [loading,  setLoading] = useState(true)

  useEffect(() => {
    fetch(`${MANIFEST_URL}?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        const items = (data.items || [])
          .filter(i => i.story_hash && i.headline && i.story_hash !== currentHash)
          .filter(i => (i.category || 'production') === category)
        items.sort((a,b) => new Date(b.published_at||0) - new Date(a.published_at||0))
        setRelated(items.slice(0, 8))
      })
      .catch(() => setRelated([]))
      .finally(() => setLoading(false))
  }, [category, currentHash])

  const conf = CATS[category] || CATS.production

  if (loading) return (
    <div className="space-y-3">
      {Array.from({length: 4}).map((_, i) => (
        <div key={i} className="animate-pulse flex gap-3 p-3">
          <div className="w-6 h-4 bg-slate-800 rounded"/>
          <div className="w-14 h-14 bg-slate-800 rounded-lg flex-shrink-0"/>
          <div className="flex-1"><div className="h-3 bg-slate-800 rounded w-full mb-2"/><div className="h-2 bg-slate-800 rounded w-2/3"/></div>
        </div>
      ))}
    </div>
  )

  if (!related.length) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <i className={`fa-solid fa-${conf.icon}`} style={{color:conf.color, fontSize:'12px'}}/>
        <h3 className="text-white font-black text-xs uppercase tracking-widest">More {conf.label}</h3>
      </div>
      <div className="space-y-1">
        {related.map((item, i) => <RelatedListRow key={item.story_hash} item={item} index={i}/>)}
      </div>
    </div>
  )
}

function renderMarkdown(md) {
  if (!md) return ''
  return md.split(/\n\n+/).map(block => {
    if (/^###\s/.test(block))
      return `<h3 class="text-white font-black text-lg mt-6 mb-2">${block.replace(/^###\s+/,'')}</h3>`
    if (/^##\s/.test(block))
      return `<h2 class="text-white font-black text-xl mt-8 mb-3">${block.replace(/^##\s+/,'')}</h2>`
    if (/^#\s/.test(block))
      return `<h1 class="text-white font-black text-2xl mt-8 mb-3">${block.replace(/^#\s+/,'')}</h1>`
    const html = block
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,"<strong class='text-white font-bold'>$1</strong>")
      .replace(/\*(.+?)\*/g,"<em class='italic'>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        `<a href="$2" target="_blank" rel="noopener noreferrer" class="text-cyan-400 underline hover:text-cyan-300 transition-colors">$1</a>`)
    return `<p class="text-slate-300 text-base leading-relaxed mb-4">${html}</p>`
  }).join('\n')
}

// ── Pro Paywall Card ─────────────────────────────────────────────────────────
function ProPaywall({ headline }) {
  const navigate = useNavigate()
  return (
    <div className="relative my-10">
      {/* Fade-out overlay on last visible content */}
      <div className="absolute -top-24 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-slate-950 pointer-events-none z-10"/>
      <div className="relative z-20 bg-slate-900/80 border border-cyan-500/20 rounded-3xl p-8 text-center backdrop-blur-sm">
        <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <i className="fa-solid fa-lock text-cyan-400 text-xl"/>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
          <i className="fa-solid fa-sparkles text-[9px]"/> AirDate TV Original
        </span>
        <h3 className="text-white font-black text-xl mb-3">
          Full Story Access is a Pro Feature
        </h3>
        <p className="text-slate-200 text-sm leading-relaxed max-w-md mx-auto mb-6">
          This AirDate TV Original is part of our continuously updated editorial intelligence feed.
          Pro subscribers get the full story, the 30-day archive, and personal story bookmarks.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate('/upgrade')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all">
            <i className="fa-solid fa-bolt"/> Upgrade to Pro — $4.99/mo
          </button>
          <button onClick={() => navigate('/scoop')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800/60 hover:bg-slate-800 border border-white/10 text-slate-300 font-black text-xs uppercase tracking-widest rounded-xl transition-all">
            ← Back to The Scoop
          </button>
        </div>
        <p className="text-slate-600 text-[10px] mt-5">
          Already Pro?{' '}
          <Link to="/auth/login" className="text-cyan-600 hover:text-cyan-400 transition-colors">Sign in to continue reading →</Link>
        </p>
      </div>
    </div>
  )
}

// ── Bookmark Button ──────────────────────────────────────────────────────────
function BookmarkButton({ story, token, userSub }) {
  const [saved,    setSaved]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [checking, setChecking] = useState(true)

  // Check if already saved on mount
  useEffect(() => {
    if (!token || !userSub || !story?.story_hash) { setChecking(false); return }
    fetch(`${API_BASE}/user/${userSub}/saved-stories`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : { saved_stories: [] })
      .then(d => {
        const list = d.saved_stories || []
        setSaved(list.some(s => s.story_hash === story.story_hash))
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [token, userSub, story?.story_hash])

  async function toggle() {
    if (!token || !userSub || loading) return
    setLoading(true)
    try {
      if (saved) {
        await fetch(`${API_BASE}/user/${userSub}/saved-stories/${story.story_hash}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        })
        setSaved(false)
      } else {
        await fetch(`${API_BASE}/user/${userSub}/saved-stories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            story_hash:   story.story_hash,
            headline:     story.headline,
            category:     story.category,
            published_at: story.published_at,
            image_url:    story.image_url || null,
            show_title:   story.show_title || null,
            source_domain: story.source_domain || null,
          })
        })
        setSaved(true)
      }
    } catch (e) {
      console.warn('Bookmark error:', e)
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <button onClick={toggle} disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
        saved
          ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
          : 'bg-slate-800/60 border-white/10 text-slate-300 hover:border-cyan-500/30 hover:text-cyan-400'
      } disabled:opacity-50`}>
      <i className={`fa-${saved ? 'solid' : 'regular'} fa-bookmark text-xs`}/>
      {loading ? 'Saving…' : saved ? 'Saved' : 'Save Story'}
    </button>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function ScoopStoryPage() {
  const { hash }    = useParams()
  const navigate    = useNavigate()
  const { user, token, isAuthenticated } = useAuth()

  const isPro = user?.tier === 'pro' || user?.tier === 'premium'

  const [story,  setStory]  = useState(null)
  const [error,  setError]  = useState(null)

  useEffect(() => {
    // Step 1: fetch manifest first (single source of truth for metadata)
    // Step 2: fetch individual story file for full body
    // Step 3: merge — story file body + manifest image_url
    Promise.all([
      fetch(`${STORY_BASE}${hash}.json?t=${Date.now()}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${MANIFEST_URL}?t=${Date.now()}`).then(r => r.json()).catch(() => ({ items: [] }))
    ])
      .then(([storyFile, manifest]) => {
        const manifestItem = (manifest.items || []).find(s => s.story_hash === hash)
        if (!storyFile && !manifestItem) throw new Error('Story not found')
        // Merge: prefer storyFile for body/content, manifest for image_url
        const merged = {
          ...(manifestItem || {}),
          ...(storyFile || {}),
          image_url: (storyFile?.image_url) || (manifestItem?.image_url) || null,
          image_source: (storyFile?.image_source) || (manifestItem?.image_source) || null,
        }
        if (!merged.headline) throw new Error('Story not found')
        return merged
      })
      .then(setStory)
      .catch(e => setError(e.message))
  }, [hash])

  if (error) return (
    <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center gap-4">
      <i className="fa-solid fa-circle-exclamation text-red-400 text-4xl"/>
      <p className="text-white font-black text-xl">Story not found</p>
      <button onClick={() => navigate('/scoop')} className="text-cyan-400 text-sm hover:underline">
        ← Back to The Scoop
      </button>
    </div>
  )

  if (!story) return (
    <div className="bg-slate-950 min-h-screen flex items-center justify-center">
      <div className="flex gap-1">
        {[0, 0.15, 0.3].map(d => (
          <span key={d} className="w-3 h-3 rounded-full bg-cyan-400 animate-bounce"
            style={{ animationDelay: `${d}s` }}/>
        ))}
      </div>
    </div>
  )

  const cat      = story.category || 'production'
  const conf     = CATS[cat] || CATS.production
  const keyFacts = story.key_facts || []

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-7xl mx-auto px-6 pt-24 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <main className="lg:col-span-2">

        {/* Back + Archive nav */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate('/scoop')}
            className="flex items-center gap-2 text-slate-200 hover:text-white text-sm transition-colors group">
            <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"/>
            Back to The Scoop
          </button>
          {isPro && (
            <button onClick={() => navigate('/scoop/archive')}
              className="flex items-center gap-2 text-slate-200 hover:text-cyan-400 text-xs font-bold uppercase tracking-widest transition-colors">
              <i className="fa-solid fa-box-archive text-[10px]"/>
              Archive
            </button>
          )}
        </div>

        {/* Hero image */}
        {story.image_url && (
          <div className="relative max-h-[85vh] rounded-2xl overflow-hidden mb-8 bg-slate-900 flex items-center justify-center">
            <img src={story.image_url} alt={story.headline}
              className="w-full h-auto max-h-[85vh] object-contain"/>
            {story.image_source === 'pexels' && (
              <span className="absolute bottom-3 right-3 text-[10px] text-slate-200 bg-slate-950/60 px-2 py-1 rounded-md">
                Photo by Pexels
              </span>
            )}
          </div>
        )}

        {/* Category badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-6"
          style={{ background:`${conf.color}22`, color:conf.color, border:`1px solid ${conf.color}33` }}>
          <i className={`fa-solid fa-${conf.icon} text-[10px]`}/>{conf.label}
        </span>

        {/* Headline */}
        <h1 className="text-white font-black text-3xl sm:text-4xl leading-tight mb-4">
          {story.headline}
        </h1>

        {/* Meta + Bookmark */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex flex-wrap items-center gap-3 text-slate-200 text-sm">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-sparkles text-cyan-400 text-xs"/>
              AirDate Original
            </span>
            <span>·</span>
            <span>{new Date(story.published_at).toLocaleDateString('en-US',{ month:'long', day:'numeric', year:'numeric' })}</span>
            {story.show_title && <><span>·</span><span className="text-cyan-400 font-bold">{story.show_title}</span></>}
          </div>
          {isPro && (
            <BookmarkButton story={story} token={token} userSub={user?.sub}/>
          )}
        </div>

        {/* Lede — always visible */}
        {story.lede && (
          <p className="text-slate-200 text-xl leading-relaxed font-medium border-l-4 border-cyan-400 pl-6 mb-10 italic">
            {story.lede}
          </p>
        )}

        {/* Key facts — always visible */}
        {keyFacts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            {keyFacts.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-800/60 border border-white/8 text-slate-200 text-sm font-semibold">
                <i className="fa-solid fa-check text-cyan-400 text-xs"/>{f}
              </span>
            ))}
          </div>
        )}

        {/* ── Body — Pro only ─────────────────────────────────────────────── */}
        {isPro ? (
          <>
            <div className="mb-12"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(story.body || '') }}/>
            <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button onClick={() => navigate('/scoop')}
                className="bg-cyan-500 text-slate-950 font-black px-8 py-3 rounded-2xl text-sm hover:bg-cyan-400 transition-all">
                ← More from The Scoop
              </button>
              <button onClick={() => navigate('/scoop/archive')}
                className="flex items-center gap-2 text-slate-200 hover:text-cyan-400 text-sm font-bold transition-colors">
                <i className="fa-solid fa-box-archive text-xs"/>
                Browse 30-Day Archive
              </button>
            </div>
          </>
        ) : (
          // ── Paywall for free / unauthenticated users ─────────────────────
          <ProPaywall headline={story.headline}/>
        )}

        </main>

        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <RelatedStories category={cat} currentHash={story.story_hash}/>
          </div>
        </aside>

        </div>
      </div>
      <Footer/>
    </div>
  )
}