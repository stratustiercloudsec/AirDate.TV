// src/pages/ScoopPage.jsx — v3.0
// Agent-powered feed: reads from CloudFront manifest, navigates to /scoop/:hash

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

// ── CloudFront manifest URL (agent publishes here every 4h) ──────────────────
const MANIFEST_URL = 'https://airdate.tv/scoop/stories.json'

const CATS = {
  premieres:     { label:'Premiere Dates',     icon:'calendar-star',  color:'#22d3ee' },
  renewals:      { label:'Renewals',           icon:'rotate',         color:'#4ade80' },
  cancellations: { label:'Cancellations',      icon:'ban',            color:'#f87171' },
  casting:       { label:'Casting News',       icon:'user-plus',      color:'#c084fc' },
  production:    { label:'Production Updates', icon:'clapperboard',   color:'#fb923c' },
}

const SOURCE_COLORS = {
  'variety.com':           '#9b59b6',
  'deadline.com':          '#e74c3c',
  'hollywoodreporter.com': '#3498db',
  'ew.com':                '#2ecc71',
  'tvline.com':            '#f39c12',
  'indiewire.com':         '#1abc9c',
  'thewrap.com':           '#e67e22',
  'blexmedia.com':         '#f59e0b',
  'collider.com':          '#8b5cf6',
  'vulture.com':           '#ec4899',
}

function formatSource(s) {
  return (s||'')
    .replace('variety.com','Variety')
    .replace('deadline.com','Deadline')
    .replace('hollywoodreporter.com','THR')
    .replace('tvline.com','TVLine')
    .replace('indiewire.com','IndieWire')
    .replace('thewrap.com','The Wrap')
    .replace('ew.com','EW')
    .replace('blexmedia.com','Blex Media')
    .replace('collider.com','Collider')
    .replace('vulture.com','Vulture')
    .replace(/\.com$/,'')
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    const d    = new Date(iso)
    const diff = Date.now() - d.getTime()
    const h    = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (h < 1)   return 'Just now'
    if (h < 24)  return `${h}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', {month:'short', day:'numeric'})
  } catch { return '' }
}

// ─── Category badge ───────────────────────────────────────────────────────────
function CatBadge({ cat }) {
  const conf = CATS[cat] || CATS.premieres
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider"
      style={{background:`${conf.color}22`, color:conf.color, border:`1px solid ${conf.color}33`}}>
      <i className={`fa-solid fa-${conf.icon} text-[10px]`}></i>{conf.label}
    </span>
  )
}

// ─── Story card — navigates to /scoop/:hash ───────────────────────────────────
function ScoopCard({ item }) {
  const navigate  = useNavigate()
  const cat       = item.category || 'premieres'
  const conf      = CATS[cat] || CATS.premieres
  const srcColor  = SOURCE_COLORS[item.source_domain || item.domain] || '#475569'
  const srcLabel  = formatSource(item.source_domain || item.domain || '')
  const timeAgo   = formatTime(item.published_at)
  const poster    = item.image_url || item.poster_url || item.poster

  const handleClick = () => {
    if (item.story_hash) {
      navigate(`/scoop/${item.story_hash}`)
    }
  }

  return (
    <article
      className="group bg-slate-900/50 border border-white/5 hover:border-cyan-500/20 rounded-3xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col hover:bg-slate-900/80 hover:-translate-y-0.5"
      onClick={handleClick}
    >
      {poster ? (
        <div className="relative h-40 overflow-hidden flex-shrink-0">
          <img src={poster} alt={item.show_title||''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent"></div>
          <div className="absolute top-3 left-3"><CatBadge cat={cat}/></div>
          {item.show_title && (
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-white font-black text-sm leading-tight line-clamp-1 drop-shadow">{item.show_title}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="h-14 flex-shrink-0 flex items-center px-5 pt-4">
          <CatBadge cat={cat}/>
        </div>
      )}

      <div className={`flex flex-col flex-1 p-5 ${poster ? '' : 'pt-3'}`}>
        <h3 className="text-white font-black text-sm leading-snug line-clamp-3 mb-3 group-hover:text-cyan-400 transition-colors">
          {item.headline}
        </h3>
        {item.summary
          ? <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mb-4 flex-1">{item.summary}</p>
          : <div className="flex-1"></div>
        }
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400">
            <i className="fa-solid fa-sparkles text-[10px]"></i>AirDate Original
          </span>
                    <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">{timeAgo}</span>
            <span className="text-cyan-400 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              Read →
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────
function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({length:8}).map((_,i) => (
        <div key={i}
          className="animate-pulse bg-slate-800/40 rounded-3xl h-72 border border-white/5"
          style={{animationDelay:`${i*0.08}s`}}>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ScoopPage() {
  const [all,         setAll]         = useState([])
  const [feed,        setFeed]        = useState({})
  const [counts,      setCounts]      = useState({})
  const [activeTab,   setActiveTab]   = useState('all')
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [error,       setError]       = useState(null)

  const loadScoop = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch from agent manifest — busted with timestamp to avoid stale cache
      const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data  = await res.json()
      const items = (data.items || []).filter(item =>
        // Only show items from current year or with recent published_at
        item.story_hash && item.headline
      )

      // Sort newest first
      items.sort((a,b) => new Date(b.published_at||0) - new Date(a.published_at||0))

      const grouped = {}
      items.forEach(item => {
        const cat = item.category || 'production'
        if (!grouped[cat]) grouped[cat] = []
        grouped[cat].push(item)
      })

      setAll(items)
      setFeed(grouped)
      setCounts(Object.fromEntries(Object.entries(grouped).map(([k,v]) => [k, v.length])))

      if (data.updated_at) {
        setLastUpdated(new Date(data.updated_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}))
      }
    } catch (e) {
      console.error('Scoop fetch error:', e)
      setError('Could not load stories. The agent may be mid-run — check back in a moment.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on mount
  useEffect(() => { loadScoop() }, [loadScoop])

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(loadScoop, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadScoop])

  const displayed = activeTab === 'all' ? all : (feed[activeTab] || [])

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
              <i className="fa-solid fa-fire text-cyan-400 text-2xl"></i>
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">The Scoop</h1>
              <p className="text-slate-400 text-sm mt-0.5">AI-synthesized TV industry intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-slate-500 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                Updated {lastUpdated}
              </span>
            )}
            <button
              onClick={loadScoop}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              <i className={`fa-solid fa-rotate text-cyan-400 text-xs ${loading ? 'animate-spin' : ''}`}></i>
              Refresh
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
              activeTab === 'all'
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
            }`}
          >
            <i className="fa-solid fa-layer-group text-[10px]"></i>All
            <span className="bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold">{all.length}</span>
          </button>
          {Object.entries(CATS).map(([key, conf]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                activeTab === key ? 'border-current' : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
              }`}
              style={activeTab === key ? {background:`${conf.color}22`, color:conf.color, borderColor:`${conf.color}40`} : {}}
            >
              <i className={`fa-solid fa-${conf.icon} text-[10px]`}></i>{conf.label}
              <span className="bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                {counts[key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonCards/>
        ) : error ? (
          <div className="text-center py-24 border border-dashed border-slate-700/50 rounded-3xl">
            <i className="fa-solid fa-satellite-dish text-slate-600 text-5xl mb-4"></i>
            <h3 className="text-xl font-black text-white mb-2">Agent mid-run</h3>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <button
              onClick={loadScoop}
              className="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-sm hover:bg-cyan-400 transition-all"
            >
              Try Again
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-slate-700/50 rounded-3xl">
            <i className="fa-solid fa-satellite-dish text-slate-600 text-5xl mb-4"></i>
            <h3 className="text-xl font-black text-white mb-2">No stories yet</h3>
            <p className="text-slate-400 text-sm mb-6">The agent runs every 4 hours. Check back soon.</p>
            <button
              onClick={loadScoop}
              className="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-sm hover:bg-cyan-400 transition-all"
            >
              Refresh Feed
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {displayed.map((item, i) => (
              <ScoopCard key={item.story_hash || i} item={item}/>
            ))}
          </div>
        )}

      </div>
      <Footer/>
    </div>
  )
}